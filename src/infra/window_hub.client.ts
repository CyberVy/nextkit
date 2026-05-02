import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import type {
    WindowHubIncomingEnvelope, WindowHubMessageHandler,
    WindowHubMessenger, WindowHubSendOptions,
} from "@/infra/window_hub.types"
import { is_in_native } from "./device.client"

const WINDOW_HUB_EVENT = "window-hub:message"

function normalize_id(id: string, field_name: "id" | "target_id"){
    const normalized_id = id.trim()
    if (!normalized_id){
        throw new Error(`${field_name} can not be empty`)
    }
    return normalized_id
}

/**
 * Usage:
 * ```ts
 * import { register } from "@/infra/window_hub.client"
 *
 * const messenger = await register("main")
 * const off = messenger.onMessage((data, sender) => {
 *     console.log("from:", sender, "data:", data)
 * })
 *
 * await messenger.send("another id", { action: "next" })
 *
 * off()
 * await messenger.close()
 * ```
 */
export async function register<TData = unknown>(id: string): Promise<WindowHubMessenger<TData>>{
    if (!is_in_native()){
        throw new Error("window hub is only available in native context")
    }

    const normalized_id = normalize_id(id, "id")
    await invoke("window_hub_register", { id: normalized_id })

    const handlers = new Set<WindowHubMessageHandler<TData>>()
    let closed = false
    let ensure_listening_promise: Promise<() => void> | null = null
    let remove_lifecycle_listeners: (() => void) | null = null

    const ensure_listening = () => {
        if (ensure_listening_promise){
            return ensure_listening_promise
        }

        ensure_listening_promise = listen<WindowHubIncomingEnvelope<TData>>(WINDOW_HUB_EVENT, event => {
            if (event.payload?.receiver_id !== normalized_id){
                return
            }

            handlers.forEach(handler => {
                handler(event.payload.data, event.payload.sender)
            })
        })

        return ensure_listening_promise
    }

    const setup_lifecycle_unload = () => {
        if (remove_lifecycle_listeners){
            return
        }

        const on_lifecycle_end = () => {
            void close()
        }

        window.addEventListener("pagehide", on_lifecycle_end)
        window.addEventListener("beforeunload", on_lifecycle_end)
        remove_lifecycle_listeners = () => {
            window.removeEventListener("pagehide", on_lifecycle_end)
            window.removeEventListener("beforeunload", on_lifecycle_end)
        }
    }

    const close = async () => {
        if (closed) return

        closed = true
        handlers.clear()

        remove_lifecycle_listeners?.()
        remove_lifecycle_listeners = null

        if (ensure_listening_promise){
            const unlisten = await ensure_listening_promise
            unlisten()
            ensure_listening_promise = null
        }

        await invoke("window_hub_unregister", { id: normalized_id }).catch(() => {})
    }

    setup_lifecycle_unload()
    await ensure_listening()

    return {
        send: async (target_id: string, data: TData, _options?: WindowHubSendOptions) => {
            if (closed){
                throw new Error(`messenger(${normalized_id}) is closed`)
            }
            void _options
            const normalized_target_id = normalize_id(target_id, "target_id")
            await invoke("window_hub_send", {
                senderId: normalized_id,
                targetId: normalized_target_id,
                data,
            })
        },
        onMessage: (handler: WindowHubMessageHandler<TData>) => {
            if (closed){
                throw new Error(`messenger(${normalized_id}) is closed`)
            }
            handlers.add(handler)
            return () => {
                handlers.delete(handler)
            }
        },
        close,
    }
}
