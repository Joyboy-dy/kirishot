//! The shutter click, synthesized at first use: a short soft sound, no asset to license.
use std::f32::consts::PI;
use std::sync::OnceLock;

use tauri::Manager;
use windows::Win32::Media::Audio::{PlaySoundW, SND_ASYNC, SND_MEMORY, SND_NODEFAULT};
use windows::core::PCWSTR;

use crate::settings::SettingsState;

const RATE: u32 = 44_100;
const LENGTH_MS: u32 = 120;

/// Plays the click without waiting, when the setting allows it. A failure is only logged.
pub fn play_shutter(app: &tauri::AppHandle) {
    if !app.state::<SettingsState>().get().capture.sound {
        return;
    }
    play();
}

/// Plays the click regardless of the setting (preview in the settings page).
pub fn play() {
    let wav = shutter_wav();
    // SND_ASYNC keeps reading the buffer after returning: it must live forever, and it does.
    let played = unsafe {
        PlaySoundW(
            PCWSTR(wav.as_ptr().cast()),
            None,
            SND_MEMORY | SND_ASYNC | SND_NODEFAULT,
        )
    };
    if !played.as_bool() {
        log::warn!("cannot play the shutter sound");
    }
}

/// A 16-bit mono PCM WAV at 44.1 kHz.
pub fn shutter_wav() -> &'static [u8] {
    static WAV: OnceLock<Vec<u8>> = OnceLock::new();
    WAV.get_or_init(|| wav_bytes(&shutter_samples()))
}

/// Two soft clicks, like a shutter opening then closing: decaying filtered noise with a little
/// tone for body, peak at half scale.
fn shutter_samples() -> Vec<i16> {
    let n = (RATE * LENGTH_MS / 1000) as usize;
    let dt = 1.0 / RATE as f32;
    let rc = 1.0 / (2.0 * PI * 3_000.0);
    let alpha = dt / (rc + dt);
    let mut seed: u32 = 0x9E37_79B9;
    let mut noise = || {
        seed ^= seed << 13;
        seed ^= seed >> 17;
        seed ^= seed << 5;
        seed as f32 / u32::MAX as f32 * 2.0 - 1.0
    };
    let burst = |t: f32, start: f32| {
        if t < start {
            0.0
        } else {
            (-(t - start) / 0.006).exp()
        }
    };
    let mut low = 0.0f32;
    let raw: Vec<f32> = (0..n)
        .map(|i| {
            let t = i as f32 * dt;
            let env = burst(t, 0.0) + 0.7 * burst(t, 0.055);
            low += alpha * (noise() - low);
            let tone = 0.2 * (2.0 * PI * 1_800.0 * t).sin();
            let fade = ((n - i) as f32 / (RATE as f32 * 0.002)).min(1.0);
            (low + tone) * env * fade
        })
        .collect();
    let peak = raw.iter().fold(0.0f32, |m, s| m.max(s.abs())).max(f32::EPSILON);
    let gain = 0.5 * i16::MAX as f32 / peak;
    raw.iter().map(|s| (s * gain).round() as i16).collect()
}

fn wav_bytes(samples: &[i16]) -> Vec<u8> {
    let data_len = (samples.len() * 2) as u32;
    let mut w = Vec::with_capacity(44 + data_len as usize);
    w.extend_from_slice(b"RIFF");
    w.extend_from_slice(&(36 + data_len).to_le_bytes());
    w.extend_from_slice(b"WAVEfmt ");
    w.extend_from_slice(&16u32.to_le_bytes()); // fmt chunk size
    w.extend_from_slice(&1u16.to_le_bytes()); // PCM
    w.extend_from_slice(&1u16.to_le_bytes()); // mono
    w.extend_from_slice(&RATE.to_le_bytes());
    w.extend_from_slice(&(RATE * 2).to_le_bytes()); // bytes per second
    w.extend_from_slice(&2u16.to_le_bytes()); // block align
    w.extend_from_slice(&16u16.to_le_bytes()); // bits per sample
    w.extend_from_slice(b"data");
    w.extend_from_slice(&data_len.to_le_bytes());
    for s in samples {
        w.extend_from_slice(&s.to_le_bytes());
    }
    w
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shutter_is_a_short_mono_pcm_wav() {
        let w = shutter_wav();
        assert_eq!(&w[0..4], b"RIFF");
        assert_eq!(&w[8..12], b"WAVE");
        let channels = u16::from_le_bytes([w[22], w[23]]);
        let rate = u32::from_le_bytes(w[24..28].try_into().unwrap());
        let data_len = u32::from_le_bytes(w[40..44].try_into().unwrap()) as usize;
        assert_eq!((channels, rate), (1, 44_100));
        assert_eq!(w.len(), 44 + data_len);
        let ms = data_len / 2 * 1000 / 44_100;
        assert!((100..=140).contains(&ms), "{ms} ms");
    }

    #[test]
    fn shutter_never_clips() {
        let w = shutter_wav();
        let limit = (0.6 * i16::MAX as f32) as i16;
        assert!(
            w[44..]
                .chunks_exact(2)
                .map(|c| i16::from_le_bytes([c[0], c[1]]))
                .all(|s| s.saturating_abs() <= limit)
        );
    }

    #[test]
    fn shutter_is_not_silent() {
        let w = shutter_wav();
        let peak = w[44..]
            .chunks_exact(2)
            .map(|c| i16::from_le_bytes([c[0], c[1]]).saturating_abs())
            .max()
            .unwrap();
        assert!(peak > 8_000, "peak {peak}");
    }
}
