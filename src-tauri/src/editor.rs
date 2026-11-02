//! The annotation editor window: created hidden at startup, reused for each capture.
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::window::Color;
use tauri::{Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tauri_specta::Event;

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
    /// The file the capture was last saved to (by the thumbnail or an earlier edit).
    pub saved_path: Option<String>,
    /// The autosaved document, when the capture is reopened from the history.
    pub document: Option<String>,
    /// The fingerprint of the document in `saved_path` (`None`: the original image).
    pub saved_doc: Option<String>,
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

/// Why the editor is about to close: the page checks for unsaved changes first (spec J3 § 3.5).
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum CloseReason {
    /// The window's ×, Alt+F4.
    Window,
    /// Another capture asks for the editor.
    #[serde(rename_all = "camelCase")]
    Replace { next_id: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type, tauri_specta::Event)]
pub struct EditorCloseRequested {
    pub reason: CloseReason,
}

/// Whether a capture asking for the editor must first ask the page: only when another capture
/// is shown in a loaded, visible editor.
pub fn must_ask(current: Option<&str>, next: &str, loaded: bool, visible: bool) -> bool {
    loaded && visible && current.is_some_and(|c| c != next)
}

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
        .min_inner_size(520.0, 400.0)
        .center()
        .background_color(BACKGROUND)
        .build()
        .map_err(window_error)?;
    // Closing hides the window (it is reused) once the page has checked for unsaved changes; a
    // page that is not loaded cannot answer, so the window just closes.
    let handle = app.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let loaded = handle.state::<EditorState>().0.lock().unwrap().loaded;
            let asked = loaded
                && EditorCloseRequested {
                    reason: CloseReason::Window,
                }
                .emit(&handle)
                .is_ok();
            if !asked {
                close(&handle);
            }
        }
    });
    Ok(())
}

/// Opens capture `id` in the editor; its automatic action will not run any more. When the
/// editor shows another capture, the page is asked first (`EditorCloseRequested`): it answers
/// with `open_next` or `cancel_next`.
pub fn open(app: &tauri::AppHandle, id: &str) -> KResult<()> {
    let window = editor_window(app)?;
    let ask = {
        let state = app.state::<EditorState>();
        let inner = state.0.lock().unwrap();
        must_ask(
            inner.current.as_deref(),
            id,
            inner.loaded,
            window.is_visible().unwrap_or(false),
        )
    };
    if ask {
        // The capture stays out of its automatic action while the page decides.
        app.state::<ShotStore>().begin_edit(id);
        EditorCloseRequested {
            reason: CloseReason::Replace {
                next_id: id.to_string(),
            },
        }
        .emit(app)
        .map_err(window_error)?;
        let _ = window.unminimize();
        return window.set_focus().map_err(window_error);
    }
    open_now(app, id)
}

/// The page let the next capture in (after saving or discarding the shown one).
pub fn open_next(app: &tauri::AppHandle, id: &str) -> KResult<()> {
    open_now(app, id)
}

/// The page kept the shown capture: the one that asked is released (it is in the history).
pub fn cancel_next(app: &tauri::AppHandle, id: &str) {
    let current = app.state::<EditorState>().0.lock().unwrap().current.clone();
    if current.as_deref() != Some(id) {
        release(app, id);
    }
}

fn open_now(app: &tauri::AppHandle, id: &str) -> KResult<()> {
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
    let entry = crate::history::entry(app, id).ok();
    let document = crate::history::file(app, id, crate::history::index::DOCUMENT_FILE)
        .ok()
        .and_then(|p| std::fs::read_to_string(p).ok());
    let session = EditorSession {
        capture_id: id.to_string(),
        width,
        height,
        title: title.clone(),
        saved_doc: entry.as_ref().and_then(|e| e.saved_doc.clone()),
        saved_path: entry.and_then(|e| e.saved_path),
        document,
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

/// What an export did, for the editor's status bar.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    /// The file written, if any.
    pub saved: Option<String>,
    pub copied: bool,
    /// « Enregistrer sous » cancelled by the user.
    pub cancelled: bool,
    /// The file went to `Images\Kirishot` because the chosen folder could not be written.
    pub used_fallback: bool,
}

/// Copies and/or saves the editor's final image (PNG bytes from the page).
pub fn export(
    app: &tauri::AppHandle,
    capture_id: &str,
    intent: ExportIntent,
    png: Vec<u8>,
    current: Option<std::path::PathBuf>,
    name: Option<String>,
    doc_hash: Option<String>,
) -> KResult<ExportResult> {
    let invalid = |e: &dyn std::fmt::Display| {
        KirishotError::new(
            ErrorCode::Encode,
            format!("Image de l'éditeur illisible : {e}"),
        )
    };
    let img = image::load_from_memory_with_format(&png, image::ImageFormat::Png)
        .map_err(|e| invalid(&e))?
        .to_rgba8();
    let meta = app
        .state::<ShotStore>()
        .get(capture_id)
        .map(|s| s.meta)
        .ok_or_else(|| KirishotError::new(ErrorCode::NoActiveCapture, "Capture introuvable"))?;
    let png_for_history = png.clone();
    let mut result = ExportResult {
        saved: None,
        copied: false,
        cancelled: false,
        used_fallback: false,
    };
    match intent {
        ExportIntent::Copy | ExportIntent::CopyAndClose => {
            crate::output::copy_image(app, &img, &mut Some(png))?;
            result.copied = true;
        }
        ExportIntent::Save | ExportIntent::SaveVersion => {
            let target = match (intent, current.as_deref()) {
                (ExportIntent::SaveVersion, Some(cur)) => {
                    SaveTarget::Replace(version_path(cur, |p| p.exists()))
                }
                _ => save_target(current.as_deref(), std::path::PathBuf::new),
            };
            match target {
                SaveTarget::Replace(path) => {
                    write_image(&path, &img)?;
                    result.saved = Some(path.to_string_lossy().into_owned());
                }
                // A first save: the usual folder, name and fallback, with the name chosen in
                // the editor if any (spec J3 § 3.3).
                SaveTarget::Create(_) => {
                    let saved = crate::output::save_image_named(app, &img, &meta, name.as_deref())?;
                    result.used_fallback = saved.used_fallback;
                    result.saved = Some(saved.path.to_string_lossy().into_owned());
                }
            }
        }
        ExportIntent::SaveAs => match save_as(app, &img, &meta)? {
            Some(path) => result.saved = Some(path),
            None => result.cancelled = true,
        },
    }
    // The history follows: where it was saved, that it was copied, and the annotated image.
    if let Some(path) = &result.saved {
        crate::history::mark_saved_doc(
            app,
            capture_id,
            std::path::Path::new(path),
            doc_hash.as_deref(),
        );
    }
    if result.copied {
        crate::history::mark_copied(app, capture_id);
    }
    if !result.cancelled && has_annotations(&crate::paths::history_dir(), capture_id) {
        crate::history::mark_annotated(app, capture_id, &png_for_history);
    }
    if intent == ExportIntent::CopyAndClose {
        let handle = app.clone();
        let _ = app.run_on_main_thread(move || close(&handle));
    }
    Ok(result)
}

/// Asks where to save, with the usual name, folder and format; `None` when cancelled.
fn save_as(
    app: &tauri::AppHandle,
    img: &image::RgbaImage,
    meta: &crate::output::CaptureMeta,
) -> KResult<Option<String>> {
    use tauri_plugin_dialog::DialogExt;
    let settings = app.state::<crate::settings::SettingsState>().get();
    let default_folder = crate::paths::default_save_folder(app)?;
    let folder = crate::settings::resolve_save_folder(&settings, &default_folder);
    let format = settings.save.format;
    let stem = crate::output::filename::render_name(
        &settings.save.name_template,
        &crate::output::filename::NameContext {
            taken_at: meta.taken_at.naive_local(),
            window_title: meta.window_title.clone(),
            counter: settings.save.counter,
        },
    );
    let Some(chosen) = app
        .dialog()
        .file()
        .set_directory(&folder)
        .set_file_name(format!("{stem}.{}", format.extension()))
        .add_filter("PNG", &["png"])
        .add_filter("JPG", &["jpg", "jpeg"])
        .add_filter("WebP", &["webp"])
        .blocking_save_file()
    else {
        return Ok(None);
    };
    let path = chosen
        .into_path()
        .map_err(|e| KirishotError::new(ErrorCode::Save, e.to_string()))?;
    let chosen_format = match path
        .extension()
        .and_then(|e| e.to_str())
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("jpg" | "jpeg") => crate::settings::model::ImageFormat::Jpg,
        Some("webp") => crate::settings::model::ImageFormat::Webp,
        _ => crate::settings::model::ImageFormat::Png,
    };
    let bytes = crate::output::encode::encode(img, chosen_format)?;
    std::fs::write(&path, bytes).map_err(|e| {
        KirishotError::new(
            ErrorCode::Save,
            format!("Impossible d'enregistrer la capture : {e}"),
        )
    })?;
    Ok(Some(path.to_string_lossy().into_owned()))
}

/// Writes `captures/<id>/document.json` atomically; `id` must be a ULID (no path tricks).
pub fn write_document(root: &std::path::Path, id: &str, json: &str) -> KResult<std::path::PathBuf> {
    write_atomic(&capture_dir(root, id)?, "document.json", json.as_bytes())
}

/// Whether the autosaved document of `id` has annotations or a crop.
pub fn has_annotations(root: &std::path::Path, id: &str) -> bool {
    let Ok(dir) = capture_dir(root, id) else {
        return false;
    };
    let Ok(json) = std::fs::read(dir.join(crate::history::index::DOCUMENT_FILE)) else {
        return false;
    };
    serde_json::from_slice::<serde_json::Value>(&json).is_ok_and(|doc| {
        doc["annotations"].as_array().is_some_and(|a| !a.is_empty()) || !doc["crop"].is_null()
    })
}

fn capture_dir(root: &std::path::Path, id: &str) -> KResult<std::path::PathBuf> {
    if ulid::Ulid::from_string(id).is_err() {
        return Err(KirishotError::new(
            ErrorCode::InvalidSelection,
            "Identifiant de capture invalide",
        ));
    }
    Ok(root.join(id))
}

/// A temporary file then a rename: a crash never leaves a half-written file.
fn write_atomic(dir: &std::path::Path, name: &str, bytes: &[u8]) -> KResult<std::path::PathBuf> {
    let fail = |e: std::io::Error| {
        KirishotError::new(
            ErrorCode::Save,
            format!("Sauvegarde de l'éditeur impossible : {e}"),
        )
    };
    std::fs::create_dir_all(dir).map_err(fail)?;
    let path = dir.join(name);
    let tmp = dir.join(format!(".{name}.tmp"));
    std::fs::write(&tmp, bytes)
        .and_then(|_| std::fs::rename(&tmp, &path))
        .map_err(|e| {
            let _ = std::fs::remove_file(&tmp);
            fail(e)
        })?;
    Ok(path)
}

/// Where « Enregistrer » writes (spec J3 § 3.2).
#[derive(Debug, PartialEq, Eq)]
pub enum SaveTarget {
    /// The capture's file, replaced (recreated there if it was deleted meanwhile).
    Replace(std::path::PathBuf),
    /// A first save: a new file.
    Create(std::path::PathBuf),
}

pub fn save_target(
    current: Option<&std::path::Path>,
    new_path: impl FnOnce() -> std::path::PathBuf,
) -> SaveTarget {
    match current {
        Some(path) => SaveTarget::Replace(path.to_path_buf()),
        None => SaveTarget::Create(new_path()),
    }
}

/// « Enregistrer comme nouvelle version »: `a.png` → `a (2).png`, `a (2).png` → `a (3).png`.
pub fn version_path(
    current: &std::path::Path,
    exists: impl Fn(&std::path::Path) -> bool,
) -> std::path::PathBuf {
    let dir = current.parent().unwrap_or(std::path::Path::new(""));
    let ext = current
        .extension()
        .map(|e| e.to_string_lossy().into_owned())
        .unwrap_or_else(|| "png".into());
    let stem = current
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default();
    // « a (2) » is a version of « a »: the next one is « a (3) », not « a (2) (2) ».
    let base = match stem.rsplit_once(" (") {
        Some((head, tail))
            if tail.ends_with(')')
                && tail[..tail.len() - 1].chars().all(|c| c.is_ascii_digit()) =>
        {
            head.to_string()
        }
        _ => stem,
    };
    crate::output::filename::unique_path(dir, &base, &ext, exists)
}

/// The format a file name asks for, by its extension (PNG when unknown).
pub fn format_for(path: &std::path::Path) -> crate::settings::model::ImageFormat {
    use crate::settings::model::ImageFormat;
    match path
        .extension()
        .and_then(|e| e.to_str())
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("jpg" | "jpeg") => ImageFormat::Jpg,
        Some("webp") => ImageFormat::Webp,
        _ => ImageFormat::Png,
    }
}

/// Writes the image to `path` in the format of its extension, through a temporary file.
fn write_image(path: &std::path::Path, img: &image::RgbaImage) -> KResult<()> {
    let bytes = crate::output::encode::encode(img, format_for(path))?;
    let dir = path.parent().unwrap_or(std::path::Path::new("."));
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    crate::history::index::write_atomic(dir, &name, &bytes).map_err(|e| {
        KirishotError::new(
            ErrorCode::Save,
            format!("Impossible d'enregistrer la capture : {}", e.message),
        )
    })
}

/// What the editor asks for with its exported image.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExportIntent {
    Copy,
    /// Create the file, or replace the capture's file.
    Save,
    /// A new file next to the capture's file: « … (2) ».
    SaveVersion,
    SaveAs,
    CopyAndClose,
}

pub fn parse_intent(header: Option<&str>) -> KResult<ExportIntent> {
    match header {
        Some("copy") => Ok(ExportIntent::Copy),
        Some("save") => Ok(ExportIntent::Save),
        Some("saveAs") => Ok(ExportIntent::SaveAs),
        Some("saveVersion") => Ok(ExportIntent::SaveVersion),
        Some("copyAndClose") => Ok(ExportIntent::CopyAndClose),
        other => Err(KirishotError::new(
            ErrorCode::InvalidSelection,
            format!("Export inconnu : {other:?}"),
        )),
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

    #[test]
    fn parse_intent_reads_the_four_actions() {
        assert_eq!(parse_intent(Some("copy")).unwrap(), ExportIntent::Copy);
        assert_eq!(parse_intent(Some("save")).unwrap(), ExportIntent::Save);
        assert_eq!(parse_intent(Some("saveAs")).unwrap(), ExportIntent::SaveAs);
        assert_eq!(
            parse_intent(Some("copyAndClose")).unwrap(),
            ExportIntent::CopyAndClose
        );
    }

    #[test]
    fn parse_intent_rejects_missing_or_unknown() {
        assert!(parse_intent(None).is_err());
        assert!(parse_intent(Some("print")).is_err());
    }

    #[test]
    fn save_replaces_the_known_file_even_if_deleted() {
        let p = std::path::PathBuf::from(r"C:\x\a.png");
        let q = std::path::PathBuf::from(r"C:\x\b.png");
        assert_eq!(
            save_target(Some(&p), || q.clone()),
            SaveTarget::Replace(p.clone())
        );
        assert_eq!(
            save_target(None, || q.clone()),
            SaveTarget::Create(q.clone())
        );
    }

    #[test]
    fn a_new_version_goes_next_to_the_file() {
        use std::path::{Path, PathBuf};
        let taken = |names: &'static [&'static str]| {
            move |p: &Path| names.iter().any(|n| p.file_name().is_some_and(|f| f == *n))
        };
        assert_eq!(
            version_path(Path::new(r"C:\x\a.png"), taken(&["a.png"])),
            PathBuf::from(r"C:\x\a (2).png")
        );
        assert_eq!(
            version_path(Path::new(r"C:\x\a (2).png"), taken(&["a.png", "a (2).png"])),
            PathBuf::from(r"C:\x\a (3).png")
        );
        assert_eq!(
            version_path(Path::new(r"C:\x\shot.jpg"), taken(&["shot.jpg"])),
            PathBuf::from(r"C:\x\shot (2).jpg")
        );
    }

    #[test]
    fn parse_intent_reads_save_version() {
        assert_eq!(
            parse_intent(Some("saveVersion")).unwrap(),
            ExportIntent::SaveVersion
        );
    }

    #[test]
    fn another_capture_asks_only_a_visible_loaded_editor() {
        assert!(must_ask(Some("a"), "b", true, true));
        assert!(!must_ask(Some("a"), "a", true, true));
        assert!(!must_ask(None, "b", true, true));
        assert!(!must_ask(Some("a"), "b", false, true));
        assert!(!must_ask(Some("a"), "b", true, false));
    }

    #[test]
    fn has_annotations_reads_the_autosaved_document() {
        let dir = tempfile::tempdir().unwrap();
        let id = ulid::Ulid::generate().to_string();
        assert!(!has_annotations(dir.path(), &id));
        write_document(dir.path(), &id, r#"{"annotations":[],"crop":null}"#).unwrap();
        assert!(!has_annotations(dir.path(), &id));
        write_document(
            dir.path(),
            &id,
            r#"{"annotations":[{"id":"a"}],"crop":null}"#,
        )
        .unwrap();
        assert!(has_annotations(dir.path(), &id));
    }

    #[test]
    fn autosave_is_atomic_and_rejects_bad_ids() {
        let dir = tempfile::tempdir().unwrap();
        assert!(write_document(dir.path(), "../x", "{}").is_err());
        assert!(write_document(dir.path(), "01JBX4", "{}").is_err());
        let id = ulid::Ulid::generate().to_string();
        let path = write_document(dir.path(), &id, r#"{"version":1}"#).unwrap();
        assert_eq!(path, dir.path().join(&id).join("document.json"));
        assert_eq!(std::fs::read_to_string(&path).unwrap(), r#"{"version":1}"#);
        let leftovers = std::fs::read_dir(dir.path().join(&id))
            .unwrap()
            .filter(|e| e.as_ref().unwrap().file_name() != "document.json")
            .count();
        assert_eq!(leftovers, 0);
    }
}
