pub(crate) mod inject;
pub(crate) mod itp;
pub(crate) mod storage;

use crate::window;

use tauri::{Manager, Runtime, WebviewWindowBuilder};

pub(crate) fn create_main_window<R: Runtime>(app: &mut tauri::App<R>) -> tauri::Result<()> {
    itp::disable();

    let app = &*app;
    let webview_builder = window::main_window::builder(app)?;
    let webview_builder = configure_builder(app, webview_builder)?;

    let main_window = webview_builder.build()?;
    window::appearance::sync(&main_window)?;
    Ok(())
}

#[cfg(desktop)]
fn create_popup<R: Runtime>(
    app: &tauri::AppHandle<R>,
    url: &tauri::Url,
    features: tauri::webview::NewWindowFeatures,
) -> tauri::Result<tauri::WebviewWindow<R>> {
    let webview_builder = window::popup::builder(app, url, features);
    let webview_builder = configure_builder(app, webview_builder)?;

    let popup_window = webview_builder.build()?;
    window::appearance::sync(&popup_window)?;
    window::appearance::reveal(&popup_window, true)?;
    Ok(popup_window)
}

pub(crate) fn configure_builder<'a, R, M, C>(
    manager: &C,
    builder: WebviewWindowBuilder<'a, R, M>,
) -> tauri::Result<WebviewWindowBuilder<'a, R, M>>
where
    R: Runtime,
    M: Manager<R>,
    C: Manager<R>,
{
    let mut builder = storage::configure(manager, builder)?;
    let app_config = manager.app_handle().config();
    if let Some(user_agent) = app_config
        .app
        .windows
        .iter()
        .find(|window_config| window_config.label == "main")
        .or_else(|| app_config.app.windows.first())
        .and_then(|window_config| window_config.user_agent.as_deref())
    {
        builder = builder.user_agent(user_agent);
    }
    let builder = window::appearance::configure_builder(builder);
    #[cfg(desktop)]
    let builder = {
        let builder = builder.visible(false);
        window::popup::configure(manager, builder, create_popup)
    };
    let builder = inject::configure(builder);
    Ok(builder)
}
