//! One capture from shortcut to delivery. The only module that chains the others.
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tauri::Manager;
use tauri_specta::Event;

use crate::capture::{
    self,
    types::{CommitTarget, MonitorInfo, WindowInfo},
};
use crate::error::{ErrorCode, KResult, KirishotError};
use crate::geometry::{Point, monitor_at_point, resolve_target, windows_for_monitor};
use crate::output::{CaptureMeta, deliver};
use crate::settings::SettingsState;
use crate::settings::model::{AutoAction, CaptureMode, StartModeSetting, ToolbarPosition};
use crate::store::CaptureStore;
use crate::{frame, notify, windowing};

/// What an overlay needs besides its pixels; sent with the frame as `additionalData`.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct OverlaySession {
    pub capture_id: String,
    pub monitor: MonitorInfo,
    /// In the monitor's coordinates, topmost first.
    pub windows: Vec<WindowInfo>,
    /// In the monitor's coordinates; `None` when the cursor is on another monitor.
    pub cursor: Option<Point>,
    pub commit_on_release: bool,
    /// Whether the magnifier starts shown (the overlay toggles it with M).
    pub magnifier: bool,
    /// Whether the zone flashes when it is captured.
    pub flash: bool,
    /// The mode the selection starts in.
    pub mode: CaptureMode,
    pub toolbar_position: ToolbarPosition,
    pub start_mode: StartModeSetting,
}

/// Tells the other overlays to drop their selection: a selection stays on one monitor.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type, tauri_specta::Event)]
#[serde(rename_all = "camelCase")]
pub struct OverlayClaimed {
    pub monitor_index: u32,
}

/// The capture ended: overlays clear their canvas and selection.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type, tauri_specta::Event)]
pub struct OverlayReset {}

/// An overlay not revealed by then will never be: the capture is abandoned.
pub const REVEAL_TIMEOUT: Duration = Duration::from_secs(3);

struct Active {
    capture_id: Option<String>,
    started: Instant,
    revealed: bool,
}

/// At most one capture at a time, from the shortcut until delivery starts.
#[derive(Default)]
pub struct FlowState {
    active: Mutex<Option<Active>>,
}

impl FlowState {
    pub fn try_begin(&self, t0: Instant) -> bool {
        let mut active = self.active.lock().unwrap();
        if active.is_some() {
            return false;
        }
        *active = Some(Active {
            capture_id: None,
            started: t0,
            revealed: false,
        });
        true
    }

    pub fn attach(&self, id: String) {
        if let Some(active) = self.active.lock().unwrap().as_mut() {
            active.capture_id = Some(id);
        }
    }

    pub fn active_capture(&self) -> Option<String> {
        self.active.lock().unwrap().as_ref()?.capture_id.clone()
    }

    /// The time since the shortcut, the first time an overlay is revealed only.
    pub fn mark_revealed(&self) -> Option<Duration> {
        let mut active = self.active.lock().unwrap();
        let active = active.as_mut()?;
        if active.revealed {
            return None;
        }
        active.revealed = true;
        Some(active.started.elapsed())
    }

    /// Ends capture `id` if no overlay was ever revealed for it: a frame was lost on the way.
    pub fn expire_unrevealed(&self, id: &str) -> bool {
        let mut active = self.active.lock().unwrap();
        let stuck = active
            .as_ref()
            .is_some_and(|a| !a.revealed && a.capture_id.as_deref() == Some(id));
        if stuck {
            *active = None;
        }
        stuck
    }

    pub fn finish(&self) {
        *self.active.lock().unwrap() = None;
    }
}

/// What happens to a capture once it is taken.
#[derive(Debug, PartialEq, Eq)]
pub enum Route {
    /// J1 behavior: the automatic action at once, confirmed by a notification.
    Immediate,
    Thumbnail,
    Editor,
}

pub fn route(s: &crate::settings::model::Settings, thumbnails_alive: bool) -> Route {
    if s.after_capture.always_open_editor {
        Route::Editor
    } else if s.after_capture.thumbnail && thumbnails_alive {
        Route::Thumbnail
    } else {
        Route::Immediate
    }
}

/// « Toujours ouvrir l'éditeur »: no thumbnail and no automatic action.
fn open_in_editor(app: &tauri::AppHandle, img: image::RgbaImage, meta: CaptureMeta) -> KResult<()> {
    let action = app.state::<SettingsState>().get().after_capture.auto_action;
    let id = app
        .state::<crate::shots::ShotStore>()
        .insert(img, meta, action);
    let (tx, rx) = std::sync::mpsc::channel();
    let handle = app.clone();
    app.run_on_main_thread(move || {
        let _ = tx.send(crate::editor::open(&handle, &id));
    })
    .map_err(|e| KirishotError::new(ErrorCode::Window, e.to_string()))?;
    rx.recv()
        .map_err(|e| KirishotError::new(ErrorCode::Window, e.to_string()))?
}

/// What follows a capture: the thumbnail, the editor, or the J1 immediate action. A copy-only
/// capture (Ctrl+C in the selection) is copied at once, with no file and no thumbnail.
fn after_capture(
    app: &tauri::AppHandle,
    img: image::RgbaImage,
    meta: CaptureMeta,
    monitor: &MonitorInfo,
    copy_only: bool,
) {
    if copy_only {
        if let Err(e) = deliver(app, &img, &meta, AutoAction::Copy) {
            notify::failure(app, &e);
        }
        return;
    }
    let settings = app.state::<SettingsState>().get();
    let alive = app.state::<crate::thumbnails::ThumbState>().alive(app);
    let pushed = match route(&settings, alive) {
        Route::Immediate => None,
        Route::Thumbnail if alive => Some(crate::thumbnails::push(
            app,
            img.clone(),
            meta.clone(),
            monitor,
        )),
        Route::Editor => Some(open_in_editor(app, img.clone(), meta.clone())),
        Route::Thumbnail => None,
    };
    match pushed {
        Some(Ok(())) => {}
        Some(Err(e)) => {
            log::error!("thumbnail failed, falling back: {e}");
            report(
                app,
                deliver(app, &img, &meta, settings.after_capture.auto_action),
            );
        }
        None => report(
            app,
            deliver(app, &img, &meta, settings.after_capture.auto_action),
        ),
    }
}

pub enum StartMode {
    Region,
    Fullscreen,
}

/// Starts a capture unless one is already running. Capturing runs off the main thread.
pub fn start(app: &tauri::AppHandle, mode: StartMode, t0: Instant) {
    if !app.state::<FlowState>().try_begin(t0) {
        log::debug!("capture already in progress, shortcut ignored");
        return;
    }
    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let result = match mode {
            StartMode::Region => start_region(&app),
            StartMode::Fullscreen => run_fullscreen(&app),
        };
        if let Err(e) = result {
            log::error!("capture failed: {e}");
            abort(&app);
            notify::failure(&app, &e);
        }
    });
}

fn cursor(app: &tauri::AppHandle) -> Option<Point> {
    let p = app.cursor_position().ok()?;
    Some(Point {
        x: p.x.round() as i32,
        y: p.y.round() as i32,
    })
}

fn start_region(app: &tauri::AppHandle) -> KResult<()> {
    let session = capture::capture_all()?;
    let monitors: Vec<MonitorInfo> = session.monitors.iter().map(|s| s.info.clone()).collect();
    windowing::ensure_overlays(app, &monitors)?;
    let cursor = cursor(app);
    let cursor_monitor = cursor.and_then(|c| monitor_at_point(&monitors, c));
    let settings = app.state::<SettingsState>().get();
    let posts: Vec<(usize, Vec<u8>, String)> = session
        .monitors
        .iter()
        .enumerate()
        .map(|(i, shot)| {
            let info = &shot.info;
            let overlay = OverlaySession {
                capture_id: session.id.clone(),
                monitor: info.clone(),
                windows: windows_for_monitor(&session.windows, info),
                cursor: cursor.filter(|_| cursor_monitor == Some(i)).map(|c| Point {
                    x: c.x - info.x,
                    y: c.y - info.y,
                }),
                commit_on_release: settings.capture.commit_on_release,
                magnifier: settings.capture.magnifier,
                flash: settings.capture.flash,
                mode: settings.capture.mode,
                toolbar_position: settings.capture.toolbar_position,
                start_mode: settings.capture.start_mode,
            };
            let json = serde_json::to_string(&overlay).expect("session always serializes");
            (i, frame::encode_frame(&shot.image), json)
        })
        .collect();
    // The capture must be active before any overlay can answer.
    let id = app.state::<CaptureStore>().insert(session);
    app.state::<FlowState>().attach(id.clone());
    for (i, frame, json) in posts {
        windowing::post_to_overlay(app, i, frame, json)?;
    }
    watch_reveal(app, id);
    Ok(())
}

/// A frame can be lost after it is posted (shared buffer, page error, renderer crash): without
/// this, the capture would stay active and every later shortcut would be ignored.
fn watch_reveal(app: &tauri::AppHandle, id: String) {
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(REVEAL_TIMEOUT);
        if app.state::<FlowState>().expire_unrevealed(&id) {
            log::error!("capture {id} never revealed, abandoned");
            app.state::<CaptureStore>().remove(&id);
            windowing::hide_overlays(&app);
            if let Err(e) = (OverlayReset {}).emit(&app) {
                log::warn!("cannot emit overlay-reset: {e}");
            }
            notify::failure(
                &app,
                &KirishotError::new(ErrorCode::Window, "L'écran figé n'a pas pu s'afficher"),
            );
        }
    });
}

fn run_fullscreen(app: &tauri::AppHandle) -> KResult<()> {
    let session = capture::capture_all()?;
    crate::sound::play_shutter(app);
    let monitors: Vec<MonitorInfo> = session.monitors.iter().map(|s| s.info.clone()).collect();
    let index = cursor(app)
        .and_then(|c| monitor_at_point(&monitors, c))
        .or_else(|| monitors.iter().position(|m| m.primary))
        .unwrap_or(0);
    let shot = session
        .monitors
        .get(index)
        .ok_or_else(|| KirishotError::new(ErrorCode::Capture, "Aucun écran à capturer"))?;
    let (rect, title) = resolve_target(&CommitTarget::Monitor, &shot.info, &[])?;
    let img = crop(&shot.image, rect);
    let meta = CaptureMeta {
        taken_at: session.taken_at,
        window_title: title,
    };
    let monitor = shot.info.clone();
    app.state::<FlowState>().finish();
    after_capture(app, img, meta, &monitor, false);
    Ok(())
}

fn crop(img: &image::RgbaImage, r: crate::geometry::Rect) -> image::RgbaImage {
    image::imageops::crop_imm(img, r.x as u32, r.y as u32, r.width, r.height).to_image()
}

fn report(app: &tauri::AppHandle, result: KResult<crate::output::Delivery>) {
    match result {
        Ok(delivery) => notify::delivered(app, &delivery),
        Err(e) => notify::failure(app, &e),
    }
}

/// Reveals an overlay whose frame is drawn; the overlay under the cursor takes the focus.
pub fn reveal(window: &tauri::WebviewWindow) -> KResult<()> {
    let app = window.app_handle();
    let capture_id = app
        .state::<FlowState>()
        .active_capture()
        .ok_or_else(no_capture)?;
    let session = app
        .state::<CaptureStore>()
        .get(&capture_id)
        .ok_or_else(no_capture)?;
    let index = windowing::monitor_index(window.label()).ok_or_else(no_capture)?;
    let monitors: Vec<MonitorInfo> = session.monitors.iter().map(|s| s.info.clone()).collect();
    let info = monitors.get(index).ok_or_else(no_capture)?;
    let focus = match cursor(app).and_then(|c| monitor_at_point(&monitors, c)) {
        Some(i) => i == index,
        None => info.primary,
    };
    windowing::reveal(window, info, focus)?;
    if let Some(latency) = app.state::<FlowState>().mark_revealed() {
        log::info!("overlay revealed in {} ms", latency.as_millis());
    }
    Ok(())
}

fn no_capture() -> KirishotError {
    KirishotError::new(ErrorCode::NoActiveCapture, "Aucune capture en cours")
}

/// Crops the chosen target, frees the capture, then saves and/or copies off the main thread.
pub fn commit(
    app: &tauri::AppHandle,
    monitor: usize,
    capture_id: &str,
    target: CommitTarget,
    copy_only: bool,
) -> KResult<()> {
    let flow = app.state::<FlowState>();
    if flow.active_capture().as_deref() != Some(capture_id) {
        return Err(no_capture());
    }
    crate::sound::play_shutter(app);
    let store = app.state::<CaptureStore>();
    let session = store.get(capture_id).ok_or_else(no_capture)?;
    let shot = session
        .monitors
        .get(monitor)
        .ok_or_else(|| KirishotError::new(ErrorCode::InvalidSelection, "Écran introuvable"))?;
    let local = windows_for_monitor(&session.windows, &shot.info);
    let (rect, title) = resolve_target(&target, &shot.info, &local)?;
    let img = crop(&shot.image, rect);
    let meta = CaptureMeta {
        taken_at: session.taken_at,
        window_title: title,
    };
    let monitor = shot.info.clone();
    drop(session);
    end_selection(app);
    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        after_capture(&app, img, meta, &monitor, copy_only)
    });
    Ok(())
}

pub fn cancel(app: &tauri::AppHandle) {
    end_selection(app);
}

/// Hides the overlays, frees the capture and lets the next shortcut start a new one.
fn end_selection(app: &tauri::AppHandle) {
    windowing::hide_overlays(app);
    if let Err(e) = (OverlayReset {}).emit(app) {
        log::warn!("cannot emit overlay-reset: {e}");
    }
    let flow = app.state::<FlowState>();
    if let Some(id) = flow.active_capture() {
        app.state::<CaptureStore>().remove(&id);
    }
    flow.finish();
}

fn abort(app: &tauri::AppHandle) {
    end_selection(app);
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Instant;

    #[test]
    fn second_begin_is_refused_while_active() {
        let f = FlowState::default();
        assert!(f.try_begin(Instant::now()));
        assert!(!f.try_begin(Instant::now()));
        f.finish();
        assert!(f.try_begin(Instant::now()));
    }

    #[test]
    fn an_unrevealed_capture_expires() {
        let f = FlowState::default();
        f.try_begin(Instant::now());
        f.attach("a".into());
        assert!(f.expire_unrevealed("a"));
        assert_eq!(f.active_capture(), None);
        assert!(f.try_begin(Instant::now()));
    }

    #[test]
    fn a_revealed_capture_does_not_expire() {
        let f = FlowState::default();
        f.try_begin(Instant::now());
        f.attach("a".into());
        f.mark_revealed();
        assert!(!f.expire_unrevealed("a"));
        assert_eq!(f.active_capture().as_deref(), Some("a"));
    }

    #[test]
    fn expiring_another_capture_leaves_the_active_one() {
        let f = FlowState::default();
        f.try_begin(Instant::now());
        f.attach("b".into());
        assert!(!f.expire_unrevealed("a"));
        assert_eq!(f.active_capture().as_deref(), Some("b"));
    }

    #[test]
    fn route_prefers_editor_then_thumbnail() {
        let mut s = crate::settings::model::Settings::default();
        assert_eq!(route(&s, true), Route::Thumbnail);
        assert_eq!(route(&s, false), Route::Immediate);
        s.after_capture.thumbnail = false;
        assert_eq!(route(&s, true), Route::Immediate);
        s.after_capture.always_open_editor = true;
        assert_eq!(route(&s, true), Route::Editor);
        assert_eq!(route(&s, false), Route::Editor);
    }

    #[test]
    fn latency_is_reported_once() {
        let f = FlowState::default();
        f.try_begin(Instant::now());
        f.attach("a".into());
        assert!(f.mark_revealed().is_some());
        assert!(f.mark_revealed().is_none());
        assert_eq!(f.active_capture().as_deref(), Some("a"));
    }
}
