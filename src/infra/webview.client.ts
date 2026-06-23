import { invoke } from "@tauri-apps/api/core"

export interface LayoutItem {
  label: string
  left: number
  top: number
  width: number
  height: number
}

export async function create_child_webview(label: string, url: string): Promise<void>{
    await invoke("create_child_webview", { label, url })
}

export async function destroy_child_webview(label: string): Promise<void>{
    await invoke("destroy_child_webview", { label })
}

export async function set_window_layout(items: LayoutItem[]): Promise<void>{
    await invoke("set_window_layout", { items })
}
