import http from "node:http"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEBUG_DIR = path.resolve(__dirname, "../../.debug")
const REQUEST_FILE = path.join(DEBUG_DIR, "request.json")
const RESPONSE_FILE = path.join(DEBUG_DIR, "response.json")
const LOGS_FILE = path.join(DEBUG_DIR, "logs.jsonl")
const PORT_FILE = path.join(DEBUG_DIR, "port.txt")

const PORT = parseInt(fs.readFileSync(PORT_FILE, "utf8").trim(), 10)

let client_res: http.ServerResponse | null = null

// Ensure the .debug directory exists
if (!fs.existsSync(DEBUG_DIR)){
    fs.mkdirSync(DEBUG_DIR, { recursive: true })
}

// Watch request.json for changes
fs.watch(DEBUG_DIR, (event_type, filename) => {
    if (filename === "request.json" && fs.existsSync(REQUEST_FILE)){
        try {
            const data = fs.readFileSync(REQUEST_FILE, "utf8")
            if (data.trim() && client_res){
                // Send SSE event
                client_res.write(`data: ${data.replace(/\n/g, "")}\n\n`)
            }
        }
        catch (err){
            console.error("[Debug Server] Failed to read request file:", err)
        }
    }
})

const server = http.createServer((req, res) => {
    // Enable CORS for frontend connection
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type")
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

    if (req.method === "OPTIONS"){
        res.writeHead(200)
        res.end()
        return
    }

    if (req.url === "/events"){
        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        })
        client_res = res
        req.on("close", () => {
            if (client_res === res){
                client_res = null
            }
        })
        return
    }

    if (req.url === "/respond" && req.method === "POST"){
        let body = ""
        req.on("data", (chunk) => {
            body += chunk
        })
        req.on("end", () => {
            try {
                fs.writeFileSync(RESPONSE_FILE, body, "utf8")
                res.writeHead(200, { "Content-Type": "application/json" })
                res.end(JSON.stringify({ status: "ok" }))
            }
            catch (err){
                res.writeHead(500)
                res.end(String(err))
            }
        })
        return
    }

    if (req.url === "/log" && req.method === "POST"){
        let body = ""
        req.on("data", (chunk) => {
            body += chunk
        })
        req.on("end", () => {
            try {
                fs.appendFileSync(LOGS_FILE, body + "\n", "utf8")
                res.writeHead(200, { "Content-Type": "application/json" })
                res.end(JSON.stringify({ status: "ok" }))
            }
            catch (err){
                res.writeHead(500)
                res.end(String(err))
            }
        })
        return
    }

    res.writeHead(404)
    res.end()
})

server.on("listening", () => {
    console.log(`[Debug Server] Running on http://127.0.0.1:${PORT}`)
    console.log(`[Debug Server] Communication directory: ${DEBUG_DIR}`)
})

server.on("error", (err: any) => {
    console.error("[Debug Server] Server error:", err)
})

server.listen(PORT, "127.0.0.1")
