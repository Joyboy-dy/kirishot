//! Recording a new global shortcut from the Raccourcis page (spec J3 § 4.3). Windows keeps
//! Win combinations for itself, so the page never sees them: the keyboard hook records instead.
use super::ll_hook::HookKey;

#[derive(Debug, PartialEq, Eq)]
pub enum Recorded {
    /// A modifier alone: wait for the main key.
    Wait,
    /// Échap.
    Cancel,
    /// The combination, in Tauri syntax (`Super+Shift+S`).
    Accel(String),
}

/// The Tauri name of a main key; `None` for modifiers and keys a shortcut cannot use.
fn key_name(vk: u32) -> Option<String> {
    Some(match vk {
        0x41..=0x5A | 0x30..=0x39 => char::from_u32(vk)?.to_string(),
        0x70..=0x87 => format!("F{}", vk - 0x6F),
        0x2C => "PrintScreen".into(),
        0x2D => "Insert".into(),
        0x24 => "Home".into(),
        0x23 => "End".into(),
        0x21 => "PageUp".into(),
        0x22 => "PageDown".into(),
        0x20 => "Space".into(),
        0x25 => "ArrowLeft".into(),
        0x26 => "ArrowUp".into(),
        0x27 => "ArrowRight".into(),
        0x28 => "ArrowDown".into(),
        _ => return None,
    })
}

/// What a key press means while recording. The modifiers come in a fixed order, so the same
/// combination is always written the same way (duplicates are then easy to see).
pub fn recorded(key: HookKey) -> Recorded {
    if key.vk == 0x1B {
        return Recorded::Cancel;
    }
    let Some(name) = key_name(key.vk) else {
        return Recorded::Wait;
    };
    let m = key.mods;
    let mods: Vec<&str> = [
        (m.win, "Super"),
        (m.ctrl, "Ctrl"),
        (m.alt, "Alt"),
        (m.shift, "Shift"),
    ]
    .into_iter()
    .filter_map(|(on, n)| on.then_some(n))
    .collect();
    // A plain key would steal typing everywhere; PrintScreen and F-keys may stand alone. A
    // letter or digit needs Ctrl or Win: Maj+A or Alt+1 are typed every day.
    let stands_alone = name == "PrintScreen" || name.starts_with('F') && name.len() > 1;
    if mods.is_empty() && !stands_alone {
        return Recorded::Wait;
    }
    let typed = name.len() == 1;
    if typed && !(m.ctrl || m.win) {
        return Recorded::Wait;
    }
    let mut parts = mods;
    parts.push(&name);
    Recorded::Accel(parts.join("+"))
}

#[cfg(test)]
mod tests {
    use super::super::ll_hook::Mods;
    use super::*;

    fn press(vk: u32, mods: Mods) -> Recorded {
        recorded(HookKey { vk, mods })
    }

    #[test]
    fn win_shift_s_is_recorded_in_tauri_syntax() {
        let mods = Mods {
            win: true,
            shift: true,
            ..Mods::default()
        };
        assert_eq!(press(0x53, mods), Recorded::Accel("Super+Shift+S".into()));
    }

    #[test]
    fn print_screen_and_function_keys_stand_alone() {
        assert_eq!(
            press(0x2C, Mods::default()),
            Recorded::Accel("PrintScreen".into())
        );
        let ctrl_alt = Mods {
            ctrl: true,
            alt: true,
            ..Mods::default()
        };
        assert_eq!(press(0x70, ctrl_alt), Recorded::Accel("Ctrl+Alt+F1".into()));
        assert_eq!(press(0x7B, Mods::default()), Recorded::Accel("F12".into()));
    }

    #[test]
    fn modifiers_wait_and_escape_cancels() {
        let shift = Mods {
            shift: true,
            ..Mods::default()
        };
        assert_eq!(press(0x10, shift), Recorded::Wait);
        assert_eq!(press(0xA0, shift), Recorded::Wait);
        assert_eq!(press(0x5B, Mods::default()), Recorded::Wait);
        assert_eq!(press(0x1B, Mods::default()), Recorded::Cancel);
    }

    #[test]
    fn a_plain_letter_is_not_a_shortcut() {
        assert_eq!(press(0x53, Mods::default()), Recorded::Wait);
        let ctrl = Mods {
            ctrl: true,
            ..Mods::default()
        };
        assert_eq!(press(0x31, ctrl), Recorded::Accel("Ctrl+1".into()));
    }

    #[test]
    fn shift_or_alt_alone_with_a_letter_would_steal_typing() {
        let shift = Mods {
            shift: true,
            ..Mods::default()
        };
        let alt = Mods {
            alt: true,
            ..Mods::default()
        };
        assert_eq!(press(0x41, shift), Recorded::Wait);
        assert_eq!(press(0x31, alt), Recorded::Wait);
        let ctrl_alt = Mods {
            ctrl: true,
            alt: true,
            ..Mods::default()
        };
        assert_eq!(press(0x41, ctrl_alt), Recorded::Accel("Ctrl+Alt+A".into()));
        // Maj + Impr. écran stays allowed (the default full-screen shortcut).
        assert_eq!(
            press(0x2C, shift),
            Recorded::Accel("Shift+PrintScreen".into())
        );
    }
}
