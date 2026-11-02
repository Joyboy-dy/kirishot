pub mod cursor;
pub mod monitors;
pub mod types;
pub mod windows;

pub use monitors::list_monitors;
use types::{CaptureSession, MonitorShot};

use crate::error::KResult;

/// Captures every monitor in parallel and lists the visible windows at the same moment. With
/// `include_cursor`, the pointer is kept to be drawn into the final image (spec J3 § 2.5).
pub fn capture_all(include_cursor: bool) -> KResult<CaptureSession> {
    let infos = list_monitors()?;
    let pointer = if include_cursor {
        cursor::read_cursor()
    } else {
        None
    };
    let own_pid = std::process::id();
    let (shots, windows) = std::thread::scope(|s| {
        let windows = s.spawn(move || self::windows::enumerate_windows(own_pid));
        let captures: Vec<_> = infos
            .iter()
            .map(|info| s.spawn(move || monitors::capture_monitor(info)))
            .collect();
        let shots: KResult<Vec<MonitorShot>> = captures
            .into_iter()
            .map(|h| h.join().expect("capture thread panicked"))
            .collect();
        (shots, windows.join().expect("window thread panicked"))
    });
    Ok(CaptureSession {
        id: ulid::Ulid::generate().to_string(),
        taken_at: chrono::Local::now(),
        monitors: shots?,
        windows,
        pointer,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[ignore = "needs a real display"]
    fn capture_all_smoke() {
        let session = capture_all(false).unwrap();
        assert!(!session.monitors.is_empty());
        for shot in &session.monitors {
            assert_eq!(shot.image.dimensions(), (shot.info.width, shot.info.height));
        }
        for w in session.windows.iter().take(8) {
            eprintln!(
                "window {} {:?} [{}] {:?}",
                w.index, w.title, w.app_name, w.bounds
            );
        }
    }
}
