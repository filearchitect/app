#[cfg(all(target_os = "macos", setapp_build, setapp_local_test))]
use serde::Deserialize;
use serde::Serialize;
#[cfg(all(target_os = "macos", setapp_build, setapp_local_test))]
use std::{fs, path::PathBuf};

#[derive(Clone, Debug, Serialize)]
pub struct SetappStatus {
    pub enabled: bool,
    pub available: bool,
    pub active: bool,
    pub source: &'static str,
    pub purchase_type: Option<&'static str>,
    pub expiration_date: Option<String>,
}

#[cfg(all(target_os = "macos", setapp_build, setapp_local_test))]
#[derive(Debug, Deserialize)]
struct OverrideSettings {
    setapp: Option<SetappOverrideSettings>,
}

#[cfg(all(target_os = "macos", setapp_build, setapp_local_test))]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SetappOverrideSettings {
    enabled: Option<bool>,
    available: Option<bool>,
    active: Option<bool>,
    purchase_type: Option<String>,
    expiration_date: Option<String>,
}

#[cfg(all(target_os = "macos", setapp_build, setapp_local_test))]
impl SetappOverrideSettings {
    fn into_status(self) -> SetappStatus {
        SetappStatus {
            enabled: self.enabled.unwrap_or(true),
            available: self.available.unwrap_or(true),
            active: self.active.unwrap_or(true),
            source: "setapp",
            purchase_type: match self.purchase_type.as_deref() {
                Some("membership") => Some("membership"),
                Some("single_app") => Some("single_app"),
                _ => None,
            },
            expiration_date: self.expiration_date,
        }
    }
}

#[cfg(all(target_os = "macos", setapp_build, setapp_local_test))]
fn override_file_paths() -> Option<[PathBuf; 2]> {
    std::env::var_os("HOME").map(|home| {
        let home = PathBuf::from(home);
        [home.join("fa.json"), home.join("Documents/fa.json")]
    })
}

#[cfg(all(target_os = "macos", setapp_build, setapp_local_test))]
fn local_override_status() -> Option<SetappStatus> {
    let paths = override_file_paths()?;

    for path in paths {
        let Ok(content) = fs::read_to_string(path) else {
            continue;
        };
        let Ok(settings) = serde_json::from_str::<OverrideSettings>(&content) else {
            continue;
        };

        if let Some(setapp) = settings.setapp {
            return Some(setapp.into_status());
        }
    }

    None
}

#[tauri::command]
pub fn get_setapp_status() -> SetappStatus {
    platform::get_status()
}

#[tauri::command]
pub fn get_setapp_purchase_type() -> Option<String> {
    platform::get_purchase_type()
}

#[tauri::command]
pub fn show_setapp_release_notes() -> Result<(), String> {
    platform::show_release_notes()
}

#[tauri::command]
pub fn show_setapp_release_notes_if_needed() -> Result<(), String> {
    platform::show_release_notes_if_needed()
}

#[cfg(all(target_os = "macos", setapp_build))]
pub fn report_usage() {
    platform::report_usage();
}

#[cfg(all(target_os = "macos", setapp_build, not(setapp_local_test)))]
mod platform {
    use super::SetappStatus;

    unsafe extern "C" {
        fn filearchitect_setapp_is_available() -> bool;
        fn filearchitect_setapp_is_active() -> bool;
        fn filearchitect_setapp_purchase_type() -> i32;
        fn filearchitect_setapp_expiration_timestamp() -> i64;
        fn filearchitect_setapp_show_release_notes_if_needed() -> bool;
        fn filearchitect_setapp_show_release_notes() -> bool;
        fn filearchitect_setapp_report_usage_event(usage_event: i32) -> bool;
    }

    pub fn get_status() -> SetappStatus {
        let available = unsafe { filearchitect_setapp_is_available() };
        let active = if available {
            unsafe { filearchitect_setapp_is_active() }
        } else {
            false
        };
        let expiration_date = match unsafe { filearchitect_setapp_expiration_timestamp() } {
            timestamp if timestamp > 0 => chrono::DateTime::from_timestamp(timestamp, 0)
                .map(|date| date.to_rfc3339()),
            _ => None,
        };

        SetappStatus {
            enabled: true,
            available,
            active,
            source: "setapp",
            purchase_type: match unsafe { filearchitect_setapp_purchase_type() } {
                1 => Some("membership"),
                2 => Some("single_app"),
                _ => None,
            },
            expiration_date,
        }
    }

    pub fn get_purchase_type() -> Option<String> {
        match unsafe { filearchitect_setapp_purchase_type() } {
            1 => Some("membership".to_string()),
            2 => Some("single_app".to_string()),
            _ => None,
        }
    }

    pub fn show_release_notes() -> Result<(), String> {
        if unsafe { filearchitect_setapp_show_release_notes() } {
            Ok(())
        } else {
            Err("Setapp release notes are unavailable".to_string())
        }
    }

    pub fn show_release_notes_if_needed() -> Result<(), String> {
        if unsafe { filearchitect_setapp_show_release_notes_if_needed() } {
            Ok(())
        } else {
            Err("Setapp release notes are unavailable".to_string())
        }
    }

    pub fn report_usage() {
        let _ = unsafe { filearchitect_setapp_report_usage_event(2) };
    }
}

#[cfg(any(
    not(all(target_os = "macos", setapp_build)),
    all(target_os = "macos", setapp_build, setapp_local_test)
))]
mod platform {
    use super::SetappStatus;

    pub fn get_status() -> SetappStatus {
        #[cfg(all(target_os = "macos", setapp_build, setapp_local_test))]
        if let Some(status) = super::local_override_status() {
            return status;
        }

        SetappStatus {
            enabled: cfg!(all(target_os = "macos", setapp_build, setapp_local_test)),
            available: false,
            active: false,
            source: if cfg!(all(target_os = "macos", setapp_build, setapp_local_test)) {
                "setapp"
            } else {
                "direct"
            },
            purchase_type: None,
            expiration_date: None,
        }
    }

    pub fn get_purchase_type() -> Option<String> {
        None
    }

    pub fn show_release_notes() -> Result<(), String> {
        Err("Setapp release notes are unavailable for this build".to_string())
    }

    pub fn show_release_notes_if_needed() -> Result<(), String> {
        Err("Setapp release notes are unavailable for this build".to_string())
    }

    #[cfg(all(target_os = "macos", setapp_build, setapp_local_test))]
    pub fn report_usage() {}
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn non_setapp_build_defaults_to_disabled_status() {
        let status = get_setapp_status();

        #[cfg(not(all(target_os = "macos", setapp_build)))]
        {
            assert!(!status.enabled);
            assert!(!status.available);
            assert!(!status.active);
            assert_eq!(status.source, "direct");
        }
    }
}
