use std::path::{Path, PathBuf};

const BIN_NAME: &str = "filearchitect-app";

fn resolve_setapp_sdk_dir() -> PathBuf {
    if let Ok(path) = std::env::var("SETAPP_SDK_DIR") {
        return PathBuf::from(path);
    }

    Path::new(".setapp-sdk")
        .join("macos-arm64_x86_64")
}

fn resolve_developer_dir() -> PathBuf {
    if let Ok(path) = std::env::var("DEVELOPER_DIR") {
        return PathBuf::from(path);
    }

    PathBuf::from("/Applications/Xcode.app/Contents/Developer")
}

fn main() {
    tauri_build::build();

    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=src/setapp_bridge.mm");
    println!("cargo:rerun-if-env-changed=VITE_IS_SETAPP");
    println!("cargo:rerun-if-env-changed=SETAPP_LOCAL_TEST");
    println!("cargo:rerun-if-env-changed=SETAPP_SDK_DIR");
    println!("cargo:rustc-check-cfg=cfg(setapp_build)");
    println!("cargo:rustc-check-cfg=cfg(setapp_local_test)");
    println!("cargo:rustc-env=TAURI_BUNDLE_MACOS_INFO_PLIST_URL_SCHEMES=filearchitect");

    let is_setapp_build = std::env::var("VITE_IS_SETAPP").as_deref() == Ok("true");
    let is_setapp_local_test =
        std::env::var("SETAPP_LOCAL_TEST").as_deref() == Ok("true");
    if is_setapp_build {
        println!("cargo:rustc-cfg=setapp_build");
    }
    if is_setapp_local_test {
        println!("cargo:rustc-cfg=setapp_local_test");
    }

    if is_setapp_build
        && !is_setapp_local_test
        && std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos")
    {
        let sdk_dir = resolve_setapp_sdk_dir();
        let lib_path = sdk_dir.join("libSetapp.a");
        let headers_path = sdk_dir.join("Headers");
        let developer_dir = resolve_developer_dir();
        let swift_lib_dir = developer_dir
            .join("Toolchains")
            .join("XcodeDefault.xctoolchain")
            .join("usr")
            .join("lib")
            .join("swift")
            .join("macosx");
        let sdk_swift_lib_dir = developer_dir
            .join("Platforms")
            .join("MacOSX.platform")
            .join("Developer")
            .join("SDKs")
            .join("MacOSX.sdk")
            .join("usr")
            .join("lib")
            .join("swift");

        if !lib_path.exists() {
            panic!(
                "Missing Setapp SDK static library at {}. Set SETAPP_SDK_DIR or stage the SDK under src-tauri/.setapp-sdk/macos-arm64_x86_64.",
                lib_path.display()
            );
        }

        if !headers_path.exists() {
            panic!(
                "Missing Setapp SDK headers at {}. Set SETAPP_SDK_DIR or stage the SDK under src-tauri/.setapp-sdk/macos-arm64_x86_64.",
                headers_path.display()
            );
        }

        if !swift_lib_dir.exists() {
            panic!(
                "Missing Swift runtime library directory at {}.",
                swift_lib_dir.display()
            );
        }

        cc::Build::new()
            .file("src/setapp_bridge.mm")
            .include(&headers_path)
            .flag("-fobjc-arc")
            .cargo_metadata(false)
            .compile("setapp_bridge");

        let out_dir = PathBuf::from(std::env::var("OUT_DIR").expect("OUT_DIR must be set"));
        let bridge_lib_path = out_dir.join("libsetapp_bridge.a");

        if !bridge_lib_path.exists() {
            panic!(
                "Missing compiled Setapp bridge archive at {}.",
                bridge_lib_path.display()
            );
        }

        emit_bin_link_arg(format!("-L{}", swift_lib_dir.display()));
        emit_bin_link_arg(format!("-L{}", sdk_swift_lib_dir.display()));
        emit_bin_link_arg("-framework".to_string());
        emit_bin_link_arg("AppKit".to_string());
        emit_bin_link_arg("-framework".to_string());
        emit_bin_link_arg("Foundation".to_string());
        emit_bin_link_arg("-framework".to_string());
        emit_bin_link_arg("Security".to_string());
        emit_bin_link_arg("-framework".to_string());
        emit_bin_link_arg("ServiceManagement".to_string());
        emit_bin_link_arg("-framework".to_string());
        emit_bin_link_arg("StoreKit".to_string());
        emit_bin_link_arg("-framework".to_string());
        emit_bin_link_arg("SystemConfiguration".to_string());
        emit_bin_link_arg("-Wl,-rpath,/usr/lib/swift".to_string());
        emit_bin_link_arg(format!(
            "-Wl,-force_load,{}",
            bridge_lib_path.display()
        ));
        emit_bin_link_arg(format!(
            "-Wl,-force_load,{}",
            swift_lib_dir.join("libswiftCompatibilityConcurrency.a").display()
        ));
        emit_bin_link_arg(format!(
            "-Wl,-force_load,{}",
            swift_lib_dir.join("libswiftCompatibility56.a").display()
        ));
        emit_bin_link_arg(
            swift_lib_dir
                .join("libswiftCompatibilityPacks.a")
                .display()
                .to_string(),
        );
        emit_bin_link_arg(format!("-Wl,-force_load,{}", lib_path.display()));
    }
}

fn emit_bin_link_arg(arg: String) {
    println!("cargo:rustc-link-arg-bin={}={}", BIN_NAME, arg);
}
