//! The thumbnails window: created hidden at startup, shown without ever taking the focus.
use tauri::{Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

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
    #[cfg(windows)]
    {
        use windows::Win32::Foundation::HWND;
        use windows::Win32::UI::Shell::SetWindowSubclass;
        let hwnd = window.hwnd().map_err(window_error)?;
        // A click inside WebView2 must not activate the window: the focus stays where the user types.
        unsafe {
            let _ = SetWindowSubclass(HWND(hwnd.0), Some(no_activate), 1, 0);
        }
    }
    Ok(window)
}

#[cfg(windows)]
unsafe extern "system" fn no_activate(
    hwnd: windows::Win32::Foundation::HWND,
    msg: u32,
    wparam: windows::Win32::Foundation::WPARAM,
    lparam: windows::Win32::Foundation::LPARAM,
    _id: usize,
    _data: usize,
) -> windows::Win32::Foundation::LRESULT {
    use windows::Win32::UI::Shell::DefSubclassProc;
    use windows::Win32::UI::WindowsAndMessaging::{MA_NOACTIVATE, WM_MOUSEACTIVATE};
    if msg == WM_MOUSEACTIVATE {
        return windows::Win32::Foundation::LRESULT(MA_NOACTIVATE as isize);
    }
    unsafe { DefSubclassProc(hwnd, msg, wparam, lparam) }
}

/// Shows the window at `bounds` (physical pixels) above everything, without activating it.
pub fn show_at(window: &WebviewWindow, bounds: Rect) -> KResult<()> {
    #[cfg(windows)]
    {
        use windows::Win32::Foundation::HWND;
        use windows::Win32::UI::WindowsAndMessaging::{
            HWND_TOPMOST, SW_SHOWNOACTIVATE, SWP_NOACTIVATE, SetWindowPos, ShowWindow,
        };
        let hwnd = HWND(window.hwnd().map_err(window_error)?.0);
        // Twice: moving onto a monitor with another scale makes Windows send WM_DPICHANGED, and
        // the window manager then rescales the window it just placed. The second call sets our
        // size back.
        for _ in 0..2 {
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
            }
        }
        unsafe {
            let _ = ShowWindow(hwnd, SW_SHOWNOACTIVATE);
        }
    }
    #[cfg(not(windows))]
    {
        // X11 honours set_position; Wayland compositors ignore it and decide the placement.
        if let Err(e) = window.set_position(tauri::PhysicalPosition::new(bounds.x, bounds.y)) {
            log::warn!("cannot place the thumbnails window: {e}");
        }
        window
            .set_size(tauri::PhysicalSize::new(bounds.width, bounds.height))
            .map_err(window_error)?;
        window.show().map_err(window_error)?;
    }
    Ok(())
}

pub fn hide(window: &WebviewWindow) {
    #[cfg(windows)]
    {
        use windows::Win32::Foundation::HWND;
        use windows::Win32::UI::WindowsAndMessaging::{SW_HIDE, ShowWindow};
        if let Ok(hwnd) = window.hwnd() {
            unsafe {
                let _ = ShowWindow(HWND(hwnd.0), SW_HIDE);
            }
        }
    }
    #[cfg(not(windows))]
    {
        let _ = window.hide();
    }
}

/// The monitor's work area (without the taskbar) in physical pixels.
#[cfg(windows)]
pub fn work_area(_app: &tauri::AppHandle, m: &MonitorInfo) -> Rect {
    use windows::Win32::Foundation::POINT;
    use windows::Win32::Graphics::Gdi::{
        GetMonitorInfoW, MONITOR_DEFAULTTONEAREST, MONITORINFO, MonitorFromPoint,
    };
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

/// The work area Tauri reports for the same monitor, or the whole monitor when it cannot be
/// matched.
#[cfg(not(windows))]
pub fn work_area(app: &tauri::AppHandle, m: &MonitorInfo) -> Rect {
    let whole = Rect {
        x: m.x,
        y: m.y,
        width: m.width,
        height: m.height,
    };
    let Ok(monitors) = app.available_monitors() else {
        return whole;
    };
    let found = monitors.iter().find(|t| {
        t.position().x == m.x
            && t.position().y == m.y
            && t.size().width == m.width
            && t.size().height == m.height
    });
    let Some(monitor) = found else {
        return whole;
    };
    let area = monitor.work_area();
    Rect {
        x: area.position.x,
        y: area.position.y,
        width: area.size.width,
        height: area.size.height,
    }
}
