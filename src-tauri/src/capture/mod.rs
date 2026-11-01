pub mod monitors;
pub mod types;
pub mod windows;

pub use monitors::list_monitors;
use types::{CaptureSession, MonitorShot};

use crate::error::KResult;

/// Captures every monitor in parallel and lists the visible windows at the same moment.
pub fn capture_all() -> KResult<CaptureSession> {
    let infos = list_monitors()?;
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
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[ignore = "needs a real display"]
    fn capture_all_smoke() {
        let session = capture_all().unwrap();
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
