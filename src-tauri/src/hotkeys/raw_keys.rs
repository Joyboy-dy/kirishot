//! Keys while a Kirishot window is in the foreground. Windows then calls no low-level keyboard
//! hook at all (spike J2, `docs/spike-latence.md`), and the shell opens its Snipping Tool.
//! Raw input with `RIDEV_NOHOTKEYS` still sees the keys and turns off other applications'
//! hotkeys while Kirishot is in front, so the shortcut reaches Kirishot instead.
use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::UI::Input::{
    GetRawInputData, HRAWINPUT, RAWINPUT, RAWINPUTDEVICE, RAWINPUTHEADER, RID_INPUT,
    RIDEV_INPUTSINK, RIDEV_NOHOTKEYS, RIM_TYPEKEYBOARD, RegisterRawInputDevices,
};
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DefWindowProcW, GetForegroundWindow, GetWindowThreadProcessId, HWND_MESSAGE,
    RegisterClassW, WM_INPUT, WM_KEYDOWN, WM_SYSKEYDOWN, WNDCLASSW,
};
use windows::core::w;

use super::ll_hook::{self, HookKey, Mods};

/// The modifiers held right now, read through `held` at each key: a key-up lost on the secure
/// desktop (Ctrl+Alt+Suppr, Win+L) can never leave one stuck.
pub(crate) fn mods_from(held: impl Fn(u16) -> bool) -> Mods {
    Mods {
        shift: held(0x10),
        ctrl: held(0x11),
        alt: held(0x12),
        win: held(0x5B) || held(0x5C),
    }
}

fn kirishot_in_front() -> bool {
    let mut pid = 0u32;
    unsafe { GetWindowThreadProcessId(GetForegroundWindow(), Some(&mut pid)) };
    pid == std::process::id()
}

unsafe extern "system" fn window_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    if msg == WM_INPUT {
        let mut raw = RAWINPUT::default();
        let mut size = size_of::<RAWINPUT>() as u32;
        let read = unsafe {
            GetRawInputData(
                HRAWINPUT(lparam.0 as _),
                RID_INPUT,
                Some(&mut raw as *mut RAWINPUT as _),
                &mut size,
                size_of::<RAWINPUTHEADER>() as u32,
            )
        };
        if read != u32::MAX && raw.header.dwType == RIM_TYPEKEYBOARD.0 {
            let keyboard = unsafe { raw.data.keyboard };
            let down = matches!(keyboard.Message, WM_KEYDOWN | WM_SYSKEYDOWN);
            // Elsewhere the low-level hook sees the key and handles it.
            if down && kirishot_in_front() {
                let vk = keyboard.VKey as u32;
                ll_hook::press(HookKey {
                    vk,
                    mods: mods_from(ll_hook::held),
                });
            }
        }
    }
    unsafe { DefWindowProcW(hwnd, msg, wparam, lparam) }
}

/// Registers a message-only window for raw keyboard input. Must run on a thread that
/// dispatches its messages; a later registration of the keyboard by the same process replaces
/// this one, and tao registers its own when the event loop starts, before `setup`.
pub(crate) fn listen() -> windows::core::Result<()> {
    unsafe {
        let module = GetModuleHandleW(None)?;
        let class = WNDCLASSW {
            lpfnWndProc: Some(window_proc),
            hInstance: module.into(),
            lpszClassName: w!("KirishotRawKeys"),
            ..Default::default()
        };
        RegisterClassW(&class);
        let hwnd = CreateWindowExW(
            Default::default(),
            w!("KirishotRawKeys"),
            w!(""),
            Default::default(),
            0,
            0,
            0,
            0,
            Some(HWND_MESSAGE),
            None,
            Some(module.into()),
            None,
        )?;
        let keyboard = RAWINPUTDEVICE {
            usUsagePage: 0x01,
            usUsage: 0x06,
            dwFlags: RIDEV_INPUTSINK | RIDEV_NOHOTKEYS,
            hwndTarget: hwnd,
        };
        RegisterRawInputDevices(&[keyboard], size_of::<RAWINPUTDEVICE>() as u32)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn modifiers_come_from_the_live_key_state() {
        // A key-up lost on the secure desktop (Ctrl+Alt+Suppr, Win+L) must not leave a
        // modifier stuck: the state is read at each key, never accumulated.
        let held = |vk: u16| matches!(vk, 0x10 | 0x5B);
        assert_eq!(
            mods_from(held),
            Mods {
                shift: true,
                win: true,
                ..Mods::default()
            }
        );
        assert_eq!(mods_from(|_| false), Mods::default());
    }
}
