pub mod model;
pub mod store;

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

use crate::error::KResult;
use model::Settings;

/// The settings in memory, saved to disk at every change.
pub struct SettingsState {
    path: PathBuf,
    current: Mutex<Settings>,
}

impl SettingsState {
    pub fn new(path: PathBuf, settings: Settings) -> Self {
        Self {
            path,
            current: Mutex::new(settings),
        }
    }

    pub fn get(&self) -> Settings {
        self.current.lock().unwrap().clone()
    }

    /// Applies `f` to a copy, saves it, and only then makes it the current settings.
    pub fn update(&self, f: impl FnOnce(&mut Settings)) -> KResult<Settings> {
        let mut current = self.current.lock().unwrap();
        let mut next = current.clone();
        f(&mut next);
        store::save(&self.path, &next)?;
        *current = next.clone();
        Ok(next)
    }
}

/// What the settings page displays: the settings plus the resolved destination folder.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SettingsView {
    pub settings: Settings,
    pub save_folder: String,
    pub save_folder_display: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type, tauri_specta::Event)]
pub struct SettingsChanged(pub SettingsView);

pub fn resolve_save_folder(s: &Settings, default_folder: &Path) -> PathBuf {
    match &s.save.folder {
        Some(folder) => PathBuf::from(folder),
        None => default_folder.to_path_buf(),
    }
}

/// `Images › Kirishot` for folders inside the Pictures folder, the full path otherwise.
pub fn display_path(path: &Path, pictures: &Path) -> String {
    match path.strip_prefix(pictures) {
        Ok(rest) => std::iter::once("Images".to_string())
            .chain(rest.iter().map(|part| part.to_string_lossy().into_owned()))
            .collect::<Vec<_>>()
            .join(" › "),
        Err(_) => path.display().to_string(),
    }
}

pub fn view(s: &Settings, default_folder: &Path, pictures: &Path) -> SettingsView {
    let folder = resolve_save_folder(s, default_folder);
    SettingsView {
        settings: s.clone(),
        save_folder: folder.display().to_string(),
        save_folder_display: display_path(&folder, pictures),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn display_path_uses_images_label() {
        let pics = Path::new(r"C:\Users\x\Pictures");
        assert_eq!(
            display_path(&pics.join("Kirishot"), pics),
            "Images › Kirishot"
        );
        assert_eq!(display_path(pics, pics), "Images");
        assert_eq!(
            display_path(Path::new(r"D:\Captures"), pics),
            r"D:\Captures"
        );
    }

    #[test]
    fn resolve_save_folder_prefers_custom_folder() {
        let default = Path::new(r"C:\Users\x\Pictures\Kirishot");
        let mut s = model::Settings::default();
        assert_eq!(resolve_save_folder(&s, default), default);
        s.save.folder = Some(r"D:\Captures".into());
        assert_eq!(resolve_save_folder(&s, default), Path::new(r"D:\Captures"));
    }
}
