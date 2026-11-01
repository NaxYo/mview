#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use pulldown_cmark::{html, Event, Options, Parser};
use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Serialize)]
struct Doc {
    path: String,
    dir: String,
    html: String,
    /// File's modification time (ms) when it was read; 0 for pasted text.
    mtime: u64,
}

fn mtime_of(p: &Path) -> Option<u64> {
    let t = std::fs::metadata(p).ok()?.modified().ok()?;
    Some(t.duration_since(std::time::UNIX_EPOCH).ok()?.as_millis() as u64)
}

/// Modification time of a file, polled by the page to notice changes on disk.
#[tauri::command]
fn file_mtime(path: String) -> Option<u64> {
    mtime_of(Path::new(&path))
}

/// The file passed on the command line (what the file manager sends on double click).
#[tauri::command]
fn initial_path() -> Option<String> {
    std::env::args().skip(1).find(|a| !a.starts_with('-')).map(|a| {
        let a = a.strip_prefix("file://").unwrap_or(&a).to_string();
        std::fs::canonicalize(&a)
            .map(|p| p.to_string_lossy().into_owned())
            .unwrap_or(a)
    })
}

/// Markdown → HTML. `breaks`: true keeps the line breaks, false lets paragraphs flow full width.
fn to_html(text: &str, breaks: bool) -> String {
    let mut opts = Options::empty();
    opts.insert(Options::ENABLE_TABLES);
    opts.insert(Options::ENABLE_FOOTNOTES);
    opts.insert(Options::ENABLE_STRIKETHROUGH);
    opts.insert(Options::ENABLE_TASKLISTS);
    opts.insert(Options::ENABLE_YAML_STYLE_METADATA_BLOCKS);
    opts.insert(Options::ENABLE_GFM);

    let parser = Parser::new_ext(text, opts).map(|ev| match ev {
        Event::SoftBreak if breaks => Event::HardBreak,
        other => other,
    });
    let mut out = String::with_capacity(text.len() * 3 / 2);
    html::push_html(&mut out, parser);
    out
}

/// Read a markdown file and render it to HTML.
#[tauri::command]
fn render(window: tauri::WebviewWindow, path: String, breaks: bool) -> Result<Doc, String> {
    let p = PathBuf::from(&path);
    // Read the time before the text: a save in between then still shows as a change.
    let mtime = mtime_of(&p).unwrap_or(0);
    let text = std::fs::read_to_string(&p).map_err(|e| format!("Cannot open {path}: {e}"))?;

    let name = p.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    let _ = window.set_title(&name);

    Ok(Doc {
        dir: p.parent().unwrap_or(Path::new("/")).to_string_lossy().into_owned(),
        html: to_html(&text, breaks),
        path,
        mtime,
    })
}

/// Render Markdown pasted into the start screen (no file, so no folder for relative links).
#[tauri::command]
fn render_text(window: tauri::WebviewWindow, text: String, breaks: bool) -> Doc {
    let _ = window.set_title("Pasted Markdown");
    Doc { path: String::new(), dir: String::new(), html: to_html(&text, breaks), mtime: 0 }
}

/// Open web links in the default browser instead of inside the viewer.
#[tauri::command]
fn open_external(url: String) -> Result<(), String> {
    if !(url.starts_with("http://") || url.starts_with("https://") || url.starts_with("mailto:")) {
        return Err("Only web and mail links open externally".into());
    }
    std::process::Command::new("xdg-open")
        .arg(&url)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![initial_path, render, render_text, file_mtime, open_external])
        .run(tauri::generate_context!())
        .expect("error while running the viewer");
}
