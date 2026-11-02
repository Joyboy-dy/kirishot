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
    /// `false` keeps the J1 behavior: the action runs at once and a notification confirms it.
    pub thumbnail: bool,
    /// 3, 6 or 10; `None` keeps the thumbnail until it is closed.
    pub thumbnail_seconds: Option<u8>,
    pub always_open_editor: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct CaptureSettings {
    /// Whether the selection screen starts with its magnifier shown.
    pub magnifier: bool,
    pub sound: bool,
    pub flash: bool,
    pub include_cursor: bool,
    pub tray_timer_seconds: u8,
    pub commit_on_release: bool,
    /// The selection mode the next capture starts in (the last one chosen).
    pub mode: CaptureMode,
    pub toolbar_position: ToolbarPosition,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum CaptureMode {
    Region,
    Window,
}

/// Where the selection screen shows its toolbar.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum ToolbarPosition {
    Top,
    Bottom,
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
                thumbnail: true,
                thumbnail_seconds: Some(6),
                always_open_editor: false,
            },
            capture: CaptureSettings {
                magnifier: true,
                sound: true,
                flash: true,
                include_cursor: false,
                tray_timer_seconds: 3,
                commit_on_release: false,
                mode: CaptureMode::Region,
                toolbar_position: ToolbarPosition::Top,
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
    pub magnifier: Option<bool>,
    pub sound: Option<bool>,
    pub flash: Option<bool>,
    pub thumbnail: Option<bool>,
    pub thumbnail_duration: Option<ThumbnailDuration>,
    pub always_open_editor: Option<bool>,
    pub commit_on_release: Option<bool>,
    pub mode: Option<CaptureMode>,
    pub toolbar_position: Option<ToolbarPosition>,
}

/// How long a thumbnail stays; a patch cannot carry `null` to mean "until closed".
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ThumbnailDuration {
    Seconds { value: u8 },
    UntilClosed,
}

#[cfg(test)]
impl SettingsPatch {
    /// A patch that changes nothing.
    pub fn empty() -> Self {
        Self {
            save_folder: None,
            save_format: None,
            auto_action: None,
            magnifier: None,
            sound: None,
            flash: None,
            thumbnail: None,
            thumbnail_duration: None,
            always_open_editor: None,
            commit_on_release: None,
            mode: None,
            toolbar_position: None,
        }
    }
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
    if let Some(on) = p.magnifier {
        s.capture.magnifier = on;
    }
    if let Some(on) = p.sound {
        s.capture.sound = on;
    }
    if let Some(on) = p.flash {
        s.capture.flash = on;
    }
    if let Some(on) = p.thumbnail {
        s.after_capture.thumbnail = on;
    }
    if let Some(duration) = p.thumbnail_duration {
        s.after_capture.thumbnail_seconds = match duration {
            ThumbnailDuration::Seconds { value } => Some(value),
            ThumbnailDuration::UntilClosed => None,
        };
    }
    if let Some(on) = p.always_open_editor {
        s.after_capture.always_open_editor = on;
    }
    if let Some(on) = p.commit_on_release {
        s.capture.commit_on_release = on;
    }
    if let Some(mode) = p.mode {
        s.capture.mode = mode;
    }
    if let Some(position) = p.toolbar_position {
        s.capture.toolbar_position = position;
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
            json!({"autoAction": "saveAndCopy", "thumbnail": true, "thumbnailSeconds": 6, "alwaysOpenEditor": false})
        );
        assert_eq!(
            v["capture"],
            json!({"magnifier": true, "sound": true, "flash": true, "includeCursor": false, "trayTimerSeconds": 3, "commitOnRelease": false, "mode": "region", "toolbarPosition": "top"})
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
    fn patch_sets_capture_behaviour() {
        let mut s = Settings::default();
        apply_patch(
            &mut s,
            SettingsPatch {
                commit_on_release: Some(true),
                mode: Some(CaptureMode::Window),
                toolbar_position: Some(ToolbarPosition::Bottom),
                ..SettingsPatch::empty()
            },
        );
        let mut expected = Settings::default();
        expected.capture.commit_on_release = true;
        expected.capture.mode = CaptureMode::Window;
        expected.capture.toolbar_position = ToolbarPosition::Bottom;
        assert_eq!(s, expected);
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
                ..SettingsPatch::empty()
            },
        );
        assert_eq!(s.save.folder.as_deref(), Some(r"D:\Captures"));
        assert_eq!(s.save.format, ImageFormat::Jpg);
        assert_eq!(s.save.counter, 42);
        apply_patch(
            &mut s,
            SettingsPatch {
                save_folder: Some(FolderChoice::Default),
                ..SettingsPatch::empty()
            },
        );
        assert_eq!(s.save.folder, None);
    }

    #[test]
    fn j2_defaults() {
        let s = Settings::default();
        assert!(s.after_capture.thumbnail);
        assert_eq!(s.after_capture.thumbnail_seconds, Some(6));
        assert!(s.capture.magnifier && s.capture.sound && s.capture.flash);
    }

    #[test]
    fn patch_sets_capture_toggles_and_duration() {
        let mut s = Settings::default();
        apply_patch(
            &mut s,
            SettingsPatch {
                sound: Some(false),
                magnifier: Some(false),
                thumbnail_duration: Some(ThumbnailDuration::UntilClosed),
                ..SettingsPatch::empty()
            },
        );
        assert!(!s.capture.sound && !s.capture.magnifier);
        assert!(s.capture.flash);
        assert_eq!(s.after_capture.thumbnail_seconds, None);
        apply_patch(
            &mut s,
            SettingsPatch {
                flash: Some(false),
                thumbnail: Some(false),
                always_open_editor: Some(true),
                thumbnail_duration: Some(ThumbnailDuration::Seconds { value: 10 }),
                ..SettingsPatch::empty()
            },
        );
        assert!(!s.capture.flash && !s.after_capture.thumbnail);
        assert!(s.after_capture.always_open_editor);
        assert_eq!(s.after_capture.thumbnail_seconds, Some(10));
    }

    #[test]
    fn image_format_extensions() {
        assert_eq!(ImageFormat::Png.extension(), "png");
        assert_eq!(ImageFormat::Jpg.extension(), "jpg");
        assert_eq!(ImageFormat::Webp.extension(), "webp");
    }
}
