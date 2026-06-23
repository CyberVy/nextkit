interface IPCRequest {
    readonly id: string
    readonly type: string
    readonly payload: Record<string, unknown>
    readonly sender_webview_label?: string
}

interface IPCResponse {
    readonly id: string
    readonly result: unknown
}

type IPCRequestTarget =
    | Window
    | ServiceWorker
    | MessagePort
    | Client
    | "service-worker"
    | "parent"
    | "opener"
    | string

export interface WebIPCRequestParams {
    target: IPCRequestTarget
    type: string
    payload?: Record<string, unknown>
    delay?: number
}

export interface WebIPCHandleParams {
    type: string
    handler: (payload: Record<string, unknown>) => unknown | Promise<unknown>
    listener?: MessagePort | Window | ServiceWorkerContainer | typeof self
}

let id_counter = 0
function create_id(): string{
    return Date.now().toString(36) + "_" + (id_counter++).toString(36) + "_" + Math.random().toString(36).slice(2)
}

function parse_message_data(data: unknown): Record<string, unknown> | null{
    if (typeof data === "string"){
        try {
            const parsed = JSON.parse(data)
            return parsed && typeof parsed === "object" ? parsed : null
        }
        catch {
            return null
        }
    }
    return data && typeof data === "object" ? (data as Record<string, unknown>) : null
}

// warning: target instanceof Window is not reliable for windows created by window.open and iframe.contentWindow
function is_window(target: unknown): target is Window{
    if (!target) return false
    if (typeof target !== "object") return false

    return "window" in target && "postMessage" in target
}

export async function web_ipc_call({ target, type, payload = {}, delay = 30000 }: WebIPCRequestParams): Promise<unknown>{

    const id = create_id()

    let sender: Window | ServiceWorker | MessagePort | Client | null = null
    let listener: EventTarget = typeof window !== "undefined" ? window : self
    let use_origin = false
    let is_tauri_webview = false
    let target_webview_label: string | null = null

    if (typeof target === "string"){
        if (target === "service-worker"){
            if (typeof navigator === "undefined" || !navigator.serviceWorker){
                throw new Error("Service worker is not supported in this environment")
            }
            const registration = await navigator.serviceWorker.ready
            if (!registration.active){
                throw new Error("No active service worker")
            }
            sender = registration.active
            listener = navigator.serviceWorker
        }
        else if (target === "parent"){
            if (typeof window === "undefined") throw new Error("window is not defined")
            sender = window.parent
            use_origin = true
        }
        else if (target === "opener"){
            if (typeof window === "undefined") throw new Error("window is not defined")
            sender = window.opener
            use_origin = true
        }
        else {
            is_tauri_webview = true
            target_webview_label = target
        }
    }
    else {
        sender = target
        if (is_window(target)){
            use_origin = true
        }
        else if (typeof MessagePort !== "undefined" && target instanceof MessagePort){
            listener = target
            target.start()
        }
        else if (typeof Client !== "undefined" && target instanceof Client){
            listener = self
        }
    }

    if (!sender && !is_tauri_webview){
        throw new Error("Invalid IPC request target")
    }

    return new Promise<unknown>((resolve, reject) => {
        const timer = setTimeout(() => {
            listener.removeEventListener("message", callback)
            reject(new Error(`IPC request timeout for type: ${type}`))
        }, delay)

        const callback = (event: Event) => {
            const msg_event = event as MessageEvent
            const event_data = parse_message_data(msg_event.data) as IPCResponse | null
            if (event_data && event_data.id === id){
                clearTimeout(timer)
                listener.removeEventListener("message", callback)
                resolve(event_data.result)
            }
        }

        listener.addEventListener("message", callback)

        const msg: IPCRequest = { id, type, payload }
        if (is_tauri_webview && target_webview_label){
            if (typeof window !== "undefined" && window.__TAURI__?.core?.invoke){
                window.__TAURI__.core.invoke("post_message_to_webview", {
                    label: target_webview_label,
                    message: msg
                }).catch(reject)
            }
            else {
                reject(new Error("Tauri invoke is not available in this context"))
            }
        }
        else if (use_origin){
            (sender as Window).postMessage(msg, "*")
        }
        else {
            (sender as ServiceWorker | MessagePort | Client).postMessage(msg)
        }
    })
}

export function handle_web_ipc({ type, handler, listener = typeof self !== "undefined" ? self : undefined } : WebIPCHandleParams): () => void{
    if (!listener){
        throw new Error("No message listener target available")
    }

    const message_callback = async (event: Event) => {
        const msg_event = event as MessageEvent
        const event_data = parse_message_data(msg_event.data) as IPCRequest | null
        if (!event_data) return
        if (event_data.type !== type) return
        if (!msg_event.source && !event_data.sender_webview_label) return

        const result = await handler(event_data.payload)
        if (event_data.sender_webview_label){
            if (typeof window !== "undefined" && window.__TAURI__?.core?.invoke){
                window.__TAURI__.core.invoke("post_message_to_webview", {
                    label: event_data.sender_webview_label,
                    message: { id: event_data.id, result } as IPCResponse
                }).catch((err: any) => console.warn(`Failed to route IPC reply to ${event_data.sender_webview_label}:`, err))
            }
        }
        else if (msg_event.source){
            if (is_window(msg_event.source)){
                msg_event.source.postMessage({ id: event_data.id, result } as IPCResponse, "*")
            }
            else {
                (msg_event.source as MessagePort | Client | ServiceWorker).postMessage({ id: event_data.id, result } as IPCResponse)
            }
        }
    }

    if (typeof MessagePort !== "undefined" && listener instanceof MessagePort){
        listener.start()
    }

    listener.addEventListener("message", message_callback)
    return () => listener.removeEventListener("message", message_callback)
}
