use serde::{Deserialize, Serialize};
use specta_typescript::Typescript;
use tauri::Manager;
use tauri_specta::{Builder, Event, collect_commands, collect_events};

use crate::capture::types::{CommitTarget, MonitorInfo, WindowInfo};
use crate::editor::{self, EditorSession};
use crate::error::{ErrorCode, KResult, KirishotError};
use crate::flow::{self, OverlayClaimed, OverlayReset, OverlaySession};
use crate::geometry::{Point, Rect};
use crate::paths;
use crate::settings::model::{SettingsPatch, apply_patch};
use crate::settings::{self, SettingsChanged, SettingsState, SettingsView};
use crate::thumbnails::{self, ThumbState, ThumbnailPushed, ThumbnailUpdate};
use crate::windowing;

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub version: String,
}

#[tauri::command]
#[specta::specta]
pub async fn app_info() -> KResult<AppInfo> {
    Ok(AppInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

fn settings_view(app: &tauri::AppHandle, s: &settings::model::Settings) -> KResult<SettingsView> {
    let default_folder = paths::default_save_folder(app)?;
    let pictures = app.path().picture_dir().map_err(|e| {
        KirishotError::new(
            ErrorCode::Settings,
            format!("Dossier Images introuvable : {e}"),
        )
    })?;
    Ok(settings::view(s, &default_folder, &pictures))
}

#[tauri::command]
#[specta::specta]
pub async fn settings_get(
    app: tauri::AppHandle,
    state: tauri::State<'_, SettingsState>,
) -> KResult<SettingsView> {
    settings_view(&app, &state.get())
}

#[tauri::command]
#[specta::specta]
pub async fn settings_update(
    app: tauri::AppHandle,
    state: tauri::State<'_, SettingsState>,
    patch: SettingsPatch,
) -> KResult<SettingsView> {
    let autostart = patch.launch_at_startup;
    let next = state.update(|s| apply_patch(s, patch))?;
    // The setting is stored either way; a refusal from Windows is reported to the page.
    if let Some(on) = autostart {
        crate::startup::apply_autostart(&app, on)?;
    }
    let view = settings_view(&app, &next)?;
    if let Err(e) = SettingsChanged(view.clone()).emit(&app) {
        log::warn!("cannot emit settings-changed: {e}");
    }
    Ok(view)
}

/// The thumbnails page listens for cards: captures can go to it.
#[tauri::command]
#[specta::specta]
pub async fn thumbnails_ready(state: tauri::State<'_, ThumbState>) -> KResult<()> {
    state.mark_ready();
    log::debug!("thumbnails page ready");
    Ok(())
}

/// The visible cards changed: Rust resizes and places the window, or hides it.
#[tauri::command]
#[specta::specta]
pub async fn thumbnails_layout(app: tauri::AppHandle, ids: Vec<String>, more: u32) -> KResult<()> {
    let (tx, rx) = std::sync::mpsc::channel();
    let handle = app.clone();
    app.run_on_main_thread(move || {
        let _ = tx.send(thumbnails::layout(&handle, &ids, more));
    })
    .map_err(|e| KirishotError::new(ErrorCode::Window, e.to_string()))?;
    rx.recv()
        .map_err(|e| KirishotError::new(ErrorCode::Window, e.to_string()))?
}

#[tauri::command]
#[specta::specta]
pub async fn thumbnail_expire(app: tauri::AppHandle, id: String) -> KResult<()> {
    tauri::async_runtime::spawn_blocking(move || thumbnails::expire(&app, &id))
        .await
        .map_err(|e| KirishotError::new(ErrorCode::Internal, e.to_string()))
}

#[tauri::command]
#[specta::specta]
pub async fn thumbnail_copy(app: tauri::AppHandle, id: String) -> KResult<()> {
    thumbnails::copy(&app, &id)
}

#[tauri::command]
#[specta::specta]
pub async fn thumbnail_save(app: tauri::AppHandle, id: String) -> KResult<()> {
    tauri::async_runtime::spawn_blocking(move || thumbnails::save(&app, &id))
        .await
        .map_err(|e| KirishotError::new(ErrorCode::Internal, e.to_string()))?
}

/// Opens the capture in the editor; its automatic action no longer runs.
#[tauri::command]
#[specta::specta]
pub async fn thumbnail_edit(app: tauri::AppHandle, id: String) -> KResult<()> {
    // Editing from now on: the card's close, sent right after, can no longer save it.
    if !app.state::<crate::shots::ShotStore>().begin_edit(&id) {
        return Err(KirishotError::new(
            ErrorCode::NoActiveCapture,
            "Capture introuvable",
        ));
    }
    let (tx, rx) = std::sync::mpsc::channel();
    let handle = app.clone();
    app.run_on_main_thread(move || {
        let _ = tx.send(editor::open(&handle, &id));
    })
    .map_err(|e| KirishotError::new(ErrorCode::Window, e.to_string()))?;
    rx.recv()
        .map_err(|e| KirishotError::new(ErrorCode::Window, e.to_string()))?
}

#[tauri::command]
#[specta::specta]
pub async fn thumbnail_close(app: tauri::AppHandle, id: String) -> KResult<()> {
    tauri::async_runtime::spawn_blocking(move || thumbnails::close(&app, &id))
        .await
        .map_err(|e| KirishotError::new(ErrorCode::Internal, e.to_string()))
}

#[tauri::command]
#[specta::specta]
pub async fn thumbnail_delete(app: tauri::AppHandle, id: String) -> KResult<()> {
    thumbnails::delete(&app, &id);
    Ok(())
}

/// « Ouvrir le dossier »: the Explorer with the saved file selected.
#[tauri::command]
#[specta::specta]
pub async fn thumbnail_reveal(app: tauri::AppHandle, id: String) -> KResult<()> {
    use tauri_plugin_opener::OpenerExt;
    let path = thumbnails::saved_path(&app, &id)?;
    app.opener()
        .reveal_item_in_dir(path)
        .map_err(|e| KirishotError::new(ErrorCode::Save, e.to_string()))
}

#[tauri::command]
#[specta::specta]
pub async fn thumbnail_copy_path(app: tauri::AppHandle, id: String) -> KResult<()> {
    let path = thumbnails::saved_path(&app, &id)?;
    crate::output::clipboard::write_text(&path.to_string_lossy())
}

/// The editor page listens for frames: a pending capture can be posted.
#[tauri::command]
#[specta::specta]
pub async fn editor_loaded(window: tauri::WebviewWindow) -> KResult<()> {
    editor::mark_loaded(&window)
}

/// The editor's final image as raw PNG bytes (no JSON): the headers say which capture and what
/// to do with it. Registered outside tauri-specta, which cannot type a raw request.
#[tauri::command]
pub async fn editor_export(
    app: tauri::AppHandle,
    request: tauri::ipc::Request<'_>,
) -> KResult<editor::ExportResult> {
    let header = |name: &str| {
        request
            .headers()
            .get(name)
            .and_then(|v| v.to_str().ok())
            .map(str::to_string)
    };
    let intent = editor::parse_intent(header("x-kirishot-intent").as_deref())?;
    let capture_id = header("x-kirishot-capture")
        .ok_or_else(|| KirishotError::new(ErrorCode::InvalidSelection, "Capture inconnue"))?;
    let tauri::ipc::InvokeBody::Raw(png) = request.body() else {
        return Err(KirishotError::new(
            ErrorCode::InvalidSelection,
            "Image manquante",
        ));
    };
    let png = png.clone();
    // The file the capture was saved to, and a name chosen before the first save.
    let current = header("x-kirishot-path")
        .and_then(|p| percent_decode(&p))
        .filter(|p| !p.is_empty())
        .map(std::path::PathBuf::from);
    let name = header("x-kirishot-name")
        .and_then(|n| percent_decode(&n))
        .filter(|n| !n.trim().is_empty());
    tauri::async_runtime::spawn_blocking(move || {
        editor::export(&app, &capture_id, intent, png, current, name)
    })
    .await
    .map_err(|e| KirishotError::new(ErrorCode::Internal, e.to_string()))?
}

/// The page let the next capture into the editor (spec J3 § 3.5).
#[tauri::command]
#[specta::specta]
pub async fn editor_open_next(app: tauri::AppHandle, next_id: String) -> KResult<()> {
    let (tx, rx) = std::sync::mpsc::channel();
    let handle = app.clone();
    app.run_on_main_thread(move || {
        let _ = tx.send(editor::open_next(&handle, &next_id));
    })
    .map_err(|e| KirishotError::new(ErrorCode::Window, e.to_string()))?;
    rx.recv()
        .map_err(|e| KirishotError::new(ErrorCode::Window, e.to_string()))?
}

/// The page kept its capture: the one that asked is released.
#[tauri::command]
#[specta::specta]
pub async fn editor_cancel_next(app: tauri::AppHandle, next_id: String) -> KResult<()> {
    editor::cancel_next(&app, &next_id);
    Ok(())
}

/// The file name a first save would use: the template's, with the settings' extension.
#[tauri::command]
#[specta::specta]
pub async fn editor_planned_name(
    app: tauri::AppHandle,
    state: tauri::State<'_, SettingsState>,
    capture_id: String,
) -> KResult<String> {
    let settings = state.get();
    let meta = app
        .state::<crate::shots::ShotStore>()
        .get(&capture_id)
        .map(|s| s.meta)
        .ok_or_else(|| KirishotError::new(ErrorCode::NoActiveCapture, "Capture introuvable"))?;
    let stem = crate::output::filename::render_name(
        &settings.save.name_template,
        &crate::output::filename::NameContext {
            taken_at: meta.taken_at.naive_local(),
            window_title: meta.window_title.clone(),
            counter: settings.save.counter,
        },
    );
    Ok(format!("{stem}.{}", settings.save.format.extension()))
}

/// Renames the capture's file (spec J3 § 3.3). Without a file yet, only checks the name, which
/// the page keeps for the first save. Returns the new path, if a file was renamed.
#[tauri::command]
#[specta::specta]
pub async fn editor_rename(
    app: tauri::AppHandle,
    capture_id: String,
    current_path: Option<String>,
    stem: String,
) -> KResult<Option<String>> {
    use crate::output::filename::{RenameError, StemError, rename_plan, validate_stem};
    let refused = |e: StemError| {
        let message = match e {
            StemError::Empty => "Le nom ne peut pas être vide".to_string(),
            StemError::ForbiddenChar(c) => format!("Le caractère « {c} » n'est pas permis"),
            StemError::Reserved => "Ce nom est réservé par Windows".to_string(),
        };
        KirishotError::new(ErrorCode::Save, message)
    };
    let Some(current) = current_path.map(std::path::PathBuf::from) else {
        validate_stem(&stem).map_err(refused)?;
        return Ok(None);
    };
    let next = match rename_plan(&current, &stem, |p| p.exists()) {
        Ok(Some(next)) => next,
        Ok(None) => return Ok(Some(current.to_string_lossy().into_owned())),
        Err(RenameError::Invalid(e)) => return Err(refused(e)),
        Err(RenameError::Taken) => {
            return Err(KirishotError::new(
                ErrorCode::Save,
                "Un fichier porte déjà ce nom",
            ));
        }
    };
    std::fs::rename(&current, &next).map_err(|e| {
        // ERROR_SHARING_VIOLATION: another application has the file open.
        let message = if e.raw_os_error() == Some(32) {
            "Le fichier est utilisé par une autre application".to_string()
        } else {
            format!("Renommage impossible : {e}")
        };
        KirishotError::new(ErrorCode::Save, message)
    })?;
    crate::history::mark_saved(&app, &capture_id, &next);
    Ok(Some(next.to_string_lossy().into_owned()))
}

/// Headers carry ASCII only: the page sends paths and names percent-encoded.
fn percent_decode(s: &str) -> Option<String> {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let hex = std::str::from_utf8(&bytes[i + 1..i + 3]).ok()?;
            out.push(u8::from_str_radix(hex, 16).ok()?);
            i += 3;
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(out).ok()
}

/// Saves the editor's document (JSON) beside the original.
#[tauri::command]
#[specta::specta]
pub async fn editor_autosave(capture_id: String, document: String) -> KResult<()> {
    tauri::async_runtime::spawn_blocking(move || {
        editor::write_document(&paths::history_dir(), &capture_id, &document).map(|_| ())
    })
    .await
    .map_err(|e| KirishotError::new(ErrorCode::Internal, e.to_string()))?
}

/// Closes the editor and frees its capture.
#[tauri::command]
#[specta::specta]
pub async fn editor_close(app: tauri::AppHandle) -> KResult<()> {
    editor::close(&app);
    Ok(())
}

/// Plays the shutter click, so the settings page can preview it.
#[tauri::command]
#[specta::specta]
pub async fn play_shutter_preview() -> KResult<()> {
    crate::sound::play();
    Ok(())
}

/// Copies text, such as the colour under the magnifier.
#[tauri::command]
#[specta::specta]
pub async fn copy_text(text: String) -> KResult<()> {
    crate::output::clipboard::write_text(&text)
}

fn overlay_monitor(window: &tauri::WebviewWindow) -> KResult<usize> {
    windowing::monitor_index(window.label())
        .ok_or_else(|| KirishotError::new(ErrorCode::Window, "Fenêtre de sélection inconnue"))
}

/// The overlay page listens for frames: pending frames can be posted.
#[tauri::command]
#[specta::specta]
pub async fn overlay_loaded(window: tauri::WebviewWindow) -> KResult<()> {
    windowing::mark_loaded(&window)
}

/// The overlay drew its frozen screen and can be shown.
#[tauri::command]
#[specta::specta]
pub async fn overlay_ready(window: tauri::WebviewWindow) -> KResult<()> {
    flow::reveal(&window)
}

/// A selection started on this monitor: the other overlays drop theirs.
#[tauri::command]
#[specta::specta]
pub async fn overlay_claim(app: tauri::AppHandle, window: tauri::WebviewWindow) -> KResult<()> {
    let monitor_index = overlay_monitor(&window)? as u32;
    OverlayClaimed { monitor_index }
        .emit(&app)
        .map_err(|e| KirishotError::new(ErrorCode::Internal, e.to_string()))
}

#[tauri::command]
#[specta::specta]
pub async fn overlay_commit(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    capture_id: String,
    target: CommitTarget,
    copy_only: bool,
) -> KResult<()> {
    flow::commit(
        &app,
        overlay_monitor(&window)?,
        &capture_id,
        target,
        copy_only,
    )
}

#[tauri::command]
#[specta::specta]
pub async fn overlay_cancel(app: tauri::AppHandle) -> KResult<()> {
    flow::cancel(&app);
    Ok(())
}

/// Opens the destination folder in the Explorer, creating it first if needed.
#[tauri::command]
#[specta::specta]
pub async fn open_save_folder(
    app: tauri::AppHandle,
    state: tauri::State<'_, SettingsState>,
) -> KResult<()> {
    use tauri_plugin_opener::OpenerExt;
    let folder = settings::resolve_save_folder(&state.get(), &paths::default_save_folder(&app)?);
    let fail = |e: &dyn std::fmt::Display| {
        KirishotError::new(
            ErrorCode::Save,
            format!("Impossible d'ouvrir le dossier : {e}"),
        )
    };
    std::fs::create_dir_all(&folder).map_err(|e| fail(&e))?;
    app.opener()
        .open_path(folder.to_string_lossy(), None::<&str>)
        .map_err(|e| fail(&e))
}

/// Every capture of the history, newest first.
#[tauri::command]
#[specta::specta]
pub async fn history_list(
    app: tauri::AppHandle,
) -> KResult<Vec<crate::history::index::HistoryEntry>> {
    Ok(crate::history::entries(&app))
}

/// The thumbnail file of a capture, for `convertFileSrc`.
#[tauri::command]
#[specta::specta]
pub async fn history_thumb_path(app: tauri::AppHandle, id: String) -> KResult<String> {
    let path = crate::history::file(&app, &id, crate::history::index::THUMB_FILE)?;
    Ok(path.to_string_lossy().into_owned())
}

/// Copies a capture from the history: the annotated image if there is one.
#[tauri::command]
#[specta::specta]
pub async fn history_copy(app: tauri::AppHandle, id: String) -> KResult<()> {
    tauri::async_runtime::spawn_blocking(move || {
        use crate::history::index::{FINAL_FILE, ORIGINAL_FILE};
        let final_path = crate::history::file(&app, &id, FINAL_FILE)?;
        let path = if final_path.exists() {
            final_path
        } else {
            crate::history::file(&app, &id, ORIGINAL_FILE)?
        };
        let png =
            std::fs::read(&path).map_err(|e| KirishotError::new(ErrorCode::Save, e.to_string()))?;
        let img = image::load_from_memory(&png)
            .map_err(|e| KirishotError::new(ErrorCode::Encode, e.to_string()))?
            .to_rgba8();
        crate::output::copy_image(&app, &img, &mut Some(png))?;
        crate::history::mark_copied(&app, &id);
        Ok(())
    })
    .await
    .map_err(|e| KirishotError::new(ErrorCode::Internal, e.to_string()))?
}

/// Reopens a capture of the history in the editor, with its annotations.
#[tauri::command]
#[specta::specta]
pub async fn history_edit(app: tauri::AppHandle, id: String) -> KResult<()> {
    let shots = app.state::<crate::shots::ShotStore>();
    if shots.get(&id).is_none() {
        let entry = crate::history::entry(&app, &id)?;
        let path = crate::history::file(&app, &id, crate::history::index::ORIGINAL_FILE)?;
        let img = image::open(&path)
            .map_err(|e| KirishotError::new(ErrorCode::Encode, e.to_string()))?
            .to_rgba8();
        let taken_at = chrono::DateTime::parse_from_rfc3339(&entry.created_at)
            .map(|t| t.with_timezone(&chrono::Local))
            .unwrap_or_else(|_| chrono::Local::now());
        let meta = crate::output::CaptureMeta {
            taken_at,
            window_title: entry.source.window_title.clone(),
        };
        let action = app.state::<SettingsState>().get().after_capture.auto_action;
        shots.insert_with_id(&id, img, meta, action);
    }
    let (tx, rx) = std::sync::mpsc::channel();
    let handle = app.clone();
    app.run_on_main_thread(move || {
        let _ = tx.send(editor::open(&handle, &id));
    })
    .map_err(|e| KirishotError::new(ErrorCode::Window, e.to_string()))?;
    rx.recv()
        .map_err(|e| KirishotError::new(ErrorCode::Window, e.to_string()))?
}

/// The Explorer with the file the capture was last saved to.
#[tauri::command]
#[specta::specta]
pub async fn history_reveal(app: tauri::AppHandle, id: String) -> KResult<()> {
    use tauri_plugin_opener::OpenerExt;
    let entry = crate::history::entry(&app, &id)?;
    let path = entry
        .saved_path
        .filter(|p| std::path::Path::new(p).exists())
        .ok_or_else(|| {
            KirishotError::new(ErrorCode::Save, "Le fichier enregistré n'existe plus")
        })?;
    app.opener()
        .reveal_item_in_dir(path)
        .map_err(|e| KirishotError::new(ErrorCode::Save, e.to_string()))
}

/// Removes a capture from the history (never the file it was saved to).
#[tauri::command]
#[specta::specta]
pub async fn history_delete(app: tauri::AppHandle, id: String) -> KResult<()> {
    crate::history::delete(&app, &id);
    Ok(())
}

/// Empties the history (never the saved files).
#[tauri::command]
#[specta::specta]
pub async fn history_clear(app: tauri::AppHandle) -> KResult<()> {
    crate::history::clear(&app);
    Ok(())
}

/// Every command and event exposed to the front end.
pub fn specta_builder() -> Builder<tauri::Wry> {
    Builder::<tauri::Wry>::new()
        // One TypeScript type per Rust type: Option<T> becomes T | null, never an optional field.
        .disable_serde_phases()
        .commands(collect_commands![
            app_info,
            settings_get,
            settings_update,
            open_save_folder,
            overlay_loaded,
            overlay_ready,
            overlay_claim,
            overlay_commit,
            overlay_cancel,
            copy_text,
            thumbnails_ready,
            thumbnails_layout,
            thumbnail_expire,
            thumbnail_copy,
            thumbnail_save,
            thumbnail_edit,
            thumbnail_close,
            thumbnail_delete,
            thumbnail_reveal,
            thumbnail_copy_path,
            editor_loaded,
            editor_close,
            editor_autosave,
            play_shutter_preview,
            editor_planned_name,
            editor_open_next,
            editor_cancel_next,
            editor_rename,
            history_list,
            history_thumb_path,
            history_copy,
            history_edit,
            history_reveal,
            history_delete,
            history_clear
        ])
        .events(collect_events![
            SettingsChanged,
            OverlayClaimed,
            OverlayReset,
            ThumbnailPushed,
            ThumbnailUpdate,
            crate::history::HistoryChanged,
            editor::EditorCloseRequested
        ])
        // Used by the overlay before any command carries them.
        .typ::<Rect>()
        .typ::<Point>()
        .typ::<MonitorInfo>()
        .typ::<WindowInfo>()
        .typ::<CommitTarget>()
        // Sent as the shared buffer's additionalData, never as a command result.
        .typ::<OverlaySession>()
        .typ::<EditorSession>()
        .typ::<editor::ExportResult>()
}

/// Writes `src/lib/bindings.ts`, which the front end imports through `src/lib/ipc.ts`.
pub fn export_bindings(builder: &Builder<tauri::Wry>) {
    builder
        .export(
            Typescript::default().header(
                "/* eslint-disable */
// @ts-nocheck",
            ),
            concat!(env!("CARGO_MANIFEST_DIR"), "/../src/lib/bindings.ts"),
        )
        .expect("failed to export TypeScript bindings");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn percent_decode_reads_encoded_paths() {
        assert_eq!(
            percent_decode("C%3A%5CImages%5CKirishot%20%C3%A0.png").as_deref(),
            Some(r"C:\Images\Kirishot à.png")
        );
        assert_eq!(percent_decode("abc").as_deref(), Some("abc"));
        assert_eq!(percent_decode("%ZZ"), None);
    }

    // One test only: two tests writing the same bindings file in parallel would race.
    #[test]
    fn export_bindings_writes_typescript() {
        export_bindings(&specta_builder());
        let ts = std::fs::read_to_string(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../src/lib/bindings.ts"
        ))
        .unwrap();
        assert!(ts.contains("appInfo"));
        assert!(ts.contains("KirishotError"));
        for name in ["Rect", "Point", "MonitorInfo", "WindowInfo", "CommitTarget"] {
            assert!(
                ts.contains(&format!("export type {name} =")),
                "{name} missing"
            );
        }
    }
}
