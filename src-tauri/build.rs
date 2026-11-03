fn main() {
    tauri_build::build();
    println!("cargo:rustc-env=TAURI_BUNDLE_MACOS_INFO_PLIST_URL_SCHEMES=filearchitect");
}
