mod fetch;
mod logging;
mod main_window_setup;
mod webview;
mod window;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    window::state_persistence::register(tauri::Builder::default())
        .setup(|app| {
            logging::init(app)?;
            main_window_setup::create(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![fetch::fetch])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
