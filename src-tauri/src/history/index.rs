//! The history on disk (spec v1 § 6.2, J3 § 4.2): one folder per capture under
//! `%APPDATA%\Kirishot\history\` and an `index.json` written atomically.
use std::path::Path;

use image::RgbaImage;
use serde::{Deserialize, Serialize};

use crate::error::{ErrorCode, KResult, KirishotError};

pub const INDEX_FILE: &str = "index.json";
pub const ORIGINAL_FILE: &str = "original.png";
pub const THUMB_FILE: &str = "thumb.jpg";
pub const FINAL_FILE: &str = "final.png";
pub const DOCUMENT_FILE: &str = "document.json";
const THUMB_WIDTH: u32 = 320;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum SourceKind {
    Region,
    Window,
    Fullscreen,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct Source {
    pub kind: SourceKind,
    pub window_title: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
pub struct ImageSize {
    pub w: u32,
    pub h: u32,
}

/// One capture in the history (spec v1 § 6.3).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub id: String,
    /// RFC 3339, local time.
    pub created_at: String,
    pub size: ImageSize,
    pub source: Source,
    /// The last file it was saved to, if any.
    pub saved_path: Option<String>,
    pub copied: bool,
    pub annotated: bool,
    /// Bytes used in the history folder.
    pub bytes: f64,
    /// The fingerprint of the editor document last saved to `saved_path`; `None` when the file
    /// holds the original image (saved by the thumbnail) — spec J3 § 3.2.
    #[serde(default)]
    pub saved_doc: Option<String>,
}

/// The entries, newest first.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Index {
    pub entries: Vec<HistoryEntry>,
}

fn io_error(e: impl std::fmt::Display) -> KirishotError {
    KirishotError::new(ErrorCode::Save, format!("Historique inaccessible : {e}"))
}

/// Writes `bytes` to `dir/name` through a temporary file, so a crash never leaves half a file.
pub fn write_atomic(dir: &Path, name: &str, bytes: &[u8]) -> KResult<()> {
    std::fs::create_dir_all(dir).map_err(io_error)?;
    let tmp = dir.join(format!(".{name}.tmp"));
    std::fs::write(&tmp, bytes)
        .and_then(|_| std::fs::rename(&tmp, dir.join(name)))
        .map_err(|e| {
            let _ = std::fs::remove_file(&tmp);
            io_error(e)
        })
}

fn created(e: &HistoryEntry) -> Option<chrono::DateTime<chrono::FixedOffset>> {
    chrono::DateTime::parse_from_rfc3339(&e.created_at).ok()
}

/// Bytes of the files directly in `dir`.
fn folder_bytes(dir: &Path) -> u64 {
    std::fs::read_dir(dir)
        .map(|it| {
            it.filter_map(Result::ok)
                .filter_map(|e| e.metadata().ok())
                .filter(|m| m.is_file())
                .map(|m| m.len())
                .sum()
        })
        .unwrap_or(0)
}

impl Index {
    /// The index of `dir`: empty when there is none, rebuilt from the folders when unreadable.
    pub fn load(dir: &Path) -> Index {
        match std::fs::read(dir.join(INDEX_FILE)) {
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Index::rebuild(dir),
            Err(e) => {
                log::warn!("history index unreadable ({e}), rebuilt");
                Index::rebuild(dir)
            }
            Ok(bytes) => match serde_json::from_slice::<Vec<HistoryEntry>>(&bytes) {
                Ok(entries) => Index { entries }.matched_to(dir),
                Err(e) => {
                    log::warn!("history index invalid ({e}), rebuilt");
                    Index::rebuild(dir)
                }
            },
        }
    }

    /// The index made true to the folders: entries whose original image is gone are dropped
    /// (folder deleted, or never written because the app was killed), folders it does not list
    /// are added. What it knew about the others is kept.
    fn matched_to(self, dir: &Path) -> Index {
        let on_disk = Index::rebuild(dir);
        let mut entries: Vec<HistoryEntry> = self
            .entries
            .into_iter()
            .filter(|e| on_disk.entries.iter().any(|d| d.id == e.id))
            .collect();
        for found in on_disk.entries {
            if !entries.iter().any(|e| e.id == found.id) {
                entries.push(found);
            }
        }
        let mut index = Index { entries };
        index.sort();
        index
    }

    pub fn save(&self, dir: &Path) -> KResult<()> {
        let json = serde_json::to_vec_pretty(&self.entries).map_err(io_error)?;
        write_atomic(dir, INDEX_FILE, &json)
    }

    fn sort(&mut self) {
        // Newest first; ULIDs break ties in the same order.
        self.entries
            .sort_by(|a, b| created(b).cmp(&created(a)).then_with(|| b.id.cmp(&a.id)));
    }

    /// Adds `entry`, or replaces the entry with its id; keeps newest first.
    pub fn upsert(&mut self, entry: HistoryEntry) {
        match self.entries.iter_mut().find(|e| e.id == entry.id) {
            Some(existing) => *existing = entry,
            None => self.entries.push(entry),
        }
        self.sort();
    }

    /// Changes the entry `id`; `false` when there is none.
    pub fn update(&mut self, id: &str, f: impl FnOnce(&mut HistoryEntry)) -> bool {
        match self.entries.iter_mut().find(|e| e.id == id) {
            Some(e) => {
                f(e);
                true
            }
            None => false,
        }
    }

    pub fn remove(&mut self, id: &str) -> bool {
        let before = self.entries.len();
        self.entries.retain(|e| e.id != id);
        self.entries.len() != before
    }

    /// Drops the entries older than `days` (none with `None`); returns their ids, oldest first.
    pub fn prune(
        &mut self,
        now: chrono::DateTime<chrono::Local>,
        days: Option<u32>,
    ) -> Vec<String> {
        let Some(days) = days else {
            return Vec::new();
        };
        let limit = now - chrono::Duration::days(days as i64);
        let (old, kept): (Vec<_>, Vec<_>) = self
            .entries
            .drain(..)
            .partition(|e| created(e).is_some_and(|c| c < limit));
        self.entries = kept;
        old.into_iter().rev().map(|e| e.id).collect()
    }

    /// One entry per capture folder that has an original image; other fields take defaults.
    pub fn rebuild(dir: &Path) -> Index {
        let mut entries = Vec::new();
        for item in std::fs::read_dir(dir).into_iter().flatten().flatten() {
            let id = item.file_name().to_string_lossy().into_owned();
            let Ok(ulid) = ulid::Ulid::from_string(&id) else {
                continue;
            };
            let folder = item.path();
            let Ok((w, h)) = image::image_dimensions(folder.join(ORIGINAL_FILE)) else {
                continue;
            };
            let time: chrono::DateTime<chrono::Local> = ulid.datetime().into();
            entries.push(HistoryEntry {
                id,
                created_at: time.to_rfc3339(),
                size: ImageSize { w, h },
                source: Source {
                    kind: SourceKind::Region,
                    window_title: None,
                },
                saved_path: None,
                copied: false,
                annotated: folder.join(DOCUMENT_FILE).exists(),
                bytes: folder_bytes(&folder) as f64,
                saved_doc: None,
            });
        }
        let mut index = Index { entries };
        index.sort();
        index
    }
}

/// Writes a capture's folder; returns the bytes it uses.
pub fn write_capture(dir: &Path, id: &str, original_png: &[u8], thumb_jpg: &[u8]) -> KResult<u64> {
    let folder = dir.join(id);
    write_atomic(&folder, ORIGINAL_FILE, original_png)?;
    write_atomic(&folder, THUMB_FILE, thumb_jpg)?;
    Ok(folder_bytes(&folder))
}

/// A 320 px wide JPEG of `img`; a smaller image keeps its size.
pub fn thumbnail(img: &RgbaImage) -> KResult<Vec<u8>> {
    let small = if img.width() > THUMB_WIDTH {
        let h = ((img.height() as u64 * THUMB_WIDTH as u64) / img.width() as u64).max(1) as u32;
        image::imageops::thumbnail(img, THUMB_WIDTH, h)
    } else {
        img.clone()
    };
    let rgb = image::DynamicImage::ImageRgba8(small).to_rgb8();
    let mut out = Vec::new();
    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, 80)
        .encode_image(&rgb)
        .map_err(|e| {
            KirishotError::new(ErrorCode::Encode, format!("Miniature impossible : {e}"))
        })?;
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{Duration, Local};

    fn entry(id: &str, created: chrono::DateTime<Local>) -> HistoryEntry {
        HistoryEntry {
            id: id.into(),
            created_at: created.to_rfc3339(),
            size: ImageSize { w: 4, h: 3 },
            source: Source {
                kind: SourceKind::Region,
                window_title: None,
            },
            saved_path: None,
            copied: false,
            annotated: false,
            bytes: 10.0,
            saved_doc: None,
        }
    }

    fn png(w: u32, h: u32) -> Vec<u8> {
        crate::output::encode_png(&RgbaImage::new(w, h)).unwrap()
    }

    #[test]
    fn index_roundtrips_atomically() {
        let dir = tempfile::tempdir().unwrap();
        let id = "01JBX4Q8Z3M6N2P7R9S5T1V0W8";
        write_capture(dir.path(), id, &png(4, 3), b"jpg").unwrap();
        let mut index = Index::default();
        let mut e = entry(id, Local::now());
        e.size = ImageSize { w: 4, h: 3 };
        index.upsert(e);
        index.save(dir.path()).unwrap();
        assert_eq!(Index::load(dir.path()), index);
        let leftovers: Vec<_> = std::fs::read_dir(dir.path())
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
            .filter(|n| n.ends_with(".tmp"))
            .collect();
        assert!(leftovers.is_empty());
    }

    #[test]
    fn upsert_keeps_newest_first_and_replaces() {
        let mut index = Index::default();
        let now = Local::now();
        index.upsert(entry("a", now - Duration::days(1)));
        index.upsert(entry("b", now));
        let mut again = entry("a", now - Duration::days(1));
        again.copied = true;
        index.upsert(again);
        let ids: Vec<_> = index.entries.iter().map(|e| e.id.as_str()).collect();
        assert_eq!(ids, ["b", "a"]);
        assert!(index.entries[1].copied);
    }

    #[test]
    fn prune_keeps_recent_and_forever() {
        let now = Local::now();
        let mut index = Index::default();
        index.upsert(entry("old", now - Duration::days(40)));
        index.upsert(entry("recent", now - Duration::days(10)));
        let mut forever = index.clone();
        assert_eq!(index.prune(now, Some(30)), ["old"]);
        assert_eq!(index.entries.len(), 1);
        assert!(forever.prune(now, None).is_empty());
        assert_eq!(forever.entries.len(), 2);
    }

    #[test]
    fn corrupt_index_is_rebuilt_from_folders() {
        let dir = tempfile::tempdir().unwrap();
        let older = ulid::Ulid::from_parts(1_700_000_000_000, 1).to_string();
        let newer = ulid::Ulid::from_parts(1_800_000_000_000, 1).to_string();
        for id in [&older, &newer] {
            write_capture(dir.path(), id, &png(4, 3), b"jpg").unwrap();
        }
        std::fs::write(dir.path().join(INDEX_FILE), b"{ not json").unwrap();
        let index = Index::load(dir.path());
        let ids: Vec<_> = index.entries.iter().map(|e| e.id.clone()).collect();
        assert_eq!(ids, [newer, older]);
        assert_eq!(index.entries[0].size, ImageSize { w: 4, h: 3 });
        assert!(index.entries[0].bytes > 0.0);
    }

    #[test]
    fn a_valid_index_is_matched_to_the_folders() {
        let dir = tempfile::tempdir().unwrap();
        let kept = ulid::Ulid::from_parts(1_700_000_000_000, 1).to_string();
        let gone = ulid::Ulid::from_parts(1_750_000_000_000, 1).to_string();
        let orphan = ulid::Ulid::from_parts(1_800_000_000_000, 1).to_string();
        write_capture(dir.path(), &kept, &png(4, 3), b"jpg").unwrap();
        write_capture(dir.path(), &orphan, &png(4, 3), b"jpg").unwrap();
        let mut index = Index::default();
        let mut e = entry(&kept, Local::now());
        e.copied = true;
        index.upsert(e);
        // Its folder was deleted (or never written: the app was killed).
        index.upsert(entry(&gone, Local::now()));
        index.save(dir.path()).unwrap();
        let loaded = Index::load(dir.path());
        let ids: Vec<_> = loaded.entries.iter().map(|e| e.id.clone()).collect();
        assert!(ids.contains(&kept) && ids.contains(&orphan) && !ids.contains(&gone));
        // What the index knew about a capture is kept.
        assert!(loaded.entries.iter().find(|e| e.id == kept).unwrap().copied);
    }

    #[test]
    fn update_and_remove_report_unknown_ids() {
        let mut index = Index::default();
        index.upsert(entry("a", Local::now()));
        assert!(index.update("a", |e| e.copied = true));
        assert!(index.entries[0].copied);
        assert!(!index.update("zz", |e| e.copied = true));
        assert!(!index.remove("zz"));
        assert!(index.remove("a"));
        assert!(index.entries.is_empty());
    }

    #[test]
    fn thumbnail_is_320_wide() {
        let small =
            image::load_from_memory(&thumbnail(&RgbaImage::new(200, 100)).unwrap()).unwrap();
        assert_eq!((small.width(), small.height()), (200, 100));
        let big = image::load_from_memory(&thumbnail(&RgbaImage::new(1000, 500)).unwrap()).unwrap();
        assert_eq!((big.width(), big.height()), (320, 160));
    }
}
