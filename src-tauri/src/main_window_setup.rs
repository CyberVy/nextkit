use tauri::{App, Runtime, WebviewWindowBuilder};

use crate::{webview, window};

pub fn create<R: Runtime>(app: &mut App<R>) -> tauri::Result<()> {
    let main_window_config = app
        .config()
        .app
        .windows
        .iter()
        .find(|window_config| window_config.label == "main")
        .or_else(|| app.config().app.windows.first())
        .expect("main window config not found");

    let webview_builder = WebviewWindowBuilder::from_config(app, main_window_config)?;
    let webview_builder = webview::storage::configure(app, webview_builder)?;
    let webview_builder = window::appearance::configure_builder(webview_builder);
    let webview_builder = window::no_flicker::configure(webview_builder);
    let webview_builder = webview::external_open::configure(webview_builder);
    let webview_builder = webview::inject::configure(webview_builder);

    let window = webview_builder.build()?;
    window::appearance::sync(&window)?;
    Ok(())
}
