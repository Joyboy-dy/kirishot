//! Keys while a Kirishot window is in the foreground. Windows then calls no low-level keyboard
//! hook at all (spike J2, `docs/spike-latence.md`), and the shell opens its Snipping Tool.
//! Raw input with `RIDEV_NOHOTKEYS` still sees the keys and turns off other applications'
//! hotkeys while Kirishot is in front, so the shortcut reaches Kirishot instead.
use std::sync::Mutex;

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

/// The modifiers held after a raw key event.
pub(crate) fn track_mods(mut mods: Mods, vk: u32, down: bool) -> Mods {
    match vk {
        0x10 | 0xA0 | 0xA1 => mods.shift = down,
        0x11 | 0xA2 | 0xA3 => mods.ctrl = down,
        0x12 | 0xA4 | 0xA5 => mods.alt = down,
        0x5B | 0x5C => mods.win = down,
        _ => {}
    }
    mods
}

static MODS: Mutex<Mods> = Mutex::new(Mods {
    shift: false,
    ctrl: false,
    alt: false,
    win: false,
});

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
            let vk = keyboard.VKey as u32;
            let mods = {
                let mut held = MODS.lock().unwrap();
                *held = track_mods(*held, vk, down);
                *held
            };
            // Elsewhere the low-level hook sees the key and handles it.
            if down && kirishot_in_front() {
                ll_hook::press(HookKey { vk, mods });
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
    fn modifiers_follow_presses_and_releases() {
        let m = track_mods(Mods::default(), 0x5B, true);
        let m = track_mods(m, 0xA0, true);
        assert_eq!(
            m,
            Mods {
                win: true,
                shift: true,
                ..Mods::default()
            }
        );
        let m = track_mods(m, 0xA0, false);
        assert_eq!(
            m,
            Mods {
                win: true,
                ..Mods::default()
            }
        );
    }

    #[test]
    fn both_sides_and_generic_codes_count() {
        for vk in [0x10, 0xA0, 0xA1] {
            assert!(track_mods(Mods::default(), vk, true).shift);
        }
        for vk in [0x11, 0xA2, 0xA3] {
            assert!(track_mods(Mods::default(), vk, true).ctrl);
        }
        for vk in [0x12, 0xA4, 0xA5] {
            assert!(track_mods(Mods::default(), vk, true).alt);
        }
        for vk in [0x5B, 0x5C] {
            assert!(track_mods(Mods::default(), vk, true).win);
        }
    }

    #[test]
    fn other_keys_leave_modifiers_alone() {
        let held = Mods {
            win: true,
            shift: true,
            ..Mods::default()
        };
        assert_eq!(track_mods(held, 0x53, true), held);
        assert_eq!(track_mods(held, 0x53, false), held);
    }
}
