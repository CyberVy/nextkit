import fs from "node:fs"
import path from "node:path"
import net from "node:net"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEBUG_DIR = path.resolve(__dirname, "../../.debug")
const PORT_FILE = path.join(DEBUG_DIR, "port.txt")
const TEMPLATE_PATH = path.join(__dirname, "debug_bridge_template.js")
const PUBLIC_BRIDGE_PATH = path.resolve(__dirname, "../../public/debug_bridge.js")

// Ensure .debug exists
if (!fs.existsSync(DEBUG_DIR)){
    fs.mkdirSync(DEBUG_DIR, { recursive: true })
}

// Function to find a free port starting from 9999
function find_free_port(start_port: number): Promise<number>{
    return new Promise((resolve) => {
        const server = net.createServer()
        server.unref()
        server.on("error", () => {
            resolve(find_free_port(start_port + 1))
        })
        server.listen(start_port, "127.0.0.1", () => {
            const address = server.address()
            const port = typeof address === "string" ? start_port : address?.port || start_port
            server.close(() => {
                resolve(port)
            })
        })
    })
}

async function main(){
    try {
        const port = await find_free_port(9999)

        // Write port to port.txt
        fs.writeFileSync(PORT_FILE, String(port), "utf8")

        // Generate public/debug_bridge.js
        const template = fs.readFileSync(TEMPLATE_PATH, "utf8")
        const generated = template.replace("{{SERVER_URL}}", `http://127.0.0.1:${port}`)
        fs.writeFileSync(PUBLIC_BRIDGE_PATH, generated, "utf8")

        console.log(`[Debug Bridge Init] Generated public/debug_bridge.js pointing to port ${port}`)
    }
    catch (err){
        console.error("[Debug Bridge Init] Initialization failed:", err)
        process.exit(1)
    }
}

main()
