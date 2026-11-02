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
    let next = state.update(|s| apply_patch(s, patch))?;
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
    tauri::async_runtime::spawn_blocking(move || editor::export(&app, &capture_id, intent, png))
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
            editor_close
        ])
        .events(collect_events![
            SettingsChanged,
            OverlayClaimed,
            OverlayReset,
            ThumbnailPushed,
            ThumbnailUpdate
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
