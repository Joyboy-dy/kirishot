//! The annotation editor window: created hidden at startup, reused for each capture.
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::window::Color;
use tauri::{Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use crate::error::{ErrorCode, KResult, KirishotError};
use crate::frame;
use crate::shots::ShotStore;

pub const LABEL: &str = "editor";
/// Chromium refuses canvases with a side above this (Review Focus 4).
const MAX_SIDE: u32 = 16_384;
const BACKGROUND: Color = Color(14, 16, 20, 255);

/// What the editor page needs besides the pixels; sent as the shared buffer's additionalData.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct EditorSession {
    pub capture_id: String,
    pub width: u32,
    pub height: u32,
    pub title: String,
}

#[derive(Default)]
struct Inner {
    /// The page listens for frames.
    loaded: bool,
    /// The capture shown, kept in the shot store while the editor is open.
    current: Option<String>,
    /// A frame posted before the page was loaded.
    pending: Option<(Vec<u8>, String)>,
}

#[derive(Default)]
pub struct EditorState(Mutex<Inner>);

/// Logical size of the editor window for a work area of `work` logical pixels.
pub fn window_size(work: (u32, u32)) -> (u32, u32) {
    let fit = |want: u32, room: u32| want.min(room * 9 / 10);
    (fit(1200, work.0), fit(800, work.1))
}

/// « Capture du 02/11/2026 à 09:56 ».
pub fn editor_title(taken_at: chrono::NaiveDateTime) -> String {
    taken_at.format("Capture du %d/%m/%Y à %H:%M").to_string()
}

fn window_error(e: impl std::fmt::Display) -> KirishotError {
    KirishotError::new(ErrorCode::Window, format!("Éditeur indisponible : {e}"))
}

fn editor_window(app: &tauri::AppHandle) -> KResult<WebviewWindow> {
    app.get_webview_window(LABEL)
        .ok_or_else(|| window_error("fenêtre absente"))
}

pub fn create(app: &tauri::AppHandle) -> KResult<()> {
    let (width, height) = app
        .primary_monitor()
        .ok()
        .flatten()
        .map(|m| {
            let size = m.size().to_logical::<f64>(m.scale_factor());
            window_size((size.width as u32, size.height as u32))
        })
        .unwrap_or((1200, 800));
    let window = WebviewWindowBuilder::new(app, LABEL, WebviewUrl::App("editor.html".into()))
        .title("Kirishot")
        .visible(false)
        .inner_size(width as f64, height as f64)
        .min_inner_size(900.0, 600.0)
        .center()
        .background_color(BACKGROUND)
        .build()
        .map_err(window_error)?;
    // Closing hides the window: it is reused, and its capture is released.
    let handle = app.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            close(&handle);
        }
    });
    Ok(())
}

/// Opens capture `id` in the editor; its automatic action will not run any more.
pub fn open(app: &tauri::AppHandle, id: &str) -> KResult<()> {
    let shots = app.state::<ShotStore>();
    if !shots.begin_edit(id) {
        return Err(KirishotError::new(
            ErrorCode::NoActiveCapture,
            "Capture introuvable",
        ));
    }
    let shot = shots
        .get(id)
        .ok_or_else(|| KirishotError::new(ErrorCode::NoActiveCapture, "Capture introuvable"))?;
    let (width, height) = shot.image.dimensions();
    if width > MAX_SIDE || height > MAX_SIDE {
        shots.remove(id);
        return Err(KirishotError::new(
            ErrorCode::InvalidSelection,
            format!("Capture trop grande pour l'éditeur ({width} × {height})"),
        ));
    }
    let title = editor_title(shot.meta.taken_at.naive_local());
    let session = EditorSession {
        capture_id: id.to_string(),
        width,
        height,
        title: title.clone(),
    };
    let json = serde_json::to_string(&session).expect("session always serializes");
    let pixels = frame::encode_frame(&shot.image);
    let window = editor_window(app)?;
    let (previous, post_now) = {
        let state = app.state::<EditorState>();
        let mut inner = state.0.lock().unwrap();
        let previous = inner.current.replace(id.to_string());
        if inner.loaded {
            (previous, Some((pixels, json)))
        } else {
            inner.pending = Some((pixels, json));
            (previous, None)
        }
    };
    if let Some(previous) = previous.filter(|p| p != id) {
        release(app, &previous);
    }
    if let Some((pixels, json)) = post_now {
        frame::post_frame(&window, pixels, json)?;
    }
    window.set_title(&title).map_err(window_error)?;
    let _ = window.unminimize();
    window.show().map_err(window_error)?;
    window.set_focus().map_err(window_error)
}

/// Called by the editor page once it listens for frames.
pub fn mark_loaded(window: &WebviewWindow) -> KResult<()> {
    let pending = {
        let state = window.app_handle().state::<EditorState>();
        let mut inner = state.0.lock().unwrap();
        inner.loaded = true;
        log::debug!("editor page ready");
        inner.pending.take()
    };
    match pending {
        Some((pixels, json)) => frame::post_frame(window, pixels, json),
        None => Ok(()),
    }
}

fn release(app: &tauri::AppHandle, id: &str) {
    if let Some(file) = app.state::<ShotStore>().remove(id) {
        let _ = std::fs::remove_file(file);
    }
}

/// Hides the editor and frees its capture.
pub fn close(app: &tauri::AppHandle) {
    let current = app.state::<EditorState>().0.lock().unwrap().current.take();
    if let Some(id) = current {
        release(app, &id);
    }
    if let Ok(window) = editor_window(app)
        && let Err(e) = window.hide()
    {
        log::warn!("cannot hide the editor: {e}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;

    #[test]
    fn editor_window_fits_small_screens() {
        assert_eq!(window_size((1280, 720)), (1152, 648));
        assert_eq!(window_size((2560, 1440)), (1200, 800));
    }

    #[test]
    fn editor_title_is_french() {
        let at = NaiveDate::from_ymd_opt(2026, 11, 2)
            .unwrap()
            .and_hms_opt(9, 56, 12)
            .unwrap();
        assert_eq!(editor_title(at), "Capture du 02/11/2026 à 09:56");
    }
}
