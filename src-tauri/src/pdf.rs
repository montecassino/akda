use serde::{Deserialize, Serialize};
use std::{fs, path::Path, process::Command};
use tauri::Manager;

fn open_folder(path: &std::path::Path) -> Result<(), String> {
    if cfg!(target_os = "windows") {
        Command::new("explorer")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    } else if cfg!(target_os = "macos") {
        Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    } else if cfg!(target_os = "linux") {
        Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[derive(Serialize, Deserialize, Debug)]
pub struct PdfEntry {
    id: u64,
    original_path: String,
    file_name: String,
}

impl PdfEntry {
    pub fn new(id: u64, original_path: String, file_name: String) -> Self {
        Self {
            id,
            original_path,
            file_name,
        }
    }
}

#[tauri::command]
pub fn register_pdf(app_handle: tauri::AppHandle, pdf_path: String) -> Result<String, String> {
    log::info!("Registering new pdf: {pdf_path}");

    // This will handle platform specific app data directories
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let state_path = app_data_dir.join("pdfs.json");

    let mut pdfs: Vec<PdfEntry> = if state_path.exists() {
        let data = fs::read_to_string(&state_path).map_err(|e| e.to_string())?;
        serde_json::from_str::<Vec<PdfEntry>>(&data).map_err(|e| e.to_string())?
    } else {
        Vec::new()
    };

    let latest_id = match pdfs.last() {
        Some(pdf_entry) => pdf_entry.id + 1,
        None => 1,
    };

    let file_name = Path::new(&pdf_path)
        .file_name()
        .and_then(|s| s.to_str())
        .ok_or("Invalid PDF path")?
        .to_string();

    let entry = PdfEntry::new(latest_id, pdf_path.clone(), file_name);

    pdfs.push(entry);

    // Save
    fs::create_dir_all(app_data_dir).map_err(|e| e.to_string())?;
    let serialized = serde_json::to_string_pretty(&pdfs).map_err(|e| e.to_string())?;
    fs::write(&state_path, serialized).map_err(|e| e.to_string())?;

    if cfg!(debug_assertions) {
        if let Some(parent) = state_path.parent() {
            let _ = open_folder(parent);
        }
    }

    Ok(format!("Registered PDF {pdf_path}"))
}

#[tauri::command]
pub fn list_pdf(app_handle: tauri::AppHandle) -> Result<Vec<PdfEntry>, String> {
    log::info!("Listing pdf list");

    // This will handle platform specific app data directories
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let state_path = app_data_dir.join("pdfs.json");

    let pdfs: Vec<PdfEntry> = if state_path.exists() {
        let data = fs::read_to_string(&state_path).map_err(|e| e.to_string())?;
        serde_json::from_str::<Vec<PdfEntry>>(&data).map_err(|e| e.to_string())?
    } else {
        Vec::new()
    };

    Ok(pdfs)
}

#[tauri::command]
pub fn remove_pdf(app_handle: tauri::AppHandle, id: u64) -> Result<bool, String> {
    log::info!("Removing from pdf list {id}");

    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let state_path = app_data_dir.join("pdfs.json");

    let mut pdfs: Vec<PdfEntry> = if state_path.exists() {
        let data = fs::read_to_string(&state_path).map_err(|e| e.to_string())?;
        serde_json::from_str::<Vec<PdfEntry>>(&data).map_err(|e| e.to_string())?
    } else {
        Vec::new()
    };

    if let Ok(idx) = pdfs.binary_search_by(|pdf| pdf.id.cmp(&id)) {
        pdfs.remove(idx);
        Ok(true)
    } else {
        Ok(false)
    }
}
