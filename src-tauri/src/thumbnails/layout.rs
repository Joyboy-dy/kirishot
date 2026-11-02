//! Where the thumbnail window sits and how large it is. Logical pixels unless named physical.
use crate::geometry::Rect;

pub const CARD_WIDTH: f64 = 240.0;
pub const CARD_MAX_HEIGHT: f64 = 180.0;
pub const CARD_MIN_HEIGHT: f64 = 60.0;
pub const GAP: f64 = 8.0;
pub const MORE_ROW: f64 = 24.0;
pub const MARGIN: f64 = 16.0;
/// Transparent room on the left and top of the window for the cards' shadow.
pub const SHADOW_PAD: f64 = 24.0;

/// A card's size for an image, keeping its proportions.
pub fn card_size(image: (u32, u32)) -> (f64, f64) {
    let (w, h) = (image.0.max(1) as f64, image.1.max(1) as f64);
    let height = CARD_WIDTH * h / w;
    if height > CARD_MAX_HEIGHT {
        (CARD_MAX_HEIGHT * w / h, CARD_MAX_HEIGHT)
    } else {
        (CARD_WIDTH, height.max(CARD_MIN_HEIGHT))
    }
}

/// The window rectangle in physical pixels, anchored to the work area's bottom-right corner.
pub fn stack_bounds(work: Rect, scale: f64, cards: &[(f64, f64)], more: u32) -> Rect {
    let widest = cards.iter().map(|c| c.0).fold(0.0, f64::max);
    let mut height: f64 = cards.iter().map(|c| c.1).sum();
    height += GAP * cards.len().saturating_sub(1) as f64;
    if more > 0 {
        height += MORE_ROW + GAP;
    }
    let width = ((widest + SHADOW_PAD) * scale) as u32;
    let height = ((height + SHADOW_PAD) * scale) as u32;
    let margin = (MARGIN * scale).round() as i32;
    Rect {
        x: work.x + work.width as i32 - margin - width as i32,
        y: work.y + work.height as i32 - margin - height as i32,
        width,
        height,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn card_keeps_ratio() {
        assert_eq!(card_size((1920, 1080)), (240.0, 135.0));
    }

    #[test]
    fn tall_card_is_capped() {
        assert_eq!(card_size((600, 1200)), (90.0, 180.0));
    }

    #[test]
    fn thin_strip_keeps_a_minimum_height() {
        assert_eq!(card_size((2000, 100)), (240.0, 60.0));
    }

    #[test]
    fn stack_sits_in_the_work_area_corner_at_150_percent() {
        let work = Rect {
            x: 0,
            y: 0,
            width: 2880,
            height: 1680,
        };
        let b = stack_bounds(work, 1.5, &[(240.0, 135.0)], 0);
        assert_eq!(b.x + b.width as i32, 2880 - 24);
        assert_eq!(b.y + b.height as i32, 1680 - 24);
        assert_eq!(b.width, ((240.0 + 24.0) * 1.5) as u32);
        assert_eq!(b.height, ((135.0 + 24.0) * 1.5) as u32);
    }

    #[test]
    fn stack_on_a_left_monitor_with_negative_origin() {
        let work = Rect {
            x: -1920,
            y: 0,
            width: 1920,
            height: 1040,
        };
        let b = stack_bounds(work, 1.0, &[(240.0, 135.0), (240.0, 135.0)], 0);
        assert_eq!(b.x + b.width as i32, -16);
        assert_eq!(b.height, 135 * 2 + 8 + 24);
    }

    #[test]
    fn more_row_adds_height() {
        let work = Rect {
            x: 0,
            y: 0,
            width: 1920,
            height: 1040,
        };
        let without = stack_bounds(work, 1.0, &[(240.0, 135.0)], 0);
        let with = stack_bounds(work, 1.0, &[(240.0, 135.0)], 2);
        assert_eq!(with.height - without.height, 24 + 8);
    }
}
