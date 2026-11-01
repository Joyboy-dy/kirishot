use image::codecs::jpeg::JpegEncoder;
use image::codecs::png::{CompressionType, FilterType, PngEncoder};
use image::codecs::webp::WebPEncoder;
use image::{DynamicImage, ExtendedColorType, ImageEncoder, RgbaImage};

use crate::error::{ErrorCode, KResult, KirishotError};
use crate::settings::model::ImageFormat;

/// PNG (balanced compression), JPG at quality 90 without alpha, or lossless WebP.
pub fn encode(img: &RgbaImage, format: ImageFormat) -> KResult<Vec<u8>> {
    let (w, h) = img.dimensions();
    let mut out = Vec::new();
    let result = match format {
        ImageFormat::Png => {
            PngEncoder::new_with_quality(&mut out, CompressionType::Default, FilterType::Adaptive)
                .write_image(img.as_raw(), w, h, ExtendedColorType::Rgba8)
        }
        ImageFormat::Jpg => {
            let rgb = DynamicImage::ImageRgba8(img.clone()).to_rgb8();
            JpegEncoder::new_with_quality(&mut out, 90).write_image(
                rgb.as_raw(),
                w,
                h,
                ExtendedColorType::Rgb8,
            )
        }
        ImageFormat::Webp => WebPEncoder::new_lossless(&mut out).write_image(
            img.as_raw(),
            w,
            h,
            ExtendedColorType::Rgba8,
        ),
    };
    result.map_err(|e| {
        KirishotError::new(
            ErrorCode::Encode,
            format!("Impossible d'encoder l'image : {e}"),
        )
    })?;
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{GenericImageView, Rgba, RgbaImage};

    fn sample() -> RgbaImage {
        RgbaImage::from_fn(4, 3, |x, y| {
            Rgba([(x * 60) as u8, (y * 80) as u8, 128, 255])
        })
    }

    #[test]
    fn png_roundtrips_exactly() {
        let bytes = encode(&sample(), ImageFormat::Png).unwrap();
        assert_eq!(
            image::load_from_memory(&bytes).unwrap().to_rgba8(),
            sample()
        );
    }

    #[test]
    fn webp_is_lossless() {
        let bytes = encode(&sample(), ImageFormat::Webp).unwrap();
        assert_eq!(
            image::load_from_memory(&bytes).unwrap().to_rgba8(),
            sample()
        );
    }

    #[test]
    fn jpg_keeps_dimensions() {
        let bytes = encode(&sample(), ImageFormat::Jpg).unwrap();
        assert_eq!(
            image::guess_format(&bytes).unwrap(),
            image::ImageFormat::Jpeg
        );
        assert_eq!(
            image::load_from_memory(&bytes).unwrap().dimensions(),
            (4, 3)
        );
    }
}
