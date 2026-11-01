//! Global shortcuts from the settings.
mod ll_hook;

use std::time::Instant;

use tauri::Manager;
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

/// Keeps the PrintScreen hook installed for the life of the app.
struct HookState(#[allow(dead_code)] ll_hook::HookGuard);

/// Registers every binding: PrintScreen combinations through the low-level hook, the others
/// through the global-shortcut plugin. A shortcut taken by another application is reported,
/// not fatal.
pub fn register_all(app: &tauri::AppHandle, s: &Shortcuts) {
    let mut printscreen = Vec::new();
    for (action, accel) in bindings(s) {
        match ll_hook::printscreen_mods(&accel) {
            Some(mods) => printscreen.push((mods, action)),
            None => register_with_plugin(app, action, &accel),
        }
    }
    if printscreen.is_empty() {
        return;
    }
    let handle = app.clone();
    // Combinations without a binding (Alt+PrintScreen…) keep their Windows behavior.
    let installed = ll_hook::install_printscreen_hook(move |mods| {
        let Some((_, action)) = printscreen.iter().find(|(m, _)| *m == mods) else {
            return false;
        };
        flow::start(&handle, action.mode(), Instant::now());
        true
    });
    match installed {
        Ok(guard) => {
            app.manage(HookState(guard));
        }
        Err(e) => {
            log::error!("{e}");
            notify::show(
                app,
                messages::SHORTCUT_CONFLICT_TITLE,
                &messages::shortcut_conflict("Impr. écran"),
            );
        }
    }
}

fn register_with_plugin(app: &tauri::AppHandle, action: HotkeyAction, accel: &str) {
    let registered = app
        .global_shortcut()
        .on_shortcut(accel, move |app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                flow::start(app, action.mode(), Instant::now());
            }
        });
    if let Err(e) = registered {
        log::warn!("cannot register {accel}: {e}");
        notify::show(
            app,
            messages::SHORTCUT_CONFLICT_TITLE,
            &messages::shortcut_conflict(accel),
        );
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
