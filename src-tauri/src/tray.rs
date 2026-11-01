//! The notification-area icon and its menu.
use std::time::Instant;

use tauri::Manager;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
use windows::Win32::System::Registry::{HKEY_CURRENT_USER, RRF_RT_REG_DWORD, RegGetValueW};
use windows::core::w;

use crate::error::{ErrorCode, KResult, KirishotError};
use crate::flow::{self, StartMode};
use crate::{messages, windowing};

#[derive(Debug, PartialEq)]
pub enum TrayVariant {
    /// White mark, for a dark taskbar.
    Dark,
    /// Dark mark, for a light taskbar.
    Light,
}

/// `SystemUsesLightTheme` is 1 for a light taskbar; it is missing on dark-only setups.
pub fn tray_variant(system_uses_light_theme: Option<u32>) -> TrayVariant {
    match system_uses_light_theme {
        Some(1) => TrayVariant::Light,
        _ => TrayVariant::Dark,
    }
}

fn system_uses_light_theme() -> Option<u32> {
    let mut value = 0u32;
    let mut size = std::mem::size_of::<u32>() as u32;
    let status = unsafe {
        RegGetValueW(
            HKEY_CURRENT_USER,
            w!(r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize"),
            w!("SystemUsesLightTheme"),
            RRF_RT_REG_DWORD,
            None,
            Some(&mut value as *mut u32 as *mut _),
            Some(&mut size),
        )
    };
    status.is_ok().then_some(value)
}

/// Keeps the icon alive for the life of the app.
struct TrayState(#[allow(dead_code)] TrayIcon);

fn tray_error(e: tauri::Error) -> KirishotError {
    KirishotError::new(
        ErrorCode::Window,
        format!("Zone de notification indisponible : {e}"),
    )
}

pub fn build(app: &tauri::AppHandle) -> KResult<()> {
    let icon = match tray_variant(system_uses_light_theme()) {
        TrayVariant::Light => tauri::include_image!("icons/tray-light.png"),
        TrayVariant::Dark => tauri::include_image!("icons/tray-dark.png"),
    };
    let item = |id: &str, text: &str| MenuItem::with_id(app, id, text, true, None::<&str>);
    let menu = Menu::with_items(
        app,
        &[
            &item("region", messages::TRAY_REGION).map_err(tray_error)?,
            &item("fullscreen", messages::TRAY_FULLSCREEN).map_err(tray_error)?,
            &PredefinedMenuItem::separator(app).map_err(tray_error)?,
            &item("settings", messages::TRAY_SETTINGS).map_err(tray_error)?,
            &PredefinedMenuItem::separator(app).map_err(tray_error)?,
            &item("quit", messages::TRAY_QUIT).map_err(tray_error)?,
        ],
    )
    .map_err(tray_error)?;
    let tray = TrayIconBuilder::with_id("main")
        .icon(icon)
        .tooltip(messages::APP_NAME)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "region" => flow::start(app, StartMode::Region, Instant::now()),
            "fullscreen" => flow::start(app, StartMode::Fullscreen, Instant::now()),
            "settings" => open_main_or_log(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                open_main_or_log(tray.app_handle());
            }
        })
        .build(app)
        .map_err(tray_error)?;
    app.manage(TrayState(tray));
    Ok(())
}

fn open_main_or_log(app: &tauri::AppHandle) {
    if let Err(e) = windowing::open_main(app) {
        log::error!("cannot open the main window: {e}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tray_variant_follows_taskbar_theme() {
        assert_eq!(tray_variant(Some(1)), TrayVariant::Light);
        assert_eq!(tray_variant(Some(0)), TrayVariant::Dark);
        assert_eq!(tray_variant(None), TrayVariant::Dark);
    }
}
