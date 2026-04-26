use std::sync::atomic::{AtomicUsize, Ordering};

use tauri::{App, AppHandle, Manager, Runtime, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use crate::{webview, window};

#[cfg(desktop)]
static POPUP_WINDOW_COUNTER: AtomicUsize = AtomicUsize::new(0);

#[cfg(desktop)]
fn default_popup_size<R: Runtime>(app: &AppHandle<R>) -> (f64, f64) {
    let main_window_config = app
        .config()
        .app
        .windows
        .iter()
        .find(|window_config| window_config.label == "main")
        .or_else(|| app.config().app.windows.first())
        .expect("main window config not found");

    (main_window_config.width, main_window_config.height)
}

fn configure_external_open<'a, R, M, C>(
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

        builder.on_new_window(
            move |url, features| match create_popup(&app, &url, features) {
                Ok(window) => tauri::webview::NewWindowResponse::Create { window },
                Err(error) => {
                    log::error!("failed to create popup window for {url}: {error}");
                    tauri::webview::NewWindowResponse::Deny
                }
            },
        )
    }
    #[cfg(not(desktop))]
    {
        let _ = manager;
        builder
    }
}

pub fn configure_builder<'a, R, M, C>(
    manager: &C,
    builder: WebviewWindowBuilder<'a, R, M>,
) -> tauri::Result<WebviewWindowBuilder<'a, R, M>>
where
    R: Runtime,
    M: Manager<R>,
    C: Manager<R>,
{
    let builder = webview::storage::configure(manager, builder)?;
    let builder = window::appearance::configure_builder(builder);
    #[cfg(desktop)]
    let builder = builder.visible(false);
    let builder = configure_external_open(manager, builder);
    let builder = webview::inject::configure(builder);
    Ok(builder)
}

pub fn configure_main_builder<'a, R, M, C>(
    manager: &C,
    builder: WebviewWindowBuilder<'a, R, M>,
) -> tauri::Result<WebviewWindowBuilder<'a, R, M>>
where
    R: Runtime,
    M: Manager<R>,
    C: Manager<R>,
{
    // Reuse the shared window/webview setup so injection and base behavior
    // stay aligned across main window and popups.
    let builder = configure_builder(manager, builder)?;
    let builder = window::no_flicker::configure(builder);
    Ok(builder)
}

pub fn create_main<R: Runtime>(app: &mut App<R>) -> tauri::Result<()> {

    let main_window_config = app
        .config()
        .app
        .windows
        .iter()
        .find(|window_config| window_config.label == "main")
        .or_else(|| app.config().app.windows.first())
        .expect("main window config not found");

    let webview_builder = WebviewWindowBuilder::from_config(app, main_window_config)?;
    let webview_builder = configure_main_builder(app, webview_builder)?;

    let window = webview_builder.build()?;
    window::appearance::sync(&window)?;
    Ok(())
}

#[cfg(desktop)]
pub fn create_popup<R: Runtime>(
    app: &AppHandle<R>,
    url: &tauri::Url,
    features: tauri::webview::NewWindowFeatures,
) -> tauri::Result<WebviewWindow<R>> {
    let popup_label = format!(
        "popup-{}",
        POPUP_WINDOW_COUNTER.fetch_add(1, Ordering::Relaxed)
    );

    let (default_width, default_height) = default_popup_size(app);

    let mut webview_builder = WebviewWindowBuilder::new(
        app,
        popup_label,
        WebviewUrl::External(
            "about:blank"
                .parse()
                .expect("about:blank should always parse"),
        ),
    )
    .title(url.as_str())
    .on_document_title_changed(|window, title| {
        let _ = window.set_title(&title);
    });

    if features.size().is_none() {
        webview_builder = webview_builder.inner_size(default_width, default_height);
    }

    webview_builder = webview_builder.window_features(features);

    let webview_builder = configure_builder(app, webview_builder)?;

    let window = webview_builder.build()?;
    window::appearance::sync(&window)?;
    window::appearance::reveal(&window, true)?;
    Ok(window)
}
