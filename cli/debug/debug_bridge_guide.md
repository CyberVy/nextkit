# Developer Guide: Frontend Debug Bridge

To facilitate bidirectional communication between the **Frontend Browser Context (Webview)** and the **AI Agent (Host Sandbox)** during development, this project implements a lightweight, zero-dependency, and non-intrusive **Debug Bridge**. 

This document explains how the mechanism works under the hood and how subsequent developers or AI agents can use it.

---

## 1. How the Mechanism Works

The communication runs purely on standard web protocols (Server-Sent Events & HTTP POST) and is handled by a Node.js development sidecar. It keeps the core React frontend codebase (`src/core`, `src/infra`, `src/app/page.tsx`, etc.) 100% clean and untouched.

```
                           [ Local Filesystem (Shared Mailbox) ]
                                   /.debug/request.json
                                   /.debug/response.json
                                   /.debug/logs.jsonl
                                           ▲
                                           │ (Silent File Read/Write)
                                           ▼
                                    [ AI Developer ]
                                           │
                                           ▼ (Launches via npm run dev)
 ┌─────────────────────────────────────────┴─────────────────────────────────────────┐
 │                                                                                   │
 │   [ Pre-dev Script (generate_debug_bridge.ts) ]   [ Active Server (launch.ts) ]   │
 │   • Resolves a free TCP port (e.g. 9999)          • Binds to the resolved port    │
 │   • Writes port number to port.txt                • Watches request.json &        │
 │   • Replaces {{SERVER_URL}} in template and         pushes commands via SSE       │
 │     outputs public/debug_bridge.js                • Collects logs & responses     │
 │                                                           ▲                       │
 └───────────────────────────────────────────────────────────┼───────────────────────┘
                                                             │ (EventSource & Fetch)
                                                             ▼
                                                [ Browser / Tauri Webview ]
                                                • Loads public/debug_bridge.js
                                                • Hijacks console & errors
                                                • Evaluates incoming commands
```

### Components List
* **`cli/debug/generate_debug_bridge.ts`** (Pre-dev task): Finds an available TCP port (starting from `9999`), saves the port to `.debug/port.txt`, and generates `public/debug_bridge.js` from the template.
* **`cli/debug/debug_bridge_template.js`** (Browser Script Template): The JavaScript client template that runs inside the browser, intercepting logs and evaluating incoming commands.
* **`cli/debug/launch.ts`** (Active Communication Server): A long-running HTTP server that reads the port from `.debug/port.txt` and manages the dynamic WebSocket/SSE pipeline.
* **`src/app/layout.tsx`** (JSX Anchor): Anchors the script dynamically:
  ```tsx
  {process.env.NODE_ENV === "development" && (
      <script src="/debug_bridge.js" defer />
  )}
  ```
* **`.debug/`** (Ignored Data Directory): Acts as the local "mailbox" containing the files used for communication (`request.json`, `response.json`, `logs.jsonl`, `port.txt`).

---

## 2. Developer/Agent Usage Guide

### Step 1: Start the Development Environment
Run the dev script in the terminal:
```bash
npm run dev
```
This automatically triggers `dev:debug_bridge` first to find a free port and write the dynamic client script, then concurrently launches the Service Worker compiler, the Next.js Turbopack dev server, and our debugging server (`launch.ts`).

### Step 2: Sending Commands / Querying Frontend State
The AI agent does **not** need to make network requests. It communicates silently by writing to `.debug/request.json`.

Write a JSON object to **`/.debug/request.json`**:
```json
{
  "id": "query_1",
  "code": "document.title"
}
```

Wait a few milliseconds, and read the response from **`/.debug/response.json`**:
```json
{
  "id": "query_1",
  "success": true,
  "result": "Hello!"
}
```

You can execute any arbitrary JavaScript expression, inspect the React state (if exposed to `window`), navigate the router, or trigger DOM events:
```json
{
  "id": "query_2",
  "code": "document.querySelector('button').click()"
}
```

### Step 3: Inspecting Frontend Logs
Read the JSON Lines file at **`/.debug/logs.jsonl`** to view console outputs, uncaught exceptions, and Turbopack dev compiler logs:
```jsonl
{"timestamp":1783567259175,"level":"info","message":"Service worker is registered successfully."}
```
All console prints (`log`, `warn`, `error`, `info`) and runtime crashes are captured and appended in real-time.

---

## 3. Git Hygiene
The generated files and logs are completely ignored by git using the following `.gitignore` rules:
```gitignore
/.debug
/public/debug_bridge.js
```
The codebase remains pristine, and no runtime data will ever pollute the commit logs.
