use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
pub struct SetappStatus {
    pub enabled: bool,
    pub available: bool,
    pub active: bool,
    pub source: &'static str,
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

#[cfg(all(target_os = "macos", setapp_build))]
pub fn show_release_notes_if_needed() -> Result<(), String> {
    platform::show_release_notes_if_needed()
}

#[cfg(all(target_os = "macos", setapp_build))]
mod platform {
    use super::SetappStatus;

    unsafe extern "C" {
        fn filearchitect_setapp_is_available() -> bool;
        fn filearchitect_setapp_is_active() -> bool;
        fn filearchitect_setapp_purchase_type() -> i32;
        fn filearchitect_setapp_show_release_notes_if_needed() -> bool;
        fn filearchitect_setapp_show_release_notes() -> bool;
    }

    pub fn get_status() -> SetappStatus {
        let available = unsafe { filearchitect_setapp_is_available() };
        let active = if available {
            unsafe { filearchitect_setapp_is_active() }
        } else {
            false
        };

        SetappStatus {
            enabled: true,
            available,
            active,
            source: "setapp",
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
}

#[cfg(not(all(target_os = "macos", setapp_build)))]
mod platform {
    use super::SetappStatus;

    pub fn get_status() -> SetappStatus {
        SetappStatus {
            enabled: false,
            available: false,
            active: false,
            source: "direct",
        }
    }

    pub fn get_purchase_type() -> Option<String> {
        None
    }

    pub fn show_release_notes() -> Result<(), String> {
        Err("Setapp release notes are unavailable for this build".to_string())
    }
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
