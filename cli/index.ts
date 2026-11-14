import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { execSync } from "node:child_process"
import readline from "node:readline/promises"
import { stdin, stdout } from "node:process"
import { create_cli, type Command, type CommandContext } from "./lib/cli_builder.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let source_root = path.resolve(__dirname, "..")
if (!fs.existsSync(path.join(source_root, "package.json"))) {
    source_root = path.resolve(__dirname, "../..")
}

const IGNORED_EXACT_OR_DIR = [
    "node_modules",
    "dist",
    ".debug",
    "target",
    "src-tauri/target",
    "src-tauri/gen/schemas",
    "src-tauri/gen/apple/build",
    "src-tauri/gen/apple/Externals",
    ".git",
    ".idea",
    "tsconfig.tsbuildinfo",
    "frontend/tsconfig.tsbuildinfo",
    "draft",
    "cli/index.ts",
    "cli/lib",
    "cli/dist"
]

const IGNORED_DIR_NAMES = new Set(["xcuserdata", ".idea"])

const IGNORED_FILE_NAMES = new Set([".DS_Store", "Thumbs.db"])

function copy_recursive(src: string, dest: string, filter: (s: string) => boolean) {
    if (!filter(src)) {
        return
    }
    const stat = fs.statSync(src)
    if (stat.isDirectory()) {
        fs.mkdirSync(dest, { recursive: true })
        const entries = fs.readdirSync(src)
        for (const entry of entries) {
            copy_recursive(path.join(src, entry), path.join(dest, entry), filter)
        }
    } else {
        fs.copyFileSync(src, dest)
    }
}

function to_kebab_case(str: string): string {
    return str
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .replace(/[_\s]+/g, "-")
        .toLowerCase()
}

function to_title_case(str: string): string {
    return str.replace(/[_-]+/g, " ").replace(/\b[a-z]/g, (char) => char.toUpperCase())
}

function to_valid_identifier(str: string): string {
    return str.toLowerCase().replace(/[^a-z0-9.]/g, "")
}

function detect_package_manager(): string {
    const user_agent = process.env.npm_config_user_agent || ""
    if (user_agent.startsWith("pnpm")) return "pnpm"
    if (user_agent.startsWith("yarn")) return "yarn"
    if (user_agent.startsWith("bun")) return "bun"
    return "npm"
}

async function prompt_text(rl: readline.Interface, question: string, default_val?: string): Promise<string> {
    const display = default_val ? `${question} (${default_val}): ` : `${question}: `
    const answer = (await rl.question(display)).trim()
    return answer || (default_val ?? "")
}

async function prompt_confirm(rl: readline.Interface, question: string, default_yes = true): Promise<boolean> {
    const hint = default_yes ? "(Y/n)" : "(y/N)"
    const answer = (await rl.question(`${question} ${hint}: `)).trim().toLowerCase()
    if (!answer) return default_yes
    return answer === "y" || answer === "yes"
}

type ClientMetadata = {
    title: string
    identifier: string
    description: string
    port: string
}

const IGNORED_CLIENT_SCRIPTS = new Set(["cli", "build:cli", "create", "attach", "prepare"])

const ATTACH_COPY_DIRS = ["frontend", "src-tauri", "public", "scripts", "cli/debug"]

const ATTACH_COPY_FILES = [
    "vite.config.ts",
    "postcss.config.mjs",
    "oxlint.rules.mjs",
    ".oxlintrc.json",
    ".oxfmtrc.json"
]

const ATTACH_OPTIONAL_FILES = ["Cargo.toml", "AGENTS.md"]

const ATTACH_GITIGNORE_ENTRIES = [
    "/dist/",
    "/target/",
    "/public/sw.js",
    "/public/debug_bridge.js",
    "/.debug",
    "*.tsbuildinfo"
]

function create_copy_filter(base_root: string, ignored_exact_or_dir: string[]) {
    return (src: string) => {
        const file_name = path.basename(src)
        if (IGNORED_FILE_NAMES.has(file_name)) return false

        const relative = path.relative(base_root, src)
        if (!relative) return true

        const segments = relative.split(path.sep)
        if (segments.some((seg) => IGNORED_DIR_NAMES.has(seg))) return false

        const normalized_relative = segments.join("/")
        return !ignored_exact_or_dir.some((ignored) => {
            return normalized_relative === ignored || normalized_relative.startsWith(ignored + "/")
        })
    }
}

function sanitize_client_scripts(
    scripts: Record<string, string>,
    port: string,
    include_src_in_tools: boolean
): Record<string, string> {
    const cleaned: Record<string, string> = {}
    for (const [key, raw_val] of Object.entries(scripts)) {
        if (IGNORED_CLIENT_SCRIPTS.has(key)) continue
        let val = raw_val
        if (key === "dev") {
            val = val.replace(/--port=\d+/g, `--port=${port}`)
        } else if (key === "start") {
            val = val.replace(/--port \d+/g, `--port ${port}`)
        } else if (include_src_in_tools) {
            if (key === "lint" || key === "check") {
                val = val.replace(/\boxlint frontend cli\b/, "oxlint src frontend cli")
            } else if (key === "format" || key === "format:check") {
                val = val.replace(/\boxfmt (--check )?frontend cli\b/, "oxfmt $1src frontend cli")
            }
        }
        cleaned[key] = val
    }
    return cleaned
}

async function resolve_client_metadata(
    rl: readline.Interface | null,
    ctx: CommandContext,
    defaults: { base_name: string; default_description: string }
): Promise<ClientMetadata> {
    const kebab_name = to_kebab_case(defaults.base_name)
    const default_title = to_title_case(defaults.base_name)

    let title = ctx.options.title as string | undefined
    if (!title) {
        title = rl ? await prompt_text(rl, "? App display title", default_title) : default_title
    }

    const default_identifier = `com.example.${kebab_name.replace(/-/g, "") || "app"}`
    let identifier = ctx.options.identifier as string | undefined
    if (!identifier) {
        identifier = rl ? await prompt_text(rl, "? Tauri bundle identifier", default_identifier) : default_identifier
    }
    identifier = to_valid_identifier(identifier)

    let port = ctx.options.port as string | undefined
    if (!port) {
        port = rl ? await prompt_text(rl, "? Development server port", "4000") : "4000"
    }

    const description = (ctx.options.description as string) || defaults.default_description

    return { title, identifier, description, port }
}

async function resolve_install_choice(
    rl: readline.Interface | null,
    ctx: CommandContext,
    pkg_manager: string
): Promise<boolean> {
    if (ctx.options.no_install) return false
    if (ctx.options.install) return true
    if (rl) return prompt_confirm(rl, `? Install dependencies with ${pkg_manager}?`, true)
    return false
}

function run_dependency_install(dest_path: string, pkg_manager: string) {
    console.log(`[nextkit] Installing dependencies via ${pkg_manager}...`)
    try {
        execSync(`${pkg_manager} install`, { cwd: dest_path, stdio: "inherit" })
        console.log("[nextkit] Dependencies installed successfully.")
    } catch {
        console.log(`[nextkit] Warning: Failed to install dependencies via ${pkg_manager}.`)
    }
}

function configure_client_metadata(dest_path: string, metadata: ClientMetadata) {
    const { title, identifier, description, port } = metadata

    // public/manifest.json
    const manifest_path = path.join(dest_path, "public/manifest.json")
    if (fs.existsSync(manifest_path)) {
        const manifest = JSON.parse(fs.readFileSync(manifest_path, "utf-8"))
        manifest.name = title
        manifest.short_name = title
        manifest.description = description
        fs.writeFileSync(manifest_path, JSON.stringify(manifest, null, 2) + "\n", "utf-8")
    }

    // vite.config.ts
    const vite_config_path = path.join(dest_path, "vite.config.ts")
    if (fs.existsSync(vite_config_path)) {
        const vite_content = fs.readFileSync(vite_config_path, "utf-8")
        const updated_vite = vite_content.replace(/(\bserver:\s*\{[\s\S]*?\bport:\s*)\d+/, `$1${port}`)
        if (updated_vite !== vite_content) {
            fs.writeFileSync(vite_config_path, updated_vite, "utf-8")
        }
    }

    // src-tauri/tauri.conf.json
    const tauri_conf_path = path.join(dest_path, "src-tauri/tauri.conf.json")
    if (fs.existsSync(tauri_conf_path)) {
        const conf = JSON.parse(fs.readFileSync(tauri_conf_path, "utf-8"))
        conf.productName = title
        conf.identifier = identifier
        if (conf.build) {
            conf.build.devUrl = `http://localhost:${port}`
        }
        if (conf.app && Array.isArray(conf.app.windows)) {
            for (const win of conf.app.windows) {
                if (win.label === "main" || conf.app.windows.length === 1) {
                    win.title = title
                }
            }
        }
        fs.writeFileSync(tauri_conf_path, JSON.stringify(conf, null, 2) + "\n", "utf-8")
    }

    // src-tauri/Cargo.toml
    const cargo_path = path.join(dest_path, "src-tauri/Cargo.toml")
    if (fs.existsSync(cargo_path)) {
        let cargo_content = fs.readFileSync(cargo_path, "utf-8")
        cargo_content = cargo_content.replace(
            /description = ".*?"/,
            `description = "${description.replace(/"/g, '\\"')}"`
        )
        fs.writeFileSync(cargo_path, cargo_content, "utf-8")
    }

    // frontend/app/index.html
    const index_html_path = path.join(dest_path, "frontend/app/index.html")
    if (fs.existsSync(index_html_path)) {
        let html_content = fs.readFileSync(index_html_path, "utf-8")
        html_content = html_content
            .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
            .replace(
                /<meta name="description" content=".*?" \/>/,
                `<meta name="description" content="${description}" />`
            )
            .replace(/<meta property="og:title" content=".*?" \/>/, `<meta property="og:title" content="${title}" />`)
            .replace(
                /<meta property="og:description" content=".*?" \/>/,
                `<meta property="og:description" content="${description}" />`
            )
        fs.writeFileSync(index_html_path, html_content, "utf-8")
    }

    // frontend/app/native_entry/index.html
    const native_index_html_path = path.join(dest_path, "frontend/app/native_entry/index.html")
    if (fs.existsSync(native_index_html_path)) {
        let native_html = fs.readFileSync(native_index_html_path, "utf-8")
        native_html = native_html.replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
        fs.writeFileSync(native_index_html_path, native_html, "utf-8")
    }

    // frontend/app/App.tsx
    const app_tsx_path = path.join(dest_path, "frontend/app/App.tsx")
    if (fs.existsSync(app_tsx_path)) {
        let app_content = fs.readFileSync(app_tsx_path, "utf-8")
        app_content = app_content.replace(/Hello from Nextkit!/g, `Hello from ${title}!`)
        fs.writeFileSync(app_tsx_path, app_content, "utf-8")
    }

    // src-tauri/gen/apple/project.yml
    const project_yml_path = path.join(dest_path, "src-tauri/gen/apple/project.yml")
    if (fs.existsSync(project_yml_path)) {
        let yml_content = fs.readFileSync(project_yml_path, "utf-8")
        yml_content = yml_content
            .replace(/bundleIdPrefix: .*/, `bundleIdPrefix: ${identifier}`)
            .replace(/PRODUCT_NAME: .*/, `PRODUCT_NAME: ${title}`)
            .replace(/PRODUCT_BUNDLE_IDENTIFIER: .*/, `PRODUCT_BUNDLE_IDENTIFIER: ${identifier}`)
        fs.writeFileSync(project_yml_path, yml_content, "utf-8")
    }

    // src-tauri/gen/apple/app.xcodeproj
    const pbxproj_path = path.join(dest_path, "src-tauri/gen/apple/app.xcodeproj/project.pbxproj")
    if (fs.existsSync(pbxproj_path)) {
        let pbx_content = fs.readFileSync(pbxproj_path, "utf-8")
        pbx_content = pbx_content
            .replaceAll(
                "PRODUCT_BUNDLE_IDENTIFIER = com.xsolutiontech.nextkit;",
                `PRODUCT_BUNDLE_IDENTIFIER = ${identifier};`
            )
            .replaceAll("PRODUCT_NAME = Nextkit;", `PRODUCT_NAME = ${title};`)
            .replaceAll("Nextkit.app", `${title}.app`)
        fs.writeFileSync(pbxproj_path, pbx_content, "utf-8")
    }

    const scheme_path = path.join(
        dest_path,
        "src-tauri/gen/apple/app.xcodeproj/xcshareddata/xcschemes/app_iOS.xcscheme"
    )
    if (fs.existsSync(scheme_path)) {
        let scheme_content = fs.readFileSync(scheme_path, "utf-8")
        scheme_content = scheme_content.replaceAll('BuildableName = "Nextkit.app"', `BuildableName = "${title}.app"`)
        fs.writeFileSync(scheme_path, scheme_content, "utf-8")
    }
}

function merge_attach_package_json(dest_path: string, metadata: ClientMetadata): string[] {
    const template_pkg = JSON.parse(fs.readFileSync(path.join(source_root, "package.json"), "utf-8"))
    const has_src_dir = fs.existsSync(path.join(dest_path, "src"))
    const client_scripts = sanitize_client_scripts(template_pkg.scripts || {}, metadata.port, has_src_dir)
    const dest_pkg_path = path.join(dest_path, "package.json")

    if (!fs.existsSync(dest_pkg_path)) {
        const folder_name = path.basename(dest_path)
        const next_pkg = {
            ...template_pkg,
            name: to_kebab_case(folder_name),
            title: metadata.title,
            description: metadata.description,
            version: "0.1.0",
            scripts: client_scripts
        }
        delete next_pkg.bin
        fs.writeFileSync(dest_pkg_path, JSON.stringify(next_pkg, null, 2) + "\n", "utf-8")
        return []
    }

    const existing_pkg = JSON.parse(fs.readFileSync(dest_pkg_path, "utf-8"))
    const existing_scripts: Record<string, string> = existing_pkg.scripts || {}
    const preserved_scripts: string[] = []

    for (const [key, val] of Object.entries(client_scripts)) {
        if (Object.hasOwn(existing_scripts, key)) {
            if (existing_scripts[key] !== val) {
                preserved_scripts.push(`${key} (nextkit default: ${val})`)
            }
        } else {
            existing_scripts[key] = val
        }
    }
    existing_pkg.scripts = existing_scripts

    const existing_deps: Record<string, string> = existing_pkg.dependencies || {}
    const existing_dev_deps: Record<string, string> = existing_pkg.devDependencies || {}

    for (const [pkg_name, version] of Object.entries<string>(template_pkg.dependencies || {})) {
        if (!Object.hasOwn(existing_deps, pkg_name) && !Object.hasOwn(existing_dev_deps, pkg_name)) {
            existing_deps[pkg_name] = version
        }
    }
    for (const [pkg_name, version] of Object.entries<string>(template_pkg.devDependencies || {})) {
        if (!Object.hasOwn(existing_deps, pkg_name) && !Object.hasOwn(existing_dev_deps, pkg_name)) {
            existing_dev_deps[pkg_name] = version
        }
    }

    existing_pkg.dependencies = existing_deps
    existing_pkg.devDependencies = existing_dev_deps
    fs.writeFileSync(dest_pkg_path, JSON.stringify(existing_pkg, null, 2) + "\n", "utf-8")
    return preserved_scripts
}

function merge_attach_tsconfig(dest_path: string) {
    const template_tsconfig_path = path.join(source_root, "tsconfig.json")
    const dest_tsconfig_path = path.join(dest_path, "tsconfig.json")

    if (!fs.existsSync(dest_tsconfig_path)) {
        fs.copyFileSync(template_tsconfig_path, dest_tsconfig_path)
        return
    }

    try {
        const tsconfig = JSON.parse(fs.readFileSync(dest_tsconfig_path, "utf-8"))
        const exclude_list: string[] = Array.isArray(tsconfig.exclude) ? [...tsconfig.exclude] : ["node_modules"]
        for (const required_exclude of ["dist", "frontend", "src-tauri", "cli", "scripts", "vite.config.ts"]) {
            if (!exclude_list.includes(required_exclude)) {
                exclude_list.push(required_exclude)
            }
        }
        tsconfig.exclude = exclude_list
        fs.writeFileSync(dest_tsconfig_path, JSON.stringify(tsconfig, null, 2) + "\n", "utf-8")
    } catch {
        console.log(
            '[nextkit] Warning: Could not parse existing tsconfig.json as strict JSON. Please ensure "frontend", "src-tauri", "cli", "vite.config.ts", and "dist" are listed in "exclude".'
        )
    }
}

function merge_attach_gitignore(dest_path: string) {
    const template_gitignore_path = path.join(source_root, ".gitignore")
    const dest_gitignore_path = path.join(dest_path, ".gitignore")

    if (!fs.existsSync(dest_gitignore_path)) {
        if (fs.existsSync(template_gitignore_path)) {
            fs.copyFileSync(template_gitignore_path, dest_gitignore_path)
        }
        return
    }

    const content = fs.readFileSync(dest_gitignore_path, "utf-8")
    const existing_lines = new Set(content.split(/\r?\n/).map((line) => line.trim()))
    const missing_lines = ATTACH_GITIGNORE_ENTRIES.filter((entry) => !existing_lines.has(entry))

    if (missing_lines.length === 0) return

    const separator = content.endsWith("\n") ? "\n" : "\n\n"
    fs.writeFileSync(dest_gitignore_path, `${content}${separator}# nextkit\n${missing_lines.join("\n")}\n`, "utf-8")
}

async function handle_create_project(ctx: CommandContext) {
    const is_interactive = Boolean(stdin.isTTY && !ctx.options.yes)
    const rl = is_interactive ? readline.createInterface({ input: stdin, output: stdout }) : null

    try {
        let target_arg = ctx.args[0]
        if (!target_arg) {
            target_arg = rl ? await prompt_text(rl, "? Project directory or name", "my-nextkit-app") : "my-nextkit-app"
        }

        const dest_path = path.resolve(process.cwd(), target_arg)
        const folder_name = path.basename(dest_path)
        const kebab_name = to_kebab_case(folder_name)
        const force = Boolean(ctx.options.force)

        if (fs.existsSync(dest_path)) {
            const entries = fs.readdirSync(dest_path)
            if (entries.length > 0) {
                if (force) {
                    console.log(`[nextkit] Target directory exists, removing due to force flag: ${dest_path}`)
                    fs.rmSync(dest_path, { recursive: true, force: true })
                } else if (rl) {
                    const should_overwrite = await prompt_confirm(
                        rl,
                        `! Target directory "${folder_name}" is not empty. Overwrite?`,
                        false
                    )
                    if (!should_overwrite) {
                        console.log("[nextkit] Operation cancelled.")
                        return
                    }
                    console.log(`[nextkit] Removing existing directory: ${dest_path}`)
                    fs.rmSync(dest_path, { recursive: true, force: true })
                } else {
                    throw new Error(
                        `Target directory already exists and is not empty: ${dest_path}. Use -f or --force to overwrite.`
                    )
                }
            }
        }

        const metadata = await resolve_client_metadata(rl, ctx, {
            base_name: folder_name,
            default_description: "A cross-platform application built with Nextkit"
        })

        let should_git = true
        if (ctx.options.no_git) {
            should_git = false
        } else if (ctx.options.git) {
            should_git = true
        } else if (rl) {
            should_git = await prompt_confirm(rl, "? Initialize a git repository?", true)
        }

        const pkg_manager = detect_package_manager()
        const should_install = await resolve_install_choice(rl, ctx, pkg_manager)

        console.log(`\n[nextkit] Initializing new Nextkit project:`)
        console.log(`  * Directory:   ${dest_path}`)
        console.log(`  * Package:     ${kebab_name}`)
        console.log(`  * Title:       ${metadata.title}`)
        console.log(`  * Identifier:  ${metadata.identifier}`)
        console.log(`  * Port:        ${metadata.port}\n`)

        console.log("[nextkit] Copying template files...")
        fs.mkdirSync(dest_path, { recursive: true })
        copy_recursive(source_root, dest_path, create_copy_filter(source_root, IGNORED_EXACT_OR_DIR))

        console.log("[nextkit] Configuring project metadata...")

        // 1. package.json
        const pkg_path = path.join(dest_path, "package.json")
        if (fs.existsSync(pkg_path)) {
            const pkg = JSON.parse(fs.readFileSync(pkg_path, "utf-8"))
            pkg.name = kebab_name
            pkg.title = metadata.title
            pkg.description = metadata.description
            pkg.version = "0.1.0"

            delete pkg.bin
            if (pkg.scripts) {
                pkg.scripts = sanitize_client_scripts(pkg.scripts, metadata.port, false)
            }

            fs.writeFileSync(pkg_path, JSON.stringify(pkg, null, 2) + "\n", "utf-8")
        }

        // 2. package-lock.json
        const lock_path = path.join(dest_path, "package-lock.json")
        if (fs.existsSync(lock_path)) {
            const lock = JSON.parse(fs.readFileSync(lock_path, "utf-8"))
            if (lock.name) lock.name = kebab_name
            if (lock.packages && lock.packages[""]) {
                lock.packages[""].name = kebab_name
                lock.packages[""].title = metadata.title
                lock.packages[""].description = metadata.description
                lock.packages[""].version = "0.1.0"
            }
            fs.writeFileSync(lock_path, JSON.stringify(lock, null, 2) + "\n", "utf-8")
        }

        // 3. Shared client & Tauri files
        configure_client_metadata(dest_path, metadata)

        // Git initialization
        if (should_git) {
            try {
                execSync("git init", { cwd: dest_path, stdio: "ignore" })
                console.log("[nextkit] Initialized a new Git repository.")
            } catch {
                console.log("[nextkit] Warning: Failed to initialize Git repository.")
            }
        }

        // Dependency installation
        if (should_install) {
            run_dependency_install(dest_path, pkg_manager)
        }

        console.log(`\n[nextkit] Project initialized successfully at ${dest_path}`)
        console.log("\nTo get started:")
        const relative_dest = path.relative(process.cwd(), dest_path)
        if (relative_dest && relative_dest !== ".") {
            console.log(`  cd ${relative_dest}`)
        }
        if (!should_install) {
            console.log(`  ${pkg_manager} install`)
        }
        console.log(`  ${pkg_manager} run dev          # Start web dev server and SW watcher`)
        console.log(`  ${pkg_manager} run tauri dev    # Start native desktop app`)
        console.log("")
    } finally {
        if (rl) {
            rl.close()
        }
    }
}

async function handle_attach_project(ctx: CommandContext) {
    const is_interactive = Boolean(stdin.isTTY && !ctx.options.yes)
    const rl = is_interactive ? readline.createInterface({ input: stdin, output: stdout }) : null

    try {
        let target_arg = ctx.args[0]
        if (!target_arg) {
            target_arg = rl ? await prompt_text(rl, "? Existing project directory", ".") : "."
        }

        const dest_path = path.resolve(process.cwd(), target_arg)
        if (!fs.existsSync(dest_path) || !fs.statSync(dest_path).isDirectory()) {
            throw new Error(`Target directory does not exist: ${dest_path}. Use "create" to scaffold a new project.`)
        }
        if (path.resolve(dest_path) === path.resolve(source_root)) {
            throw new Error("Cannot attach Nextkit onto its own template repository.")
        }

        const existing_pkg_path = path.join(dest_path, "package.json")
        const existing_pkg = fs.existsSync(existing_pkg_path)
            ? JSON.parse(fs.readFileSync(existing_pkg_path, "utf-8"))
            : null

        const base_name = (typeof existing_pkg?.name === "string" && existing_pkg.name) || path.basename(dest_path)
        const default_description =
            (typeof existing_pkg?.description === "string" && existing_pkg.description) ||
            "A cross-platform application built with Nextkit"

        const force = Boolean(ctx.options.force)
        const collision_targets = [...ATTACH_COPY_DIRS, ...ATTACH_COPY_FILES]
        const collisions = collision_targets.filter((rel) => fs.existsSync(path.join(dest_path, rel)))

        if (collisions.length > 0) {
            if (force) {
                console.log(`[nextkit] Overwriting existing client targets due to force flag: ${collisions.join(", ")}`)
            } else if (rl) {
                const should_overwrite = await prompt_confirm(
                    rl,
                    `! Existing Nextkit paths found (${collisions.join(", ")}). Overwrite them?`,
                    false
                )
                if (!should_overwrite) {
                    console.log("[nextkit] Operation cancelled.")
                    return
                }
            } else {
                throw new Error(
                    `Existing client paths found in target directory (${collisions.join(", ")}). Use -f or --force to overwrite them.`
                )
            }
        }

        const metadata = await resolve_client_metadata(rl, ctx, { base_name, default_description })
        const pkg_manager = detect_package_manager()
        const should_install = await resolve_install_choice(rl, ctx, pkg_manager)

        console.log(`\n[nextkit] Attaching Nextkit client to existing project:`)
        console.log(`  * Directory:   ${dest_path}`)
        console.log(`  * Title:       ${metadata.title}`)
        console.log(`  * Identifier:  ${metadata.identifier}`)
        console.log(`  * Port:        ${metadata.port}\n`)

        console.log("[nextkit] Copying frontend and native client files...")
        const filter = create_copy_filter(source_root, IGNORED_EXACT_OR_DIR)

        for (const rel_dir of ATTACH_COPY_DIRS) {
            const src_dir = path.join(source_root, rel_dir)
            const dst_dir = path.join(dest_path, rel_dir)
            if (!fs.existsSync(src_dir)) continue
            if (fs.existsSync(dst_dir)) {
                fs.rmSync(dst_dir, { recursive: true, force: true })
            }
            copy_recursive(src_dir, dst_dir, filter)
        }

        for (const rel_file of ATTACH_COPY_FILES) {
            const src_file = path.join(source_root, rel_file)
            const dst_file = path.join(dest_path, rel_file)
            if (fs.existsSync(src_file)) {
                fs.copyFileSync(src_file, dst_file)
            }
        }

        for (const rel_file of ATTACH_OPTIONAL_FILES) {
            const src_file = path.join(source_root, rel_file)
            const dst_file = path.join(dest_path, rel_file)
            if (!fs.existsSync(dst_file) && fs.existsSync(src_file)) {
                fs.copyFileSync(src_file, dst_file)
            } else if (rel_file === "Cargo.toml" && fs.existsSync(dst_file)) {
                const cargo_content = fs.readFileSync(dst_file, "utf-8")
                if (!cargo_content.includes("src-tauri")) {
                    console.log(
                        '[nextkit] Note: Existing Cargo.toml preserved. Add "src-tauri" to [workspace] members if you use a Rust workspace.'
                    )
                }
            }
        }

        console.log("[nextkit] Configuring client metadata & merging config files...")
        configure_client_metadata(dest_path, metadata)
        const preserved_scripts = merge_attach_package_json(dest_path, metadata)
        merge_attach_tsconfig(dest_path)
        merge_attach_gitignore(dest_path)

        if (preserved_scripts.length > 0) {
            console.log("[nextkit] Preserved existing package.json scripts:")
            for (const item of preserved_scripts) {
                console.log(`  * ${item}`)
            }
        }

        if (should_install) {
            run_dependency_install(dest_path, pkg_manager)
        }

        console.log(`\n[nextkit] Nextkit client attached successfully at ${dest_path}`)
        console.log("\nTo get started:")
        const relative_dest = path.relative(process.cwd(), dest_path)
        if (relative_dest && relative_dest !== ".") {
            console.log(`  cd ${relative_dest}`)
        }
        if (!should_install) {
            console.log(`  ${pkg_manager} install`)
        }
        console.log(`  ${pkg_manager} run dev          # Start Vite dev server and SW watcher`)
        console.log(`  ${pkg_manager} run check        # Run lint and TypeScript checks`)
        console.log("")
    } finally {
        if (rl) {
            rl.close()
        }
    }
}

function register_client_options(cmd: Command): Command {
    return cmd
        .option("-t, --title <title>", { description: "App display title (e.g. 'My App')" })
        .option("-i, --identifier <id>", { description: "Tauri bundle identifier (e.g. 'com.company.app')" })
        .option("-d, --description <desc>", { description: "Project description" })
        .option("-p, --port <port>", { description: "Development server port (default: 4000)" })
        .option("-f, --force", { description: "Force overwrite conflicting paths" })
        .option("-y, --yes", { description: "Skip prompts and use defaults" })
        .option("--install", { description: "Install dependencies automatically" })
        .option("--no-install", { description: "Do not install dependencies" })
}

async function main() {
    const cli = create_cli()

    register_client_options(
        cli.command(
            "create",
            "Create a new Nextkit project from this template.\n\nPositionals:\n  <directory>               Target directory path where the project will be created (e.g. '../my-app')"
        )
    )
        .option("-g, --git", { description: "Initialize a git repository" })
        .option("--no-git", { description: "Do not initialize a git repository" })
        .action(handle_create_project)

    register_client_options(cli.command("init", "Alias for create"))
        .option("-g, --git", { description: "Initialize a git repository" })
        .option("--no-git", { description: "Do not initialize a git repository" })
        .action(handle_create_project)

    register_client_options(
        cli.command(
            "attach",
            "Attach Nextkit frontend and Tauri client files to an existing project (preserving its src/ and package.json).\n\nPositionals:\n  [directory]               Existing target directory path (default: current working directory)"
        )
    ).action(handle_attach_project)

    cli.command("clean", "Clean up generated files and caches").action(() => {
        const targets = [
            "dist",
            ".debug",
            "node_modules",
            "target",
            "src-tauri/target",
            "src-tauri/gen/schemas",
            "src-tauri/gen/apple/build",
            "src-tauri/gen/apple/Externals",
            "src-tauri/gen/apple/app.xcodeproj/project.xcworkspace/xcuserdata",
            "src-tauri/gen/apple/app.xcodeproj/xcuserdata",
            "tsconfig.tsbuildinfo",
            "frontend/tsconfig.tsbuildinfo"
        ]

        console.log("[nextkit] Cleaning up project caches...")
        for (const target of targets) {
            const target_path = path.resolve(source_root, target)
            if (fs.existsSync(target_path)) {
                console.log(`[nextkit] Removing ${target}...`)
                fs.rmSync(target_path, { recursive: true, force: true })
            }
        }
        console.log("[nextkit] Project cleaned successfully.")
    })

    const raw_args = process.argv.slice(2)
    const first_arg = raw_args[0]
    const is_known_command = Boolean(
        first_arg && ["create", "init", "attach", "clean", "-h", "--help"].includes(first_arg)
    )
    const args_to_run = is_known_command ? raw_args : ["create", ...raw_args]

    await cli.run(args_to_run)
}

main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[nextkit] Error: ${message}`)
    process.exitCode = 1
})
