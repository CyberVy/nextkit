mod commands;
mod logging;
mod webview;
mod window;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    window::state_persistence::register(tauri::Builder::default())
        .manage(commands::window_hub::WindowHubState::default())
        .setup(|app| {
            logging::init(app)?;
            webview::create_main_window(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::fetch::fetch,
            commands::window_hub::window_hub_register,
            commands::window_hub::window_hub_unregister,
            commands::window_hub::window_hub_send
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
