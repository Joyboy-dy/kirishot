fn main() {
    // tauri-build only embeds its manifest in the app binary. Test binaries then lack Common
    // Controls v6 and fail to start with STATUS_ENTRYPOINT_NOT_FOUND, so the same manifest is
    // embedded by the linker in every binary instead.
    let windows = tauri_build::WindowsAttributes::new_without_app_manifest();
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .windows_attributes(windows)
            // App commands must be listed here so each window's capability can allow them one by one.
            .app_manifest(tauri_build::AppManifest::new().commands(&[
                "app_info",
                "settings_get",
                "settings_update",
                "open_save_folder",
                "overlay_loaded",
                "overlay_ready",
                "overlay_claim",
                "overlay_commit",
                "overlay_cancel",
                "copy_text",
                "thumbnails_ready",
                "thumbnails_layout",
                "thumbnail_expire",
                "thumbnail_copy",
                "thumbnail_save",
                "thumbnail_edit",
                "thumbnail_close",
                "thumbnail_delete",
                "thumbnail_reveal",
                "thumbnail_copy_path",
                "editor_loaded",
                "editor_close",
            ])),
    )
    .expect("failed to run tauri-build");

    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        let manifest = std::path::Path::new(&std::env::var("CARGO_MANIFEST_DIR").unwrap())
            .join("windows-app-manifest.xml");
        println!("cargo:rerun-if-changed=windows-app-manifest.xml");
        println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
        println!("cargo:rustc-link-arg=/MANIFESTINPUT:{}", manifest.display());
    }
}
