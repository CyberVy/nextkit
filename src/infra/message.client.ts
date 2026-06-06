let id_counter = 0

function create_id(){
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

export function request_to_window(receiver: Window, type: string, payload: Record<string, unknown> = {}, delay = 30000){
    const id = create_id()
    const promise = new Promise((resolve, reject) => {

        const timer = window.setTimeout(() => {
            window.removeEventListener("message", callback)
            reject(new Error("Timeout"))
        }, delay)

        const callback = (event: MessageEvent) => {
            const event_data = parse_message_data(event.data) as RPCResponse | null
            if (event_data && event_data.id === id && event.source === receiver){
                window.clearTimeout(timer)
                window.removeEventListener("message", callback)
                resolve(event_data.result)
            }
        }
        window.addEventListener("message", callback)
        receiver.postMessage({ id, type, payload } as RPCRequest, "*")
    })
    return promise
}

export function handle_request(type: string, callback: (payload: Record<string, unknown>) => unknown | Promise<unknown>){
    const message_callback = async (event: MessageEvent) => {
        const event_data = parse_message_data(event.data) as RPCRequest | null
        if (!event_data) return

        if (event_data.type === type){
            const result = await callback(event_data.payload)
            if (event.source){
                ;(event.source as Window).postMessage({ id: event_data.id, result } as RPCResponse, "*")
            }
        }
    }
    window.addEventListener("message", message_callback)
    return () => window.removeEventListener("message", message_callback)
}
