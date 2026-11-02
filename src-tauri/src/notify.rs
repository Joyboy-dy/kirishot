use tauri_plugin_notification::NotificationExt;

use crate::error::KirishotError;
use crate::messages;
use crate::output::Delivery;

/// Shows a Windows notification. A failure is only logged: notifications are never critical.
pub fn show(app: &tauri::AppHandle, title: &str, body: &str) {
    if let Err(e) = app.notification().builder().title(title).body(body).show() {
        log::error!("notification failed: {e}");
    }
}

/// Confirms a capture taken without a thumbnail (setting off, or its window unavailable).
pub fn delivered(app: &tauri::AppHandle, d: &Delivery) {
    let file_name = d
        .saved
        .as_ref()
        .and_then(|s| s.path.file_name())
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    match (&d.saved, d.copied) {
        (Some(_), true) => show(app, messages::SAVED_AND_COPIED, &file_name),
        (Some(_), false) => show(app, messages::SAVED, &file_name),
        (None, true) => show(app, messages::COPIED, messages::COPIED_BODY),
        (None, false) => {}
    }
    if d.saved.as_ref().is_some_and(|s| s.used_fallback) {
        show(app, messages::FALLBACK_TITLE, messages::FALLBACK_BODY);
    }
    if let Some(e) = &d.error {
        failure(app, e);
    }
}

pub fn failure(app: &tauri::AppHandle, e: &KirishotError) {
    show(app, messages::FAILURE_TITLE, &e.message);
}
