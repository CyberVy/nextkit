import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "node:path"
import fs from "node:fs"

export default defineConfig({
    root: path.resolve(import.meta.dirname, "src/app"),
    publicDir: path.resolve(import.meta.dirname, "public"),
    plugins: [
        react({
            compiler: true
        }),
        {
            name: "native-entry-handler",
            configureServer(server){
                server.middlewares.use((req, _res, next) => {
                    if (req.url === "/native_entry" || req.url === "/native_entry/"){
                        req.url = "/native_entry/index.html"
                    }
                    next()
                })
            },
            closeBundle(){
                const out_dir = path.resolve(import.meta.dirname, "dist")
                const src_file = path.join(out_dir, "native_entry/index.html")
                const dest_file = path.join(out_dir, "native_entry.html")
                if (fs.existsSync(src_file)){
                    fs.copyFileSync(src_file, dest_file)
                }
            }
        }
    ],
    resolve: {
        alias: {
            "@": path.resolve(import.meta.dirname, "./src")
        }
    },
    server: {
        port: 4000,
        host: "0.0.0.0",
        fs: {
            allow: [path.resolve(import.meta.dirname)]
        }
    },
    build: {
        outDir: path.resolve(import.meta.dirname, "dist"),
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: path.resolve(import.meta.dirname, "src/app/index.html"),
                native_entry: path.resolve(import.meta.dirname, "src/app/native_entry/index.html")
            }
        }
    },
    define: {
        "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "development"),
        "import.meta.env.VITE_BUILD_TIME": JSON.stringify(new Date().toUTCString()),
        "import.meta.env.VITE_NATIVE_ENTRY_URL": JSON.stringify("/")
    }
})
