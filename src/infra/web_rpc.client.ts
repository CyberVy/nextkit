let id_counter = 0

function create_id(): string{
    return Date.now().toString(36) + "_" + (id_counter++).toString(36) + "_" + Math.random().toString(36).slice(2)
}

export interface RPCRequest {
    readonly id: string
    readonly type: string
    readonly payload: Record<string, unknown>
}

export interface RPCResponse {
    readonly id: string
    readonly result: unknown
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

export type RPCRequestTarget =
    | Window
    | ServiceWorker
    | MessagePort
    | Client
    | "service-worker"
    | "parent"
    | "opener"

export interface WebRPCRequestOptions {
    target: RPCRequestTarget
    type: string
    payload?: Record<string, unknown>
    delay?: number
}

export async function web_rpc_request(options: WebRPCRequestOptions): Promise<unknown>{
    const { target, type, payload = {}, delay = 30000 } = options
    const id = create_id()

    let sender: Window | ServiceWorker | MessagePort | Client | null = null
    let listener: EventTarget = typeof window !== "undefined" ? window : self
    let use_origin = false

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

    if (!sender){
        throw new Error("Invalid RPC request target")
    }

    return new Promise<unknown>((resolve, reject) => {
        const timer = setTimeout(() => {
            listener.removeEventListener("message", callback)
            reject(new Error(`RPC request timeout for type: ${type}`))
        }, delay)

        const callback = (event: Event) => {
            const msg_event = event as MessageEvent
            const event_data = parse_message_data(msg_event.data) as RPCResponse | null
            if (event_data && event_data.id === id){
                clearTimeout(timer)
                listener.removeEventListener("message", callback)
                resolve(event_data.result)
            }
        }

        listener.addEventListener("message", callback)

        const msg: RPCRequest = { id, type, payload }
        if (use_origin){
            (sender as Window).postMessage(msg, "*")
        }
        else {
            (sender as ServiceWorker | MessagePort | Client).postMessage(msg)
        }
    })
}

export interface WebRPCHandleOptions {
    type: string
    handler: (payload: Record<string, unknown>) => unknown | Promise<unknown>
    listener?: MessagePort | Window | ServiceWorkerContainer | typeof self
}

export function handle_web_rpc_request(options: WebRPCHandleOptions): () => void{
    const { type, handler, listener = typeof self !== "undefined" ? self : undefined } = options
    if (!listener){
        throw new Error("No message listener target available")
    }

    const message_callback = async (event: Event) => {
        const msg_event = event as MessageEvent
        const event_data = parse_message_data(msg_event.data) as RPCRequest | null
        if (!event_data) return
        if (event_data.type !== type) return
        if (!msg_event.source) return

        const result = await handler(event_data.payload)
        if (is_window(msg_event.source)){
            msg_event.source.postMessage({ id: event_data.id, result } as RPCResponse, "*")
        }
        else {
            (msg_event.source as MessagePort | Client | ServiceWorker).postMessage({ id: event_data.id, result } as RPCResponse)
        }
    }

    if (typeof MessagePort !== "undefined" && listener instanceof MessagePort){
        listener.start()
    }

    listener.addEventListener("message", message_callback)
    return () => listener.removeEventListener("message", message_callback)
}
