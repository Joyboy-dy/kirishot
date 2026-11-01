//! Monitor list and screen capture through `xcap`.
use crate::capture::types::{MonitorInfo, MonitorShot};
use crate::error::{ErrorCode, KResult, KirishotError};

fn capture_error(e: impl std::fmt::Display) -> KirishotError {
    KirishotError::new(
        ErrorCode::Capture,
        format!("Impossible de capturer l'écran : {e}"),
    )
}

/// The monitors, in xcap's order, without capturing any image.
pub fn list_monitors() -> KResult<Vec<MonitorInfo>> {
    let monitors = xcap::Monitor::all().map_err(capture_error)?;
    monitors
        .iter()
        .enumerate()
        .map(|(index, m)| {
            Ok(MonitorInfo {
                index: index as u32,
                name: m.name().map_err(capture_error)?,
                x: m.x().map_err(capture_error)?,
                y: m.y().map_err(capture_error)?,
                width: m.width().map_err(capture_error)?,
                height: m.height().map_err(capture_error)?,
                scale: m.scale_factor().map_err(capture_error)? as f64,
                primary: m.is_primary().map_err(capture_error)?,
            })
        })
        .collect()
}

/// Captures one monitor. `xcap::Monitor` is neither `Send` nor `Sync`, so each capture thread
/// looks its monitor up again from the monitor's center.
pub fn capture_monitor(info: &MonitorInfo) -> KResult<MonitorShot> {
    let cx = info.x + (info.width / 2) as i32;
    let cy = info.y + (info.height / 2) as i32;
    let monitor = xcap::Monitor::from_point(cx, cy).map_err(capture_error)?;
    let image = monitor.capture_image().map_err(capture_error)?;
    if image.dimensions() != (info.width, info.height) {
        log::warn!(
            "monitor {} captured as {:?}, expected {}x{}",
            info.index,
            image.dimensions(),
            info.width,
            info.height
        );
    }
    Ok(MonitorShot {
        info: info.clone(),
        image,
    })
}
