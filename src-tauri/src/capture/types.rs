//! Data captured at the moment of the shortcut. Coordinates are physical pixels.
use serde::{Deserialize, Serialize};

use crate::geometry::Rect;

/// A monitor and its position on the virtual desktop.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MonitorInfo {
    pub index: u32,
    pub name: String,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale: f64,
    pub primary: bool,
}

/// A visible top-level window. Lists of windows are ordered topmost first.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct WindowInfo {
    pub index: u32,
    pub title: String,
    pub app_name: String,
    pub bounds: Rect,
}

/// What the selection overlay asks Rust to capture.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum CommitTarget {
    Region { rect: Rect },
    Window { index: u32 },
    Monitor,
}

pub struct MonitorShot {
    pub info: MonitorInfo,
    pub image: image::RgbaImage,
}

/// All monitors and windows frozen by one shortcut press.
pub struct CaptureSession {
    pub id: String,
    pub taken_at: chrono::DateTime<chrono::Local>,
    pub monitors: Vec<MonitorShot>,
    /// Virtual-desktop coordinates, topmost first.
    pub windows: Vec<WindowInfo>,
    /// The pointer when `capture.includeCursor` is on: drawn into the final image only, so the
    /// frozen screen never shows it twice.
    pub pointer: Option<crate::capture::cursor::CursorImage>,
}
