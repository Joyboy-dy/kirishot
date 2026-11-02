//! Copying an image as both `PNG` (browsers, Discord) and `CF_DIBV5` (Word, Paint, older apps).
use std::time::Duration;

use image::RgbaImage;

use crate::error::{ErrorCode, KResult, KirishotError};

const CF_DIBV5: u32 = 17;
const BI_BITFIELDS: u32 = 3;
const LCS_SRGB: u32 = 0x7352_4742;
const LCS_GM_IMAGES: u32 = 4;
const HEADER_SIZE: u32 = 124;

/// A `BITMAPV5HEADER` followed by bottom-up BGRA rows.
pub fn dibv5_from_rgba(img: &RgbaImage) -> Vec<u8> {
    let (w, h) = img.dimensions();
    let pixels = w * h * 4;
    let mut d = Vec::with_capacity((HEADER_SIZE + pixels) as usize);
    let u32s = |d: &mut Vec<u8>, values: &[u32]| {
        for v in values {
            d.extend_from_slice(&v.to_le_bytes());
        }
    };
    u32s(&mut d, &[HEADER_SIZE, w, h]); // positive height: bottom-up rows
    d.extend_from_slice(&1u16.to_le_bytes()); // planes
    d.extend_from_slice(&32u16.to_le_bytes()); // bits per pixel
    u32s(&mut d, &[BI_BITFIELDS, pixels, 0, 0, 0, 0]);
    u32s(
        &mut d,
        &[0x00FF_0000, 0x0000_FF00, 0x0000_00FF, 0xFF00_0000],
    ); // R, G, B, A masks
    u32s(&mut d, &[LCS_SRGB]);
    d.extend_from_slice(&[0u8; 36]); // CIEXYZTRIPLE endpoints, unused with sRGB
    u32s(&mut d, &[0, 0, 0, LCS_GM_IMAGES, 0, 0, 0]); // gammas, intent, profile, reserved
    debug_assert_eq!(d.len(), HEADER_SIZE as usize);
    for row in img.as_raw().chunks_exact((w * 4) as usize).rev() {
        for p in row.as_chunks::<4>().0 {
            d.extend_from_slice(&[p[2], p[1], p[0], p[3]]);
        }
    }
    d
}

/// Replaces the clipboard content with both formats. Opening is retried 3 times, 50 ms apart,
/// when another application holds the clipboard.
pub fn write_image(owner: Option<isize>, png: &[u8], dib: &[u8]) -> KResult<()> {
    let owner = owner.map_or(std::ptr::null_mut(), |h| h as clipboard_win::types::HWND);
    let mut retries = 3;
    let _clipboard = loop {
        match clipboard_win::Clipboard::new_attempts_for(owner, 0) {
            Ok(clipboard) => break clipboard,
            Err(_) if retries > 0 => {
                retries -= 1;
                std::thread::sleep(Duration::from_millis(50));
            }
            Err(e) => {
                log::warn!("clipboard busy: {e}");
                return Err(KirishotError::new(
                    ErrorCode::Clipboard,
                    "Le presse-papiers est utilisé par une autre application.",
                ));
            }
        }
    };
    let fail = |e: &dyn std::fmt::Display| {
        KirishotError::new(
            ErrorCode::Clipboard,
            format!("Impossible de copier l'image : {e}"),
        )
    };
    clipboard_win::raw::empty().map_err(|e| fail(&e))?;
    clipboard_win::raw::set_without_clear(CF_DIBV5, dib).map_err(|e| fail(&e))?;
    let png_format =
        clipboard_win::raw::register_format("PNG").ok_or_else(|| fail(&"format PNG"))?;
    clipboard_win::raw::set_without_clear(png_format.get(), png).map_err(|e| fail(&e))?;
    Ok(())
}

/// Replaces the clipboard content with text, such as a colour `#CFD4DC`.
pub fn write_text(text: &str) -> KResult<()> {
    clipboard_win::set_clipboard_string(text).map_err(|e| {
        KirishotError::new(
            ErrorCode::Clipboard,
            format!("Impossible de copier le texte : {e}"),
        )
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{Rgba, RgbaImage};

    #[test]
    fn dibv5_header_and_bottom_up_bgra() {
        let mut img = RgbaImage::from_pixel(2, 2, Rgba([0, 0, 255, 255])); // blue
        img.put_pixel(0, 0, Rgba([255, 0, 0, 255])); // top left: red
        let d = dibv5_from_rgba(&img);
        let u32_at = |o: usize| u32::from_le_bytes(d[o..o + 4].try_into().unwrap());
        let u16_at = |o: usize| u16::from_le_bytes(d[o..o + 2].try_into().unwrap());
        assert_eq!(d.len(), 124 + 2 * 2 * 4);
        assert_eq!((u32_at(0), u32_at(4), u32_at(8)), (124, 2, 2));
        assert_eq!(
            (u16_at(12), u16_at(14), u32_at(16), u32_at(20)),
            (1, 32, 3, 16)
        );
        assert_eq!(
            (u32_at(40), u32_at(44), u32_at(48), u32_at(52)),
            (0x00FF_0000, 0x0000_FF00, 0x0000_00FF, 0xFF00_0000)
        );
        assert_eq!((u32_at(56), u32_at(108)), (0x7352_4742, 4));
        // First stored row = bottom row (blue, BGRA); last row = top row, red first.
        assert_eq!(&d[124..128], &[255, 0, 0, 255]);
        assert_eq!(&d[124 + 8..124 + 12], &[0, 0, 255, 255]);
    }

    #[test]
    fn write_text_round_trips() {
        write_text("#CFD4DC").unwrap();
        let back: String = clipboard_win::get_clipboard_string().unwrap();
        assert_eq!(back, "#CFD4DC");
    }
}
