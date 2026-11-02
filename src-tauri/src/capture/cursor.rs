//! The mouse pointer drawn into a capture when `capture.includeCursor` is on (spec J3 § 2.5).
use image::RgbaImage;

/// The pointer as it looked when the screen was frozen. `at` is in desktop physical pixels.
pub struct CursorImage {
    pub image: RgbaImage,
    pub hotspot: (i32, i32),
    pub at: (i32, i32),
}

/// Draws `cursor` over `img`, whose top-left corner is `origin` on the desktop; clipped.
pub fn blend_cursor(img: &mut RgbaImage, cursor: &CursorImage, origin: (i32, i32)) {
    let left = cursor.at.0 - cursor.hotspot.0 - origin.0;
    let top = cursor.at.1 - cursor.hotspot.1 - origin.1;
    for (cx, cy, src) in cursor.image.enumerate_pixels() {
        let x = left + cx as i32;
        let y = top + cy as i32;
        if x < 0 || y < 0 || x >= img.width() as i32 || y >= img.height() as i32 {
            continue;
        }
        let a = src[3] as u32;
        let dst = img.get_pixel_mut(x as u32, y as u32);
        for c in 0..3 {
            dst[c] = ((src[c] as u32 * a + dst[c] as u32 * (255 - a)) / 255) as u8;
        }
        dst[3] = 255;
    }
}

/// The pointer as Windows shows it now, or `None` when it is hidden.
pub fn read_cursor() -> Option<CursorImage> {
    win::read()
}

mod win {
    use std::ffi::c_void;

    use image::RgbaImage;
    use windows::Win32::Graphics::Gdi::{
        BI_RGB, BITMAP, BITMAPINFO, BITMAPINFOHEADER, CreateCompatibleDC, CreateDIBSection,
        DIB_RGB_COLORS, DeleteDC, DeleteObject, GetDC, GetObjectW, HBITMAP, HGDIOBJ, ReleaseDC,
        SelectObject,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        CURSOR_SHOWING, CURSORINFO, DI_NORMAL, DrawIconEx, GetCursorInfo, GetIconInfo, HICON,
        ICONINFO,
    };

    use super::CursorImage;

    pub fn read() -> Option<CursorImage> {
        unsafe {
            let mut info = CURSORINFO {
                cbSize: size_of::<CURSORINFO>() as u32,
                ..Default::default()
            };
            GetCursorInfo(&mut info).ok()?;
            if info.flags.0 & CURSOR_SHOWING.0 == 0 || info.hCursor.is_invalid() {
                return None;
            }
            let icon = HICON(info.hCursor.0);
            let mut icon_info = ICONINFO::default();
            GetIconInfo(icon, &mut icon_info).ok()?;
            let colour = !icon_info.hbmColor.is_invalid();
            let size = bitmap_size(if colour {
                icon_info.hbmColor
            } else {
                icon_info.hbmMask
            });
            let _ = DeleteObject(HGDIOBJ(icon_info.hbmColor.0));
            let _ = DeleteObject(HGDIOBJ(icon_info.hbmMask.0));
            let (w, mut h) = size?;
            // A monochrome cursor stacks its AND and XOR masks in one bitmap.
            if !colour {
                h /= 2;
            }
            // Drawn on black then on white: the difference gives the alpha of every pixel,
            // whatever the cursor's kind (colour with alpha, masked, inverting).
            let black = draw(icon, w, h, 0x0000_0000)?;
            let white = draw(icon, w, h, 0x00FF_FFFF)?;
            let mut image = RgbaImage::new(w as u32, h as u32);
            for (i, px) in image.pixels_mut().enumerate() {
                let (b, wt) = (&black[i * 4..i * 4 + 4], &white[i * 4..i * 4 + 4]);
                let alpha = 255 - (wt[1] as i32 - b[1] as i32).clamp(0, 255);
                let un = |v: u8| {
                    if alpha == 0 {
                        0
                    } else {
                        (v as i32 * 255 / alpha).min(255) as u8
                    }
                };
                // BGRA in the DIB.
                *px = image::Rgba([un(b[2]), un(b[1]), un(b[0]), alpha as u8]);
            }
            Some(CursorImage {
                image,
                hotspot: (icon_info.xHotspot as i32, icon_info.yHotspot as i32),
                at: (info.ptScreenPos.x, info.ptScreenPos.y),
            })
        }
    }

    unsafe fn bitmap_size(bitmap: HBITMAP) -> Option<(i32, i32)> {
        let mut bm = BITMAP::default();
        let read = unsafe {
            GetObjectW(
                HGDIOBJ(bitmap.0),
                size_of::<BITMAP>() as i32,
                Some(&mut bm as *mut BITMAP as *mut c_void),
            )
        };
        (read > 0 && bm.bmWidth > 0 && bm.bmHeight > 0).then_some((bm.bmWidth, bm.bmHeight))
    }

    /// The cursor drawn on a `w`×`h` 32-bit bitmap filled with `background` (0x00RRGGBB).
    unsafe fn draw(icon: HICON, w: i32, h: i32, background: u32) -> Option<Vec<u8>> {
        unsafe {
            let screen = GetDC(None);
            let dc = CreateCompatibleDC(Some(screen));
            let info = BITMAPINFO {
                bmiHeader: BITMAPINFOHEADER {
                    biSize: size_of::<BITMAPINFOHEADER>() as u32,
                    biWidth: w,
                    biHeight: -h,
                    biPlanes: 1,
                    biBitCount: 32,
                    biCompression: BI_RGB.0,
                    ..Default::default()
                },
                ..Default::default()
            };
            let mut bits: *mut c_void = std::ptr::null_mut();
            let result = CreateDIBSection(Some(dc), &info, DIB_RGB_COLORS, &mut bits, None, 0)
                .ok()
                .filter(|_| !bits.is_null())
                .map(|dib| {
                    let old = SelectObject(dc, HGDIOBJ(dib.0));
                    let len = (w * h) as usize;
                    std::slice::from_raw_parts_mut(bits as *mut u32, len).fill(background);
                    let _ = DrawIconEx(dc, 0, 0, icon, w, h, 0, None, DI_NORMAL);
                    let out = std::slice::from_raw_parts(bits as *const u8, len * 4).to_vec();
                    SelectObject(dc, old);
                    let _ = DeleteObject(HGDIOBJ(dib.0));
                    out
                });
            let _ = DeleteDC(dc);
            ReleaseDC(None, screen);
            result
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::Rgba;

    fn white(w: u32, h: u32) -> RgbaImage {
        RgbaImage::from_pixel(w, h, Rgba([255, 255, 255, 255]))
    }

    fn cursor(color: Rgba<u8>, at: (i32, i32)) -> CursorImage {
        CursorImage {
            image: RgbaImage::from_pixel(2, 2, color),
            hotspot: (0, 0),
            at,
        }
    }

    #[test]
    fn an_opaque_cursor_covers_its_pixels() {
        let mut img = white(10, 10);
        blend_cursor(&mut img, &cursor(Rgba([255, 0, 0, 255]), (5, 5)), (0, 0));
        assert_eq!(img.get_pixel(5, 5), &Rgba([255, 0, 0, 255]));
        assert_eq!(img.get_pixel(6, 6), &Rgba([255, 0, 0, 255]));
        assert_eq!(img.get_pixel(4, 4), &Rgba([255, 255, 255, 255]));
    }

    #[test]
    fn the_hotspot_and_the_monitor_origin_shift_it() {
        let mut img = white(10, 10);
        let mut c = cursor(Rgba([255, 0, 0, 255]), (105, 55));
        c.hotspot = (1, 1);
        blend_cursor(&mut img, &c, (100, 50));
        assert_eq!(img.get_pixel(4, 4), &Rgba([255, 0, 0, 255]));
        assert_eq!(img.get_pixel(6, 6), &Rgba([255, 255, 255, 255]));
    }

    #[test]
    fn a_cursor_half_outside_is_clipped() {
        let mut img = white(10, 10);
        blend_cursor(&mut img, &cursor(Rgba([255, 0, 0, 255]), (9, -1)), (0, 0));
        assert_eq!(img.get_pixel(9, 0), &Rgba([255, 0, 0, 255]));
    }

    #[test]
    fn half_transparent_pixels_blend() {
        let mut img = white(10, 10);
        blend_cursor(&mut img, &cursor(Rgba([255, 0, 0, 128]), (0, 0)), (0, 0));
        assert_eq!(img.get_pixel(0, 0), &Rgba([255, 127, 127, 255]));
    }
}
