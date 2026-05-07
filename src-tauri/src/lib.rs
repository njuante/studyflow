mod commands;
mod db;
mod error;
mod models;

use std::sync::Mutex;

use rusqlite::Connection;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let connection = db::init_db(app.handle())?;
            app.manage(Mutex::new(connection));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_tags,
            commands::create_tag,
            commands::update_tag,
            commands::delete_tag,
            commands::reorder_tags,
            commands::count_events_by_tag,
            commands::get_events_by_tag,
            commands::get_tag_stats,
            commands::bulk_change_tag,
            commands::get_events_in_range,
            commands::create_event,
            commands::update_event,
            commands::delete_event,
            commands::bulk_create_events,
            commands::get_today_events,
            commands::get_inbox_events,
            commands::get_archive_events,
            commands::count_inbox_events,
            commands::schedule_event,
            commands::unschedule_event,
            commands::complete_event,
            commands::close_window,
            commands::minimize_window,
            commands::toggle_maximize_window,
            commands::toggle_quick_capture,
            commands::hide_quick_capture,
            commands::open_focus_window,
            commands::close_focus_window,
            commands::get_current_event,
            commands::get_next_event,
            commands::get_event_by_id
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

pub type DbState = Mutex<Connection>;
