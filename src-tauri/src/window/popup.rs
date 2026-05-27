#[cfg(desktop)]
use std::sync::atomic::{AtomicUsize, Ordering};

#[cfg(desktop)]
use tauri::{AppHandle, Manager, Runtime, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

#[cfg(desktop)]
static POPUP_WINDOW_COUNTER: AtomicUsize = AtomicUsize::new(0);

#[cfg(desktop)]
fn default_size<R: Runtime>(app: &AppHandle<R>) -> (f64, f64) {
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

#[cfg(desktop)]
pub(crate) fn configure<'a, R, M, C, F>(
    manager: &C,
    builder: WebviewWindowBuilder<'a, R, M>,
    create_popup: F,
) -> WebviewWindowBuilder<'a, R, M>
where
    R: Runtime,
    M: Manager<R>,
    C: Manager<R>,
    F: Fn(
            &AppHandle<R>,
            &tauri::Url,
            tauri::webview::NewWindowFeatures,
        ) -> tauri::Result<WebviewWindow<R>>
        + Send
        + 'static,
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

#[cfg(desktop)]
pub(crate) fn builder<'a, R: Runtime>(
    app: &'a AppHandle<R>,
    url: &tauri::Url,
    features: tauri::webview::NewWindowFeatures,
) -> WebviewWindowBuilder<'a, R, AppHandle<R>> {
    let popup_label = format!(
        "popup-{}",
        POPUP_WINDOW_COUNTER.fetch_add(1, Ordering::Relaxed)
    );

    let (default_width, default_height) = default_size(app);

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

    webview_builder
}
