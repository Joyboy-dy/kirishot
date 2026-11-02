//! How Kirishot was launched, and its registration to start with Windows (spec J3 § 2.1, § 2.2).

/// The argument Windows passes when it starts Kirishot at logon.
pub const AUTOSTART_ARG: &str = "--autostart";

/// `true` when the user launched Kirishot (installer, Start menu, double-click): the main window
/// opens. At logon (`--autostart`) it stays in the tray.
pub fn launched_by_user(args: &[String]) -> bool {
    !args.iter().any(|a| a == AUTOSTART_ARG)
}

/// Registers or removes Kirishot from the programs Windows starts at logon.
pub fn apply_autostart(app: &tauri::AppHandle, on: bool) -> crate::error::KResult<()> {
    use tauri_plugin_autostart::ManagerExt;
    let manager = app.autolaunch();
    let result = if on {
        manager.enable()
    } else {
        manager.disable()
    };
    result.map_err(|e| {
        crate::error::KirishotError::new(
            crate::error::ErrorCode::Settings,
            format!("Lancement au démarrage impossible à modifier : {e}"),
        )
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_plain_launch_is_the_user() {
        assert!(launched_by_user(&["kirishot.exe".into()]));
        assert!(launched_by_user(&[]));
    }

    #[test]
    fn a_logon_launch_is_not() {
        assert!(!launched_by_user(&[
            "kirishot.exe".into(),
            AUTOSTART_ARG.into()
        ]));
    }
}
