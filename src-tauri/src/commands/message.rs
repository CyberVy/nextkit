use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn post_message_to_webview(
    app: AppHandle,
    webview: tauri::Webview,
    label: String,
    mut message: serde_json::Value,
) -> Result<(), String> {
    if let Some(target_webview) = app.get_webview(&label) {
        if let Some(obj) = message.as_object_mut() {
            obj.insert(
                "sender_webview_label".to_string(),
                serde_json::Value::String(webview.label().to_string()),
            );
        }
        let js = format!("window.postMessage({}, '*')", message.to_string());
        target_webview.eval(&js).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn post_message_to_main(
    app: AppHandle,
    webview: tauri::Webview,
    message: serde_json::Value,
) -> Result<(), String> {
    post_message_to_webview(app, webview, "main".to_string(), message)
}
