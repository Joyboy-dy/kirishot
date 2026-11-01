use serde::{Deserialize, Serialize};
use specta_typescript::Typescript;
use tauri::Manager;
use tauri_specta::{Builder, Event, collect_commands, collect_events};

use crate::capture::types::{CommitTarget, MonitorInfo, WindowInfo};
use crate::error::{ErrorCode, KResult, KirishotError};
use crate::geometry::{Point, Rect};
use crate::paths;
use crate::settings::model::{SettingsPatch, apply_patch};
use crate::settings::{self, SettingsChanged, SettingsState, SettingsView};

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

/// Every command and event exposed to the front end.
pub fn specta_builder() -> Builder<tauri::Wry> {
    Builder::<tauri::Wry>::new()
        .commands(collect_commands![app_info, settings_get, settings_update])
        .events(collect_events![SettingsChanged])
        // Used by the overlay before any command carries them.
        .typ::<Rect>()
        .typ::<Point>()
        .typ::<MonitorInfo>()
        .typ::<WindowInfo>()
        .typ::<CommitTarget>()
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
    fn export_bindings_writes_typescript() {
        export_bindings(&specta_builder());
        let ts = std::fs::read_to_string(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../src/lib/bindings.ts"
        ))
        .unwrap();
        assert!(ts.contains("appInfo"));
        assert!(ts.contains("KirishotError"));
    }

    #[test]
    fn export_bindings_includes_capture_types() {
        export_bindings(&specta_builder());
        let ts = std::fs::read_to_string(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../src/lib/bindings.ts"
        ))
        .unwrap();
        for name in ["Rect", "Point", "MonitorInfo", "WindowInfo", "CommitTarget"] {
            assert!(
                ts.contains(&format!("export type {name} =")),
                "{name} missing"
            );
        }
    }
}
