mod fetch;
mod no_flicker;

const INJECT_SCRIPT: &str = include_str!("./inject.js");

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::new().build())
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
            if !inject_script.is_empty() {
                webview_builder =
                    webview_builder.initialization_script_for_all_frames(inject_script);
            }
            webview_builder.build()?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            no_flicker::show_main_window,
            fetch::fetch
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
