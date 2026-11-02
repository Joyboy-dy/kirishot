//! User-facing texts on the Rust side (French only until J6 adds English).

pub const APP_NAME: &str = "Kirishot";

pub const SETTINGS_RESET_TITLE: &str = "Réglages réinitialisés";
pub const SETTINGS_RESET_BODY: &str =
    "Le fichier de réglages était illisible. Une copie a été gardée dans settings.bak.json.";

pub const SHORTCUT_CONFLICT_TITLE: &str = "Raccourci indisponible";

pub fn shortcut_conflict(accel: &str) -> String {
    format!("{accel} est déjà utilisé par une autre application.")
}

pub const SAVED_AND_COPIED: &str = "Capture enregistrée et copiée";
pub const SAVED: &str = "Capture enregistrée";
pub const COPIED: &str = "Capture copiée";
pub const COPIED_BODY: &str = "Collez-la où vous voulez avec Ctrl+V.";
pub const FALLBACK_TITLE: &str = "Dossier de destination inaccessible";
pub const FALLBACK_BODY: &str = "La capture a été enregistrée dans Images › Kirishot.";
pub const FAILURE_TITLE: &str = "Capture impossible";

pub const TRAY_REGION: &str = "Capturer une zone";
pub const TRAY_FULLSCREEN: &str = "Capturer l'écran entier";
pub const TRAY_SETTINGS: &str = "Réglages";
pub const TRAY_QUIT: &str = "Quitter";

/// Where the source code lives (« À propos »).
pub const REPOSITORY_URL: &str = "https://github.com/Joyboy-dy/kirishot";

pub const SHORTCUT_TAKEN: &str = "Déjà utilisé par une autre application";
pub const SHORTCUT_DUPLICATE: &str = "Déjà utilisé par un autre raccourci de Kirishot";
pub const SHORTCUT_UNPARSABLE: &str = "Combinaison non reconnue";
