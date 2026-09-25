#!/usr/bin/env node

// cli/index.ts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

// cli/lib/cli_builder.ts
function to_snake_case(input) {
  return input.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/-/g, "_").toLowerCase();
}
function parse_option_declaration(option_declaration, option_declaration_config = {}) {
  const parts = option_declaration.split(",").map((part) => part.trim()).filter(Boolean);
  const short_flag = parts.find((part) => /^-[a-zA-Z0-9]\b/.test(part))?.match(/^-([a-zA-Z0-9])/)?.[1];
  const long_flag = parts.find((part) => part.startsWith("--"))?.match(/^--([a-zA-Z][a-zA-Z0-9-]*)/)?.[1];
  const value_placeholder = option_declaration.match(/<([^>]+)>/)?.[1]?.trim();
  const requires_value = value_placeholder !== void 0;
  const repeatable = option_declaration_config.repeatable ?? false;
  const description = option_declaration_config.description?.trim() || void 0;
  const base_name = long_flag ?? short_flag;
  if (!base_name) {
    throw new Error(`Invalid option declaration: "${option_declaration}"`);
  }
  if (repeatable && !requires_value) {
    throw new Error(`Repeatable option must require a value: "${option_declaration}"`);
  }
  return {
    short_flag,
    long_flag,
    option_name: to_snake_case(base_name),
    requires_value,
    repeatable,
    value_placeholder,
    description
  };
}
var Command = class {
  constructor(name, description = "") {
    this.name = name;
    this.description = description;
  }
  name;
  description;
  option_configs = [];
  handler;
  /** Register one option for this command; description is used by built-in help output. */
  option(option_declaration, option_declaration_config = {}) {
    this.option_configs.push(parse_option_declaration(option_declaration, option_declaration_config));
    return this;
  }
  /** Register the command handler called after args/options parsing. */
  action(handler) {
    this.handler = handler;
    return this;
  }
  get options() {
    return this.option_configs;
  }
  async execute(ctx) {
    if (!this.handler) {
      throw new Error(`No action registered for command "${this.name}"`);
    }
    await this.handler(ctx);
  }
};
var CLI = class {
  commands = /* @__PURE__ */ new Map();
  /** Register a command by unique name; its description is shown in built-in help. */
  command(name, description = "") {
    if (this.commands.has(name)) {
      throw new Error(`Command "${name}" is already registered`);
    }
    const cmd = new Command(name, description);
    this.commands.set(name, cmd);
    return cmd;
  }
  /** Run argv like process.argv.slice(2); auto handles -h/--help unless that command defines help manually. */
  async run(argv) {
    const [command_name, ...tokens] = argv;
    if (!command_name) {
      throw new Error("No command provided");
    }
    if (command_name === "-h" || command_name === "--help") {
      console.log(this.build_cli_help());
      return;
    }
    const command = this.commands.get(command_name);
    if (!command) {
      throw new Error(`Unknown command: "${command_name}"`);
    }
    const has_manual_help = this.has_manual_help_option(command.options);
    if (!has_manual_help && this.has_help_token(tokens)) {
      console.log(this.build_command_help(command));
      return;
    }
    const parsed = this.parse_args(tokens, command.options);
    await command.execute({
      command: command_name,
      args: parsed.args,
      options: parsed.options,
      unknown: parsed.unknown,
      raw: argv
    });
  }
  has_manual_help_option(option_configs) {
    return option_configs.some((option_config) => option_config.short_flag === "h" || option_config.long_flag === "help");
  }
  has_help_token(tokens) {
    for (const token of tokens) {
      if (token === "--") return false;
      if (token === "-h" || token === "--help") return true;
    }
    return false;
  }
  format_option_label(option_config) {
    const names = [];
    if (option_config.short_flag) names.push(`-${option_config.short_flag}`);
    if (option_config.long_flag) names.push(`--${option_config.long_flag}`);
    const value_part = option_config.requires_value ? ` <${option_config.value_placeholder || "value"}>` : "";
    return `${names.join(", ")}${value_part}`;
  }
  format_option_description(option_config) {
    const base_description = option_config.description ?? option_config.value_placeholder;
    if (option_config.repeatable) {
      return base_description ? `${base_description} (repeatable)` : "repeatable";
    }
    return base_description;
  }
  build_command_help(command) {
    const option_entries = [...command.options];
    if (!this.has_manual_help_option(command.options)) {
      option_entries.push({
        short_flag: "h",
        long_flag: "help",
        option_name: "help",
        requires_value: false,
        repeatable: false,
        description: "Show help for this command"
      });
    }
    const rows = option_entries.map((option_config) => ({
      label: this.format_option_label(option_config),
      description: this.format_option_description(option_config)
    }));
    const label_width = rows.reduce((max, row) => Math.max(max, row.label.length), 0);
    const option_lines = rows.length === 0 ? ["  (none)"] : rows.map(
      (row) => row.description ? `  ${row.label.padEnd(label_width)}  ${row.description}` : `  ${row.label}`
    );
    const lines = [`Usage: ${command.name} [options] [args]`];
    if (command.description) {
      lines.push("", command.description);
    }
    lines.push("", "Options:", ...option_lines);
    return lines.join("\n");
  }
  build_cli_help() {
    const commands = Array.from(this.commands.values());
    const name_width = commands.reduce((max, command) => Math.max(max, command.name.length), 0);
    const command_lines = commands.map(
      (command) => command.description ? `  ${command.name.padEnd(name_width)}  ${command.description}` : `  ${command.name}`
    );
    return [
      "Usage: <command> [options] [args]",
      "",
      "Commands:",
      ...command_lines,
      "",
      'Run "<command> --help" for command details.'
    ].join("\n");
  }
  parse_args(tokens, option_configs) {
    const args = [];
    const options = {};
    const unknown = [];
    const assign_option = (option_config, value) => {
      if (!option_config.repeatable) {
        options[option_config.option_name] = value;
        return;
      }
      if (typeof value !== "string") {
        throw new Error(`Repeatable option "${option_config.option_name}" must have string values`);
      }
      const existing = options[option_config.option_name];
      if (existing === void 0) {
        options[option_config.option_name] = [value];
        return;
      }
      if (Array.isArray(existing)) {
        existing.push(value);
        return;
      }
      if (typeof existing === "string") {
        options[option_config.option_name] = [existing, value];
        return;
      }
      throw new Error(`Repeatable option "${option_config.option_name}" has invalid existing value`);
    };
    const short_map = new Map(
      option_configs.filter((config) => config.short_flag).map((config) => [config.short_flag, config])
    );
    const long_map = new Map(
      option_configs.filter((config) => config.long_flag).map((config) => [config.long_flag, config])
    );
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token === "--") {
        args.push(...tokens.slice(i + 1));
        break;
      }
      if (token.startsWith("--")) {
        const option_body = token.slice(2);
        const eq_index = option_body.indexOf("=");
        const colon_index = option_body.indexOf(":");
        const separator_index = eq_index >= 0 && colon_index >= 0 ? Math.min(eq_index, colon_index) : Math.max(eq_index, colon_index);
        const name = separator_index >= 0 ? option_body.slice(0, separator_index) : option_body;
        const inline_value = separator_index >= 0 ? option_body.slice(separator_index + 1) : void 0;
        const option_config = long_map.get(name);
        if (!option_config) {
          unknown.push(token);
          continue;
        }
        if (option_config.requires_value) {
          const value = inline_value ?? tokens[++i];
          if (value === void 0) {
            throw new Error(`Missing value for --${name}`);
          }
          assign_option(option_config, value);
        } else {
          assign_option(option_config, true);
        }
        continue;
      }
      if (/^-[a-zA-Z0-9]$/.test(token)) {
        const name = token[1];
        const option_config = short_map.get(name);
        if (!option_config) {
          unknown.push(token);
          continue;
        }
        if (option_config.requires_value) {
          const value = tokens[++i];
          if (value === void 0) {
            throw new Error(`Missing value for -${name}`);
          }
          assign_option(option_config, value);
        } else {
          assign_option(option_config, true);
        }
        continue;
      }
      args.push(token);
    }
    return { args, options, unknown };
  }
};
var create_cli = () => new CLI();

// cli/index.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var source_root = path.resolve(__dirname, "..");
if (!fs.existsSync(path.join(source_root, "package.json"))) {
  source_root = path.resolve(__dirname, "../..");
}
var IGNORED_EXACT_OR_DIR = [
  "node_modules",
  "dist",
  ".debug",
  "src-tauri/target",
  "src-tauri/gen/schemas",
  "src-tauri/gen/apple/build",
  "src-tauri/gen/apple/Externals",
  ".git",
  ".idea",
  ".vscode",
  "tsconfig.tsbuildinfo",
  "draft",
  "cli/index.ts",
  "cli/lib",
  "cli/dist"
];
var IGNORED_DIR_NAMES = /* @__PURE__ */ new Set([
  "xcuserdata",
  ".idea"
]);
var IGNORED_FILE_NAMES = /* @__PURE__ */ new Set([
  ".DS_Store",
  "Thumbs.db"
]);
function copy_recursive(src, dest, filter) {
  if (!filter(src)) {
    return;
  }
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      copy_recursive(path.join(src, entry), path.join(dest, entry), filter);
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}
function to_kebab_case(str) {
  return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/[_\s]+/g, "-").toLowerCase();
}
function to_title_case(str) {
  return str.replace(/[_-]+/g, " ").replace(/\b[a-z]/g, (char) => char.toUpperCase());
}
function to_valid_identifier(str) {
  return str.toLowerCase().replace(/[^a-z0-9.]/g, "");
}
function detect_package_manager() {
  const user_agent = process.env.npm_config_user_agent || "";
  if (user_agent.startsWith("pnpm")) return "pnpm";
  if (user_agent.startsWith("yarn")) return "yarn";
  if (user_agent.startsWith("bun")) return "bun";
  return "npm";
}
async function prompt_text(rl, question, default_val) {
  const display = default_val ? `${question} (${default_val}): ` : `${question}: `;
  const answer = (await rl.question(display)).trim();
  return answer || (default_val ?? "");
}
async function prompt_confirm(rl, question, default_yes = true) {
  const hint = default_yes ? "(Y/n)" : "(y/N)";
  const answer = (await rl.question(`${question} ${hint}: `)).trim().toLowerCase();
  if (!answer) return default_yes;
  return answer === "y" || answer === "yes";
}
async function handle_create_project(ctx) {
  const is_interactive = Boolean(stdin.isTTY && !ctx.options.yes);
  const rl = is_interactive ? readline.createInterface({ input: stdin, output: stdout }) : null;
  try {
    let target_arg = ctx.args[0];
    if (!target_arg) {
      if (rl) {
        target_arg = await prompt_text(rl, "? Project directory or name", "my-nextkit-app");
      } else {
        target_arg = "my-nextkit-app";
      }
    }
    const dest_path = path.resolve(process.cwd(), target_arg);
    const folder_name = path.basename(dest_path);
    const kebab_name = to_kebab_case(folder_name);
    const force = Boolean(ctx.options.force);
    if (fs.existsSync(dest_path)) {
      const entries = fs.readdirSync(dest_path);
      if (entries.length > 0) {
        if (force) {
          console.log(`[nextkit] Target directory exists, removing due to force flag: ${dest_path}`);
          fs.rmSync(dest_path, { recursive: true, force: true });
        } else if (rl) {
          const should_overwrite = await prompt_confirm(
            rl,
            `! Target directory "${folder_name}" is not empty. Overwrite?`,
            false
          );
          if (!should_overwrite) {
            console.log("[nextkit] Operation cancelled.");
            return;
          }
          console.log(`[nextkit] Removing existing directory: ${dest_path}`);
          fs.rmSync(dest_path, { recursive: true, force: true });
        } else {
          throw new Error(`Target directory already exists and is not empty: ${dest_path}. Use -f or --force to overwrite.`);
        }
      }
    }
    const default_title = to_title_case(folder_name);
    let title = ctx.options.title;
    if (!title) {
      if (rl) {
        title = await prompt_text(rl, "? App display title", default_title);
      } else {
        title = default_title;
      }
    }
    const default_identifier = `com.example.${kebab_name.replace(/-/g, "")}`;
    let identifier = ctx.options.identifier;
    if (!identifier) {
      if (rl) {
        identifier = await prompt_text(rl, "? Tauri bundle identifier", default_identifier);
      } else {
        identifier = default_identifier;
      }
    }
    identifier = to_valid_identifier(identifier);
    let port = ctx.options.port;
    if (!port) {
      if (rl) {
        port = await prompt_text(rl, "? Development server port", "4000");
      } else {
        port = "4000";
      }
    }
    const description = ctx.options.description || "A cross-platform application built with Nextkit";
    let should_git = true;
    if (ctx.options.no_git) {
      should_git = false;
    } else if (ctx.options.git) {
      should_git = true;
    } else if (rl) {
      should_git = await prompt_confirm(rl, "? Initialize a git repository?", true);
    }
    const pkg_manager = detect_package_manager();
    let should_install = false;
    if (ctx.options.no_install) {
      should_install = false;
    } else if (ctx.options.install) {
      should_install = true;
    } else if (rl) {
      should_install = await prompt_confirm(rl, `? Install dependencies with ${pkg_manager}?`, true);
    }
    console.log(`
[nextkit] Initializing new Nextkit project:`);
    console.log(`  * Directory:   ${dest_path}`);
    console.log(`  * Package:     ${kebab_name}`);
    console.log(`  * Title:       ${title}`);
    console.log(`  * Identifier:  ${identifier}`);
    console.log(`  * Port:        ${port}
`);
    console.log("[nextkit] Copying template files...");
    fs.mkdirSync(dest_path, { recursive: true });
    const filter = (src) => {
      const file_name = path.basename(src);
      if (IGNORED_FILE_NAMES.has(file_name)) return false;
      const relative = path.relative(source_root, src);
      if (!relative) return true;
      const segments = relative.split(path.sep);
      if (segments.some((seg) => IGNORED_DIR_NAMES.has(seg))) return false;
      const normalized_relative = segments.join("/");
      return !IGNORED_EXACT_OR_DIR.some((ignored) => {
        return normalized_relative === ignored || normalized_relative.startsWith(ignored + "/");
      });
    };
    copy_recursive(source_root, dest_path, filter);
    console.log("[nextkit] Configuring project metadata...");
    const pkg_path = path.join(dest_path, "package.json");
    if (fs.existsSync(pkg_path)) {
      const pkg = JSON.parse(fs.readFileSync(pkg_path, "utf-8"));
      pkg.name = kebab_name;
      pkg.title = title;
      pkg.description = description;
      pkg.version = "0.1.0";
      delete pkg.bin;
      if (pkg.scripts) {
        delete pkg.scripts.cli;
        delete pkg.scripts["build:cli"];
        delete pkg.scripts.create;
        delete pkg.scripts.prepare;
        if (typeof pkg.scripts.dev === "string") {
          pkg.scripts.dev = pkg.scripts.dev.replace(/--port=\d+/g, `--port=${port}`);
        }
        if (typeof pkg.scripts.start === "string") {
          pkg.scripts.start = pkg.scripts.start.replace(/--port \d+/g, `--port ${port}`);
        }
      }
      fs.writeFileSync(pkg_path, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
    }
    const lock_path = path.join(dest_path, "package-lock.json");
    if (fs.existsSync(lock_path)) {
      const lock = JSON.parse(fs.readFileSync(lock_path, "utf-8"));
      if (lock.name) lock.name = kebab_name;
      if (lock.packages && lock.packages[""]) {
        lock.packages[""].name = kebab_name;
        lock.packages[""].title = title;
        lock.packages[""].description = description;
        lock.packages[""].version = "0.1.0";
      }
      fs.writeFileSync(lock_path, JSON.stringify(lock, null, 2) + "\n", "utf-8");
    }
    const manifest_path = path.join(dest_path, "public/manifest.json");
    if (fs.existsSync(manifest_path)) {
      const manifest = JSON.parse(fs.readFileSync(manifest_path, "utf-8"));
      manifest.name = title;
      manifest.short_name = title;
      manifest.description = description;
      fs.writeFileSync(manifest_path, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
    }
    const tauri_conf_path = path.join(dest_path, "src-tauri/tauri.conf.json");
    if (fs.existsSync(tauri_conf_path)) {
      const conf = JSON.parse(fs.readFileSync(tauri_conf_path, "utf-8"));
      conf.productName = title;
      conf.identifier = identifier;
      if (conf.build) {
        conf.build.devUrl = `http://localhost:${port}`;
      }
      if (conf.app && Array.isArray(conf.app.windows)) {
        for (const win of conf.app.windows) {
          if (win.label === "main" || conf.app.windows.length === 1) {
            win.title = title;
          }
        }
      }
      fs.writeFileSync(tauri_conf_path, JSON.stringify(conf, null, 2) + "\n", "utf-8");
    }
    const cargo_path = path.join(dest_path, "src-tauri/Cargo.toml");
    if (fs.existsSync(cargo_path)) {
      let cargo_content = fs.readFileSync(cargo_path, "utf-8");
      cargo_content = cargo_content.replace(
        /description = ".*?"/,
        `description = "${description.replace(/"/g, '\\"')}"`
      );
      fs.writeFileSync(cargo_path, cargo_content, "utf-8");
    }
    const index_html_path = path.join(dest_path, "src/app/index.html");
    if (fs.existsSync(index_html_path)) {
      let html_content = fs.readFileSync(index_html_path, "utf-8");
      html_content = html_content.replace(/<title>.*?<\/title>/, `<title>${title}</title>`).replace(/<meta name="description" content=".*?" \/>/, `<meta name="description" content="${description}" />`).replace(/<meta property="og:title" content=".*?" \/>/, `<meta property="og:title" content="${title}" />`).replace(/<meta property="og:description" content=".*?" \/>/, `<meta property="og:description" content="${description}" />`);
      fs.writeFileSync(index_html_path, html_content, "utf-8");
    }
    const native_index_html_path = path.join(dest_path, "src/app/native_entry/index.html");
    if (fs.existsSync(native_index_html_path)) {
      let native_html = fs.readFileSync(native_index_html_path, "utf-8");
      native_html = native_html.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);
      fs.writeFileSync(native_index_html_path, native_html, "utf-8");
    }
    const app_tsx_path = path.join(dest_path, "src/app/App.tsx");
    if (fs.existsSync(app_tsx_path)) {
      let app_content = fs.readFileSync(app_tsx_path, "utf-8");
      app_content = app_content.replace(/Hello from Nextkit!/g, `Hello from ${title}!`);
      fs.writeFileSync(app_tsx_path, app_content, "utf-8");
    }
    const project_yml_path = path.join(dest_path, "src-tauri/gen/apple/project.yml");
    if (fs.existsSync(project_yml_path)) {
      let yml_content = fs.readFileSync(project_yml_path, "utf-8");
      yml_content = yml_content.replace(/bundleIdPrefix: .*/, `bundleIdPrefix: ${identifier}`).replace(/PRODUCT_NAME: .*/, `PRODUCT_NAME: ${title}`).replace(/PRODUCT_BUNDLE_IDENTIFIER: .*/, `PRODUCT_BUNDLE_IDENTIFIER: ${identifier}`);
      fs.writeFileSync(project_yml_path, yml_content, "utf-8");
    }
    const pbxproj_path = path.join(dest_path, "src-tauri/gen/apple/app.xcodeproj/project.pbxproj");
    if (fs.existsSync(pbxproj_path)) {
      let pbx_content = fs.readFileSync(pbxproj_path, "utf-8");
      pbx_content = pbx_content.replaceAll("PRODUCT_BUNDLE_IDENTIFIER = com.xsolutiontech.nextkit;", `PRODUCT_BUNDLE_IDENTIFIER = ${identifier};`).replaceAll("PRODUCT_NAME = Nextkit;", `PRODUCT_NAME = ${title};`).replaceAll("Nextkit.app", `${title}.app`);
      fs.writeFileSync(pbxproj_path, pbx_content, "utf-8");
    }
    const scheme_path = path.join(dest_path, "src-tauri/gen/apple/app.xcodeproj/xcshareddata/xcschemes/app_iOS.xcscheme");
    if (fs.existsSync(scheme_path)) {
      let scheme_content = fs.readFileSync(scheme_path, "utf-8");
      scheme_content = scheme_content.replaceAll('BuildableName = "Nextkit.app"', `BuildableName = "${title}.app"`);
      fs.writeFileSync(scheme_path, scheme_content, "utf-8");
    }
    if (should_git) {
      try {
        execSync("git init", { cwd: dest_path, stdio: "ignore" });
        console.log("[nextkit] Initialized a new Git repository.");
      } catch {
        console.log("[nextkit] Warning: Failed to initialize Git repository.");
      }
    }
    if (should_install) {
      console.log(`[nextkit] Installing dependencies via ${pkg_manager}...`);
      try {
        execSync(`${pkg_manager} install`, { cwd: dest_path, stdio: "inherit" });
        console.log("[nextkit] Dependencies installed successfully.");
      } catch {
        console.log(`[nextkit] Warning: Failed to install dependencies via ${pkg_manager}.`);
      }
    }
    console.log(`
[nextkit] Project initialized successfully at ${dest_path}`);
    console.log("\nTo get started:");
    const relative_dest = path.relative(process.cwd(), dest_path);
    if (relative_dest && relative_dest !== ".") {
      console.log(`  cd ${relative_dest}`);
    }
    if (!should_install) {
      console.log(`  ${pkg_manager} install`);
    }
    console.log(`  ${pkg_manager} run dev          # Start web dev server and SW watcher`);
    console.log(`  ${pkg_manager} run tauri dev    # Start native desktop app`);
    console.log("");
  } finally {
    if (rl) {
      rl.close();
    }
  }
}
async function main() {
  const cli = create_cli();
  cli.command("create", "Create a new Nextkit project from this template.\n\nPositionals:\n  <directory>               Target directory path where the project will be created (e.g. '../my-app')").option("-t, --title <title>", { description: "App display title (e.g. 'My App')" }).option("-i, --identifier <id>", { description: "Tauri bundle identifier (e.g. 'com.company.app')" }).option("-d, --description <desc>", { description: "Project description" }).option("-p, --port <port>", { description: "Development server port (default: 4000)" }).option("-f, --force", { description: "Force overwrite target directory if it exists" }).option("-y, --yes", { description: "Skip prompts and use defaults" }).option("-g, --git", { description: "Initialize a git repository" }).option("--no-git", { description: "Do not initialize a git repository" }).option("--install", { description: "Install dependencies automatically" }).option("--no-install", { description: "Do not install dependencies" }).action(handle_create_project);
  cli.command("init", "Alias for create").option("-t, --title <title>", { description: "App display title (e.g. 'My App')" }).option("-i, --identifier <id>", { description: "Tauri bundle identifier (e.g. 'com.company.app')" }).option("-d, --description <desc>", { description: "Project description" }).option("-p, --port <port>", { description: "Development server port (default: 4000)" }).option("-f, --force", { description: "Force overwrite target directory if it exists" }).option("-y, --yes", { description: "Skip prompts and use defaults" }).option("-g, --git", { description: "Initialize a git repository" }).option("--no-git", { description: "Do not initialize a git repository" }).option("--install", { description: "Install dependencies automatically" }).option("--no-install", { description: "Do not install dependencies" }).action(handle_create_project);
  cli.command("clean", "Clean up generated files and caches").action(() => {
    const targets = [
      "dist",
      ".debug",
      "node_modules",
      "src-tauri/target",
      "src-tauri/gen/schemas",
      "src-tauri/gen/apple/build",
      "src-tauri/gen/apple/Externals",
      "src-tauri/gen/apple/app.xcodeproj/project.xcworkspace/xcuserdata",
      "src-tauri/gen/apple/app.xcodeproj/xcuserdata",
      "tsconfig.tsbuildinfo"
    ];
    console.log("[nextkit] Cleaning up project caches...");
    for (const target of targets) {
      const target_path = path.resolve(source_root, target);
      if (fs.existsSync(target_path)) {
        console.log(`[nextkit] Removing ${target}...`);
        fs.rmSync(target_path, { recursive: true, force: true });
      }
    }
    console.log("[nextkit] Project cleaned successfully.");
  });
  const raw_args = process.argv.slice(2);
  const first_arg = raw_args[0];
  const is_known_command = Boolean(first_arg && ["create", "init", "clean", "-h", "--help"].includes(first_arg));
  const args_to_run = is_known_command ? raw_args : ["create", ...raw_args];
  await cli.run(args_to_run);
}
main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[nextkit] Error: ${message}`);
  process.exitCode = 1;
});
