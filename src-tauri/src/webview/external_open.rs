use tauri::{Manager, Runtime, WebviewWindowBuilder};

pub fn configure<'a, R, M>(
    builder: WebviewWindowBuilder<'a, R, M>,
) -> WebviewWindowBuilder<'a, R, M>
where
    R: Runtime,
    M: Manager<R>,
{
    #[cfg(desktop)]
    {
        builder.on_new_window(move |_url, _features| {
            // Keep the platform default popup path so opener is preserved.
            tauri::webview::NewWindowResponse::Allow
        })
    }
    #[cfg(not(desktop))]
    {
        builder
    }
}
