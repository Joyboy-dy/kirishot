//! The thumbnails window: created hidden at startup, shown without ever taking the focus.
use tauri::{WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, POINT, WPARAM};
use windows::Win32::Graphics::Gdi::{
    GetMonitorInfoW, MONITOR_DEFAULTTONEAREST, MONITORINFO, MonitorFromPoint,
};
use windows::Win32::UI::Shell::{DefSubclassProc, SetWindowSubclass};
use windows::Win32::UI::WindowsAndMessaging::{
    HWND_TOPMOST, MA_NOACTIVATE, SW_HIDE, SW_SHOWNOACTIVATE, SWP_NOACTIVATE, SetWindowPos,
    ShowWindow, WM_MOUSEACTIVATE,
};

use crate::capture::types::MonitorInfo;
use crate::error::{ErrorCode, KResult, KirishotError};
use crate::geometry::Rect;

pub const LABEL: &str = "thumbnails";

fn window_error(e: impl std::fmt::Display) -> KirishotError {
    KirishotError::new(ErrorCode::Window, format!("Vignettes indisponibles : {e}"))
}

pub fn create(app: &tauri::AppHandle) -> KResult<WebviewWindow> {
    let window = WebviewWindowBuilder::new(app, LABEL, WebviewUrl::App("thumbnails.html".into()))
        .title("Kirishot")
        .visible(false)
        .focused(false)
        .focusable(false)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .resizable(false)
        .skip_taskbar(true)
        .always_on_top(true)
        .inner_size(1.0, 1.0)
        .build()
        .map_err(window_error)?;
    let hwnd = window.hwnd().map_err(window_error)?;
    // A click inside WebView2 must not activate the window: the focus stays where the user types.
    unsafe {
        let _ = SetWindowSubclass(HWND(hwnd.0), Some(no_activate), 1, 0);
    }
    Ok(window)
}

unsafe extern "system" fn no_activate(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
    _id: usize,
    _data: usize,
) -> LRESULT {
    if msg == WM_MOUSEACTIVATE {
        return LRESULT(MA_NOACTIVATE as isize);
    }
    unsafe { DefSubclassProc(hwnd, msg, wparam, lparam) }
}

/// Shows the window at `bounds` (physical pixels) above everything, without activating it.
pub fn show_at(window: &WebviewWindow, bounds: Rect) -> KResult<()> {
    let hwnd = HWND(window.hwnd().map_err(window_error)?.0);
    unsafe {
        SetWindowPos(
            hwnd,
            Some(HWND_TOPMOST),
            bounds.x,
            bounds.y,
            bounds.width as i32,
            bounds.height as i32,
            SWP_NOACTIVATE,
        )
        .map_err(window_error)?;
        let _ = ShowWindow(hwnd, SW_SHOWNOACTIVATE);
    }
    Ok(())
}

pub fn hide(window: &WebviewWindow) {
    if let Ok(hwnd) = window.hwnd() {
        unsafe {
            let _ = ShowWindow(HWND(hwnd.0), SW_HIDE);
        }
    }
}

/// The monitor's work area (without the taskbar) in physical pixels.
pub fn work_area(m: &MonitorInfo) -> Rect {
    let whole = Rect {
        x: m.x,
        y: m.y,
        width: m.width,
        height: m.height,
    };
    let centre = POINT {
        x: m.x + m.width as i32 / 2,
        y: m.y + m.height as i32 / 2,
    };
    let mut info = MONITORINFO {
        cbSize: size_of::<MONITORINFO>() as u32,
        ..Default::default()
    };
    let found = unsafe {
        let monitor = MonitorFromPoint(centre, MONITOR_DEFAULTTONEAREST);
        GetMonitorInfoW(monitor, &mut info).as_bool()
    };
    if !found {
        return whole;
    }
    let r = info.rcWork;
    Rect {
        x: r.left,
        y: r.top,
        width: (r.right - r.left) as u32,
        height: (r.bottom - r.top) as u32,
    }
}
