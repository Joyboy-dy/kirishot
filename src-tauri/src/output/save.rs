use std::path::{Path, PathBuf};

use crate::error::{ErrorCode, KResult, KirishotError};
use crate::output::filename::unique_path;

pub struct SavedFile {
    pub path: PathBuf,
    pub used_fallback: bool,
}

/// Saves into `preferred`, or into `fallback` when `preferred` cannot be written (deleted
/// folder, unplugged drive, no rights). The file never overwrites an existing one.
pub fn save_bytes(
    bytes: &[u8],
    preferred: &Path,
    fallback: &Path,
    stem: &str,
    ext: &str,
) -> KResult<SavedFile> {
    match write_into(bytes, preferred, stem, ext) {
        Ok(path) => Ok(SavedFile {
            path,
            used_fallback: false,
        }),
        Err(first) => {
            log::warn!("cannot save into {}: {first}", preferred.display());
            let path = write_into(bytes, fallback, stem, ext).map_err(|e| {
                KirishotError::new(
                    ErrorCode::Save,
                    format!("Impossible d'enregistrer la capture : {e}"),
                )
            })?;
            Ok(SavedFile {
                path,
                used_fallback: true,
            })
        }
    }
}

/// Writes a hidden temporary file, then renames it, so a failed write never leaves a broken image.
fn write_into(bytes: &[u8], dir: &Path, stem: &str, ext: &str) -> std::io::Result<PathBuf> {
    std::fs::create_dir_all(dir)?;
    let path = unique_path(dir, stem, ext, Path::exists);
    let file_name = path.file_name().unwrap_or_default().to_string_lossy();
    let tmp = dir.join(format!(".{file_name}.kirishot-tmp"));
    let written = std::fs::write(&tmp, bytes).and_then(|_| std::fs::rename(&tmp, &path));
    if let Err(e) = written {
        let _ = std::fs::remove_file(&tmp);
        return Err(e);
    }
    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn saves_into_preferred_folder() {
        let dir = tempfile::tempdir().unwrap();
        let pref = dir.path().join("pref");
        let fb = dir.path().join("fallback");
        let saved = save_bytes(b"x", &pref, &fb, "Shot", "png").unwrap();
        assert_eq!(saved.path, pref.join("Shot.png"));
        assert!(!saved.used_fallback);
        assert_eq!(std::fs::read(&saved.path).unwrap(), b"x");
    }

    #[test]
    fn falls_back_when_preferred_is_unreachable() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("fichier.txt");
        std::fs::write(&file, "pas un dossier").unwrap();
        let pref = file.join("sous-dossier");
        let fb = dir.path().join("fallback");
        let saved = save_bytes(b"x", &pref, &fb, "Shot", "png").unwrap();
        assert_eq!(saved.path, fb.join("Shot.png"));
        assert!(saved.used_fallback);
    }

    #[test]
    fn adds_suffix_on_collision_and_leaves_no_temp_file() {
        let dir = tempfile::tempdir().unwrap();
        let pref = dir.path().join("pref");
        let fb = dir.path().join("fallback");
        let first = save_bytes(b"1", &pref, &fb, "Shot", "png").unwrap();
        let second = save_bytes(b"2", &pref, &fb, "Shot", "png").unwrap();
        assert_eq!(first.path, pref.join("Shot.png"));
        assert_eq!(second.path, pref.join("Shot (2).png"));
        let leftovers: Vec<_> = std::fs::read_dir(&pref)
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().ends_with(".kirishot-tmp"))
            .collect();
        assert!(leftovers.is_empty());
    }
}
