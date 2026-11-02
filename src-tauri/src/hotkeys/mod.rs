//! Global shortcuts from the settings.
mod ll_hook;
mod raw_keys;
mod record;

use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Instant;

use tauri::Manager;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use tauri_specta::Event;

use crate::error::{ErrorCode, KResult, KirishotError};
use crate::flow::{self, StartMode};
use crate::settings::SettingsState;
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

/// The global shortcuts the Raccourcis page can change (spec J3 § 4.3).
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum BindingSlot {
    Region,
    RegionAlt,
    Fullscreen,
}

#[derive(Debug, PartialEq, Eq)]
pub enum BindingError {
    Unparsable,
    Duplicate(BindingSlot),
}

/// Whether `accel` may go into `slot`: a valid combination, used by no other slot. `None`
/// (« Aucun ») is always valid.
pub fn validate_binding(
    s: &Shortcuts,
    slot: BindingSlot,
    accel: Option<&str>,
) -> Result<(), BindingError> {
    let Some(accel) = accel else {
        return Ok(());
    };
    let parsed = ll_hook::parse_hook_accel(accel).is_some()
        || accel
            .parse::<tauri_plugin_global_shortcut::Shortcut>()
            .is_ok();
    if !parsed {
        return Err(BindingError::Unparsable);
    }
    for other in [
        BindingSlot::Region,
        BindingSlot::RegionAlt,
        BindingSlot::Fullscreen,
    ] {
        if other != slot
            && slot_value(s, other)
                .as_deref()
                .is_some_and(|a| a.eq_ignore_ascii_case(accel))
        {
            return Err(BindingError::Duplicate(other));
        }
    }
    Ok(())
}

fn slot_value(s: &Shortcuts, slot: BindingSlot) -> &Option<String> {
    match slot {
        BindingSlot::Region => &s.region,
        BindingSlot::RegionAlt => &s.region_alt,
        BindingSlot::Fullscreen => &s.fullscreen,
    }
}

fn slot_value_mut(s: &mut Shortcuts, slot: BindingSlot) -> &mut Option<String> {
    match slot {
        BindingSlot::Region => &mut s.region,
        BindingSlot::RegionAlt => &mut s.region_alt,
        BindingSlot::Fullscreen => &mut s.fullscreen,
    }
}

/// Keeps the keyboard hook installed for the life of the app.
struct HookState(#[allow(dead_code)] ll_hook::HookGuard);

/// The combinations the low-level hook answers to; changed by the Raccourcis page.
static HOOKED: Mutex<Vec<(ll_hook::HookKey, HotkeyAction)>> = Mutex::new(Vec::new());

/// The Raccourcis page waits for a new combination: the next one goes to it, not to a capture.
static RECORDING: AtomicBool = AtomicBool::new(false);

/// The combination recorded for the Raccourcis page; `None` when cancelled with Échap.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type, tauri_specta::Event)]
pub struct ShortcutRecorded {
    pub accel: Option<String>,
}

/// Starts or stops waiting for a combination (spec J3 § 4.3).
pub fn record(app: &tauri::AppHandle, on: bool) {
    if on {
        ensure_hook(app);
    }
    RECORDING.store(on, Ordering::SeqCst);
}

/// Registers every binding: PrintScreen and Windows-key combinations through the low-level
/// hook, the others through the global-shortcut plugin. A shortcut taken by another
/// application is reported, not fatal.
pub fn register_all(app: &tauri::AppHandle, s: &Shortcuts) {
    for accel in apply(app, s) {
        notify::show(
            app,
            messages::SHORTCUT_CONFLICT_TITLE,
            &messages::shortcut_conflict(&accel),
        );
    }
}

/// Puts `s` in force, replacing the previous bindings; returns the combinations refused.
fn apply(app: &tauri::AppHandle, s: &Shortcuts) -> Vec<String> {
    if let Err(e) = app.global_shortcut().unregister_all() {
        log::warn!("cannot unregister the shortcuts: {e}");
    }
    let mut hooked = Vec::new();
    let mut refused = Vec::new();
    for (action, accel) in bindings(s) {
        match ll_hook::parse_hook_accel(&accel) {
            Some(key) => {
                log::debug!("{accel}: low-level hook");
                hooked.push((key, action));
            }
            None => {
                if let Err(e) = register_with_plugin(app, action, &accel) {
                    log::warn!("cannot register {accel}: {e}");
                    refused.push(accel);
                }
            }
        }
    }
    let needs_hook = !hooked.is_empty();
    *HOOKED.lock().unwrap() = hooked;
    if needs_hook {
        ensure_hook(app);
    }
    refused
}

/// Installs the hook once; it reads `HOOKED` at each key, so later changes need no reinstall.
fn ensure_hook(app: &tauri::AppHandle) {
    if app.try_state::<HookState>().is_some() {
        return;
    }
    let handle = app.clone();
    // Keys without a binding (Alt+PrintScreen, Win+E…) keep their Windows behavior.
    let installed = ll_hook::install_hook(move |pressed| {
        // Only keys typed in Kirishot are recorded: a combination typed in another application
        // goes to it, never to a new global shortcut.
        if RECORDING.load(Ordering::SeqCst) && raw_keys::kirishot_in_front() {
            let accel = match record::recorded(pressed) {
                // A modifier goes through: Windows must see it held.
                record::Recorded::Wait => return false,
                record::Recorded::Cancel => None,
                record::Recorded::Accel(accel) => Some(accel),
            };
            RECORDING.store(false, Ordering::SeqCst);
            if let Err(e) = (ShortcutRecorded { accel }).emit(&handle) {
                log::warn!("cannot emit shortcut-recorded: {e}");
            }
            return true;
        }
        let action = HOOKED
            .lock()
            .unwrap()
            .iter()
            .find(|(k, _)| *k == pressed)
            .map(|(_, a)| *a);
        let Some(action) = action else {
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

fn register_with_plugin(
    app: &tauri::AppHandle,
    action: HotkeyAction,
    accel: &str,
) -> Result<(), tauri_plugin_global_shortcut::Error> {
    app.global_shortcut()
        .on_shortcut(accel, move |app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                flow::start(app, action.mode(), Instant::now());
            }
        })
}

/// Changes one global shortcut (spec J3 § 4.3). The new combination is registered first; if
/// Windows refuses it, the previous ones stay in force and nothing is saved.
pub fn set_binding(
    app: &tauri::AppHandle,
    slot: BindingSlot,
    accel: Option<String>,
) -> KResult<Shortcuts> {
    let state = app.state::<SettingsState>();
    let old = state.get().shortcuts;
    validate_binding(&old, slot, accel.as_deref()).map_err(|e| {
        let message = match e {
            BindingError::Unparsable => messages::SHORTCUT_UNPARSABLE.to_string(),
            BindingError::Duplicate(_) => messages::SHORTCUT_DUPLICATE.to_string(),
        };
        KirishotError::new(ErrorCode::Shortcut, message)
    })?;
    let mut next = old.clone();
    *slot_value_mut(&mut next, slot) = accel;
    if !apply(app, &next).is_empty() {
        apply(app, &old);
        return Err(KirishotError::new(
            ErrorCode::Shortcut,
            messages::SHORTCUT_TAKEN,
        ));
    }
    state.update(|s| s.shortcuts = next.clone())?;
    Ok(next)
}

/// The default combination of a slot.
pub fn default_binding(slot: BindingSlot) -> Option<String> {
    slot_value(&crate::settings::model::Settings::default().shortcuts, slot).clone()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::settings::model::Settings;

    #[test]
    fn a_combination_used_elsewhere_is_refused() {
        let s = Settings::default().shortcuts;
        assert_eq!(
            validate_binding(&s, BindingSlot::Fullscreen, Some("Super+Shift+S")),
            Err(BindingError::Duplicate(BindingSlot::Region))
        );
        assert_eq!(
            validate_binding(&s, BindingSlot::Fullscreen, Some("super+shift+s")),
            Err(BindingError::Duplicate(BindingSlot::Region))
        );
        // Its own combination is not a conflict.
        assert_eq!(
            validate_binding(&s, BindingSlot::Region, Some("Super+Shift+S")),
            Ok(())
        );
    }

    #[test]
    fn unparsable_combinations_are_refused() {
        let s = Settings::default().shortcuts;
        assert_eq!(
            validate_binding(&s, BindingSlot::Region, Some("Ctrl+")),
            Err(BindingError::Unparsable)
        );
        assert_eq!(
            validate_binding(&s, BindingSlot::Region, Some("Ctrl+Alt+F9")),
            Ok(())
        );
    }

    #[test]
    fn none_is_always_valid() {
        let s = Settings::default().shortcuts;
        for slot in [
            BindingSlot::Region,
            BindingSlot::RegionAlt,
            BindingSlot::Fullscreen,
        ] {
            assert_eq!(validate_binding(&s, slot, None), Ok(()));
        }
    }

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
