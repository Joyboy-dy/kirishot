//! The floating thumbnails shown after a capture (spec J2 § 3).
pub mod layout;
pub mod temp;
pub mod window;

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};

use base64::Engine;
use image::RgbaImage;
use serde::{Deserialize, Serialize};
use tauri::Manager;
use tauri_specta::Event;

use crate::capture::types::MonitorInfo;
use crate::error::{ErrorCode, KResult, KirishotError};
use crate::geometry::Rect;
use crate::output::{self, CaptureMeta};
use crate::settings::SettingsState;
use crate::settings::model::AutoAction;
use crate::shots::{ShotState, ShotStore};
use crate::{messages, notify, paths};

/// The clipboard gets the capture as soon as it is taken when the action copies.
pub fn copies_now(action: AutoAction) -> bool {
    matches!(action, AutoAction::SaveAndCopy | AutoAction::Copy)
}

/// The file is written when the countdown ends, if the action saves.
pub fn saves_on_expiry(action: AutoAction) -> bool {
    matches!(action, AutoAction::SaveAndCopy | AutoAction::Save)
}

/// A new card for the stack.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type, tauri_specta::Event)]
#[serde(rename_all = "camelCase")]
pub struct ThumbnailPushed {
    pub id: String,
    /// The temporary PNG, for `convertFileSrc` and dragging.
    pub src: Option<String>,
    /// A small JPEG data URL, only when the temporary file could not be written.
    pub preview: Option<String>,
    pub width: u32,
    pub height: u32,
    /// `None`: the card stays until it is closed.
    pub seconds: Option<u8>,
    pub action: AutoAction,
    pub copied: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ThumbStatus {
    Saved { path: String },
    Copied,
    Failed { message: String },
    Removed,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type, tauri_specta::Event)]
#[serde(rename_all = "camelCase")]
pub struct ThumbnailUpdate {
    pub id: String,
    pub status: ThumbStatus,
}

#[derive(Default)]
pub struct ThumbState {
    /// Set once the page listens for cards; until then captures take the J1 route.
    ready: AtomicBool,
    /// Work area and scale of the monitor of the last capture: the stack follows it.
    area: Mutex<Option<(Rect, f64)>>,
    /// Files saved from a card, for « Ouvrir le dossier » and « Copier le chemin ».
    saved: Mutex<HashMap<String, PathBuf>>,
}

impl ThumbState {
    pub fn alive(&self, app: &tauri::AppHandle) -> bool {
        self.ready.load(Ordering::SeqCst) && app.get_webview_window(window::LABEL).is_some()
    }

    pub fn mark_ready(&self) {
        self.ready.store(true, Ordering::SeqCst);
    }
}

fn shot_error() -> KirishotError {
    KirishotError::new(ErrorCode::NoActiveCapture, "Capture introuvable")
}

fn emit_update(app: &tauri::AppHandle, id: &str, status: ThumbStatus) {
    let update = ThumbnailUpdate {
        id: id.to_string(),
        status,
    };
    if let Err(e) = update.emit(app) {
        log::warn!("cannot emit thumbnail-update: {e}");
    }
}

fn preview_data_url(img: &RgbaImage) -> Option<String> {
    let width = img.width().min(480);
    let height = (img.height() as u64 * width as u64 / img.width().max(1) as u64).max(1) as u32;
    let small = image::imageops::thumbnail(img, width, height);
    let rgb = image::DynamicImage::ImageRgba8(small).to_rgb8();
    let mut jpeg = Vec::new();
    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg, 80)
        .encode_image(&rgb)
        .ok()?;
    Some(format!(
        "data:image/jpeg;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(jpeg)
    ))
}

/// Takes a fresh capture: copies it now if the action copies, writes its temporary PNG and
/// pushes its card. The file itself is written when the countdown ends.
pub fn push(
    app: &tauri::AppHandle,
    id: &str,
    img: RgbaImage,
    meta: CaptureMeta,
    monitor: &MonitorInfo,
) -> KResult<()> {
    let settings = app.state::<SettingsState>().get();
    let action = settings.after_capture.auto_action;
    let mut png = Some(output::encode_png(&img)?);
    let mut copied = false;
    if copies_now(action) {
        match output::copy_image(app, &img, &mut png) {
            Ok(()) => {
                copied = true;
                crate::history::mark_copied(app, id);
            }
            Err(e) => notify::failure(app, &e),
        }
    }
    let (width, height) = img.dimensions();
    let png = png.expect("encoded above");
    let preview_source = img.clone();
    let shots = app.state::<ShotStore>();
    shots.insert_with_id(id, img, meta, action);
    let id = id.to_string();
    let (src, preview) = match temp::write_png(&paths::temp_dir(), &id, &png) {
        Ok(path) => {
            shots.set_temp_png(&id, path.clone());
            (Some(path.to_string_lossy().into_owned()), None)
        }
        Err(e) => {
            log::warn!("cannot write the thumbnail file: {e}");
            (None, preview_data_url(&preview_source))
        }
    };
    *app.state::<ThumbState>().area.lock().unwrap() =
        Some((window::work_area(monitor), monitor.scale));
    let card = ThumbnailPushed {
        id,
        src,
        preview,
        width,
        height,
        seconds: settings.after_capture.thumbnail_seconds,
        action,
        copied,
    };
    card.emit(app)
        .map_err(|e| KirishotError::new(ErrorCode::Window, e.to_string()))
}

/// Sizes the window to the visible cards and shows it, or hides it when there are none.
pub fn layout(app: &tauri::AppHandle, ids: &[String], more: u32) -> KResult<()> {
    let window = app
        .get_webview_window(window::LABEL)
        .ok_or_else(|| KirishotError::new(ErrorCode::Window, "Vignettes indisponibles"))?;
    if ids.is_empty() {
        window::hide(&window);
        return Ok(());
    }
    let shots = app.state::<ShotStore>();
    let cards: Vec<(f64, f64)> = ids
        .iter()
        .map(|id| {
            shots.get(id).map_or((layout::CARD_WIDTH, 135.0), |s| {
                layout::card_size(s.image.dimensions())
            })
        })
        .collect();
    let Some((work, scale)) = *app.state::<ThumbState>().area.lock().unwrap() else {
        return Ok(());
    };
    window::show_at(&window, layout::stack_bounds(work, scale, &cards, more))
}

/// What « Enregistrer » does on a card.
#[derive(Debug, PartialEq, Eq)]
pub enum SavePlan {
    Write,
    /// The automatic action already saved it: show that file, do not write a second one.
    Reuse(PathBuf),
}

/// `expired_now`: this click took the automatic action over (the capture was still waiting).
pub fn save_plan(expired_now: bool, already_saved: Option<&PathBuf>) -> SavePlan {
    match already_saved {
        Some(path) if !expired_now => SavePlan::Reuse(path.clone()),
        _ => SavePlan::Write,
    }
}

/// × on a card: a capture still waiting is dropped without its automatic action (spec J2
/// § 3.2); one open in the editor stays. Returns the temporary file to delete.
pub fn close_shot(shots: &ShotStore, id: &str) -> Option<PathBuf> {
    shots.expire(id);
    shots.release(id)
}

fn save_now(app: &tauri::AppHandle, id: &str, image: &RgbaImage, meta: &CaptureMeta) {
    match output::save_image(app, image, meta) {
        Ok(saved) => {
            if saved.used_fallback {
                notify::show(app, messages::FALLBACK_TITLE, messages::FALLBACK_BODY);
            }
            let path = saved.path.to_string_lossy().into_owned();
            crate::history::mark_saved(app, id, &saved.path);
            app.state::<ThumbState>()
                .saved
                .lock()
                .unwrap()
                .insert(id.to_string(), saved.path);
            emit_update(app, id, ThumbStatus::Saved { path });
        }
        Err(e) => emit_update(
            app,
            id,
            ThumbStatus::Failed {
                message: e.message.clone(),
            },
        ),
    }
}

/// The countdown ended: the automatic action runs, once.
pub fn expire(app: &tauri::AppHandle, id: &str) {
    if let Some(expired) = app.state::<ShotStore>().expire(id)
        && saves_on_expiry(expired.action)
    {
        save_now(app, id, &expired.image, &expired.meta);
    }
}

/// Copy from the card: replaces the automatic action.
pub fn copy(app: &tauri::AppHandle, id: &str) -> KResult<()> {
    let shots = app.state::<ShotStore>();
    let shot = shots.get(id).ok_or_else(shot_error)?;
    shots.expire(id);
    match output::copy_image(app, &shot.image, &mut None) {
        Ok(()) => {
            crate::history::mark_copied(app, id);
            emit_update(app, id, ThumbStatus::Copied)
        }
        Err(e) => emit_update(
            app,
            id,
            ThumbStatus::Failed {
                message: e.message.clone(),
            },
        ),
    }
    Ok(())
}

/// Save from the card: replaces the automatic action.
pub fn save(app: &tauri::AppHandle, id: &str) -> KResult<()> {
    let shots = app.state::<ShotStore>();
    let shot = shots.get(id).ok_or_else(shot_error)?;
    let expired_now = shots.expire(id).is_some();
    let already = app
        .state::<ThumbState>()
        .saved
        .lock()
        .unwrap()
        .get(id)
        .cloned();
    match save_plan(expired_now, already.as_ref()) {
        SavePlan::Reuse(path) => emit_update(
            app,
            id,
            ThumbStatus::Saved {
                path: path.to_string_lossy().into_owned(),
            },
        ),
        SavePlan::Write => save_now(app, id, &shot.image, &shot.meta),
    }
    Ok(())
}

/// The card left the stack (× or the end of its display).
pub fn close(app: &tauri::AppHandle, id: &str) {
    if let Some(file) = close_shot(&app.state::<ShotStore>(), id) {
        let _ = std::fs::remove_file(file);
    }
    app.state::<ThumbState>().saved.lock().unwrap().remove(id);
}

/// « Supprimer »: drops the capture and the file saved from it, if any.
pub fn delete(app: &tauri::AppHandle, id: &str) {
    let shots = app.state::<ShotStore>();
    if shots.get(id).is_some_and(|s| s.state == ShotState::Editing) {
        return;
    }
    if let Some(file) = shots.remove(id) {
        let _ = std::fs::remove_file(file);
    }
    if let Some(saved) = app.state::<ThumbState>().saved.lock().unwrap().remove(id)
        && let Err(e) = std::fs::remove_file(&saved)
    {
        log::warn!("cannot delete {}: {e}", saved.display());
    }
    // « Supprimer » on the card discards the capture: it leaves the history too.
    crate::history::delete(app, id);
    emit_update(app, id, ThumbStatus::Removed);
}

pub fn saved_path(app: &tauri::AppHandle, id: &str) -> KResult<PathBuf> {
    app.state::<ThumbState>()
        .saved
        .lock()
        .unwrap()
        .get(id)
        .cloned()
        .ok_or_else(|| {
            KirishotError::new(ErrorCode::Save, "La capture n'est pas encore enregistrée")
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn copy_happens_at_capture_only_when_the_action_copies() {
        assert!(copies_now(AutoAction::SaveAndCopy));
        assert!(copies_now(AutoAction::Copy));
        assert!(!copies_now(AutoAction::Save));
    }

    #[test]
    fn expiry_saves_only_when_the_action_saves() {
        assert!(saves_on_expiry(AutoAction::Save));
        assert!(saves_on_expiry(AutoAction::SaveAndCopy));
        assert!(!saves_on_expiry(AutoAction::Copy));
    }

    fn shot(store: &ShotStore) -> String {
        let meta = CaptureMeta {
            taken_at: chrono::Local::now(),
            window_title: None,
        };
        store.insert(RgbaImage::new(4, 3), meta, AutoAction::SaveAndCopy)
    }

    #[test]
    fn closing_a_waiting_card_drops_it_without_its_action() {
        // Spec J2 § 3.2: « × ferme sans enregistrer ».
        let store = ShotStore::default();
        let id = shot(&store);
        store.set_temp_png(&id, PathBuf::from("a.png"));
        assert_eq!(close_shot(&store, &id), Some(PathBuf::from("a.png")));
        assert!(store.expire(&id).is_none());
        assert!(store.get(&id).is_none());
    }

    #[test]
    fn closing_a_card_in_the_editor_keeps_the_capture() {
        let store = ShotStore::default();
        let id = shot(&store);
        store.begin_edit(&id);
        assert_eq!(close_shot(&store, &id), None);
        assert!(store.get(&id).is_some());
    }

    #[test]
    fn save_after_an_automatic_save_reuses_the_file() {
        let saved = PathBuf::from("Kirishot.png");
        assert_eq!(
            save_plan(false, Some(&saved)),
            SavePlan::Reuse(saved.clone())
        );
        assert_eq!(save_plan(true, Some(&saved)), SavePlan::Write);
        assert_eq!(save_plan(false, None), SavePlan::Write);
    }

    #[test]
    fn preview_is_a_small_jpeg_data_url() {
        let url = preview_data_url(&RgbaImage::new(1920, 1080)).unwrap();
        assert!(url.starts_with("data:image/jpeg;base64,"));
    }
}
