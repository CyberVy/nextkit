pub(crate) mod inject;
pub(crate) mod itp;
pub(crate) mod storage;

use crate::window;

use tauri::{Manager, Runtime, WebviewWindowBuilder};

pub(crate) fn create_main_window<R: Runtime>(app: &mut tauri::App<R>) -> tauri::Result<()> {
    itp::disable();

    let app = &*app;
    let webview_builder = window::main_window::create_main_window_builder(app)?;
    let webview_builder = apply_default_webview_settings(app, webview_builder)?;

    let main_window = webview_builder.build()?;
    window::appearance::bind_theme_change_listener(&main_window)?;
    Ok(())
}

pub(crate) fn apply_default_webview_settings<'a, R, M, C>(
    manager: &C,
    builder: WebviewWindowBuilder<'a, R, M>,
) -> tauri::Result<WebviewWindowBuilder<'a, R, M>>
where
    R: Runtime,
    M: Manager<R>,
    C: Manager<R>,
{
    let mut builder = storage::setup_shared_data_directory(manager, builder)?;
    let app_config = manager.app_handle().config();
    if let Some(user_agent) = app_config
        .app
        .windows
        .iter()
        .find(|window_config| window_config.label == "main")
        .or_else(|| app_config.app.windows.first())
        .and_then(|window_config| window_config.user_agent.as_deref())
    {
        builder = builder.user_agent(user_agent);
    }
    let builder = window::appearance::apply_platform_decorations(builder);
    #[cfg(desktop)]
    let builder = {
        let builder = builder.visible(false);
        window::popup::register_popup_webview_handler(manager, builder)
    };
    let builder = inject::inject_startup_scripts(builder);
    Ok(builder)
}
