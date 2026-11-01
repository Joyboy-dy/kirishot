pub mod clipboard;
pub mod encode;
pub mod filename;
pub mod save;

use image::RgbaImage;
use tauri::Manager;

use crate::error::{KResult, KirishotError};
use crate::paths;
use crate::settings::model::{AutoAction, ImageFormat, Settings};
use crate::settings::{SettingsState, resolve_save_folder};
use filename::{NameContext, render_name};
use save::{SavedFile, save_bytes};

pub struct CaptureMeta {
    pub taken_at: chrono::DateTime<chrono::Local>,
    pub window_title: Option<String>,
}

/// What was done with a capture. When both actions were asked and only one failed, the other
/// one is still done and `error` carries the failure.
pub struct Delivery {
    pub saved: Option<SavedFile>,
    pub copied: bool,
    pub error: Option<KirishotError>,
}

/// Applies the automatic action from the settings: save, copy, or both.
pub fn deliver(app: &tauri::AppHandle, img: &RgbaImage, meta: &CaptureMeta) -> KResult<Delivery> {
    let settings = app.state::<SettingsState>().get();
    let (save, copy) = match settings.after_capture.auto_action {
        AutoAction::SaveAndCopy => (true, true),
        AutoAction::Copy => (false, true),
        AutoAction::Save => (true, false),
    };
    let mut png = None;
    let mut delivery = Delivery {
        saved: None,
        copied: false,
        error: None,
    };
    if save {
        match save_capture(app, &settings, img, meta, &mut png) {
            Ok(saved) => delivery.saved = Some(saved),
            Err(e) => delivery.error = Some(e),
        }
    }
    if copy {
        match copy_capture(app, img, &mut png) {
            Ok(()) => delivery.copied = true,
            Err(e) => {
                delivery.error.get_or_insert(e);
            }
        }
    }
    match delivery.error.take() {
        Some(e) if delivery.saved.is_none() && !delivery.copied => Err(e),
        error => Ok(Delivery { error, ..delivery }),
    }
}

/// PNG bytes, encoded once and shared by saving and copying.
fn png_bytes<'a>(img: &RgbaImage, cache: &'a mut Option<Vec<u8>>) -> KResult<&'a [u8]> {
    if cache.is_none() {
        *cache = Some(encode::encode(img, ImageFormat::Png)?);
    }
    Ok(cache.as_deref().expect("just filled"))
}

fn save_capture(
    app: &tauri::AppHandle,
    settings: &Settings,
    img: &RgbaImage,
    meta: &CaptureMeta,
    png: &mut Option<Vec<u8>>,
) -> KResult<SavedFile> {
    let default_folder = paths::default_save_folder(app)?;
    let preferred = resolve_save_folder(settings, &default_folder);
    let format = settings.save.format;
    let encoded;
    let bytes = if format == ImageFormat::Png {
        png_bytes(img, png)?
    } else {
        encoded = encode::encode(img, format)?;
        &encoded
    };
    let stem = render_name(
        &settings.save.name_template,
        &NameContext {
            taken_at: meta.taken_at.naive_local(),
            window_title: meta.window_title.clone(),
            counter: settings.save.counter,
        },
    );
    let saved = save_bytes(
        bytes,
        &preferred,
        &default_folder,
        &stem,
        format.extension(),
    )?;
    let counted = app
        .state::<SettingsState>()
        .update(|s| s.save.counter = s.save.counter.saturating_add(1));
    if let Err(e) = counted {
        log::warn!("cannot increment the file counter: {e}");
    }
    Ok(saved)
}

fn copy_capture(app: &tauri::AppHandle, img: &RgbaImage, png: &mut Option<Vec<u8>>) -> KResult<()> {
    // Owning the clipboard with a Kirishot window is what SetClipboardData documents.
    let owner = app
        .get_webview_window("overlay-0")
        .and_then(|w| w.hwnd().ok())
        .map(|hwnd| hwnd.0 as isize);
    let dib = clipboard::dibv5_from_rgba(img);
    clipboard::write_image(owner, png_bytes(img, png)?, &dib)
}
