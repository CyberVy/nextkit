use tauri::{Manager, Runtime, WebviewWindowBuilder};

use crate::window;

pub fn configure<'a, R, M, C>(
    manager: &C,
    builder: WebviewWindowBuilder<'a, R, M>,
) -> WebviewWindowBuilder<'a, R, M>
where
    R: Runtime,
    M: Manager<R>,
    C: Manager<R>,
{
    #[cfg(desktop)]
    {
        let app = manager.app_handle().clone();

        builder.on_new_window(move |url, features| {
            match window::setup::create_popup(&app, &url, features) {
                Ok(window) => tauri::webview::NewWindowResponse::Create { window },
                Err(error) => {
                    log::error!("failed to create popup window for {url}: {error}");
                    tauri::webview::NewWindowResponse::Deny
                }
            }
        })
    }
    #[cfg(not(desktop))]
    {
        builder
    }
}
