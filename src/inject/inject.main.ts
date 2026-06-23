import { setup_tauri_opener_polyfill } from "./infra/ipc/opener"

export function inject(){
    setup_tauri_opener_polyfill()
}
