mod capture;
mod commands;
mod error;
mod flow;
mod frame;
mod geometry;
mod hotkeys;
mod logging;
mod messages;
mod notify;
mod output;
mod paths;
mod settings;
mod sound;
mod store;
mod tray;
mod windowing;

use tauri::Manager;

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
        .manage(store::CaptureStore::default())
        .manage(flow::FlowState::default())
        .manage(windowing::OverlaySet::default())
        .invoke_handler(builder.invoke_handler())
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
            let shortcuts = loaded.settings.shortcuts.clone();
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
            hotkeys::register_all(app.handle(), &shortcuts);
            if let Err(e) = tray::build(app.handle()) {
                log::error!("{e}");
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
