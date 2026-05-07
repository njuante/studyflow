use chrono::Local;
use tauri::{
    image::Image, path::BaseDirectory, AppHandle, Emitter, LogicalPosition, Manager, State,
    WebviewWindow, WebviewWindowBuilder,
};

use crate::{
    db,
    error::AppError,
    models::{StudyEvent, Tag, TagStats, TagViewOptions},
    DbState,
};

#[tauri::command]
pub async fn get_tags(db_state: State<'_, DbState>) -> Result<Vec<Tag>, AppError> {
    let connection = db_state
        .lock()
        .map_err(|_| AppError::State("database connection lock poisoned".into()))?;

    db::get_tags(&connection)
}

#[tauri::command]
pub async fn create_tag(
    name: String,
    color: String,
    icon: Option<String>,
    db_state: State<'_, DbState>,
) -> Result<Tag, AppError> {
    let connection = db_state
        .lock()
        .map_err(|_| AppError::State("database connection lock poisoned".into()))?;

    db::insert_tag(&connection, &name, &color, icon.as_deref())
}

#[tauri::command]
pub async fn update_tag(
    id: String,
    name: String,
    color: String,
    icon: Option<String>,
    db_state: State<'_, DbState>,
) -> Result<Tag, AppError> {
    let connection = db_state
        .lock()
        .map_err(|_| AppError::State("database connection lock poisoned".into()))?;

    db::update_tag(&connection, &id, &name, &color, icon.as_deref())
}

#[tauri::command]
pub async fn delete_tag(id: String, db_state: State<'_, DbState>) -> Result<(), AppError> {
    let connection = db_state
        .lock()
        .map_err(|_| AppError::State("database connection lock poisoned".into()))?;

    db::delete_tag(&connection, &id)
}

#[tauri::command]
pub async fn reorder_tags(ids: Vec<String>, db_state: State<'_, DbState>) -> Result<(), AppError> {
    let mut connection = db_state
        .lock()
        .map_err(|_| AppError::State("database connection lock poisoned".into()))?;

    db::reorder_tags(&mut connection, &ids)
}

#[tauri::command]
pub async fn count_events_by_tag(
    id: String,
    db_state: State<'_, DbState>,
) -> Result<i64, AppError> {
    let connection = db_state
        .lock()
        .map_err(|_| AppError::State("database connection lock poisoned".into()))?;

    db::count_events_by_tag(&connection, &id)
}

#[tauri::command]
pub async fn get_events_by_tag(
    tag_id: String,
    options: TagViewOptions,
    db_state: State<'_, DbState>,
) -> Result<Vec<StudyEvent>, AppError> {
    let today = Local::now().date_naive().format("%Y-%m-%d").to_string();
    let connection = db_state
        .lock()
        .map_err(|_| AppError::State("database connection lock poisoned".into()))?;

    db::get_events_by_tag(&connection, &tag_id, &today, &options)
}

#[tauri::command]
pub async fn get_tag_stats(
    tag_id: String,
    db_state: State<'_, DbState>,
) -> Result<TagStats, AppError> {
    let today = Local::now().date_naive().format("%Y-%m-%d").to_string();
    let connection = db_state
        .lock()
        .map_err(|_| AppError::State("database connection lock poisoned".into()))?;

    db::get_tag_stats(&connection, &tag_id, &today)
}

#[tauri::command]
pub async fn bulk_change_tag(
    event_ids: Vec<String>,
    new_tag_id: Option<String>,
    db_state: State<'_, DbState>,
) -> Result<usize, AppError> {
    let mut connection = db_state
        .lock()
        .map_err(|_| AppError::State("database connection lock poisoned".into()))?;

    db::bulk_change_tag(&mut connection, &event_ids, new_tag_id.as_deref())
}

#[tauri::command]
pub async fn get_events_in_range(
    start_date: String,
    end_date: String,
    db_state: State<'_, DbState>,
) -> Result<Vec<StudyEvent>, AppError> {
    let connection = db_state
        .lock()
        .map_err(|_| AppError::State("database connection lock poisoned".into()))?;

    db::get_events_in_range(&connection, &start_date, &end_date)
}

#[tauri::command]
pub async fn create_event(
    event: StudyEvent,
    db_state: State<'_, DbState>,
) -> Result<StudyEvent, AppError> {
    let connection = db_state
        .lock()
        .map_err(|_| AppError::State("database connection lock poisoned".into()))?;

    db::insert_event(&connection, &event)
}

#[tauri::command]
pub async fn update_event(
    event: StudyEvent,
    db_state: State<'_, DbState>,
) -> Result<StudyEvent, AppError> {
    let connection = db_state
        .lock()
        .map_err(|_| AppError::State("database connection lock poisoned".into()))?;

    db::update_event(&connection, &event)
}

#[tauri::command]
pub async fn delete_event(id: String, db_state: State<'_, DbState>) -> Result<(), AppError> {
    let connection = db_state
        .lock()
        .map_err(|_| AppError::State("database connection lock poisoned".into()))?;

    db::delete_event(&connection, &id)
}

#[tauri::command]
pub async fn bulk_create_events(
    events: Vec<StudyEvent>,
    db_state: State<'_, DbState>,
) -> Result<usize, AppError> {
    let mut connection = db_state
        .lock()
        .map_err(|_| AppError::State("database connection lock poisoned".into()))?;

    db::bulk_insert_events(&mut connection, &events)
}

#[tauri::command]
pub async fn get_today_events(db_state: State<'_, DbState>) -> Result<Vec<StudyEvent>, AppError> {
    let today = Local::now().date_naive().format("%Y-%m-%d").to_string();
    let connection = db_state
        .lock()
        .map_err(|_| AppError::State("database connection lock poisoned".into()))?;

    db::get_events_for_date(&connection, &today)
}

#[tauri::command]
pub async fn get_inbox_events(db_state: State<'_, DbState>) -> Result<Vec<StudyEvent>, AppError> {
    let connection = db_state
        .lock()
        .map_err(|_| AppError::State("database connection lock poisoned".into()))?;

    db::get_inbox_events(&connection)
}

#[tauri::command]
pub async fn get_archive_events(
    limit: i64,
    offset: i64,
    db_state: State<'_, DbState>,
) -> Result<Vec<StudyEvent>, AppError> {
    let today = Local::now().date_naive().format("%Y-%m-%d").to_string();
    let connection = db_state
        .lock()
        .map_err(|_| AppError::State("database connection lock poisoned".into()))?;

    db::get_archive_events(&connection, &today, limit, offset)
}

#[tauri::command]
pub async fn count_inbox_events(db_state: State<'_, DbState>) -> Result<i64, AppError> {
    let connection = db_state
        .lock()
        .map_err(|_| AppError::State("database connection lock poisoned".into()))?;

    db::count_inbox_events(&connection)
}

#[tauri::command]
pub async fn schedule_event(
    id: String,
    date: String,
    start_time: String,
    db_state: State<'_, DbState>,
) -> Result<StudyEvent, AppError> {
    let connection = db_state
        .lock()
        .map_err(|_| AppError::State("database connection lock poisoned".into()))?;

    db::schedule_event(&connection, &id, &date, &start_time)
}

#[tauri::command]
pub async fn unschedule_event(
    id: String,
    db_state: State<'_, DbState>,
) -> Result<StudyEvent, AppError> {
    let connection = db_state
        .lock()
        .map_err(|_| AppError::State("database connection lock poisoned".into()))?;

    db::unschedule_event(&connection, &id)
}

#[tauri::command]
pub async fn complete_event(
    id: String,
    db_state: State<'_, DbState>,
) -> Result<StudyEvent, AppError> {
    let connection = db_state
        .lock()
        .map_err(|_| AppError::State("database connection lock poisoned".into()))?;

    db::complete_event(&connection, &id)
}

#[tauri::command]
pub async fn close_window(window: WebviewWindow) -> Result<(), AppError> {
    window.close()?;
    Ok(())
}

#[tauri::command]
pub async fn minimize_window(window: WebviewWindow) -> Result<(), AppError> {
    window.minimize()?;
    Ok(())
}

#[tauri::command]
pub async fn toggle_maximize_window(window: WebviewWindow) -> Result<(), AppError> {
    if window.is_maximized()? {
        window.unmaximize()?;
    } else {
        window.maximize()?;
    }

    Ok(())
}

#[tauri::command]
pub async fn toggle_quick_capture(app: AppHandle) -> Result<(), AppError> {
    if let Some(window) = app.get_webview_window("quickCapture") {
        if window.is_visible().unwrap_or(false) {
            window.hide().ok();
        } else {
            window.center().ok();
            window.show().ok();
            window.set_focus().ok();
        }
        return Ok(());
    }

    WebviewWindowBuilder::new(
        &app,
        "quickCapture",
        tauri::WebviewUrl::App("index.html#/quick-capture".into()),
    )
    .title("Quick Capture")
    .inner_size(540.0, 64.0)
    .resizable(false)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .transparent(true)
    .visible(false)
    .build()?;

    if let Some(window) = app.get_webview_window("quickCapture") {
        window.center().ok();
        window.show().ok();
        window.set_focus().ok();
    }

    Ok(())
}

#[tauri::command]
pub async fn hide_quick_capture(app: AppHandle) -> Result<(), AppError> {
    if let Some(window) = app.get_webview_window("quickCapture") {
        window.hide().ok();
    }
    Ok(())
}

const FOCUS_WIDTH: f64 = 240.0;
const FOCUS_HEIGHT: f64 = 180.0;
const FOCUS_MARGIN: f64 = 24.0;
const FOCUS_TASKBAR_OFFSET: f64 = 48.0;

fn focus_window_position(app: &AppHandle) -> Option<LogicalPosition<f64>> {
    let monitor = app.primary_monitor().ok().flatten()?;
    let scale = monitor.scale_factor();
    let size = monitor.size();
    let logical_width = size.width as f64 / scale;
    let logical_height = size.height as f64 / scale;
    let x = logical_width - FOCUS_WIDTH - FOCUS_MARGIN;
    let y = logical_height - FOCUS_HEIGHT - FOCUS_MARGIN - FOCUS_TASKBAR_OFFSET;
    Some(LogicalPosition::new(x, y))
}

#[tauri::command]
pub async fn open_focus_window(app: AppHandle, event_id: String) -> Result<(), AppError> {
    let position = focus_window_position(&app);

    if let Some(window) = app.get_webview_window("focus") {
        if let Some(pos) = position {
            window.set_position(pos).ok();
        }
        window.show().ok();
        window.set_focus().ok();
        window.emit("focus-event-changed", event_id).ok();
        return Ok(());
    }

    let url = format!("index.html#/focus?event={event_id}");
    let mut builder = WebviewWindowBuilder::new(&app, "focus", tauri::WebviewUrl::App(url.into()))
        .title("Focus")
        .inner_size(FOCUS_WIDTH, FOCUS_HEIGHT)
        .resizable(false)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .transparent(true);

    if let Some(pos) = position {
        builder = builder.position(pos.x, pos.y);
    }

    builder.build()?;

    if let Some(window) = app.get_webview_window("focus") {
        window.set_focus().ok();
    }

    Ok(())
}

#[tauri::command]
pub async fn close_focus_window(app: AppHandle) -> Result<(), AppError> {
    if let Some(window) = app.get_webview_window("focus") {
        window.hide().ok();
    }
    Ok(())
}

#[tauri::command]
pub async fn get_current_event(
    db_state: State<'_, DbState>,
) -> Result<Option<StudyEvent>, AppError> {
    let now = Local::now();
    let today = now.date_naive().format("%Y-%m-%d").to_string();
    let now_time = now.format("%H:%M").to_string();

    let connection = db_state
        .lock()
        .map_err(|_| AppError::State("database connection lock poisoned".into()))?;

    db::get_current_event(&connection, &today, &now_time)
}

#[tauri::command]
pub async fn get_next_event(
    db_state: State<'_, DbState>,
) -> Result<Option<StudyEvent>, AppError> {
    let now = Local::now();
    let today = now.date_naive().format("%Y-%m-%d").to_string();
    let now_time = now.format("%H:%M").to_string();

    let connection = db_state
        .lock()
        .map_err(|_| AppError::State("database connection lock poisoned".into()))?;

    db::get_next_event(&connection, &today, &now_time)
}

#[tauri::command]
pub async fn get_event_by_id(
    id: String,
    db_state: State<'_, DbState>,
) -> Result<StudyEvent, AppError> {
    let connection = db_state
        .lock()
        .map_err(|_| AppError::State("database connection lock poisoned".into()))?;

    db::get_event_by_id(&connection, &id)
}

#[tauri::command]
pub async fn update_taskbar_badge(app: AppHandle, count: i64) -> Result<(), AppError> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| AppError::State("main window not found".into()))?;

    if count <= 0 {
        window
            .set_overlay_icon(None)
            .map_err(|error| AppError::State(error.to_string()))?;
        return Ok(());
    }

    let badge_name = if count >= 9 {
        "9plus".to_string()
    } else {
        count.to_string()
    };
    let resource_path = app
        .path()
        .resolve(
            format!("icons/badge/{badge_name}.png"),
            BaseDirectory::Resource,
        )
        .map_err(|error| AppError::Path(error.to_string()))?;
    let icon = Image::from_path(&resource_path)
        .map_err(|error| AppError::State(error.to_string()))?;
    window
        .set_overlay_icon(Some(icon))
        .map_err(|error| AppError::State(error.to_string()))?;

    Ok(())
}
