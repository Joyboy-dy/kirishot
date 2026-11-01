//! Visible top-level windows, topmost first, with their DWM bounds (without the shadow).
use windows::Win32::Foundation::{CloseHandle, HWND, LPARAM, RECT};
use windows::Win32::Graphics::Dwm::{
    DWMWA_CLOAKED, DWMWA_EXTENDED_FRAME_BOUNDS, DwmGetWindowAttribute,
};
use windows::Win32::System::Threading::{
    OpenProcess, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION, QueryFullProcessImageNameW,
};
use windows::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GWL_EXSTYLE, GetClassNameW, GetWindowLongPtrW, GetWindowTextW,
    GetWindowThreadProcessId, IsIconic, IsWindowVisible, WS_EX_TOOLWINDOW,
};
use windows::core::{BOOL, PWSTR};

use crate::capture::types::WindowInfo;
use crate::geometry::Rect;

pub(crate) struct RawWindow {
    pub title: String,
    pub class_name: String,
    pub pid: u32,
    pub visible: bool,
    pub iconic: bool,
    pub cloaked: bool,
    pub tool_window: bool,
    pub bounds: Rect,
}

/// Keeps the windows a person expects to hover: visible, not minimized or cloaked (hidden UWP
/// windows, other virtual desktops), not tool windows, not Kirishot's own, not the desktop.
pub(crate) fn keep_window(w: &RawWindow, own_pid: u32) -> bool {
    w.visible
        && !w.iconic
        && !w.cloaked
        && !w.tool_window
        && w.pid != own_pid
        && !w.title.is_empty()
        && w.bounds.width > 0
        && w.bounds.height > 0
        && w.class_name != "Progman"
        && w.class_name != "WorkerW"
}

pub fn enumerate_windows(own_pid: u32) -> Vec<WindowInfo> {
    unsafe extern "system" fn collect(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let handles = unsafe { &mut *(lparam.0 as *mut Vec<HWND>) };
        handles.push(hwnd);
        BOOL(1)
    }
    let mut handles: Vec<HWND> = Vec::new();
    // EnumWindows walks top-level windows in Z order, topmost first.
    let walked = unsafe { EnumWindows(Some(collect), LPARAM(&mut handles as *mut _ as isize)) };
    if let Err(e) = walked {
        log::warn!("EnumWindows failed: {e}");
    }
    let mut windows = Vec::new();
    for hwnd in handles {
        let Some((raw, app_name)) = read_window(hwnd) else {
            continue;
        };
        if keep_window(&raw, own_pid) {
            windows.push(WindowInfo {
                index: windows.len() as u32,
                title: raw.title,
                app_name,
                bounds: raw.bounds,
            });
        }
    }
    windows
}

fn read_window(hwnd: HWND) -> Option<(RawWindow, String)> {
    unsafe {
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        let mut cloaked = 0u32;
        let _ = DwmGetWindowAttribute(
            hwnd,
            DWMWA_CLOAKED,
            &mut cloaked as *mut u32 as *mut _,
            std::mem::size_of::<u32>() as u32,
        );
        let mut rect = RECT::default();
        DwmGetWindowAttribute(
            hwnd,
            DWMWA_EXTENDED_FRAME_BOUNDS,
            &mut rect as *mut RECT as *mut _,
            std::mem::size_of::<RECT>() as u32,
        )
        .ok()?;
        let mut title = [0u16; 512];
        let title_len = GetWindowTextW(hwnd, &mut title).max(0) as usize;
        let mut class = [0u16; 256];
        let class_len = GetClassNameW(hwnd, &mut class).max(0) as usize;
        let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
        let raw = RawWindow {
            title: String::from_utf16_lossy(&title[..title_len]),
            class_name: String::from_utf16_lossy(&class[..class_len]),
            pid,
            visible: IsWindowVisible(hwnd).as_bool(),
            iconic: IsIconic(hwnd).as_bool(),
            cloaked: cloaked != 0,
            tool_window: ex_style & WS_EX_TOOLWINDOW.0 != 0,
            bounds: Rect {
                x: rect.left,
                y: rect.top,
                width: (rect.right - rect.left).max(0) as u32,
                height: (rect.bottom - rect.top).max(0) as u32,
            },
        };
        Some((raw, process_name(pid)))
    }
}

/// The executable's file stem, or an empty string when it cannot be read.
fn process_name(pid: u32) -> String {
    unsafe {
        let Ok(process) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) else {
            return String::new();
        };
        let mut buf = [0u16; 1024];
        let mut len = buf.len() as u32;
        let queried = QueryFullProcessImageNameW(
            process,
            PROCESS_NAME_WIN32,
            PWSTR(buf.as_mut_ptr()),
            &mut len,
        );
        let _ = CloseHandle(process);
        if queried.is_err() {
            return String::new();
        }
        let path = String::from_utf16_lossy(&buf[..len as usize]);
        std::path::Path::new(&path)
            .file_stem()
            .map(|s| s.to_string_lossy().into_owned())
            .unwrap_or_default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn raw() -> RawWindow {
        RawWindow {
            title: "Notes".into(),
            class_name: "Notepad".into(),
            pid: 10,
            visible: true,
            iconic: false,
            cloaked: false,
            tool_window: false,
            bounds: Rect {
                x: 0,
                y: 0,
                width: 800,
                height: 600,
            },
        }
    }

    #[test]
    fn keeps_normal_window() {
        assert!(keep_window(&raw(), 99));
    }

    #[test]
    fn drops_hidden_minimized_cloaked_tool_and_own_windows() {
        for w in [
            RawWindow {
                visible: false,
                ..raw()
            },
            RawWindow {
                iconic: true,
                ..raw()
            },
            RawWindow {
                cloaked: true,
                ..raw()
            },
            RawWindow {
                tool_window: true,
                ..raw()
            },
            RawWindow { pid: 99, ..raw() },
        ] {
            assert!(!keep_window(&w, 99));
        }
    }

    #[test]
    fn drops_desktop_untitled_and_empty_windows() {
        for w in [
            RawWindow {
                class_name: "Progman".into(),
                ..raw()
            },
            RawWindow {
                class_name: "WorkerW".into(),
                ..raw()
            },
            RawWindow {
                title: String::new(),
                ..raw()
            },
            RawWindow {
                bounds: Rect {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 10,
                },
                ..raw()
            },
        ] {
            assert!(!keep_window(&w, 99));
        }
    }
}
