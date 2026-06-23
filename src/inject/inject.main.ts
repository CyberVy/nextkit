import { setup_tauri_opener_polyfill } from "./infra/rpc/opener"

export function inject(){
    setup_tauri_opener_polyfill()
}
