import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { execSync } from "node:child_process"
import readline from "node:readline/promises"
import { stdin, stdout } from "node:process"
import { create_cli, type CommandContext } from "./lib/cli_builder.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let source_root = path.resolve(__dirname, "..")
if (!fs.existsSync(path.join(source_root, "package.json"))){
    source_root = path.resolve(__dirname, "../..")
}

const IGNORED_EXACT_OR_DIR = [
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
    "cli/dist",
]

const IGNORED_DIR_NAMES = new Set([
    "xcuserdata",
    ".idea",
])

const IGNORED_FILE_NAMES = new Set([
    ".DS_Store",
    "Thumbs.db",
])

function copy_recursive(src: string, dest: string, filter: (s: string) => boolean){
    if (!filter(src)){
        return
    }
    const stat = fs.statSync(src)
    if (stat.isDirectory()){
        fs.mkdirSync(dest, { recursive: true })
        const entries = fs.readdirSync(src)
        for (const entry of entries){
            copy_recursive(path.join(src, entry), path.join(dest, entry), filter)
        }
    }
    else {
        fs.copyFileSync(src, dest)
    }
}

function to_kebab_case(str: string): string{
    return str
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .replace(/[_\s]+/g, "-")
        .toLowerCase()
}

function to_title_case(str: string): string{
    return str
        .replace(/[_-]+/g, " ")
        .replace(/\b[a-z]/g, (char) => char.toUpperCase())
}

function to_valid_identifier(str: string): string{
    return str
        .toLowerCase()
        .replace(/[^a-z0-9.]/g, "")
}

function detect_package_manager(): string{
    const user_agent = process.env.npm_config_user_agent || ""
    if (user_agent.startsWith("pnpm")) return "pnpm"
    if (user_agent.startsWith("yarn")) return "yarn"
    if (user_agent.startsWith("bun")) return "bun"
    return "npm"
}

async function prompt_text(rl: readline.Interface, question: string, default_val?: string): Promise<string>{
    const display = default_val ? `${question} (${default_val}): ` : `${question}: `
    const answer = (await rl.question(display)).trim()
    return answer || (default_val ?? "")
}

async function prompt_confirm(rl: readline.Interface, question: string, default_yes = true): Promise<boolean>{
    const hint = default_yes ? "(Y/n)" : "(y/N)"
    const answer = (await rl.question(`${question} ${hint}: `)).trim().toLowerCase()
    if (!answer) return default_yes
    return answer === "y" || answer === "yes"
}

async function handle_create_project(ctx: CommandContext){
    const is_interactive = Boolean(stdin.isTTY && !ctx.options.yes)
    const rl = is_interactive ? readline.createInterface({ input: stdin, output: stdout }) : null

    try {
        let target_arg = ctx.args[0]
        if (!target_arg){
            if (rl){
                target_arg = await prompt_text(rl, "? Project directory or name", "my-nextkit-app")
            }
            else {
                target_arg = "my-nextkit-app"
            }
        }

        const dest_path = path.resolve(process.cwd(), target_arg)
        const folder_name = path.basename(dest_path)
        const kebab_name = to_kebab_case(folder_name)
        const force = Boolean(ctx.options.force)

        if (fs.existsSync(dest_path)){
            const entries = fs.readdirSync(dest_path)
            if (entries.length > 0){
                if (force){
                    console.log(`[nextkit] Target directory exists, removing due to force flag: ${dest_path}`)
                    fs.rmSync(dest_path, { recursive: true, force: true })
                }
                else if (rl){
                    const should_overwrite = await prompt_confirm(
                        rl,
                        `! Target directory "${folder_name}" is not empty. Overwrite?`,
                        false
                    )
                    if (!should_overwrite){
                        console.log("[nextkit] Operation cancelled.")
                        return
                    }
                    console.log(`[nextkit] Removing existing directory: ${dest_path}`)
                    fs.rmSync(dest_path, { recursive: true, force: true })
                }
                else {
                    throw new Error(`Target directory already exists and is not empty: ${dest_path}. Use -f or --force to overwrite.`)
                }
            }
        }

        const default_title = to_title_case(folder_name)
        let title = ctx.options.title as string | undefined
        if (!title){
            if (rl){
                title = await prompt_text(rl, "? App display title", default_title)
            }
            else {
                title = default_title
            }
        }

        const default_identifier = `com.example.${kebab_name.replace(/-/g, "")}`
        let identifier = ctx.options.identifier as string | undefined
        if (!identifier){
            if (rl){
                identifier = await prompt_text(rl, "? Tauri bundle identifier", default_identifier)
            }
            else {
                identifier = default_identifier
            }
        }
        identifier = to_valid_identifier(identifier)

        let port = ctx.options.port as string | undefined
        if (!port){
            if (rl){
                port = await prompt_text(rl, "? Development server port", "4000")
            }
            else {
                port = "4000"
            }
        }

        const description = (ctx.options.description as string) || "A cross-platform application built with Nextkit"

        let should_git = true
        if (ctx.options.no_git){
            should_git = false
        }
        else if (ctx.options.git){
            should_git = true
        }
        else if (rl){
            should_git = await prompt_confirm(rl, "? Initialize a git repository?", true)
        }

        const pkg_manager = detect_package_manager()
        let should_install = false
        if (ctx.options.no_install){
            should_install = false
        }
        else if (ctx.options.install){
            should_install = true
        }
        else if (rl){
            should_install = await prompt_confirm(rl, `? Install dependencies with ${pkg_manager}?`, true)
        }

        console.log(`\n[nextkit] Initializing new Nextkit project:`)
        console.log(`  * Directory:   ${dest_path}`)
        console.log(`  * Package:     ${kebab_name}`)
        console.log(`  * Title:       ${title}`)
        console.log(`  * Identifier:  ${identifier}`)
        console.log(`  * Port:        ${port}\n`)

        console.log("[nextkit] Copying template files...")
        fs.mkdirSync(dest_path, { recursive: true })

        const filter = (src: string) => {
            const file_name = path.basename(src)
            if (IGNORED_FILE_NAMES.has(file_name)) return false

            const relative = path.relative(source_root, src)
            if (!relative) return true

            const segments = relative.split(path.sep)
            if (segments.some((seg) => IGNORED_DIR_NAMES.has(seg))) return false

            const normalized_relative = segments.join("/")
            return !IGNORED_EXACT_OR_DIR.some((ignored) => {
                return normalized_relative === ignored || normalized_relative.startsWith(ignored + "/")
            })
        }

        copy_recursive(source_root, dest_path, filter)

        console.log("[nextkit] Configuring project metadata...")

        // 1. package.json
        const pkg_path = path.join(dest_path, "package.json")
        if (fs.existsSync(pkg_path)){
            const pkg = JSON.parse(fs.readFileSync(pkg_path, "utf-8"))
            pkg.name = kebab_name
            pkg.title = title
            pkg.description = description
            pkg.version = "0.1.0"

            delete pkg.bin
            if (pkg.scripts){
                delete pkg.scripts.cli
                delete pkg.scripts["build:cli"]
                delete pkg.scripts.create
                delete pkg.scripts.prepare
                if (typeof pkg.scripts.dev === "string"){
                    pkg.scripts.dev = pkg.scripts.dev.replace(/--port=\d+/g, `--port=${port}`)
                }
                if (typeof pkg.scripts.start === "string"){
                    pkg.scripts.start = pkg.scripts.start.replace(/--port \d+/g, `--port ${port}`)
                }
            }

            fs.writeFileSync(pkg_path, JSON.stringify(pkg, null, 2) + "\n", "utf-8")
        }

        // 2. package-lock.json
        const lock_path = path.join(dest_path, "package-lock.json")
        if (fs.existsSync(lock_path)){
            const lock = JSON.parse(fs.readFileSync(lock_path, "utf-8"))
            if (lock.name) lock.name = kebab_name
            if (lock.packages && lock.packages[""]){
                lock.packages[""].name = kebab_name
                lock.packages[""].title = title
                lock.packages[""].description = description
                lock.packages[""].version = "0.1.0"
            }
            fs.writeFileSync(lock_path, JSON.stringify(lock, null, 2) + "\n", "utf-8")
        }

        // 3. public/manifest.json
        const manifest_path = path.join(dest_path, "public/manifest.json")
        if (fs.existsSync(manifest_path)){
            const manifest = JSON.parse(fs.readFileSync(manifest_path, "utf-8"))
            manifest.name = title
            manifest.short_name = title
            manifest.description = description
            fs.writeFileSync(manifest_path, JSON.stringify(manifest, null, 2) + "\n", "utf-8")
        }

        // 4. src-tauri/tauri.conf.json
        const tauri_conf_path = path.join(dest_path, "src-tauri/tauri.conf.json")
        if (fs.existsSync(tauri_conf_path)){
            const conf = JSON.parse(fs.readFileSync(tauri_conf_path, "utf-8"))
            conf.productName = title
            conf.identifier = identifier
            if (conf.build){
                conf.build.devUrl = `http://localhost:${port}`
            }
            if (conf.app && Array.isArray(conf.app.windows)){
                for (const win of conf.app.windows){
                    if (win.label === "main" || conf.app.windows.length === 1){
                        win.title = title
                    }
                }
            }
            fs.writeFileSync(tauri_conf_path, JSON.stringify(conf, null, 2) + "\n", "utf-8")
        }

        // 5. src-tauri/Cargo.toml
        const cargo_path = path.join(dest_path, "src-tauri/Cargo.toml")
        if (fs.existsSync(cargo_path)){
            let cargo_content = fs.readFileSync(cargo_path, "utf-8")
            cargo_content = cargo_content.replace(
                /description = ".*?"/,
                `description = "${description.replace(/"/g, '\\"')}"`
            )
            fs.writeFileSync(cargo_path, cargo_content, "utf-8")
        }

        // 6. src/app/index.html
        const index_html_path = path.join(dest_path, "src/app/index.html")
        if (fs.existsSync(index_html_path)){
            let html_content = fs.readFileSync(index_html_path, "utf-8")
            html_content = html_content
                .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
                .replace(/<meta name="description" content=".*?" \/>/, `<meta name="description" content="${description}" />`)
                .replace(/<meta property="og:title" content=".*?" \/>/, `<meta property="og:title" content="${title}" />`)
                .replace(/<meta property="og:description" content=".*?" \/>/, `<meta property="og:description" content="${description}" />`)
            fs.writeFileSync(index_html_path, html_content, "utf-8")
        }

        // 7. src/app/native_entry/index.html
        const native_index_html_path = path.join(dest_path, "src/app/native_entry/index.html")
        if (fs.existsSync(native_index_html_path)){
            let native_html = fs.readFileSync(native_index_html_path, "utf-8")
            native_html = native_html.replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
            fs.writeFileSync(native_index_html_path, native_html, "utf-8")
        }

        // 8. src/app/App.tsx
        const app_tsx_path = path.join(dest_path, "src/app/App.tsx")
        if (fs.existsSync(app_tsx_path)){
            let app_content = fs.readFileSync(app_tsx_path, "utf-8")
            app_content = app_content.replace(/Hello from Nextkit!/g, `Hello from ${title}!`)
            fs.writeFileSync(app_tsx_path, app_content, "utf-8")
        }

        // 9. src-tauri/gen/apple/project.yml
        const project_yml_path = path.join(dest_path, "src-tauri/gen/apple/project.yml")
        if (fs.existsSync(project_yml_path)){
            let yml_content = fs.readFileSync(project_yml_path, "utf-8")
            yml_content = yml_content
                .replace(/bundleIdPrefix: .*/, `bundleIdPrefix: ${identifier}`)
                .replace(/PRODUCT_NAME: .*/, `PRODUCT_NAME: ${title}`)
                .replace(/PRODUCT_BUNDLE_IDENTIFIER: .*/, `PRODUCT_BUNDLE_IDENTIFIER: ${identifier}`)
            fs.writeFileSync(project_yml_path, yml_content, "utf-8")
        }

        // 10. src-tauri/gen/apple/app.xcodeproj
        const pbxproj_path = path.join(dest_path, "src-tauri/gen/apple/app.xcodeproj/project.pbxproj")
        if (fs.existsSync(pbxproj_path)){
            let pbx_content = fs.readFileSync(pbxproj_path, "utf-8")
            pbx_content = pbx_content
                .replaceAll("PRODUCT_BUNDLE_IDENTIFIER = com.xsolutiontech.nextkit;", `PRODUCT_BUNDLE_IDENTIFIER = ${identifier};`)
                .replaceAll("PRODUCT_NAME = Nextkit;", `PRODUCT_NAME = ${title};`)
                .replaceAll("Nextkit.app", `${title}.app`)
            fs.writeFileSync(pbxproj_path, pbx_content, "utf-8")
        }

        const scheme_path = path.join(dest_path, "src-tauri/gen/apple/app.xcodeproj/xcshareddata/xcschemes/app_iOS.xcscheme")
        if (fs.existsSync(scheme_path)){
            let scheme_content = fs.readFileSync(scheme_path, "utf-8")
            scheme_content = scheme_content.replaceAll('BuildableName = "Nextkit.app"', `BuildableName = "${title}.app"`)
            fs.writeFileSync(scheme_path, scheme_content, "utf-8")
        }

        // Git initialization
        if (should_git){
            try {
                execSync("git init", { cwd: dest_path, stdio: "ignore" })
                console.log("[nextkit] Initialized a new Git repository.")
            }
            catch {
                console.log("[nextkit] Warning: Failed to initialize Git repository.")
            }
        }

        // Dependency installation
        if (should_install){
            console.log(`[nextkit] Installing dependencies via ${pkg_manager}...`)
            try {
                execSync(`${pkg_manager} install`, { cwd: dest_path, stdio: "inherit" })
                console.log("[nextkit] Dependencies installed successfully.")
            }
            catch {
                console.log(`[nextkit] Warning: Failed to install dependencies via ${pkg_manager}.`)
            }
        }

        console.log(`\n[nextkit] Project initialized successfully at ${dest_path}`)
        console.log("\nTo get started:")
        const relative_dest = path.relative(process.cwd(), dest_path)
        if (relative_dest && relative_dest !== "."){
            console.log(`  cd ${relative_dest}`)
        }
        if (!should_install){
            console.log(`  ${pkg_manager} install`)
        }
        console.log(`  ${pkg_manager} run dev          # Start web dev server and SW watcher`)
        console.log(`  ${pkg_manager} run tauri dev    # Start native desktop app`)
        console.log("")
    }
    finally {
        if (rl){
            rl.close()
        }
    }
}

async function main(){
    const cli = create_cli()

    cli
        .command("create", "Create a new Nextkit project from this template.\n\nPositionals:\n  <directory>               Target directory path where the project will be created (e.g. '../my-app')")
        .option("-t, --title <title>", { description: "App display title (e.g. 'My App')" })
        .option("-i, --identifier <id>", { description: "Tauri bundle identifier (e.g. 'com.company.app')" })
        .option("-d, --description <desc>", { description: "Project description" })
        .option("-p, --port <port>", { description: "Development server port (default: 4000)" })
        .option("-f, --force", { description: "Force overwrite target directory if it exists" })
        .option("-y, --yes", { description: "Skip prompts and use defaults" })
        .option("-g, --git", { description: "Initialize a git repository" })
        .option("--no-git", { description: "Do not initialize a git repository" })
        .option("--install", { description: "Install dependencies automatically" })
        .option("--no-install", { description: "Do not install dependencies" })
        .action(handle_create_project)

    cli
        .command("init", "Alias for create")
        .option("-t, --title <title>", { description: "App display title (e.g. 'My App')" })
        .option("-i, --identifier <id>", { description: "Tauri bundle identifier (e.g. 'com.company.app')" })
        .option("-d, --description <desc>", { description: "Project description" })
        .option("-p, --port <port>", { description: "Development server port (default: 4000)" })
        .option("-f, --force", { description: "Force overwrite target directory if it exists" })
        .option("-y, --yes", { description: "Skip prompts and use defaults" })
        .option("-g, --git", { description: "Initialize a git repository" })
        .option("--no-git", { description: "Do not initialize a git repository" })
        .option("--install", { description: "Install dependencies automatically" })
        .option("--no-install", { description: "Do not install dependencies" })
        .action(handle_create_project)

    cli
        .command("clean", "Clean up generated files and caches")
        .action(() => {
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
            ]

            console.log("[nextkit] Cleaning up project caches...")
            for (const target of targets){
                const target_path = path.resolve(source_root, target)
                if (fs.existsSync(target_path)){
                    console.log(`[nextkit] Removing ${target}...`)
                    fs.rmSync(target_path, { recursive: true, force: true })
                }
            }
            console.log("[nextkit] Project cleaned successfully.")
        })

    const raw_args = process.argv.slice(2)
    const first_arg = raw_args[0]
    const is_known_command = Boolean(first_arg && ["create", "init", "clean", "-h", "--help"].includes(first_arg))
    const args_to_run = is_known_command ? raw_args : ["create", ...raw_args]

    await cli.run(args_to_run)
}

main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[nextkit] Error: ${message}`)
    process.exitCode = 1
})
