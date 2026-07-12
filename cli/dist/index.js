#!/usr/bin/env node

// cli/index.ts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync, spawn } from "node:child_process";

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
var IGNORED_PATHS = [
  "node_modules",
  ".next",
  "out",
  "src-tauri/target",
  ".git",
  ".idea",
  ".DS_Store",
  "tsconfig.tsbuildinfo",
  "draft",
  "cli"
];
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
  const clean = str.toLowerCase().replace(/[^a-z0-9.]/g, "");
  return clean;
}
async function main() {
  const cli = create_cli();
  cli.command("init", "Create a new Nextkit project from this template.\n\nPositionals:\n  <directory>               Target directory path where the project will be created (e.g. '../my-app')").option("-t, --title <title>", { description: "App display title (e.g. 'My App')" }).option("-i, --identifier <id>", { description: "Tauri bundle identifier (e.g. 'com.company.app')" }).option("-d, --description <desc>", { description: "Project description" }).option("-p, --port <port>", { description: "Development server port (default: 4000)" }).option("-f, --force", { description: "Force overwrite target directory if it exists" }).action((ctx) => {
    const [target_arg] = ctx.args;
    if (!target_arg) {
      throw new Error("Missing target directory argument: nextkit init <directory>");
    }
    const dest_path = path.resolve(process.cwd(), target_arg);
    const folder_name = path.basename(dest_path);
    const kebab_name = to_kebab_case(folder_name);
    const title = ctx.options.title ?? to_title_case(folder_name);
    const identifier = ctx.options.identifier ?? `com.example.${kebab_name.replace(/-/g, "")}`;
    const description = ctx.options.description ?? "A cross-platform native application built with Nextkit";
    const port = ctx.options.port ?? "4000";
    const force = !!ctx.options.force;
    console.log(`
\u{1F680} Initializing new Nextkit project at: ${dest_path}`);
    console.log(`   * Package Name: ${kebab_name}`);
    console.log(`   * App Title:    ${title}`);
    console.log(`   * Identifier:   ${identifier}`);
    console.log(`   * Description:  ${description}`);
    console.log(`   * Dev Port:     ${port}
`);
    if (fs.existsSync(dest_path)) {
      if (force) {
        console.log(`\u26A0\uFE0F  Target directory exists, removing due to --force...`);
        fs.rmSync(dest_path, { recursive: true, force: true });
      } else {
        throw new Error(`Target directory already exists: ${dest_path}. Use -f or --force to overwrite.`);
      }
    }
    console.log("\u{1F4C2} Copying template files...");
    fs.mkdirSync(dest_path, { recursive: true });
    const filter = (src) => {
      const relative = path.relative(source_root, src);
      if (!relative) return true;
      return !IGNORED_PATHS.some((ignored) => {
        const normalized_ignored = ignored.replace(/\//g, path.sep);
        const normalized_relative = relative.replace(/\//g, path.sep);
        return normalized_relative === normalized_ignored || normalized_relative.startsWith(normalized_ignored + path.sep);
      });
    };
    copy_recursive(source_root, dest_path, filter);
    console.log("\u2699\uFE0F  Configuring identifiers...");
    const pkgPath = path.join(dest_path, "package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      pkg.name = kebab_name;
      pkg.title = title;
      pkg.description = description;
      pkg.version = "0.1.0";
      delete pkg.bin;
      if (pkg.scripts) {
        delete pkg.scripts.cli;
        delete pkg.scripts["build:cli"];
        delete pkg.scripts.prepare;
        if (typeof pkg.scripts.dev === "string") {
          pkg.scripts.dev = pkg.scripts.dev.replace(/-p 4000\b/g, `-p ${port}`);
        }
      }
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
    }
    const lockPath = path.join(dest_path, "package-lock.json");
    if (fs.existsSync(lockPath)) {
      const lock = JSON.parse(fs.readFileSync(lockPath, "utf-8"));
      if (lock.name) lock.name = kebab_name;
      if (lock.packages && lock.packages[""]) {
        lock.packages[""].name = kebab_name;
        lock.packages[""].title = title;
        lock.packages[""].description = description;
        lock.packages[""].version = "0.1.0";
      }
      fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n", "utf-8");
    }
    const manifestPath = path.join(dest_path, "public/manifest.json");
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      manifest.name = title;
      manifest.short_name = title;
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
    }
    const tauriConfPath = path.join(dest_path, "src-tauri/tauri.conf.json");
    if (fs.existsSync(tauriConfPath)) {
      const conf = JSON.parse(fs.readFileSync(tauriConfPath, "utf-8"));
      conf.productName = title;
      conf.identifier = to_valid_identifier(identifier);
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
      fs.writeFileSync(tauriConfPath, JSON.stringify(conf, null, 2) + "\n", "utf-8");
    }
    const pagePath = path.join(dest_path, "src/app/page.tsx");
    if (fs.existsSync(pagePath)) {
      let pageContent = fs.readFileSync(pagePath, "utf-8");
      pageContent = pageContent.replace(/Hello from Nextkit!/g, `Hello from ${title}!`);
      fs.writeFileSync(pagePath, pageContent, "utf-8");
    }
    try {
      execSync("git init", { cwd: dest_path, stdio: "ignore" });
      console.log("\u2728 Initialized a new Git repository.");
    } catch {
      console.log("\u26A0\uFE0F  Failed to initialize Git repository (git command not found).");
    }
    console.log(`
\u{1F389} Project initialized successfully at ${dest_path}`);
    console.log("\nTo get started:");
    console.log(`  cd ${target_arg}`);
    console.log("  npm install");
    console.log("  npm run dev");
    console.log("");
  });
  cli.command("dev", "Start development servers").option("-p, --port <port>", { description: "Next.js dev port (default: 4000)" }).action((ctx) => {
    const port = ctx.options.port ?? "4000";
    console.log("\u{1F680} Starting Nextkit development servers...");
    const sw_proc = spawn("npx", [
      "esbuild",
      "src/sw/main.worker.ts",
      "--bundle",
      "--format=esm",
      "--target=esnext",
      "--outfile=public/sw.js",
      "--watch=forever",
      "--banner:js=// Generated by src/sw/main.worker.ts"
    ], { stdio: "inherit", shell: true });
    const next_proc = spawn("npx", ["next", "dev", "-p", port], { stdio: "inherit", shell: true });
    const cleanup = () => {
      console.log("\nStopping servers...");
      sw_proc.kill();
      next_proc.kill();
      process.exit(0);
    };
    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
  });
  cli.command("clean", "Clean up generated files and caches").action(() => {
    const targets = [
      ".next",
      "out",
      "node_modules",
      "src-tauri/target",
      "src-tauri/gen",
      "tsconfig.tsbuildinfo"
    ];
    console.log("\u{1F9F9} Cleaning up project caches...");
    for (const target of targets) {
      const target_path = path.resolve(source_root, target);
      if (fs.existsSync(target_path)) {
        console.log(`Removing ${target}...`);
        fs.rmSync(target_path, { recursive: true, force: true });
      }
    }
    console.log("\u2728 Project cleaned successfully!");
  });
  await cli.run(process.argv.slice(2));
}
main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\u274C Error: ${message}`);
  process.exitCode = 1;
});
