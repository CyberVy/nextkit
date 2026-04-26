use std::collections::HashMap;
use std::sync::Mutex;

use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow};

pub const WINDOW_HUB_EVENT: &str = "window-hub:message";

#[derive(Clone)]
struct Endpoint {
    window_label: String,
}

#[derive(Default)]
pub struct WindowHubState {
    endpoints: Mutex<HashMap<String, Endpoint>>,
}

#[derive(Clone, Debug, Serialize)]
struct HubIncomingEnvelope {
    receiver_id: String,
    sender: String,
    data: Value,
}

fn normalize_id(id: String) -> Result<String, String> {
    let normalized_id = id.trim().to_string();
    if normalized_id.is_empty() {
        return Err("id can not be empty".to_string());
    }
    Ok(normalized_id)
}

#[tauri::command]
pub fn window_hub_register(
    window: WebviewWindow,
    state: State<WindowHubState>,
    id: String,
) -> Result<(), String> {
    let normalized_id = normalize_id(id)?;
    let current_window_label = window.label().to_string();
    let mut endpoints = state
        .endpoints
        .lock()
        .map_err(|_| "window hub state is poisoned".to_string())?;

    if let Some(endpoint) = endpoints.get(&normalized_id) {
        if endpoint.window_label != current_window_label {
            return Err(format!("id `{normalized_id}` is already registered"));
        }
        return Ok(());
    }

    endpoints.insert(
        normalized_id,
        Endpoint {
            window_label: current_window_label,
        },
    );
    Ok(())
}

#[tauri::command]
pub fn window_hub_unregister(
    window: WebviewWindow,
    state: State<WindowHubState>,
    id: String,
) -> Result<(), String> {
    let normalized_id = normalize_id(id)?;
    let current_window_label = window.label().to_string();
    let mut endpoints = state
        .endpoints
        .lock()
        .map_err(|_| "window hub state is poisoned".to_string())?;

    if let Some(endpoint) = endpoints.get(&normalized_id) {
        if endpoint.window_label != current_window_label {
            return Err(format!("id `{normalized_id}` is owned by another window"));
        }
    }
    endpoints.remove(&normalized_id);
    Ok(())
}

#[tauri::command]
pub fn window_hub_send(
    window: WebviewWindow,
    app: AppHandle,
    state: State<WindowHubState>,
    sender_id: String,
    target_id: String,
    data: Value,
) -> Result<(), String> {
    let normalized_sender_id = normalize_id(sender_id)?;
    let normalized_target_id = normalize_id(target_id)?;
    let current_window_label = window.label().to_string();

    let mut endpoints = state
        .endpoints
        .lock()
        .map_err(|_| "window hub state is poisoned".to_string())?;

    let Some(sender_endpoint) = endpoints.get(&normalized_sender_id) else {
        return Err(format!(
            "sender id `{normalized_sender_id}` is not registered"
        ));
    };
    if sender_endpoint.window_label != current_window_label {
        return Err(format!(
            "sender id `{normalized_sender_id}` is owned by another window"
        ));
    }

    let Some(target_endpoint) = endpoints.get(&normalized_target_id).cloned() else {
        return Err(format!(
            "target id `{normalized_target_id}` is not registered"
        ));
    };

    let Some(target_window) = app.get_webview_window(&target_endpoint.window_label) else {
        endpoints.remove(&normalized_target_id);
        return Err(format!(
            "target window `{}` is unavailable",
            target_endpoint.window_label
        ));
    };

    target_window
        .emit(
            WINDOW_HUB_EVENT,
            HubIncomingEnvelope {
                receiver_id: normalized_target_id,
                sender: normalized_sender_id,
                data,
            },
        )
        .map_err(|error| error.to_string())
}
