//! Sending a frozen screen to its overlay. Windows uses a WebView2 shared buffer (the latency
//! spike in docs/spike-latence.md measured ~4 ms this way); other platforms send the frame as a
//! base64 event, slower but portable.
use image::RgbaImage;

use crate::error::{ErrorCode, KResult, KirishotError};

/// Width (u32 LE), height (u32 LE), then the RGBA pixels.
pub fn encode_frame(img: &RgbaImage) -> Vec<u8> {
    let (w, h) = img.dimensions();
    let mut frame = Vec::with_capacity(8 + img.as_raw().len());
    frame.extend_from_slice(&w.to_le_bytes());
    frame.extend_from_slice(&h.to_le_bytes());
    frame.extend_from_slice(img.as_raw());
    frame
}

/// Posts `frame` to the page as a read-only shared buffer. The page receives `additional_json`
/// as the event's `additionalData` and releases the buffer once it has drawn it. `_event` is
/// ignored: other platforms name the event they send.
#[cfg(windows)]
pub fn post_frame(
    _event: &str,
    window: &tauri::WebviewWindow,
    frame: Vec<u8>,
    additional_json: String,
) -> KResult<()> {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        COREWEBVIEW2_SHARED_BUFFER_ACCESS_READ_ONLY, ICoreWebView2_17, ICoreWebView2Environment12,
    };
    use windows::core::{HSTRING, Interface, PCWSTR};

    /// Must run on the webview's thread, which `with_webview` guarantees.
    unsafe fn post(
        webview: &tauri::webview::PlatformWebview,
        frame: &[u8],
        additional_json: &str,
    ) -> windows::core::Result<()> {
        unsafe {
            let environment: ICoreWebView2Environment12 = webview.environment().cast()?;
            let buffer = environment.CreateSharedBuffer(frame.len() as u64)?;
            let mut ptr: *mut u8 = std::ptr::null_mut();
            buffer.Buffer(&mut ptr)?;
            std::ptr::copy_nonoverlapping(frame.as_ptr(), ptr, frame.len());
            let core: ICoreWebView2_17 = webview.controller().CoreWebView2()?.cast()?;
            let json = HSTRING::from(additional_json);
            core.PostSharedBufferToScript(
                &buffer,
                COREWEBVIEW2_SHARED_BUFFER_ACCESS_READ_ONLY,
                PCWSTR(json.as_ptr()),
            )
        }
    }

    window
        .with_webview(move |webview| {
            if let Err(e) = unsafe { post(&webview, &frame, &additional_json) } {
                log::error!("cannot post frame: {e}");
            }
        })
        .map_err(|e| {
            KirishotError::new(
                ErrorCode::Window,
                format!("Fenêtre de sélection indisponible : {e}"),
            )
        })
}

/// Posts `frame` to the page as an `event`, with the session as its payload.
#[cfg(not(windows))]
pub fn post_frame(
    event: &str,
    window: &tauri::WebviewWindow,
    frame: Vec<u8>,
    additional_json: String,
) -> KResult<()> {
    use base64::Engine;
    use tauri::Emitter;

    #[derive(Clone, serde::Serialize)]
    struct OverlayFrame {
        frame: String,
        session: serde_json::Value,
    }

    let session = serde_json::from_str(&additional_json).unwrap_or(serde_json::Value::Null);
    let payload = OverlayFrame {
        frame: base64::engine::general_purpose::STANDARD.encode(frame),
        session,
    };
    window
        .emit_to(window.label(), event, payload)
        .map_err(|e| {
            KirishotError::new(
                ErrorCode::Window,
                format!("Écran figé indisponible : {e}"),
            )
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{Rgba, RgbaImage};

    #[test]
    fn frame_has_size_header() {
        let img = RgbaImage::from_pixel(3, 2, Rgba([1, 2, 3, 255]));
        let f = encode_frame(&img);
        assert_eq!(&f[0..8], &[3, 0, 0, 0, 2, 0, 0, 0]);
        assert_eq!(f.len(), 8 + 3 * 2 * 4);
        assert_eq!(&f[8..12], &[1, 2, 3, 255]);
    }
}
