mod fetch;

const INJECT_SCRIPT: &str = include_str!("./inject.js");

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();
    #[cfg(desktop)]
    {
        let state_flags = tauri_plugin_window_state::StateFlags::all()
            & !tauri_plugin_window_state::StateFlags::VISIBLE;
        builder = builder.plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(state_flags)
                .build(),
        );
    }

    builder
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let main_window_config = app
                .config()
                .app
                .windows
                .iter()
                .find(|window_config| window_config.label == "main")
                .or_else(|| app.config().app.windows.first())
                .expect("main window config not found");

            let inject_script = INJECT_SCRIPT.trim();
            let mut webview_builder =
                tauri::WebviewWindowBuilder::from_config(app, main_window_config)?;

            #[cfg(desktop)]
            {
                webview_builder = webview_builder
                    .background_color(tauri::webview::Color(0, 0, 0, 255))
                    .visible(false)
                    .on_page_load(|window, payload| {
                        if payload.event() == tauri::webview::PageLoadEvent::Finished {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    })
                    .on_new_window(move |_url, _features| {
                        // Let WKWebView create the popup with its default path so opener is preserved.
                        tauri::webview::NewWindowResponse::Allow
                    });
            }
            if !inject_script.is_empty() {
                webview_builder =
                    webview_builder.initialization_script_for_all_frames(inject_script);
            }
            webview_builder.build()?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![fetch::fetch])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
