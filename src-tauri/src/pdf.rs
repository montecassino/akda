use crate::state::AppState;
use chrono::Local;
use pdfium_render::prelude::Pdfium;
use serde::de::{self, Deserializer};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::{collections::HashMap, fs, path::Path, process::Command};
use tauri::{AppHandle, Emitter, Manager};

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

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfEditorSyncProps {
    id: u64,
    pen_color: String,
    pen_thickness: u64,
    highlighter_color: String,
    highlighter_thickness: u64,
    eraser_thickness: u64,
    current_page: u64,
    scale: f64,
}

impl Default for PdfEditorSyncProps {
    fn default() -> Self {
        Self {
            id: 0,
            pen_color: "#ff0000".into(),
            pen_thickness: 2,
            highlighter_color: "#ffff00".into(),
            highlighter_thickness: 12,
            eraser_thickness: 12,
            current_page: 1,
            scale: 1.0,
        }
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

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct PdfPagesThumbnails {
    #[serde(flatten)]
    #[serde(deserialize_with = "string_key_to_u32")]
    inner: HashMap<u32, String>,
}

impl PdfPagesThumbnails {
    pub fn new() -> Self {
        Self {
            inner: HashMap::new(),
        }
    }

    fn insert(&mut self, page: u32, path: String) {
        self.inner.insert(page, path);
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

#[derive(Default)]
struct ExtractOptions {
    thumbnail: bool,
    dims: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PdfBookmark {
    pub page_number: u32,
    pub label: String,
}

pub type PdfBookmarks = Vec<PdfBookmark>;

fn extract_pdf_data(
    app_handle: &AppHandle,
    pdfium_path: &PathBuf,
    pdf_path: &str,
    folder_path: &PathBuf,
    options: ExtractOptions,
) -> Result<(), String> {
    if !options.thumbnail && !options.dims {
        return Ok(()); // nothing to do
    }

    let pdfium = Pdfium::new(
        Pdfium::bind_to_library(Pdfium::pdfium_platform_library_name_at_path(pdfium_path))
            .or_else(|_| Pdfium::bind_to_system_library())
            .map_err(|e| e.to_string())?,
    );

    let document = pdfium
        .load_pdf_from_file(pdf_path, None)
        .map_err(|e| e.to_string())?;

    // Prepare output folders/files
    let thumbs_dir = folder_path.join("thumbnails");
    let thumbs_path = folder_path.join("thumbs.json");
    let dims_path = folder_path.join("dims.json");

    if options.thumbnail {
        fs::create_dir_all(&thumbs_dir).map_err(|e| e.to_string())?;
    }

    let mut page_thumbs = PdfPagesThumbnails::new();
    let mut pdf_pages_dims = PdfPagesDimensions::new();

    for (i, page) in document.pages().iter().enumerate() {
        let page_no = i as u32 + 1;
        let size = page.page_size();
        let height = size.height().value;
        let width = size.width().value;

        if options.dims {
            pdf_pages_dims.insert(page_no, Dimensions::new(height, width));

            let serialized =
                serde_json::to_string_pretty(&pdf_pages_dims).map_err(|e| e.to_string())?;
            fs::write(&dims_path, serialized).map_err(|e| e.to_string())?;

            app_handle
                .emit("page-dimensions-extracted", &pdf_pages_dims)
                .unwrap();
        }

        if options.thumbnail {
            let thumb_width = (width / 3.0) as i32;
            let thumb_height = (height / 3.0) as i32;

            let bitmap = page
                .render(thumb_width, thumb_height, None)
                .map_err(|e| e.to_string())?;

            let now = Local::now();
            let timestamp = now.format("%Y%m%d_%H%M%S").to_string();
            let thumb_path = thumbs_dir.join(format!("page_{page_no}_{timestamp}.jpg"));
            bitmap
                .as_image()
                .save(&thumb_path)
                .map_err(|e| e.to_string())?;

            page_thumbs.insert(page_no, thumb_path.to_str().unwrap().to_string());

            // Incremental emit
            app_handle
                .emit("thumbnail-extracted", &page_thumbs)
                .unwrap();

            // Persist thumbnails incrementally
            let thumbs_serialized =
                serde_json::to_string_pretty(&page_thumbs).map_err(|e| e.to_string())?;
            fs::write(&thumbs_path, thumbs_serialized).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
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
    let base_path = folder_path.to_str().unwrap().to_string(); // String
    let clone_path = format!("{base_path}/{latest_id}.pdf");

    fs::create_dir_all(&folder_path).map_err(|e| e.to_string())?;

    fs::copy(&pdf_path, &clone_path).map_err(|e| e.to_string())?;

    // extract pdf cover
    let now = Local::now();
    let timestamp = now.format("%Y%m%d_%H%M%S").to_string();
    let cover_path = format!("{base_path}/{latest_id}_cover_{timestamp}.jpg");
    let state = app_handle.state::<AppState>();

    let pdfium_path = &state.lib_path;

    let pdfium = Pdfium::new(
        Pdfium::bind_to_library(Pdfium::pdfium_platform_library_name_at_path(pdfium_path))
            .or_else(|_| Pdfium::bind_to_system_library())
            .unwrap(),
    );

    let document = pdfium
        .load_pdf_from_file(&clone_path, None)
        .map_err(|e| e.to_string())?;

    let page = document.pages().get(0).map_err(|e| e.to_string())?;
    let size = page.page_size();
    let height = (size.height().value / 2.0) as i32;
    let width = (size.width().value / 2.0) as i32;

    let bitmap = page
        .render(width, height, None)
        .map_err(|e| e.to_string())?;

    bitmap
        .as_image()
        .save(&cover_path)
        .map_err(|e| e.to_string())?;
    let entry = PdfEntry::new(
        latest_id,
        pdf_path.clone(),
        clone_path.clone(),
        cover_path,
        file_name,
    );

    pdfs.push(entry);

    // Save
    fs::create_dir_all(app_data_dir).map_err(|e| e.to_string())?;
    let serialized = serde_json::to_string_pretty(&pdfs).map_err(|e| e.to_string())?;
    fs::write(&state_path, serialized).map_err(|e| e.to_string())?;

    // cpu heavy
    let pdfium_lib_path = pdfium_path.clone();
    let thread_clone_path = clone_path.clone();
    let thread_folder_path = folder_path.clone();

    tauri::async_runtime::spawn_blocking(move || {
        // extract_page_thumbnails(&app_handle, &pdfium_lib_path, &thread_clone_path, &thread_folder_path)

        extract_pdf_data(
            &app_handle,
            &pdfium_lib_path,
            &thread_clone_path,
            &thread_folder_path,
            ExtractOptions {
                thumbnail: true,
                dims: true,
            },
        )
    });

    Ok(format!("Registered PDF"))
}

#[tauri::command]
pub async fn list_pdf(app_handle: tauri::AppHandle) -> Result<Vec<PdfEntry>, String> {
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

        // recursive removal of subfolders and files
        let folder_name = format!("pdf_{id}");
        let folder_path = app_data_dir.join(folder_name);
        if folder_path.exists() {
            fs::remove_dir_all(folder_path).map_err(|e| e.to_string())?;
            log::info!("Successfully removed folder{:?}", id);
        } else {
            log::info!("Folder does not exist: {:?}", id);
        }

        // remove from json config
        fs::create_dir_all(app_data_dir).map_err(|e| e.to_string())?;
        let serialized = serde_json::to_string_pretty(&pdfs).map_err(|e| e.to_string())?;
        fs::write(&state_path, serialized).map_err(|e| e.to_string())?;
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub async fn load_pdf(app_handle: tauri::AppHandle, id: u64) -> Result<LoadPdfResponse, String> {
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

    let data = fs::read_to_string(&dims_path).map_err(|e| e.to_string())?;
    let pdf_pages_dims =
        serde_json::from_str::<PdfPagesDimensions>(&data).map_err(|e| e.to_string())?;

    Ok(LoadPdfResponse::new(pdf_entry, pdf_pages_dims))
}

#[tauri::command]
pub async fn save_pdf_strokes(
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

    // if cfg!(debug_assertions) {
    //     if let Some(parent) = strokes_path.parent() {
    //         let _ = open_folder(parent);
    //     }
    // }

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

#[tauri::command]
pub fn load_thumbnails(
    app_handle: tauri::AppHandle,
    pdf_id: u32,
) -> Result<PdfPagesThumbnails, String> {
    log::info!("Loading pdf thumbnails: {pdf_id}");

    // This will handle platform specific app data directories
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let thumbnails_path = app_data_dir.join(format!("pdf_{pdf_id}/thumbs.json"));

    let thumbnails: PdfPagesThumbnails = if thumbnails_path.exists() {
        let data = fs::read_to_string(&thumbnails_path).map_err(|e| e.to_string())?;
        serde_json::from_str::<PdfPagesThumbnails>(&data).map_err(|e| e.to_string())?
    } else {
        PdfPagesThumbnails::new()
    };

    Ok(thumbnails)
}

#[tauri::command]
pub fn rename_pdf(app_handle: tauri::AppHandle, id: u64, name: String) -> Result<bool, String> {
    log::info!("Loading pdf for renaming: {id}");

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

    match pdfs.binary_search_by(|pdf| pdf.id.cmp(&id)) {
        Ok(index) => Ok(pdfs[index].file_name = name),
        Err(_) => Err(format!("PDF with id {id} not found")),
    }?;

    fs::create_dir_all(app_data_dir).map_err(|e| e.to_string())?;
    let serialized = serde_json::to_string_pretty(&pdfs).map_err(|e| e.to_string())?;
    fs::write(&state_path, serialized).map_err(|e| e.to_string())?;

    Ok(true)
}

#[tauri::command]
pub async fn save_editor_settings(
    app_handle: tauri::AppHandle,
    props: PdfEditorSyncProps,
) -> Result<bool, String> {
    log::info!("Syncing pdf editor settings: {:?}", props.id);

    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let settings_path = app_data_dir.join(format!("pdf_{:?}/editor.json", props.id));

    fs::create_dir_all(app_data_dir).map_err(|e| e.to_string())?;
    let serialized = serde_json::to_string_pretty(&props).map_err(|e| e.to_string())?;
    fs::write(&settings_path, serialized).map_err(|e| e.to_string())?;

    Ok(true)
}

#[tauri::command]
pub fn load_editor_settings(
    app_handle: tauri::AppHandle,
    id: u64,
) -> Result<PdfEditorSyncProps, String> {
    log::info!("Loading pdf editor settings: {id}");

    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let settings_path = app_data_dir.join(format!("pdf_{:?}/editor.json", id));

    let settings: PdfEditorSyncProps = if settings_path.exists() {
        let data = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
        serde_json::from_str::<PdfEditorSyncProps>(&data).map_err(|e| e.to_string())?
    } else {
        PdfEditorSyncProps::default()
    };

    Ok(settings)
}

// Bookmarks
fn get_bookmarks_path(app_handle: &AppHandle, pdf_id: u64) -> Result<PathBuf, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    Ok(app_data_dir.join(format!("pdf_{pdf_id}/bookmarks.json")))
}

fn load_bookmarks_from_file(path: &PathBuf) -> Result<PdfBookmarks, String> {
    if !path.exists() {
        return Ok(vec![]);
    }

    let data = fs::read_to_string(path).map_err(|e| e.to_string())?;
    if data.trim().is_empty() {
        return Ok(vec![]);
    }

    serde_json::from_str::<PdfBookmarks>(&data).map_err(|e| format!("Invalid JSON: {e}"))
}

fn save_bookmarks_to_file(path: &PathBuf, bookmarks: &PdfBookmarks) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let data = serde_json::to_string_pretty(bookmarks).map_err(|e| e.to_string())?;
    fs::write(path, data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_pdf_bookmarks(app_handle: AppHandle, pdf_id: u64) -> Result<PdfBookmarks, String> {
    log::info!("Loading bookmarks for PDF {pdf_id}");

    let path = get_bookmarks_path(&app_handle, pdf_id)?;
    load_bookmarks_from_file(&path)
}

#[tauri::command]
pub fn add_pdf_bookmark(
    app_handle: AppHandle,
    pdf_id: u64,
    page_number: u32,
    label: String,
) -> Result<PdfBookmarks, String> {
    log::info!("Adding bookmark to PDF {pdf_id} - page {page_number}");

    if label.trim().is_empty() {
        return Err("Label cannot be empty".to_string());
    }

    let path = get_bookmarks_path(&app_handle, pdf_id)?;
    let mut bookmarks = load_bookmarks_from_file(&path)?;

    let new_bookmark = PdfBookmark { page_number, label };

    bookmarks.push(new_bookmark);
    save_bookmarks_to_file(&path, &bookmarks)?;

    Ok(bookmarks)
}

#[tauri::command]
pub fn update_pdf_bookmark(
    app_handle: AppHandle,
    pdf_id: u64,
    label: Option<String>,
    page_number: u32,
) -> Result<PdfBookmarks, String> {
    log::info!("Updating bookmark {page_number} in PDF {pdf_id}");

    let path = get_bookmarks_path(&app_handle, pdf_id)?;
    let mut bookmarks = load_bookmarks_from_file(&path)?;

    if let Some(bm) = bookmarks.iter_mut().find(|b| b.page_number == page_number) {
        if let Some(lbl) = label {
            if lbl.trim().is_empty() {
                return Err("Label cannot be empty".to_string());
            }
            bm.label = lbl;
        }
    } else {
        return Err(format!("Bookmark with id {page_number} not found"));
    }

    save_bookmarks_to_file(&path, &bookmarks)?;
    Ok(bookmarks)
}

#[tauri::command]
pub fn delete_pdf_bookmark(
    app_handle: AppHandle,
    pdf_id: u64,
    page_number: u32,
) -> Result<PdfBookmarks, String> {
    log::info!("Deleting bookmark {page_number} in PDF {pdf_id}");

    let path = get_bookmarks_path(&app_handle, pdf_id)?;
    let mut bookmarks = load_bookmarks_from_file(&path)?;

    let before_len = bookmarks.len();
    bookmarks.retain(|b| b.page_number != page_number);

    if bookmarks.len() == before_len {
        return Err(format!("Bookmark with id {page_number} not found"));
    }

    save_bookmarks_to_file(&path, &bookmarks)?;
    Ok(bookmarks)
}
