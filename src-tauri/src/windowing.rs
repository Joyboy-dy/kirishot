//! Selection overlays: one per monitor, created hidden ahead of time and revealed once their
//! frozen screen is drawn.
use std::collections::{HashMap, HashSet};
use std::sync::Mutex;

use tauri::window::Color;
use tauri::{
    Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};

use crate::capture::types::MonitorInfo;
use crate::error::{ErrorCode, KResult, KirishotError};
use crate::frame;

pub const OVERLAY_PREFIX: &str = "overlay-";
const BACKGROUND: Color = Color(14, 16, 20, 255);

pub fn overlay_label(i: usize) -> String {
    format!("{OVERLAY_PREFIX}{i}")
}

pub fn monitor_index(label: &str) -> Option<usize> {
    label.strip_prefix(OVERLAY_PREFIX)?.parse().ok()
}

/// What makes an overlay window fit its monitor.
#[derive(Clone, Debug, PartialEq)]
pub struct MonitorSig {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale_milli: u32,
}

pub fn signature(monitors: &[MonitorInfo]) -> Vec<MonitorSig> {
    monitors
        .iter()
        .map(|m| MonitorSig {
            x: m.x,
            y: m.y,
            width: m.width,
            height: m.height,
            scale_milli: (m.scale * 1000.0).round() as u32,
        })
        .collect()
}

pub fn needs_recreate(current: &[MonitorSig], wanted: &[MonitorSig], all_alive: bool) -> bool {
    !all_alive || current != wanted
}

#[derive(Default)]
struct Overlays {
    signature: Vec<MonitorSig>,
    /// Pages that told Rust they can receive a frame.
    loaded: HashSet<String>,
    /// Frames posted before their page was loaded, sent as soon as it is.
    pending: HashMap<String, (Vec<u8>, String)>,
}

#[derive(Default)]
pub struct OverlaySet(Mutex<Overlays>);

/// Recreates the overlays when monitors changed or a window disappeared; otherwise keeps them.
pub fn ensure_overlays(app: &tauri::AppHandle, monitors: &[MonitorInfo]) -> KResult<()> {
    let set = app.state::<OverlaySet>();
    let mut overlays = set.0.lock().unwrap();
    let wanted = signature(monitors);
    let all_alive =
        (0..monitors.len()).all(|i| app.get_webview_window(&overlay_label(i)).is_some());
    if !needs_recreate(&overlays.signature, &wanted, all_alive) {
        return Ok(());
    }
    log::info!("creating {} overlay window(s)", monitors.len());
    for (label, window) in app.webview_windows() {
        if label.starts_with(OVERLAY_PREFIX) {
            let _ = window.destroy();
        }
    }
    *overlays = Overlays::default();
    for (i, monitor) in monitors.iter().enumerate() {
        create_overlay(app, i, monitor)?;
    }
    overlays.signature = wanted;
    Ok(())
}

fn window_error(e: tauri::Error) -> KirishotError {
    KirishotError::new(
        ErrorCode::Window,
        format!("Fenêtre de sélection indisponible : {e}"),
    )
}

fn create_overlay(app: &tauri::AppHandle, i: usize, m: &MonitorInfo) -> KResult<WebviewWindow> {
    let window = WebviewWindowBuilder::new(
        app,
        overlay_label(i),
        WebviewUrl::App("overlay.html".into()),
    )
    .title("Kirishot")
    .visible(false)
    .decorations(false)
    .resizable(false)
    .skip_taskbar(true)
    .always_on_top(true)
    .shadow(false)
    .focused(false)
    .background_color(BACKGROUND)
    .build()
    .map_err(window_error)?;
    place(&window, m)?;
    Ok(window)
}

/// Position first, then size: moving onto a monitor with another scale resizes the window.
fn place(window: &WebviewWindow, m: &MonitorInfo) -> KResult<()> {
    window
        .set_position(PhysicalPosition::new(m.x, m.y))
        .map_err(window_error)?;
    window
        .set_size(PhysicalSize::new(m.width, m.height))
        .map_err(window_error)
}

/// Sends a frame and its session to overlay `i`, or keeps it until the page is loaded.
pub fn post_to_overlay(
    app: &tauri::AppHandle,
    i: usize,
    frame: Vec<u8>,
    session_json: String,
) -> KResult<()> {
    let label = overlay_label(i);
    let window = app
        .get_webview_window(&label)
        .ok_or_else(|| KirishotError::new(ErrorCode::Window, "Fenêtre de sélection introuvable"))?;
    let set = app.state::<OverlaySet>();
    let mut overlays = set.0.lock().unwrap();
    if overlays.loaded.contains(&label) {
        drop(overlays);
        frame::post_frame(&window, frame, session_json)
    } else {
        overlays.pending.insert(label, (frame, session_json));
        Ok(())
    }
}

/// Called by an overlay page once it listens for frames.
pub fn mark_loaded(window: &WebviewWindow) -> KResult<()> {
    let label = window.label().to_string();
    let pending = {
        let set = window.app_handle().state::<OverlaySet>();
        let mut overlays = set.0.lock().unwrap();
        overlays.loaded.insert(label.clone());
        overlays.pending.remove(&label)
    };
    match pending {
        Some((frame, json)) => frame::post_frame(window, frame, json),
        None => Ok(()),
    }
}

pub fn reveal(window: &WebviewWindow, m: &MonitorInfo, focus: bool) -> KResult<()> {
    place(window, m)?;
    window.show().map_err(window_error)?;
    if focus {
        window.set_focus().map_err(window_error)?;
    }
    Ok(())
}

/// Shows the main window, creating it on demand: it does not exist until it is needed.
pub fn open_main(app: &tauri::AppHandle) -> KResult<()> {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        window.show().map_err(window_error)?;
        return window.set_focus().map_err(window_error);
    }
    WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
        .title("Kirishot")
        .inner_size(1120.0, 720.0)
        .min_inner_size(900.0, 600.0)
        .center()
        .background_color(BACKGROUND)
        .build()
        .map_err(window_error)?;
    Ok(())
}

pub fn hide_overlays(app: &tauri::AppHandle) {
    let set = app.state::<OverlaySet>();
    set.0.lock().unwrap().pending.clear();
    for (label, window) in app.webview_windows() {
        if label.starts_with(OVERLAY_PREFIX)
            && let Err(e) = window.hide()
        {
            log::warn!("cannot hide {label}: {e}");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn labels_roundtrip() {
        assert_eq!(monitor_index(&overlay_label(2)), Some(2));
        assert_eq!(monitor_index("main"), None);
    }

    #[test]
    fn needs_recreate_when_scale_changes() {
        let a = vec![MonitorSig {
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
            scale_milli: 1000,
        }];
        let b = vec![MonitorSig {
            scale_milli: 1500,
            ..a[0].clone()
        }];
        assert!(needs_recreate(&a, &b, true));
        assert!(!needs_recreate(&a, &a, true));
        assert!(needs_recreate(&a, &a, false));
        assert!(needs_recreate(&a, &[a[0].clone(), a[0].clone()], true));
    }

    #[test]
    fn signature_rounds_scale_to_thousandths() {
        let m = crate::capture::types::MonitorInfo {
            index: 0,
            name: "M".into(),
            x: -1920,
            y: 0,
            width: 1920,
            height: 1080,
            scale: 1.25,
            primary: false,
        };
        assert_eq!(
            signature(&[m]),
            vec![MonitorSig {
                x: -1920,
                y: 0,
                width: 1920,
                height: 1080,
                scale_milli: 1250
            }]
        );
    }
}
