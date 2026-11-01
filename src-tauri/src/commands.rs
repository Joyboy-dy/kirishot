use serde::{Deserialize, Serialize};
use specta_typescript::Typescript;
use tauri_specta::{collect_commands, Builder};

use crate::error::KResult;

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

/// Every command and event exposed to the front end.
pub fn specta_builder() -> Builder<tauri::Wry> {
    Builder::<tauri::Wry>::new().commands(collect_commands![app_info])
}

/// Writes `src/lib/bindings.ts`, which the front end imports through `src/lib/ipc.ts`.
pub fn export_bindings(builder: &Builder<tauri::Wry>) {
    builder
        .export(
            Typescript::default().header("/* eslint-disable */
// @ts-nocheck"),
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
        let ts =
            std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/../src/lib/bindings.ts"))
                .unwrap();
        assert!(ts.contains("appInfo"));
        assert!(ts.contains("KirishotError"));
    }
}
