//! The capture history (spec J3 § 4.2): every capture is recorded here, with what was done
//! with it, so the main window can list, reopen, copy and delete it.
pub mod index;

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use image::RgbaImage;
use serde::{Deserialize, Serialize};
use tauri::Manager;
use tauri_specta::Event;

use index::{HistoryEntry, ImageSize, Index, Source, SourceKind};

use crate::error::{ErrorCode, KResult, KirishotError};
use crate::output::CaptureMeta;

/// Sent when the history changes, so the main window can list it again.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type, tauri_specta::Event)]
pub struct HistoryChanged;

/// The history of this run: its folder and its index.
pub struct HistoryState {
    pub dir: PathBuf,
    pub index: Mutex<Index>,
}

impl HistoryState {
    pub fn open(dir: PathBuf) -> Self {
        let index = Index::load(&dir);
        Self {
            dir,
            index: Mutex::new(index),
        }
    }
}

fn io_error(e: impl std::fmt::Display) -> KirishotError {
    KirishotError::new(ErrorCode::Save, format!("Historique inaccessible : {e}"))
}

/// Moves J2's `captures\<id>` folders (editor originals and documents) into the history.
pub fn migrate_captures(old: &Path, new: &Path) -> KResult<()> {
    let Ok(items) = std::fs::read_dir(old) else {
        return Ok(());
    };
    std::fs::create_dir_all(new).map_err(io_error)?;
    for item in items.flatten() {
        let target = new.join(item.file_name());
        if !target.exists() {
            std::fs::rename(item.path(), &target).map_err(io_error)?;
        }
    }
    Ok(())
}

/// Removes a capture from the history: its entry and its folder, never a file it was saved to.
pub fn delete_entry(dir: &Path, index: &mut Index, id: &str) -> bool {
    if ulid::Ulid::from_string(id).is_err() || !index.remove(id) {
        return false;
    }
    if let Err(e) = std::fs::remove_dir_all(dir.join(id)) {
        log::warn!("cannot remove history folder {id}: {e}");
    }
    true
}

/// The capture was saved to `path` (the last save wins).
pub fn apply_saved(index: &mut Index, id: &str, path: &str) -> bool {
    index.update(id, |e| e.saved_path = Some(path.to_string()))
}

/// Where a capture came from, for its entry.
pub fn source(kind: SourceKind, meta: &CaptureMeta) -> Source {
    Source {
        kind,
        window_title: meta.window_title.clone(),
    }
}

/// Runs `f` on the index, saves it and tells the main window.
fn change(app: &tauri::AppHandle, f: impl FnOnce(&Path, &mut Index) -> bool) {
    let state = app.state::<HistoryState>();
    let changed = {
        let mut index = state.index.lock().unwrap();
        let changed = f(&state.dir, &mut index);
        if changed && let Err(e) = index.save(&state.dir) {
            log::warn!("{e}");
        }
        changed
    };
    if changed && let Err(e) = HistoryChanged.emit(app) {
        log::warn!("cannot emit history-changed: {e}");
    }
}

/// Adds a fresh capture: its entry now, its files on a worker thread.
pub fn record(
    app: &tauri::AppHandle,
    id: &str,
    img: &RgbaImage,
    meta: &CaptureMeta,
    source: Source,
) {
    let (w, h) = img.dimensions();
    let entry = HistoryEntry {
        id: id.to_string(),
        created_at: meta.taken_at.to_rfc3339(),
        size: ImageSize { w, h },
        source,
        saved_path: None,
        copied: false,
        annotated: false,
        bytes: 0.0,
    };
    change(app, |_, index| {
        index.upsert(entry);
        true
    });
    let (app, id, img) = (app.clone(), id.to_string(), img.clone());
    std::thread::spawn(move || {
        let dir = app.state::<HistoryState>().dir.clone();
        let written = crate::output::encode_png(&img).and_then(|png| {
            let thumb = index::thumbnail(&img)?;
            index::write_capture(&dir, &id, &png, &thumb)
        });
        match written {
            Ok(bytes) => change(&app, |_, index| {
                index.update(&id, |e| e.bytes = bytes as f64)
            }),
            Err(e) => log::warn!("cannot keep capture {id} in the history: {e}"),
        }
    });
}

pub fn mark_saved(app: &tauri::AppHandle, id: &str, path: &Path) {
    let path = path.to_string_lossy().into_owned();
    change(app, |_, index| apply_saved(index, id, &path));
}

pub fn mark_copied(app: &tauri::AppHandle, id: &str) {
    change(app, |_, index| index.update(id, |e| e.copied = true));
}

/// The editor exported an annotated image: it is kept as `final.png`.
pub fn mark_annotated(app: &tauri::AppHandle, id: &str, final_png: &[u8]) {
    let dir = app.state::<HistoryState>().dir.join(id);
    if let Err(e) = index::write_atomic(&dir, index::FINAL_FILE, final_png) {
        log::warn!("{e}");
    }
    let bytes = std::fs::read_dir(&dir)
        .map(|it| {
            it.flatten()
                .filter_map(|e| e.metadata().ok())
                .map(|m| m.len())
                .sum::<u64>()
        })
        .unwrap_or(0);
    change(app, |_, index| {
        index.update(id, |e| {
            e.annotated = true;
            e.bytes = bytes as f64;
        })
    });
}

pub fn delete(app: &tauri::AppHandle, id: &str) {
    change(app, |dir, index| delete_entry(dir, index, id));
}

pub fn clear(app: &tauri::AppHandle) {
    change(app, |dir, index| {
        let ids: Vec<String> = index.entries.iter().map(|e| e.id.clone()).collect();
        let mut any = false;
        for id in ids {
            any |= delete_entry(dir, index, &id);
        }
        any
    });
}

/// Drops the captures older than the retention (spec J3 § 4.2).
pub fn sweep(app: &tauri::AppHandle) {
    let days = app
        .state::<crate::settings::SettingsState>()
        .get()
        .history
        .retention_days;
    change(app, |dir, index| {
        let old = index.prune(chrono::Local::now(), days);
        for id in &old {
            if let Err(e) = std::fs::remove_dir_all(dir.join(id)) {
                log::warn!("cannot remove history folder {id}: {e}");
            }
        }
        !old.is_empty()
    });
}

pub fn entries(app: &tauri::AppHandle) -> Vec<HistoryEntry> {
    app.state::<HistoryState>()
        .index
        .lock()
        .unwrap()
        .entries
        .clone()
}

pub fn entry(app: &tauri::AppHandle, id: &str) -> KResult<HistoryEntry> {
    entries(app)
        .into_iter()
        .find(|e| e.id == id)
        .ok_or_else(|| {
            KirishotError::new(
                ErrorCode::NoActiveCapture,
                "Capture introuvable dans l'historique",
            )
        })
}

/// A file of capture `id` in the history (`original.png`, `final.png`…).
pub fn file(app: &tauri::AppHandle, id: &str, name: &str) -> KResult<PathBuf> {
    ulid::Ulid::from_string(id).map_err(|_| {
        KirishotError::new(
            ErrorCode::InvalidSelection,
            "Identifiant de capture invalide",
        )
    })?;
    Ok(app.state::<HistoryState>().dir.join(id).join(name))
}

#[cfg(test)]
mod tests {
    use super::index::*;
    use super::*;

    fn png() -> Vec<u8> {
        crate::output::encode_png(&image::RgbaImage::new(4, 3)).unwrap()
    }

    fn id() -> String {
        ulid::Ulid::generate().to_string()
    }

    #[test]
    fn migrate_moves_j2_capture_folders() {
        let root = tempfile::tempdir().unwrap();
        let (old, new) = (root.path().join("captures"), root.path().join("history"));
        let a = id();
        std::fs::create_dir_all(old.join(&a)).unwrap();
        std::fs::write(old.join(&a).join(ORIGINAL_FILE), png()).unwrap();
        std::fs::write(old.join(&a).join(DOCUMENT_FILE), b"{}").unwrap();
        migrate_captures(&old, &new).unwrap();
        assert!(new.join(&a).join(ORIGINAL_FILE).exists());
        assert!(new.join(&a).join(DOCUMENT_FILE).exists());
        assert!(!old.join(&a).exists());
        // A second run, with nothing left to move, is harmless.
        migrate_captures(&old, &new).unwrap();
    }

    #[test]
    fn deleting_an_entry_keeps_the_saved_file() {
        let root = tempfile::tempdir().unwrap();
        let saved = root.path().join("Kirishot.png");
        std::fs::write(&saved, b"png").unwrap();
        let dir = root.path().join("history");
        let a = id();
        write_capture(&dir, &a, &png(), b"jpg").unwrap();
        let mut index = Index::rebuild(&dir);
        apply_saved(&mut index, &a, &saved.to_string_lossy());
        assert!(delete_entry(&dir, &mut index, &a));
        assert!(!dir.join(&a).exists());
        assert!(index.entries.is_empty());
        assert!(saved.exists());
        assert!(!delete_entry(&dir, &mut index, &a));
    }

    #[test]
    fn mark_saved_updates_path_and_keeps_copied() {
        let dir = tempfile::tempdir().unwrap();
        let a = id();
        write_capture(dir.path(), &a, &png(), b"jpg").unwrap();
        let mut index = Index::rebuild(dir.path());
        index.update(&a, |e| e.copied = true);
        assert!(apply_saved(&mut index, &a, r"C:\x\a.png"));
        assert!(apply_saved(&mut index, &a, r"C:\x\b.png"));
        assert_eq!(index.entries[0].saved_path.as_deref(), Some(r"C:\x\b.png"));
        assert!(index.entries[0].copied);
        assert!(!apply_saved(&mut index, "zz", "p"));
    }
}
