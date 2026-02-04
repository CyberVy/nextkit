use tauri::{AppHandle, Manager};

#[tauri::command]
pub async fn show_main_window(app: AppHandle) {
   if let Some(window) = app.get_webview_window("main") {
        #[cfg(desktop)]{
            window.show().unwrap();
            window.set_focus().unwrap();
        }
    }
}
