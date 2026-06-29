#[cfg(desktop)]
use std::sync::atomic::{AtomicUsize, Ordering};

#[cfg(desktop)]
use tauri::{AppHandle, Manager, Runtime, WebviewUrl, WebviewWindow, WebviewWindowBuilder, LogicalPosition, LogicalSize, WebviewBuilder};

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
pub(crate) fn register_popup_webview_handler<'a, R, M, C, F>(
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
        move |url, features| {
            let opener_label = app
                .webview_windows()
                .values()
                .find(|w| w.is_focused().unwrap_or(false))
                .map(|w| w.label().to_string())
                .unwrap_or_else(|| "main".to_string());

            match create_popup(&app, &url, features) {
                Ok(popup_window) => {
                    let child_label = format!("{}-webview", popup_window.label());
                    let mut webview_builder = WebviewBuilder::new(
                        &child_label,
                        WebviewUrl::External(url.clone()),
                    )
                    .auto_resize()
                    .on_document_title_changed(|webview, title| {
                        let _ = webview.window().set_title(&title);
                    });

                    let label_script = format!(
                        "window.__TAURI_WEBVIEW_LABEL__ = '{}'; window.__TAURI_OPENER_LABEL__ = '{}';",
                        child_label,
                        opener_label
                    );
                    webview_builder = webview_builder.initialization_script(&label_script);

                    let inject_script = include_str!("../inject.js").trim();
                    if !inject_script.is_empty() {
                        webview_builder = webview_builder.initialization_script(inject_script);
                    }

                    let scale_factor = popup_window.scale_factor().unwrap_or(1.0);
                    let inner_size = popup_window
                        .inner_size()
                        .map(|s| s.to_logical::<f64>(scale_factor))
                        .unwrap_or_else(|_| LogicalSize::new(0.0, 0.0));

                    if let Some(window) = app.get_window(popup_window.label()) {
                        if let Err(error) = window.add_child(
                            webview_builder,
                            LogicalPosition::new(0.0, 0.0),
                            inner_size,
                        ) {
                            log::error!("failed to add child webview to popup window: {error}");
                        }
                    } else {
                        log::error!("failed to find underlying window for popup {}", popup_window.label());
                    }
                }
                Err(error) => {
                    log::error!("failed to create popup window for {url}: {error}");
                }
            }

            tauri::webview::NewWindowResponse::Deny
        },
    )
}

#[cfg(desktop)]
pub(crate) fn create_popup_window_builder<'a, R: Runtime>(
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
    .title(url.as_str());

    if let Some(size) = features.size() {
        webview_builder = webview_builder.inner_size(size.width, size.height);
    } else {
        webview_builder = webview_builder.inner_size(default_width, default_height);
    }

    if let Some(position) = features.position() {
        webview_builder = webview_builder.position(position.x, position.y);
    }

    #[cfg(not(target_os = "macos"))]
    {
        webview_builder = webview_builder.window_features(features);
    }

    webview_builder
}
