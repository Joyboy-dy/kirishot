//! Low-level keyboard hook for PrintScreen. `RegisterHotKey` accepts PrintScreen but never
//! receives it (spike J0); a `WH_KEYBOARD_LL` hook sees the key before Windows does, so Kirishot
//! gets it even while the Windows setting still assigns it to the Snipping Tool.
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::sync::{Arc, Mutex};

use windows::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
use windows::Win32::System::Threading::GetCurrentThreadId;
use windows::Win32::UI::Input::KeyboardAndMouse::{
    GetAsyncKeyState, VK_CONTROL, VK_MENU, VK_SHIFT,
};
use windows::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, GetMessageW, KBDLLHOOKSTRUCT, MSG, PostThreadMessageW, SetWindowsHookExW,
    UnhookWindowsHookEx, WH_KEYBOARD_LL, WM_KEYDOWN, WM_QUIT, WM_SYSKEYDOWN,
};

use crate::error::{ErrorCode, KResult, KirishotError};

const VK_SNAPSHOT: u32 = 0x2C;

/// Modifiers held with PrintScreen.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Mods {
    pub shift: bool,
    pub ctrl: bool,
    pub alt: bool,
}

/// Returns `true` when the key was handled and must be swallowed.
type OnPress = Arc<dyn Fn(Mods) -> bool + Send + Sync>;

static ON_PRESS: Mutex<Option<OnPress>> = Mutex::new(None);
/// Whether the last PrintScreen press was swallowed, so its release is swallowed too.
static SWALLOWED: AtomicBool = AtomicBool::new(false);

pub(crate) fn decide(vk: u32, key_down: bool) -> bool {
    vk == VK_SNAPSHOT && key_down
}

/// The modifiers of a PrintScreen accelerator such as `Shift+PrintScreen`; `None` for any other
/// key or modifier.
pub(crate) fn printscreen_mods(accel: &str) -> Option<Mods> {
    let mut parts: Vec<&str> = accel.split('+').map(str::trim).collect();
    if parts.pop()? != "PrintScreen" {
        return None;
    }
    let mut mods = Mods::default();
    for part in parts {
        match part.to_ascii_lowercase().as_str() {
            "shift" => mods.shift = true,
            "ctrl" | "control" => mods.ctrl = true,
            "alt" => mods.alt = true,
            _ => return None,
        }
    }
    Some(mods)
}

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

fn held(vk: u16) -> bool {
    (unsafe { GetAsyncKeyState(vk as i32) } as u16 & 0x8000) != 0
}

unsafe extern "system" fn hook_proc(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if code >= 0 {
        let key = unsafe { &*(lparam.0 as *const KBDLLHOOKSTRUCT) };
        if key.vkCode == VK_SNAPSHOT {
            let down = matches!(wparam.0 as u32, WM_KEYDOWN | WM_SYSKEYDOWN);
            if decide(key.vkCode, down) {
                let mods = Mods {
                    shift: held(VK_SHIFT.0),
                    ctrl: held(VK_CONTROL.0),
                    alt: held(VK_MENU.0),
                };
                // Clone the callback out of the lock: it must stay short, Windows drops slow hooks.
                let on_press = ON_PRESS.lock().unwrap().clone();
                let handled = on_press.is_some_and(|f| f(mods));
                SWALLOWED.store(handled, Ordering::SeqCst);
            }
            if SWALLOWED.load(Ordering::SeqCst) {
                return LRESULT(1);
            }
        }
    }
    unsafe { CallNextHookEx(None, code, wparam, lparam) }
}

/// Installs the hook on a dedicated thread with its own message loop.
pub fn install_printscreen_hook(
    on_press: impl Fn(Mods) -> bool + Send + Sync + 'static,
) -> KResult<HookGuard> {
    *ON_PRESS.lock().unwrap() = Some(Arc::new(on_press));
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || unsafe {
        match SetWindowsHookExW(WH_KEYBOARD_LL, Some(hook_proc), None, 0) {
            Ok(hook) => {
                let _ = tx.send(Ok(GetCurrentThreadId()));
                let mut msg = MSG::default();
                while GetMessageW(&mut msg, None, 0, 0).as_bool() {}
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
            format!("Impossible d'intercepter Impr. écran : {e}"),
        )),
        Err(e) => Err(KirishotError::new(ErrorCode::Shortcut, e.to_string())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decide_only_reacts_to_printscreen_down() {
        assert!(decide(0x2C, true));
        assert!(!decide(0x2C, false));
        assert!(!decide(0x41, true));
    }

    #[test]
    fn printscreen_mods_parses_accelerators() {
        assert_eq!(printscreen_mods("PrintScreen"), Some(Mods::default()));
        assert_eq!(
            printscreen_mods("Shift+PrintScreen"),
            Some(Mods {
                shift: true,
                ..Mods::default()
            })
        );
        assert_eq!(
            printscreen_mods("Ctrl+Shift+PrintScreen"),
            Some(Mods {
                shift: true,
                ctrl: true,
                alt: false
            })
        );
        assert_eq!(printscreen_mods("Ctrl+Alt+K"), None);
        assert_eq!(printscreen_mods("Super+PrintScreen"), None);
    }
}
