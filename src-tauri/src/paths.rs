use std::ffi::OsString;
use std::path::PathBuf;

use tauri::Manager;

use crate::error::{ErrorCode, KResult, KirishotError};

/// `%APPDATA%\Kirishot`, or a temp folder when APPDATA is missing.
pub fn app_root_from(appdata: Option<OsString>) -> PathBuf {
    match appdata {
        Some(dir) => PathBuf::from(dir).join("Kirishot"),
        None => std::env::temp_dir().join("Kirishot"),
    }
}

pub fn app_root() -> PathBuf {
    app_root_from(std::env::var_os("APPDATA"))
}

pub fn logs_dir() -> PathBuf {
    app_root().join("logs")
}

/// `%TEMP%\Kirishot`: the thumbnails' PNG files, cleared at startup.
pub fn temp_dir() -> PathBuf {
    std::env::temp_dir().join("Kirishot")
}

pub fn settings_file() -> PathBuf {
    app_root().join("settings.json")
}

/// Windows' known Pictures folder followed by `Kirishot`, resolved at each use.
pub fn default_save_folder(app: &tauri::AppHandle) -> KResult<PathBuf> {
    app.path()
        .picture_dir()
        .map(|dir| dir.join("Kirishot"))
        .map_err(|e| {
            KirishotError::new(ErrorCode::Save, format!("Dossier Images introuvable : {e}"))
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_root_is_kirishot_under_appdata() {
        let root = app_root_from(Some(r"C:\Users\x\AppData\Roaming".into()));
        assert_eq!(root, PathBuf::from(r"C:\Users\x\AppData\Roaming\Kirishot"));
    }

    #[test]
    fn app_root_falls_back_to_temp_without_appdata() {
        assert_eq!(app_root_from(None), std::env::temp_dir().join("Kirishot"));
    }
}
