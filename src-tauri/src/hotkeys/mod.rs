//! Global shortcuts from the settings.
mod ll_hook;
mod raw_keys;

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
        (HotkeyAction::Region, &s.region_alt),
        (HotkeyAction::Fullscreen, &s.fullscreen),
    ]
    .into_iter()
    .filter_map(|(action, accel)| Some((action, accel.clone()?)))
    .collect()
}

/// Keeps the keyboard hook installed for the life of the app.
struct HookState(#[allow(dead_code)] ll_hook::HookGuard);

/// Registers every binding: PrintScreen and Windows-key combinations through the low-level
/// hook, the others through the global-shortcut plugin. A shortcut taken by another
/// application is reported, not fatal.
pub fn register_all(app: &tauri::AppHandle, s: &Shortcuts) {
    let mut hooked = Vec::new();
    for (action, accel) in bindings(s) {
        match ll_hook::parse_hook_accel(&accel) {
            Some(key) => {
                log::debug!("{accel}: low-level hook");
                hooked.push((key, action));
            }
            None => register_with_plugin(app, action, &accel),
        }
    }
    if hooked.is_empty() {
        return;
    }
    let handle = app.clone();
    // Keys without a binding (Alt+PrintScreen, Win+E…) keep their Windows behavior.
    let installed = ll_hook::install_hook(move |pressed| {
        let Some((_, action)) = hooked.iter().find(|(k, _)| *k == pressed) else {
            return false;
        };
        flow::start(&handle, action.mode(), Instant::now());
        true
    });
    match installed {
        Ok(guard) => {
            log::info!("keyboard hook installed");
            app.manage(HookState(guard));
        }
        Err(e) => {
            log::error!("{e}");
            notify::show(
                app,
                messages::SHORTCUT_CONFLICT_TITLE,
                &messages::shortcut_conflict("Win + Maj + S"),
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
                (HotkeyAction::Region, "Super+Shift+S".to_string()),
                (HotkeyAction::Region, "PrintScreen".to_string()),
                (HotkeyAction::Fullscreen, "Shift+PrintScreen".to_string())
            ]
        );
    }

    #[test]
    fn null_shortcuts_are_skipped() {
        let mut s = Settings::default().shortcuts;
        s.region_alt = None;
        s.fullscreen = None;
        assert_eq!(
            bindings(&s),
            vec![(HotkeyAction::Region, "Super+Shift+S".to_string())]
        );
    }
}
