//! Settings schema, version 1 (spec § 7.1).
use serde::{Deserialize, Serialize};

pub const DEFAULT_NAME_TEMPLATE: &str = "Kirishot {date} à {heure}";

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub version: u32,
    pub save: SaveSettings,
    pub after_capture: AfterCaptureSettings,
    pub capture: CaptureSettings,
    pub shortcuts: Shortcuts,
    pub history: HistorySettings,
    pub system: SystemSettings,
    pub onboarding_done: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SaveSettings {
    /// `None` keeps the default folder (Pictures\Kirishot), resolved at each use.
    pub folder: Option<String>,
    pub format: ImageFormat,
    pub name_template: String,
    pub counter: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct AfterCaptureSettings {
    pub auto_action: AutoAction,
    pub thumbnail_seconds: u8,
    pub always_open_editor: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct CaptureSettings {
    pub include_cursor: bool,
    pub sound: bool,
    pub tray_timer_seconds: u8,
    pub commit_on_release: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct Shortcuts {
    pub region: Option<String>,
    /// A second region shortcut, for keyboards with a PrintScreen key.
    pub region_alt: Option<String>,
    pub fullscreen: Option<String>,
    pub ocr: Option<String>,
    pub repeat_region: Option<String>,
    pub open_history: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct HistorySettings {
    /// `None` keeps captures forever.
    pub retention_days: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SystemSettings {
    pub launch_at_startup: bool,
    pub language: Language,
    pub theme: Theme,
    pub check_updates: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum ImageFormat {
    Png,
    Jpg,
    Webp,
}

impl ImageFormat {
    pub fn extension(self) -> &'static str {
        match self {
            ImageFormat::Png => "png",
            ImageFormat::Jpg => "jpg",
            ImageFormat::Webp => "webp",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum AutoAction {
    SaveAndCopy,
    Copy,
    Save,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum Language {
    Auto,
    Fr,
    En,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum Theme {
    System,
    Dark,
    Light,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            version: 1,
            save: SaveSettings {
                folder: None,
                format: ImageFormat::Png,
                name_template: DEFAULT_NAME_TEMPLATE.into(),
                counter: 1,
            },
            after_capture: AfterCaptureSettings {
                auto_action: AutoAction::SaveAndCopy,
                thumbnail_seconds: 5,
                always_open_editor: false,
            },
            capture: CaptureSettings {
                include_cursor: false,
                sound: false,
                tray_timer_seconds: 3,
                commit_on_release: false,
            },
            shortcuts: Shortcuts {
                region: Some("Super+Shift+S".into()),
                region_alt: Some("PrintScreen".into()),
                fullscreen: Some("Shift+PrintScreen".into()),
                ocr: Some("Ctrl+PrintScreen".into()),
                repeat_region: None,
                open_history: None,
            },
            history: HistorySettings {
                retention_days: Some(30),
            },
            system: SystemSettings {
                launch_at_startup: true,
                language: Language::Auto,
                theme: Theme::System,
                check_updates: true,
            },
            onboarding_done: false,
        }
    }
}

/// Destination folder chosen in the settings page.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum FolderChoice {
    Default,
    Custom { path: String },
}

/// The fields the front end may change. Rust-owned fields such as `save.counter` are not here,
/// so a stale copy in the page can never overwrite them.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SettingsPatch {
    pub save_folder: Option<FolderChoice>,
    pub save_format: Option<ImageFormat>,
    pub auto_action: Option<AutoAction>,
}

pub fn apply_patch(s: &mut Settings, p: SettingsPatch) {
    if let Some(folder) = p.save_folder {
        s.save.folder = match folder {
            FolderChoice::Default => None,
            FolderChoice::Custom { path } => Some(path),
        };
    }
    if let Some(format) = p.save_format {
        s.save.format = format;
    }
    if let Some(action) = p.auto_action {
        s.after_capture.auto_action = action;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn defaults_match_spec() {
        let v = serde_json::to_value(Settings::default()).unwrap();
        assert_eq!(v["version"], 1);
        assert_eq!(
            v["save"],
            json!({"folder": null, "format": "png", "nameTemplate": "Kirishot {date} à {heure}", "counter": 1})
        );
        assert_eq!(
            v["afterCapture"],
            json!({"autoAction": "saveAndCopy", "thumbnailSeconds": 5, "alwaysOpenEditor": false})
        );
        assert_eq!(
            v["capture"],
            json!({"includeCursor": false, "sound": false, "trayTimerSeconds": 3, "commitOnRelease": false})
        );
        assert_eq!(
            v["shortcuts"],
            json!({"region": "Super+Shift+S", "regionAlt": "PrintScreen", "fullscreen": "Shift+PrintScreen", "ocr": "Ctrl+PrintScreen", "repeatRegion": null, "openHistory": null})
        );
        assert_eq!(v["history"], json!({"retentionDays": 30}));
        assert_eq!(
            v["system"],
            json!({"launchAtStartup": true, "language": "auto", "theme": "system", "checkUpdates": true})
        );
        assert_eq!(v["onboardingDone"], false);
    }

    #[test]
    fn patch_changes_only_targeted_fields() {
        let mut s = Settings::default();
        s.save.counter = 42;
        apply_patch(
            &mut s,
            SettingsPatch {
                save_folder: Some(FolderChoice::Custom {
                    path: r"D:\Captures".into(),
                }),
                save_format: Some(ImageFormat::Jpg),
                auto_action: None,
            },
        );
        assert_eq!(s.save.folder.as_deref(), Some(r"D:\Captures"));
        assert_eq!(s.save.format, ImageFormat::Jpg);
        assert_eq!(s.save.counter, 42);
        apply_patch(
            &mut s,
            SettingsPatch {
                save_folder: Some(FolderChoice::Default),
                save_format: None,
                auto_action: None,
            },
        );
        assert_eq!(s.save.folder, None);
    }

    #[test]
    fn image_format_extensions() {
        assert_eq!(ImageFormat::Png.extension(), "png");
        assert_eq!(ImageFormat::Jpg.extension(), "jpg");
        assert_eq!(ImageFormat::Webp.extension(), "webp");
    }
}
