//! Global shortcuts from the settings.
use std::time::Instant;

use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

use crate::flow::{self, StartMode};
use crate::settings::model::Shortcuts;
use crate::{messages, notify};

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum HotkeyAction {
    Region,
    Fullscreen,
}

impl HotkeyAction {
    fn mode(self) -> StartMode {
        match self {
            HotkeyAction::Region => StartMode::Region,
            HotkeyAction::Fullscreen => StartMode::Fullscreen,
        }
    }
}

/// The shortcuts J1 handles, skipping the ones set to `null`.
pub fn bindings(s: &Shortcuts) -> Vec<(HotkeyAction, String)> {
    [
        (HotkeyAction::Region, &s.region),
        (HotkeyAction::Fullscreen, &s.fullscreen),
    ]
    .into_iter()
    .filter_map(|(action, accel)| Some((action, accel.clone()?)))
    .collect()
}

/// Registers every binding; a shortcut taken by another application is reported, not fatal.
pub fn register_all(app: &tauri::AppHandle, s: &Shortcuts) {
    for (action, accel) in bindings(s) {
        let registered =
            app.global_shortcut()
                .on_shortcut(accel.as_str(), move |app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        flow::start(app, action.mode(), Instant::now());
                    }
                });
        if let Err(e) = registered {
            log::warn!("cannot register {accel}: {e}");
            notify::show(
                app,
                messages::SHORTCUT_CONFLICT_TITLE,
                &messages::shortcut_conflict(&accel),
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::settings::model::Settings;

    #[test]
    fn default_bindings() {
        assert_eq!(
            bindings(&Settings::default().shortcuts),
            vec![
                (HotkeyAction::Region, "PrintScreen".to_string()),
                (HotkeyAction::Fullscreen, "Shift+PrintScreen".to_string())
            ]
        );
    }

    #[test]
    fn null_shortcuts_are_skipped() {
        let mut s = Settings::default().shortcuts;
        s.fullscreen = None;
        assert_eq!(
            bindings(&s),
            vec![(HotkeyAction::Region, "PrintScreen".to_string())]
        );
    }
}
