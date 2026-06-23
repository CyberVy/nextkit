export function setup_tauri_opener_polyfill(){
    if (typeof window !== "undefined" && !window.opener){
        const mock_opener = {
            postMessage: (message: any, _targetOrigin: string) => {
                if (window.__TAURI__?.core?.invoke){
                    window.__TAURI__.core.invoke("post_message_to_main", { message })
                }
            }
        } as any
        mock_opener.window = mock_opener
        window.opener = mock_opener
    }
}
