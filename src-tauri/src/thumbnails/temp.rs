//! The PNG files a thumbnail shows and drags, in `%TEMP%\Kirishot`.
use std::io;
use std::path::{Path, PathBuf};

pub fn write_png(dir: &Path, id: &str, png: &[u8]) -> io::Result<PathBuf> {
    std::fs::create_dir_all(dir)?;
    let path = dir.join(format!("{id}.png"));
    std::fs::write(&path, png)?;
    Ok(path)
}

/// Removes the PNG files left by a previous run; other files stay.
pub fn clear(dir: &Path) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path
            .extension()
            .is_some_and(|e| e.eq_ignore_ascii_case("png"))
            && let Err(e) = std::fs::remove_file(&path)
        {
            log::warn!("cannot remove {}: {e}", path.display());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn write_png_creates_the_folder() {
        let dir = tempfile::tempdir().unwrap();
        let sub = dir.path().join("Kirishot");
        let path = write_png(&sub, "01JBX4", b"png").unwrap();
        assert_eq!(path, sub.join("01JBX4.png"));
        assert_eq!(std::fs::read(&path).unwrap(), b"png");
    }

    #[test]
    fn clear_removes_only_pngs() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("a.png"), "x").unwrap();
        std::fs::write(dir.path().join("keep.txt"), "x").unwrap();
        clear(dir.path());
        let left: Vec<_> = std::fs::read_dir(dir.path())
            .unwrap()
            .map(|e| e.unwrap().file_name().into_string().unwrap())
            .collect();
        assert_eq!(left, ["keep.txt"]);
    }

    #[test]
    fn clear_ignores_a_missing_folder() {
        clear(Path::new(r"Z:\nowhere\Kirishot"));
    }
}
