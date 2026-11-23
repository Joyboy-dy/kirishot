use std::path::PathBuf;

use tauri::Manager;

use crate::error::{ErrorCode, KResult, KirishotError};

/// `%APPDATA%\Kirishot`, or a temp folder when APPDATA is missing.
#[cfg(windows)]
pub fn app_root_from(appdata: Option<std::ffi::OsString>) -> PathBuf {
    match appdata {
        Some(dir) => PathBuf::from(dir).join("Kirishot"),
        None => std::env::temp_dir().join("Kirishot"),
    }
}

#[cfg(windows)]
pub fn app_root() -> PathBuf {
    app_root_from(std::env::var_os("APPDATA"))
}

/// `$XDG_DATA_HOME/kirishot`, `~/.local/share/kirishot` when XDG_DATA_HOME is unset.
#[cfg(not(windows))]
pub fn app_root_from_xdg(
    xdg_data_home: Option<std::ffi::OsString>,
    home: Option<std::ffi::OsString>,
) -> PathBuf {
    let base = xdg_data_home
        .map(PathBuf::from)
        .filter(|p| p.is_absolute())
        .or_else(|| home.map(|h| PathBuf::from(h).join(".local/share")))
        .unwrap_or_else(std::env::temp_dir);
    base.join("kirishot")
}

#[cfg(not(windows))]
pub fn app_root() -> PathBuf {
    app_root_from_xdg(
        std::env::var_os("XDG_DATA_HOME"),
        std::env::var_os("HOME"),
    )
}

pub fn logs_dir() -> PathBuf {
    app_root().join("logs")
}

/// The thumbnails' PNG files, cleared at startup.
pub fn temp_dir() -> PathBuf {
    std::env::temp_dir().join("Kirishot")
}

/// Where J2 kept editor originals; moved into the history.
pub fn captures_dir() -> PathBuf {
    app_root().join("captures")
}

/// One folder per capture and `index.json` (spec J3 § 4.2).
pub fn history_dir() -> PathBuf {
    app_root().join("history")
}

pub fn settings_file() -> PathBuf {
    app_root().join("settings.json")
}

/// The system's known Pictures folder followed by `Kirishot`, resolved at each use.
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

    #[cfg(windows)]
    #[test]
    fn app_root_is_kirishot_under_appdata() {
        let root = app_root_from(Some(r"C:\Users\x\AppData\Roaming".into()));
        assert_eq!(root, PathBuf::from(r"C:\Users\x\AppData\Roaming\Kirishot"));
    }

    #[cfg(windows)]
    #[test]
    fn app_root_falls_back_to_temp_without_appdata() {
        assert_eq!(app_root_from(None), std::env::temp_dir().join("Kirishot"));
    }

    #[cfg(not(windows))]
    #[test]
    fn app_root_is_kirishot_under_xdg_data_home() {
        let root = app_root_from_xdg(Some("/home/x/.local/share".into()), None);
        assert_eq!(root, PathBuf::from("/home/x/.local/share/kirishot"));
    }

    #[cfg(not(windows))]
    #[test]
    fn app_root_falls_back_to_home_then_temp() {
        assert_eq!(
            app_root_from_xdg(None, Some("/home/x".into())),
            PathBuf::from("/home/x/.local/share/kirishot")
        );
        assert_eq!(
            app_root_from_xdg(Some("relative".into()), None),
            std::env::temp_dir().join("kirishot")
        );
    }
}
