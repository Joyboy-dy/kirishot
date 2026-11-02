//! Reading, repairing and atomically writing `settings.json`.
use std::path::Path;

use serde_json::Value;

use crate::error::{ErrorCode, KResult, KirishotError};
use crate::settings::model::{DEFAULT_NAME_TEMPLATE, Settings};

pub struct Loaded {
    pub settings: Settings,
    pub warnings: Vec<String>,
    /// The file was not valid JSON: it was kept as `settings.bak.json` and defaults were loaded.
    pub reset_from_corrupt: bool,
}

pub fn load(path: &Path) -> Loaded {
    let mut loaded = Loaded {
        settings: Settings::default(),
        warnings: Vec::new(),
        reset_from_corrupt: false,
    };
    if !path.exists() {
        write_or_warn(path, &loaded.settings, &mut loaded.warnings);
        return loaded;
    }
    let text = match std::fs::read_to_string(path) {
        Ok(text) => text,
        Err(e) => {
            loaded
                .warnings
                .push(format!("cannot read {}: {e}", path.display()));
            return loaded;
        }
    };
    match serde_json::from_str::<Value>(&text) {
        Err(_) => {
            let backup = path.with_file_name("settings.bak.json");
            if let Err(e) = std::fs::rename(path, &backup) {
                loaded
                    .warnings
                    .push(format!("cannot back up corrupt settings: {e}"));
            }
            loaded.reset_from_corrupt = true;
            write_or_warn(path, &loaded.settings, &mut loaded.warnings);
        }
        Ok(value) => {
            let (settings, warnings) = repair(value);
            loaded.settings = settings;
            loaded.warnings = warnings;
            if !loaded.warnings.is_empty() {
                write_or_warn(path, &loaded.settings, &mut loaded.warnings);
            }
        }
    }
    loaded
}

fn write_or_warn(path: &Path, s: &Settings, warnings: &mut Vec<String>) {
    if let Err(e) = save(path, s) {
        warnings.push(e.message);
    }
}

/// Writes a temporary file next to `path`, then renames it over `path`.
pub fn save(path: &Path, s: &Settings) -> KResult<()> {
    let err = |e: std::io::Error| {
        KirishotError::new(
            ErrorCode::Settings,
            format!("Impossible d'enregistrer les réglages : {e}"),
        )
    };
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(err)?;
    }
    let tmp = path.with_extension("json.tmp");
    let json = serde_json::to_string_pretty(s).expect("settings always serialize");
    std::fs::write(&tmp, json).map_err(err)?;
    std::fs::rename(&tmp, path).map_err(err)
}

/// Rebuilds settings from a file's JSON, leaf by leaf: a missing or invalid value falls back to
/// its default and adds a warning; the deserializer itself decides what "valid" means.
pub fn repair(file: Value) -> (Settings, Vec<String>) {
    let defaults = serde_json::to_value(Settings::default()).expect("settings always serialize");
    let mut merged = defaults.clone();
    let mut warnings = Vec::new();
    let mut leaves = Vec::new();
    collect_leaves(&file, &mut Vec::new(), &mut leaves);
    for (path, value) in leaves {
        let key = path.join(".");
        if pointer(&defaults, &path).is_none() {
            warnings.push(format!("unknown key {key}"));
            continue;
        }
        let mut candidate = merged.clone();
        set_pointer(&mut candidate, &path, value);
        if serde_json::from_value::<Settings>(candidate.clone()).is_ok() {
            merged = candidate;
        } else {
            warnings.push(format!("invalid value for {key}"));
        }
    }
    let settings = serde_json::from_value(merged).expect("defaults with valid leaves");
    let (settings, more) = validate(settings);
    warnings.extend(more);
    (settings, warnings)
}

fn collect_leaves(value: &Value, path: &mut Vec<String>, out: &mut Vec<(Vec<String>, Value)>) {
    match value {
        Value::Object(map) => {
            for (key, child) in map {
                path.push(key.clone());
                collect_leaves(child, path, out);
                path.pop();
            }
        }
        leaf => out.push((path.clone(), leaf.clone())),
    }
}

fn pointer<'a>(value: &'a Value, path: &[String]) -> Option<&'a Value> {
    path.iter()
        .try_fold(value, |node, key| node.as_object()?.get(key))
}

fn set_pointer(value: &mut Value, path: &[String], leaf: Value) {
    let Some((last, parents)) = path.split_last() else {
        *value = leaf;
        return;
    };
    let mut node = value;
    for key in parents {
        match node.as_object_mut().and_then(|map| map.get_mut(key)) {
            Some(child) => node = child,
            None => return,
        }
    }
    if let Some(map) = node.as_object_mut() {
        map.insert(last.clone(), leaf);
    }
}

/// Resets values the type system accepts but the spec does not (§ 7.1), one warning each.
pub fn validate(mut s: Settings) -> (Settings, Vec<String>) {
    let mut warnings = Vec::new();
    let defaults = Settings::default();
    let reset = |name: &str, shown: String, warnings: &mut Vec<String>| {
        warnings.push(format!(
            "invalid value for {name} ({shown}), reset to default"
        ));
    };
    if s.version != 1 {
        reset("version", s.version.to_string(), &mut warnings);
        s.version = 1;
    }
    if !matches!(s.after_capture.thumbnail_seconds, None | Some(3 | 6 | 10)) {
        reset(
            "afterCapture.thumbnailSeconds",
            format!("{:?}", s.after_capture.thumbnail_seconds),
            &mut warnings,
        );
        s.after_capture.thumbnail_seconds = defaults.after_capture.thumbnail_seconds;
    }
    if ![3, 5, 10].contains(&s.capture.tray_timer_seconds) {
        reset(
            "capture.trayTimerSeconds",
            s.capture.tray_timer_seconds.to_string(),
            &mut warnings,
        );
        s.capture.tray_timer_seconds = defaults.capture.tray_timer_seconds;
    }
    if !matches!(
        s.history.retention_days,
        None | Some(7) | Some(30) | Some(90)
    ) {
        reset(
            "history.retentionDays",
            format!("{:?}", s.history.retention_days),
            &mut warnings,
        );
        s.history.retention_days = defaults.history.retention_days;
    }
    let valid_hex = |c: &String| {
        c.len() == 7 && c.starts_with('#') && c[1..].chars().all(|ch| ch.is_ascii_hexdigit())
    };
    if s.editor.recent_colors.len() > 8 || !s.editor.recent_colors.iter().all(valid_hex) {
        reset(
            "editor.recentColors",
            format!("{:?}", s.editor.recent_colors),
            &mut warnings,
        );
        s.editor.recent_colors.retain(valid_hex);
        s.editor.recent_colors.truncate(8);
    }
    if s.save.counter == 0 {
        reset("save.counter", "0".into(), &mut warnings);
        s.save.counter = 1;
    }
    if s.save
        .folder
        .as_deref()
        .is_some_and(|f| f.trim().is_empty())
    {
        reset("save.folder", "\"\"".into(), &mut warnings);
        s.save.folder = None;
    }
    if s.save.name_template.trim().is_empty() {
        reset(
            "save.nameTemplate",
            format!("{:?}", s.save.name_template),
            &mut warnings,
        );
        s.save.name_template = DEFAULT_NAME_TEMPLATE.into();
    }
    (s, warnings)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::settings::model::{
        AutoAction, CaptureMode, ImageFormat, Settings, StartModeSetting, ToolbarPosition,
    };
    use serde_json::json;

    #[test]
    fn load_missing_file_creates_defaults() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        let loaded = load(&path);
        assert_eq!(loaded.settings, Settings::default());
        assert!(path.exists());
        assert!(!loaded.reset_from_corrupt);
    }

    #[test]
    fn load_corrupt_file_backs_up_and_resets() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        std::fs::write(&path, "{ pas du json").unwrap();
        let loaded = load(&path);
        assert!(loaded.reset_from_corrupt);
        assert_eq!(
            std::fs::read_to_string(dir.path().join("settings.bak.json")).unwrap(),
            "{ pas du json"
        );
        assert_eq!(loaded.settings, Settings::default());
    }

    #[test]
    fn repair_replaces_invalid_leaf_and_keeps_valid_ones() {
        let (s, w) = repair(json!({
            "save": {"format": "gif", "nameTemplate": "Shot {n}"},
            "afterCapture": {"autoAction": "copy"}
        }));
        assert_eq!(s.save.format, ImageFormat::Png);
        assert_eq!(s.save.name_template, "Shot {n}");
        assert_eq!(s.after_capture.auto_action, AutoAction::Copy);
        assert!(w.iter().any(|m| m.contains("save.format")));
    }

    #[test]
    fn repair_warns_on_unknown_keys() {
        let (_, w) = repair(json!({"zoom": 3}));
        assert!(w.iter().any(|m| m.contains("zoom")));
    }

    #[test]
    fn validate_resets_out_of_range_values() {
        let mut s = Settings::default();
        s.after_capture.thumbnail_seconds = Some(7);
        s.capture.tray_timer_seconds = 4;
        s.history.retention_days = Some(15);
        s.save.counter = 0;
        s.save.folder = Some(String::new());
        s.save.name_template = "   ".into();
        let (s, w) = validate(s);
        assert_eq!(
            (
                s.after_capture.thumbnail_seconds,
                s.capture.tray_timer_seconds
            ),
            (Some(6), 3)
        );
        assert_eq!(s.history.retention_days, Some(30));
        assert_eq!(s.save.counter, 1);
        assert_eq!(s.save.folder, None);
        assert_eq!(s.save.name_template, "Kirishot {date} à {heure}");
        assert_eq!(w.len(), 6);
    }

    #[test]
    fn j1_file_gains_j2_fields() {
        let file = json!({
            "version": 1,
            "afterCapture": {"autoAction": "copy", "thumbnailSeconds": 5},
            "capture": {"sound": false}
        });
        let (s, _) = repair(file);
        let (s, _) = validate(s);
        assert_eq!(s.after_capture.auto_action, AutoAction::Copy);
        assert_eq!(s.after_capture.thumbnail_seconds, Some(6));
        assert!(!s.capture.sound);
        assert!(s.capture.magnifier && s.capture.flash && s.after_capture.thumbnail);
    }

    #[test]
    fn j2_file_gets_capture_defaults() {
        let file = json!({
            "version": 1,
            "capture": {"magnifier": false, "sound": false, "flash": true, "includeCursor": false,
                        "trayTimerSeconds": 3, "commitOnRelease": true}
        });
        let (s, _) = repair(file);
        let (s, _) = validate(s);
        assert_eq!(s.capture.mode, CaptureMode::Region);
        assert_eq!(s.capture.toolbar_position, ToolbarPosition::Top);
        assert!(!s.capture.magnifier && !s.capture.sound && s.capture.commit_on_release);

        let (s, _) = repair(json!({"version": 1, "capture": {"mode": "zone"}}));
        assert_eq!(s.capture.mode, CaptureMode::Region);
    }

    #[test]
    fn recent_colors_are_kept_valid() {
        let mut s = Settings::default();
        s.editor.recent_colors = (0..9)
            .map(|i| format!("#00000{i}"))
            .chain(["red".to_string()])
            .collect();
        s.editor.recent_colors.insert(0, "red".into());
        let (s, w) = validate(s);
        assert_eq!(s.editor.recent_colors.len(), 8);
        assert!(
            s.editor
                .recent_colors
                .iter()
                .all(|c| c.starts_with('#') && c.len() == 7)
        );
        assert_eq!(s.editor.recent_colors[0], "#000000");
        assert!(w.iter().any(|m| m.contains("editor.recentColors")));
    }

    #[test]
    fn retention_accepts_7_30_90_or_null() {
        for v in [None, Some(7), Some(30), Some(90)] {
            let mut s = Settings::default();
            s.history.retention_days = v;
            assert_eq!(validate(s).0.history.retention_days, v);
        }
        let mut s = Settings::default();
        s.history.retention_days = Some(45);
        assert_eq!(validate(s).0.history.retention_days, Some(30));
    }

    #[test]
    fn j3_fields_default_in_old_files() {
        let (s, _) = repair(json!({"version": 1, "capture": {"mode": "window"}}));
        assert_eq!(s.capture.start_mode, StartModeSetting::Region);
        assert!(s.editor.confirm_close && s.editor.recent_colors.is_empty());
    }

    #[test]
    fn thumbnail_seconds_accepts_null_and_3_6_10() {
        for v in [None, Some(3), Some(6), Some(10)] {
            let mut s = Settings::default();
            s.after_capture.thumbnail_seconds = v;
            assert_eq!(validate(s).0.after_capture.thumbnail_seconds, v);
        }
    }

    #[test]
    fn null_thumbnail_seconds_survives_repair() {
        let (s, w) = repair(json!({"afterCapture": {"thumbnailSeconds": null}}));
        assert_eq!(s.after_capture.thumbnail_seconds, None);
        assert!(w.is_empty(), "{w:?}");
    }

    #[test]
    fn save_is_atomic() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        save(&path, &Settings::default()).unwrap();
        let back: Settings =
            serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(back, Settings::default());
        let leftovers: Vec<_> = std::fs::read_dir(dir.path())
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().ends_with(".tmp"))
            .collect();
        assert!(leftovers.is_empty());
    }
}
