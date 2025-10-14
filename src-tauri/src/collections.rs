use std::{collections::HashMap, fs, path::PathBuf};

use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Collection {
    pub id: String,
    pub name: String,
    pub color: String,
    pub pdf_ids: HashMap<String, bool>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct CollectionsFile {
    pub collections: Vec<Collection>,
}

fn collections_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(dir.join("collections.json"))
}

fn read_collections(path: &PathBuf) -> Result<CollectionsFile, String> {
    if !path.exists() {
        return Ok(CollectionsFile::default());
    }

    let data = fs::read_to_string(path).map_err(|e| e.to_string())?;
    if data.trim().is_empty() {
        return Ok(CollectionsFile::default());
    }

    serde_json::from_str(&data).map_err(|e| e.to_string())
}

fn write_collections(path: &PathBuf, data: &CollectionsFile) -> Result<(), String> {
    fs::create_dir_all(path.parent().ok_or("Invalid path")?).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(data).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

fn generate_id() -> String {
    Utc::now().format("%Y%m%d%H%M%S%3f").to_string()
}

#[tauri::command]
pub fn get_collections(app: AppHandle) -> Result<Vec<Collection>, String> {
    let path = collections_file_path(&app)?;
    let data = read_collections(&path)?;
    Ok(data.collections)
}

#[tauri::command]
pub fn create_collection(
    app: AppHandle,
    name: String,
    color: String,
) -> Result<Collection, String> {
    if name.trim().is_empty() {
        return Err("Collection name cannot be empty".into());
    }

    let path = collections_file_path(&app)?;
    let mut data = read_collections(&path)?;

    if data.collections.iter().any(|c| c.name == name) {
        return Err(format!("Collection with name '{}' already exists", name));
    }

    let new_col = Collection {
        id: generate_id(),
        name,
        color,
        pdf_ids: HashMap::new(),
    };

    data.collections.push(new_col.clone());
    write_collections(&path, &data)?;
    Ok(new_col)
}

#[tauri::command]
pub fn rename_collection(app: AppHandle, id: String, new_name: String) -> Result<bool, String> {
    if new_name.trim().is_empty() {
        return Err("Collection name cannot be empty".into());
    }

    let path = collections_file_path(&app)?;
    let mut data = read_collections(&path)?;

    if data
        .collections
        .iter()
        .any(|c| c.name == new_name && c.id != id)
    {
        return Err(format!(
            "Collection with name '{}' already exists",
            new_name
        ));
    }

    let col = data
        .collections
        .iter_mut()
        .find(|c| c.id == id)
        .ok_or("Collection not found")?;

    col.name = new_name;
    write_collections(&path, &data)?;
    Ok(true)
}

// Delete collection
#[tauri::command]
pub fn delete_collection(app: AppHandle, id: String) -> Result<bool, String> {
    let path = collections_file_path(&app)?;
    let mut data = read_collections(&path)?;

    let original_len = data.collections.len();
    data.collections.retain(|c| c.id != id);

    if data.collections.len() == original_len {
        return Err("Collection not found".into());
    }

    write_collections(&path, &data)?;
    Ok(true)
}

#[tauri::command]
pub fn change_collection_color(
    app: AppHandle,
    id: String,
    new_color: String,
) -> Result<bool, String> {
    let path = collections_file_path(&app)?;
    let mut data = read_collections(&path)?;

    let col = data
        .collections
        .iter_mut()
        .find(|c| c.id == id)
        .ok_or("Collection not found")?;

    col.color = new_color;
    write_collections(&path, &data)?;
    Ok(true)
}

#[tauri::command]
pub fn add_pdf_to_collection(
    app: AppHandle,
    collection_id: String,
    pdf_id: String,
) -> Result<bool, String> {
    let path = collections_file_path(&app)?;
    let mut data = read_collections(&path)?;

    let col = data
        .collections
        .iter_mut()
        .find(|c| c.id == collection_id)
        .ok_or("Collection not found")?;

    col.pdf_ids.insert(pdf_id, true);
    write_collections(&path, &data)?;
    Ok(true)
}

#[tauri::command]
pub fn remove_pdf_from_collection(
    app: AppHandle,
    collection_id: String,
    pdf_id: String,
) -> Result<bool, String> {
    let path = collections_file_path(&app)?;
    let mut data = read_collections(&path)?;

    let col = data
        .collections
        .iter_mut()
        .find(|c| c.id == collection_id)
        .ok_or("Collection not found")?;

    col.pdf_ids.remove(&pdf_id);
    write_collections(&path, &data)?;
    Ok(true)
}

#[tauri::command]
pub fn toggle_pdf_in_collection(
    app: AppHandle,
    collection_id: String,
    pdf_id: String,
) -> Result<bool, String> {
    let path = collections_file_path(&app)?;
    let mut data = read_collections(&path)?;

    let col = data
        .collections
        .iter_mut()
        .find(|c| c.id == collection_id)
        .ok_or("Collection not found")?;

    let is_added = if col.pdf_ids.contains_key(&pdf_id) {
        col.pdf_ids.remove(&pdf_id);
        false
    } else {
        col.pdf_ids.insert(pdf_id, true);
        true
    };

    write_collections(&path, &data)?;
    Ok(is_added)
}

#[tauri::command]
pub fn remove_pdf_from_all_collections(app: AppHandle, pdf_id: String) -> Result<usize, String> {
    let path = collections_file_path(&app)?;
    let mut data = read_collections(&path)?;
    let mut removed_count = 0;

    for col in &mut data.collections {
        let before = col.pdf_ids.len();
        col.pdf_ids.remove(&pdf_id);
        if col.pdf_ids.len() < before {
            removed_count += 1;
        }
    }

    if removed_count > 0 {
        write_collections(&path, &data)?;
    }

    Ok(removed_count)
}
