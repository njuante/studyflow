use chrono::Local;
use tauri::{State, WebviewWindow};

use crate::{
    db,
    error::AppError,
    models::{StudyEvent, Tag},
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
