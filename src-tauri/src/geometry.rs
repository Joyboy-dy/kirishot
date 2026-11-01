//! Rectangles and coordinate conversions, in physical pixels.
use serde::{Deserialize, Serialize};

use crate::capture::types::{CommitTarget, MonitorInfo, WindowInfo};
use crate::error::{ErrorCode, KResult, KirishotError};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct Point {
    pub x: i32,
    pub y: i32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct Rect {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

impl Rect {
    fn right(&self) -> i64 {
        self.x as i64 + self.width as i64
    }

    fn bottom(&self) -> i64 {
        self.y as i64 + self.height as i64
    }

    /// Left and top edges included, right and bottom edges excluded.
    pub fn contains(&self, p: Point) -> bool {
        let (x, y) = (p.x as i64, p.y as i64);
        x >= self.x as i64 && x < self.right() && y >= self.y as i64 && y < self.bottom()
    }

    /// `None` when the overlap has no area.
    pub fn intersect(&self, other: &Rect) -> Option<Rect> {
        let left = (self.x as i64).max(other.x as i64);
        let top = (self.y as i64).max(other.y as i64);
        let right = self.right().min(other.right());
        let bottom = self.bottom().min(other.bottom());
        (right > left && bottom > top).then(|| Rect {
            x: left as i32,
            y: top as i32,
            width: (right - left) as u32,
            height: (bottom - top) as u32,
        })
    }

    pub fn center(&self) -> Point {
        Point {
            x: (self.x as i64 + self.width as i64 / 2) as i32,
            y: (self.y as i64 + self.height as i64 / 2) as i32,
        }
    }

    pub fn translate(&self, dx: i32, dy: i32) -> Rect {
        Rect {
            x: self.x + dx,
            y: self.y + dy,
            ..*self
        }
    }
}

fn monitor_rect(m: &MonitorInfo) -> Rect {
    Rect {
        x: 0,
        y: 0,
        width: m.width,
        height: m.height,
    }
}

/// The windows visible on `monitor`, in its own coordinates and clipped to it. Indexes are kept.
pub fn windows_for_monitor(windows: &[WindowInfo], monitor: &MonitorInfo) -> Vec<WindowInfo> {
    let screen = monitor_rect(monitor);
    windows
        .iter()
        .filter_map(|w| {
            let local = w
                .bounds
                .translate(-monitor.x, -monitor.y)
                .intersect(&screen)?;
            Some(WindowInfo {
                bounds: local,
                ..w.clone()
            })
        })
        .collect()
}

/// The topmost window containing `p`.
pub fn window_at(windows: &[WindowInfo], p: Point) -> Option<&WindowInfo> {
    windows.iter().find(|w| w.bounds.contains(p))
}

/// Position in `monitors` of the monitor containing the virtual-desktop point `p`.
pub fn monitor_at_point(monitors: &[MonitorInfo], p: Point) -> Option<usize> {
    monitors.iter().position(|m| {
        Rect {
            x: m.x,
            y: m.y,
            width: m.width,
            height: m.height,
        }
        .contains(p)
    })
}

/// The crop rectangle in the monitor's coordinates, clamped to it, and the title used for the
/// `{fenêtre}` token of the file name.
pub fn resolve_target(
    target: &CommitTarget,
    monitor: &MonitorInfo,
    local_windows: &[WindowInfo],
) -> KResult<(Rect, Option<String>)> {
    let screen = monitor_rect(monitor);
    let empty = || KirishotError::new(ErrorCode::InvalidSelection, "Sélection vide");
    match target {
        CommitTarget::Region { rect } => {
            let rect = rect.intersect(&screen).ok_or_else(empty)?;
            let title = window_at(local_windows, rect.center()).map(|w| w.title.clone());
            Ok((rect, title))
        }
        CommitTarget::Window { index } => {
            let window = local_windows
                .iter()
                .find(|w| w.index == *index)
                .ok_or_else(|| {
                    KirishotError::new(ErrorCode::InvalidSelection, "Fenêtre introuvable")
                })?;
            let rect = window.bounds.intersect(&screen).ok_or_else(empty)?;
            Ok((rect, Some(window.title.clone())))
        }
        CommitTarget::Monitor => Ok((screen, None)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::capture::types::{CommitTarget, MonitorInfo, WindowInfo};
    use crate::error::ErrorCode;

    fn mon(x: i32, y: i32, w: u32, h: u32) -> MonitorInfo {
        MonitorInfo {
            index: 0,
            name: "M".into(),
            x,
            y,
            width: w,
            height: h,
            scale: 1.0,
            primary: x == 0 && y == 0,
        }
    }

    fn win(i: u32, title: &str, r: Rect) -> WindowInfo {
        WindowInfo {
            index: i,
            title: title.into(),
            app_name: "app".into(),
            bounds: r,
        }
    }

    fn r(x: i32, y: i32, w: u32, h: u32) -> Rect {
        Rect {
            x,
            y,
            width: w,
            height: h,
        }
    }

    #[test]
    fn windows_for_monitor_handles_negative_origin() {
        let m = mon(-1920, 0, 1920, 1080);
        let ws = vec![
            win(0, "Gauche", r(-1800, 100, 400, 300)),
            win(1, "Droite", r(100, 100, 400, 300)),
        ];
        assert_eq!(
            windows_for_monitor(&ws, &m),
            vec![win(0, "Gauche", r(120, 100, 400, 300))]
        );
    }

    #[test]
    fn windows_for_monitor_clips_overflowing_window() {
        let m = mon(0, 0, 1920, 1080);
        assert_eq!(
            windows_for_monitor(&[win(3, "A", r(1800, -50, 300, 200))], &m),
            vec![win(3, "A", r(1800, 0, 120, 150))]
        );
    }

    #[test]
    fn window_at_prefers_topmost() {
        let ws = vec![
            win(0, "Haut", r(0, 0, 100, 100)),
            win(1, "Bas", r(0, 0, 500, 500)),
        ];
        assert_eq!(
            window_at(&ws, Point { x: 50, y: 50 }).unwrap().title,
            "Haut"
        );
        assert_eq!(
            window_at(&ws, Point { x: 300, y: 300 }).unwrap().title,
            "Bas"
        );
        assert!(window_at(&ws, Point { x: 600, y: 600 }).is_none());
    }

    #[test]
    fn region_is_clamped_to_monitor() {
        let m = mon(0, 0, 1920, 1080);
        let (rect, _) = resolve_target(
            &CommitTarget::Region {
                rect: r(1800, 1000, 300, 300),
            },
            &m,
            &[],
        )
        .unwrap();
        assert_eq!(rect, r(1800, 1000, 120, 80));
    }

    #[test]
    fn empty_region_is_rejected() {
        let m = mon(0, 0, 1920, 1080);
        let err = resolve_target(
            &CommitTarget::Region {
                rect: r(2000, 0, 50, 50),
            },
            &m,
            &[],
        )
        .unwrap_err();
        assert_eq!(err.code, ErrorCode::InvalidSelection);
    }

    #[test]
    fn region_title_is_window_at_center() {
        let m = mon(0, 0, 1920, 1080);
        let ws = vec![win(0, "Paramètres du compte", r(0, 0, 900, 700))];
        let (_, title) = resolve_target(
            &CommitTarget::Region {
                rect: r(324, 266, 604, 280),
            },
            &m,
            &ws,
        )
        .unwrap();
        assert_eq!(title.as_deref(), Some("Paramètres du compte"));
    }

    #[test]
    fn window_target_uses_its_bounds_and_title() {
        let m = mon(0, 0, 1920, 1080);
        let ws = vec![win(4, "main.rs — kirishot", r(990, 196, 390, 452))];
        assert_eq!(
            resolve_target(&CommitTarget::Window { index: 4 }, &m, &ws).unwrap(),
            (
                r(990, 196, 390, 452),
                Some("main.rs — kirishot".to_string())
            )
        );
    }

    #[test]
    fn monitor_target_is_whole_screen_without_title() {
        let m = mon(0, 0, 2560, 1440);
        assert_eq!(
            resolve_target(&CommitTarget::Monitor, &m, &[]).unwrap(),
            (r(0, 0, 2560, 1440), None)
        );
    }

    #[test]
    fn unknown_window_index_is_rejected() {
        let m = mon(0, 0, 1920, 1080);
        assert_eq!(
            resolve_target(&CommitTarget::Window { index: 9 }, &m, &[])
                .unwrap_err()
                .code,
            ErrorCode::InvalidSelection
        );
    }

    #[test]
    fn monitor_at_point_handles_negative_origin() {
        let ms = vec![
            mon(0, 0, 1920, 1080),
            MonitorInfo {
                index: 1,
                ..mon(-1920, 0, 1920, 1080)
            },
        ];
        assert_eq!(monitor_at_point(&ms, Point { x: -100, y: 500 }), Some(1));
        assert_eq!(monitor_at_point(&ms, Point { x: 100, y: 500 }), Some(0));
        assert_eq!(monitor_at_point(&ms, Point { x: 5000, y: 0 }), None);
    }
}
