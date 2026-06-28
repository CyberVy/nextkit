import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { execSync, spawn } from "node:child_process"
import { create_cli } from "./lib/cli_builder.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let source_root = path.resolve(__dirname, "..")
if (!fs.existsSync(path.join(source_root, "package.json"))){
    source_root = path.resolve(__dirname, "../..")
}

const IGNORED_PATHS = [
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
]

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
    const clean = str
        .toLowerCase()
        .replace(/[^a-z0-9.]/g, "")
    return clean
}

async function main(){
    const cli = create_cli()

    cli
        .command("init", "Create a new Nextkit project from this template.\n\nPositionals:\n  <directory>               Target directory path where the project will be created (e.g. '../my-app')")
        .option("-t, --title <title>", { description: "App display title (e.g. 'My App')" })
        .option("-i, --identifier <id>", { description: "Tauri bundle identifier (e.g. 'com.company.app')" })
        .option("-d, --description <desc>", { description: "Project description" })
        .option("-p, --port <port>", { description: "Development server port (default: 4000)" })
        .option("-f, --force", { description: "Force overwrite target directory if it exists" })
        .action((ctx) => {
            const [target_arg] = ctx.args
            if (!target_arg){
                throw new Error("Missing target directory argument: nextkit init <directory>")
            }

            const dest_path = path.resolve(process.cwd(), target_arg)
            const folder_name = path.basename(dest_path)

            const kebab_name = to_kebab_case(folder_name)
            const title = (ctx.options.title as string) ?? to_title_case(folder_name)
            const identifier = (ctx.options.identifier as string) ?? `com.example.${kebab_name.replace(/-/g, "")}`
            const description = (ctx.options.description as string) ?? "A cross-platform native application built with Nextkit"
            const port = (ctx.options.port as string) ?? "4000"
            const force = !!ctx.options.force

            console.log(`\n🚀 Initializing new Nextkit project at: ${dest_path}`)
            console.log(`   * Package Name: ${kebab_name}`)
            console.log(`   * App Title:    ${title}`)
            console.log(`   * Identifier:   ${identifier}`)
            console.log(`   * Description:  ${description}`)
            console.log(`   * Dev Port:     ${port}\n`)

            if (fs.existsSync(dest_path)){
                if (force){
                    console.log(`⚠️  Target directory exists, removing due to --force...`)
                    fs.rmSync(dest_path, { recursive: true, force: true })
                }
                else {
                    throw new Error(`Target directory already exists: ${dest_path}. Use -f or --force to overwrite.`)
                }
            }

            // Copy template files
            console.log("📂 Copying template files...")
            fs.mkdirSync(dest_path, { recursive: true })

            const filter = (src: string) => {
                const relative = path.relative(source_root, src)
                if (!relative) return true
                
                return !IGNORED_PATHS.some((ignored) => {
                    const normalized_ignored = ignored.replace(/\//g, path.sep)
                    const normalized_relative = relative.replace(/\//g, path.sep)
                    return normalized_relative === normalized_ignored || 
                           normalized_relative.startsWith(normalized_ignored + path.sep)
                })
            }

            copy_recursive(source_root, dest_path, filter)

            // Make substitutions
            console.log("⚙️  Configuring identifiers...")

            // 1. package.json
            const pkgPath = path.join(dest_path, "package.json")
            if (fs.existsSync(pkgPath)){
                const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"))
                pkg.name = kebab_name
                pkg.title = title
                pkg.description = description
                // Nextkit uses "private": true, we keep it but reset version
                pkg.version = "0.1.0"
                
                // Clean up CLI-specific keys so the new app doesn't inherit them
                delete pkg.bin
                if (pkg.scripts){
                    delete pkg.scripts.cli
                    delete pkg.scripts["build:cli"]
                    delete pkg.scripts.prepare
                    if (typeof pkg.scripts.dev === "string"){
                        pkg.scripts.dev = pkg.scripts.dev.replace(/-p 4000\b/g, `-p ${port}`)
                    }
                }
                
                fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8")
            }

            // 2. package-lock.json
            const lockPath = path.join(dest_path, "package-lock.json")
            if (fs.existsSync(lockPath)){
                const lock = JSON.parse(fs.readFileSync(lockPath, "utf-8"))
                if (lock.name) lock.name = kebab_name
                if (lock.packages && lock.packages[""]){
                    lock.packages[""].name = kebab_name
                    lock.packages[""].title = title
                    lock.packages[""].description = description
                    lock.packages[""].version = "0.1.0"
                }
                fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n", "utf-8")
            }

            // 3. public/manifest.json
            const manifestPath = path.join(dest_path, "public/manifest.json")
            if (fs.existsSync(manifestPath)){
                const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"))
                manifest.name = title
                manifest.short_name = title
                fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf-8")
            }

            // 4. src-tauri/tauri.conf.json
            const tauriConfPath = path.join(dest_path, "src-tauri/tauri.conf.json")
            if (fs.existsSync(tauriConfPath)){
                const conf = JSON.parse(fs.readFileSync(tauriConfPath, "utf-8"))
                conf.productName = title
                conf.identifier = to_valid_identifier(identifier)
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
                fs.writeFileSync(tauriConfPath, JSON.stringify(conf, null, 2) + "\n", "utf-8")
            }
            // 5. src/app/page.tsx
            const pagePath = path.join(dest_path, "src/app/page.tsx")
            if (fs.existsSync(pagePath)){
                let pageContent = fs.readFileSync(pagePath, "utf-8")
                pageContent = pageContent.replace(/Hello from Nextkit!/g, `Hello from ${title}!`)
                fs.writeFileSync(pagePath, pageContent, "utf-8")
            }


            // Initialize Git
            try {
                execSync("git init", { cwd: dest_path, stdio: "ignore" })
                console.log("✨ Initialized a new Git repository.")
            }
            catch {
                console.log("⚠️  Failed to initialize Git repository (git command not found).")
            }

            console.log(`\n🎉 Project initialized successfully at ${dest_path}`)
            console.log("\nTo get started:")
            console.log(`  cd ${target_arg}`)
            console.log("  npm install")
            console.log("  npm run dev")
            console.log("")
        })

    cli
        .command("dev", "Start development servers")
        .option("-p, --port <port>", { description: "Next.js dev port (default: 4000)" })
        .action((ctx) => {
            const port = (ctx.options.port as string) ?? "4000"

            console.log("🚀 Starting Nextkit development servers...")

            // Spawn esbuild for service worker
            const sw_proc = spawn("npx", [
                "esbuild",
                "src/sw/main.worker.ts",
                "--bundle",
                "--format=esm",
                "--target=esnext",
                "--outfile=public/sw.js",
                "--watch=forever",
                '--banner:js=// Generated by src/sw/main.worker.ts'
            ], { stdio: "inherit", shell: true })

            // Spawn next dev
            const next_proc = spawn("npx", ["next", "dev", "-p", port], { stdio: "inherit", shell: true })

            const cleanup = () => {
                console.log("\nStopping servers...")
                sw_proc.kill()
                next_proc.kill()
                process.exit(0)
            }

            process.on("SIGINT", cleanup)
            process.on("SIGTERM", cleanup)
        })

    cli
        .command("clean", "Clean up generated files and caches")
        .action(() => {
            const targets = [
                ".next",
                "out",
                "node_modules",
                "src-tauri/target",
                "src-tauri/gen",
                "tsconfig.tsbuildinfo"
            ]

            console.log("🧹 Cleaning up project caches...")
            for (const target of targets){
                const target_path = path.resolve(source_root, target)
                if (fs.existsSync(target_path)){
                    console.log(`Removing ${target}...`)
                    fs.rmSync(target_path, { recursive: true, force: true })
                }
            }
            console.log("✨ Project cleaned successfully!")
        })

    await cli.run(process.argv.slice(2))
}

main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`❌ Error: ${message}`)
    process.exitCode = 1
})
