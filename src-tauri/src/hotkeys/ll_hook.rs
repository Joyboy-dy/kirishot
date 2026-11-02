//! Low-level keyboard hook for the shortcuts Windows keeps for itself. `RegisterHotKey` accepts
//! PrintScreen but never receives it (spike J0), and Win+Shift+S belongs to the Snipping Tool.
//! A `WH_KEYBOARD_LL` hook sees keys before Windows does, so Kirishot gets them first, except
//! while a Kirishot window is in front: `raw_keys` covers that case.
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::mpsc;
use std::sync::{Arc, Mutex};

use windows::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
use windows::Win32::System::Threading::GetCurrentThreadId;
use windows::Win32::UI::Input::KeyboardAndMouse::{GetAsyncKeyState, KEYEVENTF_KEYUP, keybd_event};
use windows::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, DispatchMessageW, GetMessageW, KBDLLHOOKSTRUCT, MSG, PostThreadMessageW,
    SetWindowsHookExW, UnhookWindowsHookEx, WH_KEYBOARD_LL, WM_KEYDOWN, WM_QUIT, WM_SYSKEYDOWN,
};

use crate::error::{ErrorCode, KResult, KirishotError};

const VK_SNAPSHOT: u32 = 0x2C;
/// An unassigned virtual key, sent so that releasing Win does not open the Start menu.
const VK_DUMMY: u8 = 0xFF;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Mods {
    pub shift: bool,
    pub ctrl: bool,
    pub alt: bool,
    pub win: bool,
}

/// A key and the modifiers held with it.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct HookKey {
    pub vk: u32,
    pub mods: Mods,
}

/// The hook key of an accelerator such as `Shift+PrintScreen` or `Super+Shift+S`, when the hook
/// must handle it: PrintScreen combinations and any combination with the Windows key. `None`
/// for everything else, which the global-shortcut plugin registers.
pub(crate) fn parse_hook_accel(accel: &str) -> Option<HookKey> {
    let mut parts: Vec<&str> = accel.split('+').map(str::trim).collect();
    let key = parts.pop()?;
    let vk = match key {
        "PrintScreen" => VK_SNAPSHOT,
        k if k.len() == 1 && k.chars().all(|c| c.is_ascii_alphanumeric()) => {
            k.to_ascii_uppercase().as_bytes()[0] as u32
        }
        _ => return None,
    };
    let mut mods = Mods::default();
    for part in parts {
        match part.to_ascii_lowercase().as_str() {
            "shift" => mods.shift = true,
            "ctrl" | "control" => mods.ctrl = true,
            "alt" => mods.alt = true,
            "super" | "win" | "meta" => mods.win = true,
            _ => return None,
        }
    }
    (vk == VK_SNAPSHOT || mods.win).then_some(HookKey { vk, mods })
}

/// Returns `true` when the key was handled and must be swallowed.
type OnPress = Arc<dyn Fn(HookKey) -> bool + Send + Sync>;

static ON_PRESS: Mutex<Option<OnPress>> = Mutex::new(None);
/// The key whose press was swallowed, so its release is swallowed too (0: none).
static SWALLOWED: AtomicU32 = AtomicU32::new(0);

/// Uninstalls the hook when dropped.
pub struct HookGuard {
    thread_id: u32,
}

impl Drop for HookGuard {
    fn drop(&mut self) {
        let _ = unsafe { PostThreadMessageW(self.thread_id, WM_QUIT, WPARAM(0), LPARAM(0)) };
        *ON_PRESS.lock().unwrap() = None;
    }
}

pub(crate) fn held(vk: u16) -> bool {
    (unsafe { GetAsyncKeyState(vk as i32) } as u16 & 0x8000) != 0
}

/// Runs the callback for a pressed key; `true` when it was a Kirishot shortcut.
pub(crate) fn press(pressed: HookKey) -> bool {
    // Clone the callback out of the lock: it must stay short, Windows drops slow hooks.
    let on_press = ON_PRESS.lock().unwrap().clone();
    let handled = on_press.is_some_and(|f| f(pressed));
    if handled && pressed.mods.win {
        // Releasing Win alone would open the Start menu.
        unsafe {
            keybd_event(VK_DUMMY, 0, Default::default(), 0);
            keybd_event(VK_DUMMY, 0, KEYEVENTF_KEYUP, 0);
        }
    }
    handled
}

unsafe extern "system" fn hook_proc(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if code >= 0 {
        let key = unsafe { &*(lparam.0 as *const KBDLLHOOKSTRUCT) };
        let down = matches!(wparam.0 as u32, WM_KEYDOWN | WM_SYSKEYDOWN);
        if down {
            let pressed = HookKey {
                vk: key.vkCode,
                mods: super::raw_keys::mods_from(held),
            };
            if press(pressed) {
                SWALLOWED.store(key.vkCode, Ordering::SeqCst);
                return LRESULT(1);
            }
        } else if SWALLOWED.load(Ordering::SeqCst) == key.vkCode {
            SWALLOWED.store(0, Ordering::SeqCst);
            return LRESULT(1);
        }
    }
    unsafe { CallNextHookEx(None, code, wparam, lparam) }
}

/// Installs the hook on a dedicated thread with its own message loop.
pub fn install_hook(
    on_press: impl Fn(HookKey) -> bool + Send + Sync + 'static,
) -> KResult<HookGuard> {
    *ON_PRESS.lock().unwrap() = Some(Arc::new(on_press));
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || unsafe {
        match SetWindowsHookExW(WH_KEYBOARD_LL, Some(hook_proc), None, 0) {
            Ok(hook) => {
                let _ = tx.send(Ok(GetCurrentThreadId()));
                if let Err(e) = super::raw_keys::listen() {
                    log::warn!("raw keyboard input unavailable: {e}");
                }
                let mut msg = MSG::default();
                while GetMessageW(&mut msg, None, 0, 0).as_bool() {
                    DispatchMessageW(&msg);
                }
                let _ = UnhookWindowsHookEx(hook);
            }
            Err(e) => {
                let _ = tx.send(Err(e.to_string()));
            }
        }
    });
    match rx.recv() {
        Ok(Ok(thread_id)) => Ok(HookGuard { thread_id }),
        Ok(Err(e)) => Err(KirishotError::new(
            ErrorCode::Shortcut,
            format!("Impossible d'intercepter les raccourcis : {e}"),
        )),
        Err(e) => Err(KirishotError::new(ErrorCode::Shortcut, e.to_string())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn key(vk: u32, shift: bool, win: bool) -> Option<HookKey> {
        Some(HookKey {
            vk,
            mods: Mods {
                shift,
                win,
                ..Mods::default()
            },
        })
    }

    #[test]
    fn printscreen_accelerators_go_to_the_hook() {
        assert_eq!(parse_hook_accel("PrintScreen"), key(0x2C, false, false));
        assert_eq!(
            parse_hook_accel("Shift+PrintScreen"),
            key(0x2C, true, false)
        );
    }

    #[test]
    fn windows_key_accelerators_go_to_the_hook() {
        assert_eq!(parse_hook_accel("Super+Shift+S"), key(0x53, true, true));
        assert_eq!(parse_hook_accel("Win+Shift+s"), key(0x53, true, true));
    }

    #[test]
    fn other_accelerators_stay_with_the_plugin() {
        assert_eq!(parse_hook_accel("Ctrl+Alt+K"), None);
        assert_eq!(parse_hook_accel("Super+F13"), None);
        assert_eq!(parse_hook_accel("Hyper+PrintScreen"), None);
    }
}
