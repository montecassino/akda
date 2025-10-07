use crate::state::AppState;
use pdfium_render::prelude::Pdfium;
use serde::de::{self, Deserializer};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, fs, path::Path, process::Command};
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

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PdfEntry {
    id: u64,
    original_path: String,
    clone_path: String,
    cover_path: String,
    file_name: String,
}

impl PdfEntry {
    pub fn new(
        id: u64,
        original_path: String,
        clone_path: String,
        cover_path: String,
        file_name: String,
    ) -> Self {
        Self {
            id,
            original_path,
            clone_path,
            cover_path,
            file_name,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "lowercase")]
pub enum DrawingToolType {
    Pen,
    Highlighter,
    Eraser,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct StrokePath {
    x: f64,
    y: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Stroke {
    tool: DrawingToolType,
    color: String,
    opacity: f64,
    thickness: u64,
    path: Vec<StrokePath>,
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct PdfStrokes {
    #[serde(flatten)]
    #[serde(deserialize_with = "string_key_to_u32")]
    inner: HashMap<u32, Vec<Stroke>>,
}

impl PdfStrokes {
    pub fn new() -> Self {
        Self {
            inner: HashMap::new(),
        }
    }

    fn insert(&mut self, page: u32, stroke: Stroke) {
        self.inner.entry(page).or_insert_with(Vec::new).push(stroke);
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct Dimensions {
    height: f32,
    width: f32,
}

impl Dimensions {
    pub fn new(height: f32, width: f32) -> Self {
        Self { height, width }
    }
}

fn string_key_to_u32<'de, D, V>(deserializer: D) -> Result<HashMap<u32, V>, D::Error>
where
    D: Deserializer<'de>,
    V: Deserialize<'de>,
{
    let map: HashMap<String, V> = HashMap::deserialize(deserializer)?;
    map.into_iter()
        .map(|(k, v)| {
            k.parse::<u32>()
                .map(|k| (k, v))
                .map_err(|_| de::Error::custom(format!("Invalid key: {}", k)))
        })
        .collect()
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct PdfPagesDimensions {
    #[serde(flatten)]
    #[serde(deserialize_with = "string_key_to_u32")]
    inner: HashMap<u32, Dimensions>,
}

impl PdfPagesDimensions {
    pub fn new() -> Self {
        Self {
            inner: HashMap::new(),
        }
    }

    fn insert(&mut self, page: u32, dim: Dimensions) {
        self.inner.insert(page, dim);
    }
}

#[derive(Debug, Serialize)]
pub struct LoadPdfResponse {
    pdf_entry: PdfEntry,
    pdf_pages_dims: PdfPagesDimensions,
}

impl LoadPdfResponse {
    pub fn new(pdf_entry: PdfEntry, pdf_pages_dims: PdfPagesDimensions) -> Self {
        Self {
            pdf_entry,
            pdf_pages_dims,
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

    if cfg!(debug_assertions) {
        if let Some(parent) = state_path.parent() {
            let _ = open_folder(parent);
        }
    }

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

    let folder_name = format!("pdf_{latest_id}");
    let folder_path = app_data_dir.join(folder_name);
    let _clone_path = folder_path.to_str().unwrap().to_string(); // String
    let clone_path = format!("{_clone_path}/{latest_id}.pdf");

    fs::create_dir_all(&folder_path).map_err(|e| e.to_string())?;

    fs::copy(&pdf_path, &clone_path).map_err(|e| e.to_string())?;

    let entry = PdfEntry::new(
        latest_id,
        pdf_path.clone(),
        clone_path,
        "".to_string(),
        file_name,
    );

    pdfs.push(entry);

    // Save
    fs::create_dir_all(app_data_dir).map_err(|e| e.to_string())?;
    let serialized = serde_json::to_string_pretty(&pdfs).map_err(|e| e.to_string())?;
    fs::write(&state_path, serialized).map_err(|e| e.to_string())?;

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

#[tauri::command]
pub fn load_pdf(app_handle: tauri::AppHandle, id: u64) -> Result<LoadPdfResponse, String> {
    log::info!("Loading pdf: {id}");

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

    let pdf_entry = match pdfs.binary_search_by(|pdf| pdf.id.cmp(&id)) {
        Ok(index) => Ok(pdfs[index].clone()),
        Err(_) => Err(format!("PDF with id {id} not found")),
    }?;

    let dims_path = app_data_dir.join(format!("pdf_{id}/dims.json"));

    let pdf_pages_dims = if !dims_path.exists() {
        let mut pdf_pages_dims: PdfPagesDimensions = PdfPagesDimensions::new();

        let state = app_handle.state::<AppState>();

        let pdfium_path = &state.lib_path;

        let pdfium = Pdfium::new(
            Pdfium::bind_to_library(Pdfium::pdfium_platform_library_name_at_path(pdfium_path))
                .or_else(|_| Pdfium::bind_to_system_library())
                .unwrap(), // Or use the ? unwrapping operator to pass any error up to the caller
        );

        let document = pdfium
            .load_pdf_from_file(&pdf_entry.clone_path, None)
            .map_err(|e| e.to_string())?;

        for (i, page) in document.pages().iter().enumerate() {
            let size = page.page_size();
            let height = size.height().value;
            let width = size.width().value;
            let page_no = i as u32 + 1;
            pdf_pages_dims.insert(page_no, Dimensions::new(height, width));
        }

        // store it
        let serialized =
            serde_json::to_string_pretty(&pdf_pages_dims).map_err(|e| e.to_string())?;
        fs::write(&dims_path, serialized).map_err(|e| e.to_string())?;

        pdf_pages_dims
    } else {
        let data = fs::read_to_string(&dims_path).map_err(|e| e.to_string())?;
        let pdf_pages_dims =
            serde_json::from_str::<PdfPagesDimensions>(&data).map_err(|e| e.to_string())?;
        pdf_pages_dims
    };

    Ok(LoadPdfResponse::new(pdf_entry, pdf_pages_dims))
}

#[tauri::command]
pub fn save_pdf_strokes(
    app_handle: tauri::AppHandle,
    pdf_id: u32,
    page_id: u32,
    stroke: Stroke,
) -> Result<bool, String> {
    log::info!("Saving pdf strokes: {pdf_id}");

    // This will handle platform specific app data directories
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let strokes_path = app_data_dir.join(format!("pdf_{pdf_id}/strokes.json"));

    if cfg!(debug_assertions) {
        if let Some(parent) = strokes_path.parent() {
            let _ = open_folder(parent);
        }
    }

    let mut strokes: PdfStrokes = if strokes_path.exists() {
        let data = fs::read_to_string(&strokes_path).map_err(|e| e.to_string())?;
        serde_json::from_str::<PdfStrokes>(&data).map_err(|e| e.to_string())?
    } else {
        PdfStrokes::new()
    };

    strokes.insert(page_id, stroke);

    // Save
    fs::create_dir_all(app_data_dir).map_err(|e| e.to_string())?;
    let serialized = serde_json::to_string_pretty(&strokes).map_err(|e| e.to_string())?;
    fs::write(&strokes_path, serialized).map_err(|e| e.to_string())?;

    Ok(true)
}

#[tauri::command]
pub fn load_pdf_strokes(app_handle: tauri::AppHandle, pdf_id: u32) -> Result<PdfStrokes, String> {
    log::info!("Loading pdf strokes: {pdf_id}");

    // This will handle platform specific app data directories
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let strokes_path = app_data_dir.join(format!("pdf_{pdf_id}/strokes.json"));

    let strokes: PdfStrokes = if strokes_path.exists() {
        let data = fs::read_to_string(&strokes_path).map_err(|e| e.to_string())?;
        serde_json::from_str::<PdfStrokes>(&data).map_err(|e| e.to_string())?
    } else {
        PdfStrokes::new()
    };

    Ok(strokes)
}
