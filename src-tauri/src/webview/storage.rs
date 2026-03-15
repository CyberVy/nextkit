use tauri::{App, Manager, Runtime, WebviewWindowBuilder};

pub fn configure<'a, R, M>(
    app: &App<R>,
    mut builder: WebviewWindowBuilder<'a, R, M>,
) -> tauri::Result<WebviewWindowBuilder<'a, R, M>>
where
    R: Runtime,
    M: Manager<R>,
{
    let _ = app;

    #[cfg(target_os = "macos")]
    {
        builder = builder.data_store_identifier(*b"shared-dstore-v1");
    }

    #[cfg(target_os = "windows")]
    {
        let shared_dir = app.path().app_data_dir()?.join("shared-webview");
        std::fs::create_dir_all(&shared_dir)?;
        builder = builder.data_directory(shared_dir).incognito(false);
    }

    Ok(builder)
}
