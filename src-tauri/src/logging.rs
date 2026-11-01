use tauri_plugin_log::{RotationStrategy, Target, TargetKind, TimezoneStrategy};

use crate::paths;

/// Log files in `%APPDATA%\Kirishot\logs`: at most 5 files of 2 MB each.
pub fn plugin() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    let mut builder = tauri_plugin_log::Builder::new()
        .clear_targets()
        .target(Target::new(TargetKind::Folder {
            path: paths::logs_dir(),
            file_name: Some("kirishot".into()),
        }))
        .max_file_size(2_000_000)
        .rotation_strategy(RotationStrategy::KeepSome(5))
        .timezone_strategy(TimezoneStrategy::UseLocal);
    if cfg!(debug_assertions) {
        builder = builder
            .target(Target::new(TargetKind::Stdout))
            .level(log::LevelFilter::Debug);
    } else {
        builder = builder.level(log::LevelFilter::Info);
    }
    builder.build()
}
