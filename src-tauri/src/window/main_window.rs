use tauri::{App, Runtime, WebviewWindowBuilder};

pub(crate) fn create_main_window_builder<'a, R: Runtime>(
    app: &'a App<R>,
) -> tauri::Result<WebviewWindowBuilder<'a, R, App<R>>> {
    let main_window_config = app
        .config()
        .app
        .windows
        .iter()
        .find(|window_config| window_config.label == "main")
        .or_else(|| app.config().app.windows.first())
        .expect("main window config not found");

    let webview_builder = WebviewWindowBuilder::from_config(app, main_window_config)?;
    Ok(super::no_flicker::hide_until_page_loaded(webview_builder))
}
