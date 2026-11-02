mod capture;
mod commands;
mod editor;
mod error;
mod flow;
mod frame;
mod geometry;
mod history;
mod hotkeys;
mod logging;
mod messages;
mod notify;
mod output;
mod paths;
mod settings;
mod shots;
mod sound;
mod startup;
mod store;
mod thumbnails;
mod tray;
mod windowing;

use tauri::Manager;

/// Commands that take a raw request body, which tauri-specta cannot type.
fn raw_commands(invoke: tauri::ipc::Invoke<tauri::Wry>) -> bool {
    let handler: &dyn Fn(tauri::ipc::Invoke<tauri::Wry>) -> bool =
        &tauri::generate_handler![commands::editor_export];
    handler(invoke)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = commands::specta_builder();
    #[cfg(debug_assertions)]
    commands::export_bindings(&builder);

    tauri::Builder::default()
        // Must stay the first plugin so a second launch is caught before anything else starts.
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Err(e) = windowing::open_main(app) {
                log::error!("cannot open the main window: {e}");
            }
        }))
        .plugin(logging::plugin())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_drag::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![startup::AUTOSTART_ARG]),
        ))
        .manage(store::CaptureStore::default())
        .manage(shots::ShotStore::default())
        .manage(thumbnails::ThumbState::default())
        .manage(editor::EditorState::default())
        .manage(flow::FlowState::default())
        .manage(windowing::OverlaySet::default())
        .invoke_handler({
            let typed = builder.invoke_handler();
            move |invoke: tauri::ipc::Invoke<tauri::Wry>| match invoke.message.command() {
                "editor_export" => raw_commands(invoke),
                _ => typed(invoke),
            }
        })
        .setup(move |app| {
            builder.mount_events(app);
            let loaded = settings::store::load(&paths::settings_file());
            for warning in &loaded.warnings {
                log::warn!("settings: {warning}");
            }
            if loaded.reset_from_corrupt {
                notify::show(
                    app.handle(),
                    messages::SETTINGS_RESET_TITLE,
                    messages::SETTINGS_RESET_BODY,
                );
            }
            // A drag that never ends would freeze every window (drag-rs#94): cancel it after 30 s.
            drag::set_stuck_drag_timeout(Some(std::time::Duration::from_secs(30)));
            // J2 kept editor originals in `captures\`: they join the history.
            if let Err(e) = history::migrate_captures(&paths::captures_dir(), &paths::history_dir())
            {
                log::warn!("{e}");
            }
            app.manage(history::HistoryState::open(paths::history_dir()));
            // Thumbnail files from a previous run are never shown again.
            thumbnails::temp::clear(&paths::temp_dir());
            let shortcuts = loaded.settings.shortcuts.clone();
            let launch_at_startup = loaded.settings.system.launch_at_startup;
            app.manage(settings::SettingsState::new(
                paths::settings_file(),
                loaded.settings,
            ));
            // Overlays are created ahead of time so the first capture is as fast as the next ones.
            match capture::list_monitors() {
                Ok(monitors) => {
                    if let Err(e) = windowing::ensure_overlays(app.handle(), &monitors) {
                        log::error!("cannot create overlays: {e}");
                    }
                }
                Err(e) => log::error!("cannot list monitors: {e}"),
            }
            if let Err(e) = thumbnails::window::create(app.handle()) {
                log::error!("{e}");
            }
            if let Err(e) = editor::create(app.handle()) {
                log::error!("{e}");
            }
            hotkeys::register_all(app.handle(), &shortcuts);
            // Captures older than the retention leave the history at start, then every 24 h.
            let sweeper = app.handle().clone();
            std::thread::spawn(move || {
                loop {
                    history::sweep(&sweeper);
                    std::thread::sleep(std::time::Duration::from_secs(24 * 60 * 60));
                }
            });
            if let Err(e) = tray::build(app.handle()) {
                log::error!("{e}");
            }
            // Dev builds never register their throwaway binary to start with Windows.
            if !cfg!(debug_assertions)
                && let Err(e) = startup::apply_autostart(app.handle(), launch_at_startup)
            {
                log::warn!("{e}");
            }
            // Launched by the user (not at logon): show the window, or nothing seems to happen.
            if startup::launched_by_user(&std::env::args().collect::<Vec<_>>())
                && let Err(e) = windowing::open_main(app.handle())
            {
                log::error!("cannot open the main window: {e}");
            }
            log::info!(
                "{} {} started",
                messages::APP_NAME,
                env!("CARGO_PKG_VERSION")
            );
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Kirishot")
        .run(|_app, event| {
            // Kirishot lives in the tray: closing the last window must not quit it.
            if let tauri::RunEvent::ExitRequested {
                code: None, api, ..
            } = event
            {
                api.prevent_exit();
            }
        });
}
