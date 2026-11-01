mod capture;
mod commands;
mod error;
mod frame;
mod geometry;
mod logging;
mod messages;
mod notify;
mod paths;
mod settings;
mod store;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = commands::specta_builder();
    #[cfg(debug_assertions)]
    commands::export_bindings(&builder);

    tauri::Builder::default()
        // Must stay the first plugin so a second launch is caught before anything else starts.
        .plugin(tauri_plugin_single_instance::init(|_app, _argv, _cwd| {
            log::info!("second instance launched");
        }))
        .plugin(logging::plugin())
        .plugin(tauri_plugin_notification::init())
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
            app.manage(settings::SettingsState::new(
                paths::settings_file(),
                loaded.settings,
            ));
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
