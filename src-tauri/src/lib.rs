mod fetch;
mod logging;
mod webview;
mod window;
mod window_hub;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    window::state_persistence::register(tauri::Builder::default())
        .manage(window_hub::WindowHubState::default())
        .setup(|app| {
            logging::init(app)?;
            window::setup::create_main(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            fetch::fetch,
            window_hub::window_hub_register,
            window_hub::window_hub_unregister,
            window_hub::window_hub_send
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
