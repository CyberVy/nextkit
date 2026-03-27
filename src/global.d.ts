export {}

declare global {
    interface Window {
        webkit?: {
            messageHandlers?: Record<string, unknown>
        }
        __TAURI__?: unknown
        __TAURI_INTERNALS__?: unknown
    }
}
