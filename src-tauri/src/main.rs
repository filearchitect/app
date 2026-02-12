#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// -----------------
// Imports
// -----------------
use dirs;
use dotenv::dotenv;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io;
#[cfg(target_os = "macos")]
use std::num::NonZeroU32;
use std::path::{Path, PathBuf};
use tauri::{Runtime, Emitter};
#[cfg(target_os = "macos")]
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri_plugin_deep_link::DeepLinkExt;
use zip::ZipArchive;

#[cfg(target_os = "macos")]
use core_foundation::{
    base::TCFType,
    string::CFString,
};
#[cfg(target_os = "macos")]
use core_foundation_sys::base::kCFAllocatorDefault;
#[cfg(target_os = "macos")]
use io_kit_sys::{
    kIOMasterPortDefault, IOServiceMatching, IOServiceGetMatchingServices,
    IOIteratorNext, IOObjectRelease, IORegistryEntryCreateCFProperty
};

// -----------------
// Constants
// -----------------
#[cfg(target_os = "macos")]
const IO_PLATFORM_UUID_KEY: &str = "IOPlatformUUID";

const WEB_PROJECT_TEMPLATE: &str = r#"---
order: 1
---
project-name
	src
		components
			Button.jsx
			Header.jsx
			Footer.jsx
		pages
			Home.jsx
			About.jsx
			Contact.jsx
		styles
			global.css
		App.jsx
		index.js
	public
		index.html
	package.json
	README.md"#;

const SCHOOL_CLASS_TEMPLATE: &str = r#"---
order: 2
---
School class
	Lectures
		Lecture_1
		Lecture_2
		Lecture_3
	Labs
		Lab_1
		Lab_2
	Assignments
		Assignment_1
		Assignment_2
	Exams
		Midterm exam
		Final exam
	Readings
	Resources"#;

const VIDEO_PROJECT_TEMPLATE: &str = r#"---
order: 3
---
video-project
	video-footage
		raw-footage
		edited-footage
	audio
		music
		sound-effects
	graphics
		logos
		lower-thirds
	scripts
		scene-descriptions
		dialogue
	project-files
		final-video
		project-backups
	references
		color-palettes
		mood-boards
	team
		tasks
		notes"#;

const GRAPHIC_DESIGN_TEMPLATE: &str = r#"---
order: 4
---
graphic-design-project
	01_project-documents
		brief
		mood-board
		notes
	02_work-files
		mockups
		vectors
			logos
			illustrations
	03_deliverables
		style-guide
		presentation
			slides
			presentation_01.pdf"#;

const DEFAULT_TEMPLATES: [(&str, &str); 4] = [
    ("Web Project", WEB_PROJECT_TEMPLATE),
    ("School Class", SCHOOL_CLASS_TEMPLATE),
    ("Video Project", VIDEO_PROJECT_TEMPLATE),
    ("Graphic Design Project", GRAPHIC_DESIGN_TEMPLATE),
];
const DEFAULTS_SENTINEL_FILE: &str = ".defaults_initialized";

// -----------------
// Types
// -----------------
#[derive(Serialize, Deserialize)]
struct Template {
    name: String,
    content: String,
}

#[derive(Serialize)]
struct DirectoryEntry {
    name: String,
    #[serde(rename = "isDirectory")]
    is_directory: bool,
}

#[derive(Serialize)]
struct FileInfo {
    name: String,
    indent: usize,
    exists: bool,
    #[serde(rename = "isDirectory")]
    is_directory: bool,
}

// -----------------
// Helper Functions
// -----------------
fn expand_tilde_path(path: &str) -> PathBuf {
    if path.starts_with('~') {
        if let Some(home_dir) = dirs::home_dir() {
            if path.len() == 1 {
                home_dir
            } else {
                home_dir.join(&path[2..])
            }
        } else {
            PathBuf::from(path)
        }
    } else {
        PathBuf::from(path)
    }
}

/// Opens the folder using the system's default file explorer.
fn open_folder(_app_handle: &tauri::AppHandle, path: &Path) -> Result<(), String> {
    println!("Attempting to open folder: {}", path.display());
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn expand_path(path: String) -> String {
    expand_tilde_path(&path).to_string_lossy().into_owned()
}

#[tauri::command]
fn check_file_exists(path: String) -> bool {
    expand_tilde_path(&path).exists()
}

#[tauri::command]
fn read_directory_structure(path: String) -> Result<Vec<DirectoryEntry>, String> {
    let path = Path::new(&path);
    if !path.exists() {
        return Err(format!("Path does not exist: {}", path.display()));
    }
    if !path.is_dir() {
        return Err(format!("Path is not a directory: {}", path.display()));
    }

    let mut contents = Vec::new();

    // Read directory entries
    let entries = fs::read_dir(&path).map_err(|e| e.to_string())?;
    for entry in entries {
        if let Ok(entry) = entry {
            let name = entry.file_name().to_string_lossy().into_owned();
            // Skip hidden files and directories (starting with a dot)
            if !name.starts_with('.') {
                contents.push(DirectoryEntry {
                    name,
                    is_directory: entry.file_type().map_err(|e| e.to_string())?.is_dir(),
                });
            }
        }
    }

    // Sort entries (directories first, then files)
    contents.sort_by(|a, b| {
        match (a.is_directory, b.is_directory) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.cmp(&b.name),
        }
    });

    Ok(contents)
}

#[tauri::command]
fn open_folder_command(_app_handle: tauri::AppHandle, path: String) -> Result<(), String> {
    println!("Attempting to open folder: {}", path);
    let path_buf = PathBuf::from(path);
    println!("Path exists: {}", path_buf.exists());
    println!("Path is directory: {}", path_buf.is_dir());

    if !path_buf.exists() {
        return Err(format!("Path does not exist: {}", path_buf.display()));
    }
    if !path_buf.is_dir() {
        return Err(format!("Path is not a directory: {}", path_buf.display()));
    }

    open_folder(&_app_handle, &path_buf)
}

/// Reveals a file in the system file manager (Finder on macOS, Explorer on Windows)
#[tauri::command]
fn reveal_file_command(path: String) -> Result<(), String> {
    let path_buf = PathBuf::from(&path);
    
    if !path_buf.exists() {
        return Err(format!("Path does not exist: {}", path_buf.display()));
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg("/select,")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        // On Linux, we'll just open the parent folder
        if let Some(parent) = path_buf.parent() {
            std::process::Command::new("xdg-open")
                .arg(parent)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
fn get_hardware_uuid() -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        unsafe {
            let platform_expert = IOServiceMatching(b"IOPlatformExpertDevice\0".as_ptr() as *const i8);
            let mut iterator = 0;
            if IOServiceGetMatchingServices(kIOMasterPortDefault, platform_expert, &mut iterator) == 0 {
                if let Some(service) = NonZeroU32::new(IOIteratorNext(iterator)) {
                    let key = CFString::new(IO_PLATFORM_UUID_KEY);
                    let uuid = IORegistryEntryCreateCFProperty(
                        service.get(),
                        key.as_concrete_TypeRef(),
                        kCFAllocatorDefault,
                        0,
                    );
                    if !uuid.is_null() {
                        let uuid_str = CFString::wrap_under_create_rule(uuid as *const _);
                        let result = uuid_str.to_string();
                        IOObjectRelease(service.get());
                        IOObjectRelease(iterator);
                        return Ok(result);
                    }
                    IOObjectRelease(service.get());
                }
                IOObjectRelease(iterator);
            }
            Err("Failed to get hardware UUID".to_string())
        }
    }
    #[cfg(any(windows, target_os = "linux"))]
    {
        machine_uid::get().map_err(|e| format!("Failed to get machine ID: {}", e))
    }
}

#[tauri::command]
fn read_directory_contents(path: String) -> Result<Vec<FileInfo>, String> {
    let path = Path::new(&path);
    if !path.exists() {
        return Err(format!("Path does not exist: {}", path.display()));
    }
    if !path.is_dir() {
        return Err(format!("Path is not a directory: {}", path.display()));
    }

    let mut contents = Vec::new();
    let entries = fs::read_dir(&path).map_err(|e| e.to_string())?;

    for entry in entries {
        if let Ok(entry) = entry {
            let name = entry.file_name().to_string_lossy().into_owned();
            if !name.starts_with('.') {
                contents.push(FileInfo {
                    name,
                    indent: 0,
                    exists: true,
                    is_directory: entry.file_type().map_err(|e| e.to_string())?.is_dir(),
                });
            }
        }
    }

    contents.sort_by(|a, b| {
        match (a.is_directory, b.is_directory) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.cmp(&b.name),
        }
    });

    Ok(contents)
}

#[tauri::command]
fn remove_file(path: String) -> Result<(), String> {
    fs::remove_file(path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn remove_path(path: &str, recursive: bool) -> Result<(), String> {
    let path = PathBuf::from(path);
    
    // If path doesn't exist, return success immediately
    if !path.exists() {
        return Ok(());
    }

    if recursive {
        std::fs::remove_dir_all(&path)
    } else if path.is_dir() {
        std::fs::remove_dir(&path)
    } else {
        std::fs::remove_file(&path)
    }.map_err(|e| format!("Failed to remove path: {}", e))?;

    Ok(())
}

// -----------------
// Template Management
// -----------------
fn get_templates_dir() -> Result<PathBuf, String> {
    let mut path = dirs::document_dir()
        .ok_or_else(|| "Could not find documents directory".to_string())?;
    path.push("FileArchitect");
    path.push("Templates");
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(path)
}

fn ensure_default_templates() -> Result<(), String> {
    let templates_dir = get_templates_dir()?;

    // Respect user deletions: if the sentinel file exists we have already seeded once
    let sentinel_path = templates_dir.join(DEFAULTS_SENTINEL_FILE);
    if sentinel_path.exists() {
        return Ok(());
    }

    // Create a HashSet of existing template names for quick lookup
    let existing_templates: std::collections::HashSet<String> = if let Ok(entries) = fs::read_dir(&templates_dir) {
        entries
            .filter_map(|entry| entry.ok())
            .filter_map(|entry| {
                entry.path()
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .map(|s| s.to_string())
            })
            .collect()
    } else {
        std::collections::HashSet::new()
    };

    // Write each default template if it doesn't exist
    for (name, content) in DEFAULT_TEMPLATES.iter() {
        if !existing_templates.contains(*name) {
            let file_path = templates_dir.join(format!("{}.txt", name));
            fs::write(&file_path, content).map_err(|e| e.to_string())?;
        }
    }

    // Create the sentinel file so we don't reseed every start-up
    fs::write(&sentinel_path, "").map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn initialize_app() -> Result<(), String> {
    // Ensure templates are initialized before the app starts
    ensure_default_templates()?;
    Ok(())
}

#[tauri::command]
fn get_templates() -> Result<Vec<Template>, String> {
    let templates_dir = get_templates_dir()?;
    let mut templates = Vec::new();
    
    if let Ok(entries) = fs::read_dir(&templates_dir) {
        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.extension().map_or(false, |ext| ext == "txt") {
                    if let Ok(content) = fs::read_to_string(&path) {
                        let name = path.file_stem()
                            .and_then(|s| s.to_str())
                            .unwrap_or("Unnamed Template")
                            .to_string();
                        templates.push(Template { name, content });
                    }
                }
            }
        }
    }
    
    Ok(templates)
}

#[tauri::command]
fn save_template(name: String, content: String) -> Result<(), String> {
    let templates_dir = get_templates_dir()?;
    let file_path = templates_dir.join(format!("{}.txt", name));
    fs::write(&file_path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn handle_deep_link<R: Runtime>(app_handle: tauri::AppHandle<R>, url: String) -> Result<(), String> {
    // Simply emit the URL to the frontend
    app_handle.emit("deep-link-url", url).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn extract_zip(zip_path: String, destination_path: String) -> Result<(), String> {
    println!("Extracting ZIP: {} to {}", zip_path, destination_path);
    
    // Open the zip file
    let file = fs::File::open(&zip_path)
        .map_err(|e| format!("Failed to open zip file: {}", e))?;
    
    // Parse the zip
    let mut archive = ZipArchive::new(file)
        .map_err(|e| format!("Failed to parse zip: {}", e))?;
    
    // Create destination directory if it doesn't exist
    fs::create_dir_all(&destination_path)
        .map_err(|e| format!("Failed to create destination directory: {}", e))?;
    
    // Extract each file
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| format!("Failed to access zip entry {}: {}", i, e))?;
        
        let outpath = Path::new(&destination_path).join(file.name());
        
        // Create directory if needed
        if file.name().ends_with('/') {
            fs::create_dir_all(&outpath)
                .map_err(|e| format!("Failed to create directory {}: {}", outpath.display(), e))?;
            continue;
        }
        
        // Create parent directory if needed
        if let Some(parent) = outpath.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create directory {}: {}", parent.display(), e))?;
            }
        }
        
        // Extract file
        let mut outfile = fs::File::create(&outpath)
            .map_err(|e| format!("Failed to create file {}: {}", outpath.display(), e))?;
        
        io::copy(&mut file, &mut outfile)
            .map_err(|e| format!("Failed to write to file {}: {}", outpath.display(), e))?;
    }
    
    println!("ZIP extraction complete");
    Ok(())
}

// -----------------
// Main
// -----------------
fn main() {
    dotenv().ok();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_os::init())
        .setup(|app| {
            ensure_default_templates()?;
            
            // Register deep link handler only on supported platforms (macOS uses config-only; runtime registration not supported)
            #[cfg(any(target_os = "linux", all(debug_assertions, windows)))]
            {
                app.handle().deep_link().register_all()?;
            }

            // Emit deep-link URLs to frontend so it can handle them (works on all platforms including macOS)
            let handle = app.handle().clone();
            if let Ok(Some(urls)) = app.handle().deep_link().get_current() {
                if let Some(url) = urls.first() {
                    let _ = handle.emit("deep-link-url", url.clone());
                }
            }
            app.handle().deep_link().on_open_url(move |event| {
                if let Some(url) = event.urls().first() {
                    let _ = handle.emit("deep-link-url", url.to_string());
                }
            });

            // Create and set native menu (macOS only; avoids lone "Edit" menu bar on Windows)
            #[cfg(target_os = "macos")]
            {
                let handle = app.handle();
                let edit_menu = {
                    let undo = MenuItem::with_id(handle, "undo", "Undo", true, Some("CmdOrCtrl+Z"))?;
                    let redo = MenuItem::with_id(handle, "redo", "Redo", true, Some("CmdOrCtrl+Shift+Z"))?;
                    let cut = PredefinedMenuItem::cut(handle, Some("Cut"))?;
                    let copy = PredefinedMenuItem::copy(handle, Some("Copy"))?;
                    let paste = PredefinedMenuItem::paste(handle, Some("Paste"))?;
                    let select_all = PredefinedMenuItem::select_all(handle, Some("Select All"))?;
                    let separator = PredefinedMenuItem::separator(handle)?;
                    Submenu::with_items(
                        handle,
                        "Edit",
                        true,
                        &[&undo, &redo, &separator, &cut, &copy, &paste, &select_all],
                    )?
                };
                let app_menu = {
                    let about = PredefinedMenuItem::about(handle, Some("About File Architect"), None)?;
                    let sep1 = PredefinedMenuItem::separator(handle)?;
                    let settings = MenuItem::with_id(handle, "settings", "Settings...", true, Some("CmdOrCtrl+,"))?;
                    let sep2 = PredefinedMenuItem::separator(handle)?;
                    let services = PredefinedMenuItem::services(handle, Some("Services"))?;
                    let sep3 = PredefinedMenuItem::separator(handle)?;
                    let hide = PredefinedMenuItem::hide(handle, Some("Hide File Architect"))?;
                    let hide_others = PredefinedMenuItem::hide_others(handle, Some("Hide Others"))?;
                    let show_all = PredefinedMenuItem::show_all(handle, Some("Show All"))?;
                    let sep4 = PredefinedMenuItem::separator(handle)?;
                    let quit = PredefinedMenuItem::quit(handle, Some("Quit File Architect"))?;
                    Submenu::with_items(
                        handle,
                        "File Architect",
                        true,
                        &[&about, &sep1, &settings, &sep2, &services, &sep3, &hide, &hide_others, &show_all, &sep4, &quit],
                    )?
                };
                let window_menu = {
                    let minimize = PredefinedMenuItem::minimize(handle, Some("Minimize"))?;
                    let maximize = PredefinedMenuItem::maximize(handle, Some("Zoom"))?;
                    let sep = PredefinedMenuItem::separator(handle)?;
                    let close = PredefinedMenuItem::close_window(handle, Some("Close"))?;
                    Submenu::with_items(
                        handle,
                        "Window",
                        true,
                        &[&minimize, &maximize, &sep, &close],
                    )?
                };
                let menu = Menu::with_items(handle, &[&app_menu, &edit_menu, &window_menu])?;
                app.set_menu(menu)?;
            }
            
            Ok(())
        })
        .on_menu_event(|app, event| {
            match event.id().as_ref() {
                "undo" => {
                    let _ = app.emit("menu-undo", ());
                }
                "redo" => {
                    let _ = app.emit("menu-redo", ());
                }
                "settings" => {
                    let _ = app.emit("menu-settings", ());
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            expand_path,
            check_file_exists,
            read_directory_structure,
            open_folder_command,
            reveal_file_command,
            get_hardware_uuid,
            read_directory_contents,
            remove_file,
            remove_path,
            get_templates,
            save_template,
            initialize_app,
            handle_deep_link,
            extract_zip,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
