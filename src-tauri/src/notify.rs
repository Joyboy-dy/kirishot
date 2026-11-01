use tauri_plugin_notification::NotificationExt;

/// Shows a Windows notification. A failure is only logged: notifications are never critical.
pub fn show(app: &tauri::AppHandle, title: &str, body: &str) {
    if let Err(e) = app.notification().builder().title(title).body(body).show() {
        log::error!("notification failed: {e}");
    }
}
