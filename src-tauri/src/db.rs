use std::fs;

use chrono::Utc;
use rusqlite::{params, types::Type, Connection, Row};
use tauri::{AppHandle, Manager, Runtime};
use uuid::Uuid;

use crate::{
    error::AppError,
    models::{StudyEvent, StudyEventType, StudyPriority, Tag},
};

const DEFAULT_TAGS: [(&str, &str, &str, Option<&str>); 4] = [
    ("tfg", "TFG · Triton", "#378ADD", Some("BookOpen")),
    ("hackvault", "HackVault", "#34C759", Some("Code2")),
    ("ejpt", "eJPT", "#FF9F0A", Some("Shield")),
    ("so2", "SO II", "#FFD60A", Some("Server")),
];

pub fn init_db<R: Runtime>(app: &AppHandle<R>) -> Result<Connection, AppError> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| AppError::Path(error.to_string()))?;

    fs::create_dir_all(&app_data_dir)?;

    let db_path = app_data_dir.join("studyflow.db");
    let connection = Connection::open(db_path)?;
    connection.execute_batch("PRAGMA foreign_keys = ON;")?;

    create_tags_table(&connection)?;
    migrate_events_table(&connection)?;
    seed_default_tags_if_empty(&connection)?;

    Ok(connection)
}

fn create_tags_table(connection: &Connection) -> Result<(), AppError> {
    connection.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS tags (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          color TEXT NOT NULL,
          icon TEXT,
          created_at TEXT NOT NULL,
          sort_order INTEGER NOT NULL DEFAULT 0
        );
        ",
    )?;

    Ok(())
}

fn create_events_table(connection: &Connection) -> Result<(), AppError> {
    connection.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS events (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          date TEXT NOT NULL,
          start_time TEXT NOT NULL,
          duration_minutes INTEGER NOT NULL,
          tag_id TEXT,
          type TEXT NOT NULL,
          priority TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          scheduled INTEGER NOT NULL DEFAULT 1,
          completed INTEGER NOT NULL DEFAULT 0,
          completed_at TEXT,
          FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS idx_events_date
        ON events(date);

        CREATE INDEX IF NOT EXISTS idx_events_tag_id
        ON events(tag_id);

        CREATE INDEX IF NOT EXISTS idx_events_scheduled
        ON events(scheduled);

        CREATE INDEX IF NOT EXISTS idx_events_completed
        ON events(completed);
        ",
    )?;

    Ok(())
}

fn table_exists(connection: &Connection, table_name: &str) -> Result<bool, AppError> {
    let exists = connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?1)",
        params![table_name],
        |row| row.get::<_, i64>(0),
    )?;

    Ok(exists == 1)
}

fn column_exists(
    connection: &Connection,
    table_name: &str,
    column_name: &str,
) -> Result<bool, AppError> {
    let mut statement = connection.prepare(&format!("PRAGMA table_info({table_name})"))?;
    let columns = statement.query_map([], |row| row.get::<_, String>("name"))?;

    for column in columns {
        if column? == column_name {
            return Ok(true);
        }
    }

    Ok(false)
}

fn migrate_events_table(connection: &Connection) -> Result<(), AppError> {
    if !table_exists(connection, "events")? {
        return create_events_table(connection);
    }

    let has_old_tag = column_exists(connection, "events", "tag")?;
    let has_tag_id = column_exists(connection, "events", "tag_id")?;

    if !has_old_tag && has_tag_id {
        create_events_table(connection)?;
        return Ok(());
    }

    if has_old_tag && !has_tag_id {
        seed_default_tags_if_empty(connection)?;
        connection.execute_batch(
            "
            ALTER TABLE events RENAME TO events_legacy_tag;

            CREATE TABLE events (
              id TEXT PRIMARY KEY,
              title TEXT NOT NULL,
              description TEXT,
              date TEXT NOT NULL,
              start_time TEXT NOT NULL,
              duration_minutes INTEGER NOT NULL,
              tag_id TEXT,
              type TEXT NOT NULL,
              priority TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              scheduled INTEGER NOT NULL DEFAULT 1,
              completed INTEGER NOT NULL DEFAULT 0,
              completed_at TEXT,
              FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE SET NULL
            );

            INSERT INTO events (
              id, title, description, date, start_time, duration_minutes,
              tag_id, type, priority, created_at, updated_at
            )
            SELECT
              id,
              title,
              description,
              date,
              start_time,
              duration_minutes,
              CASE tag
                WHEN 'tfg' THEN 'tfg'
                WHEN 'hackvault' THEN 'hackvault'
                WHEN 'ejpt' THEN 'ejpt'
                WHEN 'so2' THEN 'so2'
                ELSE NULL
              END,
              type,
              priority,
              created_at,
              updated_at
            FROM events_legacy_tag;

            DROP TABLE events_legacy_tag;

            CREATE INDEX IF NOT EXISTS idx_events_date
            ON events(date);

            CREATE INDEX IF NOT EXISTS idx_events_tag_id
            ON events(tag_id);
            ",
        )?;
    }

    if !column_exists(connection, "events", "scheduled")? {
        connection
            .execute_batch("ALTER TABLE events ADD COLUMN scheduled INTEGER NOT NULL DEFAULT 1;")?;
    }

    if !column_exists(connection, "events", "completed")? {
        connection
            .execute_batch("ALTER TABLE events ADD COLUMN completed INTEGER NOT NULL DEFAULT 0;")?;
    }

    if !column_exists(connection, "events", "completed_at")? {
        connection.execute_batch("ALTER TABLE events ADD COLUMN completed_at TEXT;")?;
    }

    connection.execute_batch(
        "
        CREATE INDEX IF NOT EXISTS idx_events_scheduled ON events(scheduled);
        CREATE INDEX IF NOT EXISTS idx_events_completed ON events(completed);
        ",
    )?;

    Ok(())
}

fn seed_default_tags_if_empty(connection: &Connection) -> Result<(), AppError> {
    let count =
        connection.query_row("SELECT COUNT(*) FROM tags", [], |row| row.get::<_, i64>(0))?;

    if count > 0 {
        return Ok(());
    }

    let now = Utc::now().to_rfc3339();
    for (index, (id, name, color, icon)) in DEFAULT_TAGS.iter().enumerate() {
        connection.execute(
            "
            INSERT OR IGNORE INTO tags (id, name, color, icon, created_at, sort_order)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            ",
            params![id, name, color, icon, &now, index as i64],
        )?;
    }

    Ok(())
}

pub fn get_tags(connection: &Connection) -> Result<Vec<Tag>, AppError> {
    let mut statement = connection.prepare(
        "
        SELECT id, name, color, icon, created_at, sort_order
        FROM tags
        ORDER BY sort_order ASC, created_at ASC
        ",
    )?;

    let rows = statement.query_map([], map_tag)?;
    let tags = rows.collect::<Result<Vec<_>, _>>()?;
    Ok(tags)
}

pub fn insert_tag(
    connection: &Connection,
    name: &str,
    color: &str,
    icon: Option<&str>,
) -> Result<Tag, AppError> {
    let id = Uuid::new_v4().to_string();
    let created_at = Utc::now().to_rfc3339();
    let sort_order = connection.query_row(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM tags",
        [],
        |row| row.get::<_, i64>(0),
    )?;

    connection.execute(
        "
        INSERT INTO tags (id, name, color, icon, created_at, sort_order)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6)
        ",
        params![&id, name, color, icon, &created_at, sort_order],
    )?;

    Ok(Tag {
        id,
        name: name.to_string(),
        color: color.to_string(),
        icon: icon.map(str::to_string),
        created_at,
        sort_order,
    })
}

pub fn update_tag(
    connection: &Connection,
    id: &str,
    name: &str,
    color: &str,
    icon: Option<&str>,
) -> Result<Tag, AppError> {
    let affected_rows = connection.execute(
        "
        UPDATE tags
        SET name = ?2,
            color = ?3,
            icon = ?4
        WHERE id = ?1
        ",
        params![id, name, color, icon],
    )?;

    if affected_rows == 0 {
        return Err(AppError::NotFound(format!(
            "tag with id '{id}' was not found"
        )));
    }

    get_tag(connection, id)
}

pub fn delete_tag(connection: &Connection, id: &str) -> Result<(), AppError> {
    let affected_rows = connection.execute("DELETE FROM tags WHERE id = ?1", params![id])?;

    if affected_rows == 0 {
        return Err(AppError::NotFound(format!(
            "tag with id '{id}' was not found"
        )));
    }

    Ok(())
}

pub fn reorder_tags(connection: &mut Connection, ids: &[String]) -> Result<(), AppError> {
    let transaction = connection.transaction()?;

    for (index, id) in ids.iter().enumerate() {
        transaction.execute(
            "UPDATE tags SET sort_order = ?2 WHERE id = ?1",
            params![id, index as i64],
        )?;
    }

    transaction.commit()?;
    Ok(())
}

pub fn count_events_by_tag(connection: &Connection, id: &str) -> Result<i64, AppError> {
    let count = connection.query_row(
        "SELECT COUNT(*) FROM events WHERE tag_id = ?1",
        params![id],
        |row| row.get::<_, i64>(0),
    )?;

    Ok(count)
}

pub fn get_events_in_range(
    connection: &Connection,
    start_date: &str,
    end_date: &str,
) -> Result<Vec<StudyEvent>, AppError> {
    let mut statement = connection.prepare(
        "
        SELECT id, title, description, date, start_time, duration_minutes, tag_id, type, priority, created_at, updated_at, scheduled, completed, completed_at
        FROM events
        WHERE date BETWEEN ?1 AND ?2 AND scheduled = 1
        ORDER BY date ASC, start_time ASC
        ",
    )?;

    let rows = statement.query_map(params![start_date, end_date], map_study_event)?;
    let events = rows.collect::<Result<Vec<_>, _>>()?;
    Ok(events)
}

pub fn get_events_for_date(
    connection: &Connection,
    date: &str,
) -> Result<Vec<StudyEvent>, AppError> {
    let mut statement = connection.prepare(
        "
        SELECT id, title, description, date, start_time, duration_minutes, tag_id, type, priority, created_at, updated_at, scheduled, completed, completed_at
        FROM events
        WHERE date = ?1 AND scheduled = 1
        ORDER BY start_time ASC
        ",
    )?;

    let rows = statement.query_map(params![date], map_study_event)?;
    let events = rows.collect::<Result<Vec<_>, _>>()?;
    Ok(events)
}

pub fn get_inbox_events(connection: &Connection) -> Result<Vec<StudyEvent>, AppError> {
    let mut statement = connection.prepare(
        "
        SELECT id, title, description, date, start_time, duration_minutes, tag_id, type, priority, created_at, updated_at, scheduled, completed, completed_at
        FROM events
        WHERE scheduled = 0
        ORDER BY created_at DESC
        ",
    )?;

    let rows = statement.query_map([], map_study_event)?;
    let events = rows.collect::<Result<Vec<_>, _>>()?;
    Ok(events)
}

pub fn get_archive_events(
    connection: &Connection,
    today: &str,
    limit: i64,
    offset: i64,
) -> Result<Vec<StudyEvent>, AppError> {
    let mut statement = connection.prepare(
        "
        SELECT id, title, description, date, start_time, duration_minutes, tag_id, type, priority, created_at, updated_at, scheduled, completed, completed_at
        FROM events
        WHERE scheduled = 1 AND (date < ?1 OR completed = 1)
        ORDER BY date DESC, start_time DESC
        LIMIT ?2 OFFSET ?3
        ",
    )?;

    let rows = statement.query_map(params![today, limit, offset], map_study_event)?;
    let events = rows.collect::<Result<Vec<_>, _>>()?;
    Ok(events)
}

pub fn count_inbox_events(connection: &Connection) -> Result<i64, AppError> {
    let count = connection.query_row(
        "SELECT COUNT(*) FROM events WHERE scheduled = 0",
        [],
        |row| row.get::<_, i64>(0),
    )?;

    Ok(count)
}

pub fn schedule_event(
    connection: &Connection,
    id: &str,
    date: &str,
    start_time: &str,
) -> Result<StudyEvent, AppError> {
    let updated_at = chrono::Utc::now().to_rfc3339();

    let affected_rows = connection.execute(
        "
        UPDATE events
        SET date = ?2,
            start_time = ?3,
            scheduled = 1,
            updated_at = ?4
        WHERE id = ?1
        ",
        params![id, date, start_time, &updated_at],
    )?;

    if affected_rows == 0 {
        return Err(AppError::NotFound(format!(
            "event with id '{id}' was not found"
        )));
    }

    get_event_by_id(connection, id)
}

pub fn unschedule_event(connection: &Connection, id: &str) -> Result<StudyEvent, AppError> {
    let updated_at = chrono::Utc::now().to_rfc3339();

    let affected_rows = connection.execute(
        "
        UPDATE events
        SET scheduled = 0,
            updated_at = ?2
        WHERE id = ?1
        ",
        params![id, &updated_at],
    )?;

    if affected_rows == 0 {
        return Err(AppError::NotFound(format!(
            "event with id '{id}' was not found"
        )));
    }

    get_event_by_id(connection, id)
}

pub fn complete_event(connection: &Connection, id: &str) -> Result<StudyEvent, AppError> {
    let now = chrono::Utc::now().to_rfc3339();

    let event = get_event_by_id(connection, id)?;
    let new_completed = !event.completed;
    let new_completed_at = if new_completed {
        Some(now.clone())
    } else {
        None
    };

    let affected_rows = connection.execute(
        "
        UPDATE events
        SET completed = ?2,
            completed_at = ?3,
            updated_at = ?4
        WHERE id = ?1
        ",
        params![
            id,
            if new_completed { 1 } else { 0 },
            new_completed_at.as_deref(),
            &now,
        ],
    )?;

    if affected_rows == 0 {
        return Err(AppError::NotFound(format!(
            "event with id '{id}' was not found"
        )));
    }

    get_event_by_id(connection, id)
}

fn get_event_by_id(connection: &Connection, id: &str) -> Result<StudyEvent, AppError> {
    let event = connection.query_row(
        "
        SELECT id, title, description, date, start_time, duration_minutes, tag_id, type, priority, created_at, updated_at, scheduled, completed, completed_at
        FROM events
        WHERE id = ?1
        ",
        params![id],
        map_study_event,
    )?;

    Ok(event)
}

pub fn insert_event(connection: &Connection, event: &StudyEvent) -> Result<StudyEvent, AppError> {
    connection.execute(
        "
        INSERT INTO events (
          id, title, description, date, start_time, duration_minutes, tag_id, type, priority, created_at, updated_at, scheduled, completed, completed_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
        ",
        params![
            &event.id,
            &event.title,
            event.description.as_deref(),
            &event.date,
            &event.start_time,
            event.duration_minutes,
            event.tag_id.as_deref(),
            event.event_type.as_str(),
            event.priority.as_str(),
            &event.created_at,
            &event.updated_at,
            if event.scheduled { 1 } else { 0 },
            if event.completed { 1 } else { 0 },
            event.completed_at.as_deref(),
        ],
    )?;

    Ok(event.clone())
}

pub fn update_event(connection: &Connection, event: &StudyEvent) -> Result<StudyEvent, AppError> {
    let affected_rows = connection.execute(
        "
        UPDATE events
        SET title = ?2,
            description = ?3,
            date = ?4,
            start_time = ?5,
            duration_minutes = ?6,
            tag_id = ?7,
            type = ?8,
            priority = ?9,
            created_at = ?10,
            updated_at = ?11,
            scheduled = ?12,
            completed = ?13,
            completed_at = ?14
        WHERE id = ?1
        ",
        params![
            &event.id,
            &event.title,
            event.description.as_deref(),
            &event.date,
            &event.start_time,
            event.duration_minutes,
            event.tag_id.as_deref(),
            event.event_type.as_str(),
            event.priority.as_str(),
            &event.created_at,
            &event.updated_at,
            if event.scheduled { 1 } else { 0 },
            if event.completed { 1 } else { 0 },
            event.completed_at.as_deref(),
        ],
    )?;

    if affected_rows == 0 {
        return Err(AppError::NotFound(format!(
            "event with id '{}' was not found",
            event.id
        )));
    }

    Ok(event.clone())
}

pub fn delete_event(connection: &Connection, id: &str) -> Result<(), AppError> {
    let affected_rows = connection.execute("DELETE FROM events WHERE id = ?1", params![id])?;

    if affected_rows == 0 {
        return Err(AppError::NotFound(format!(
            "event with id '{}' was not found",
            id
        )));
    }

    Ok(())
}

pub fn bulk_insert_events(
    connection: &mut Connection,
    events: &[StudyEvent],
) -> Result<usize, AppError> {
    let transaction = connection.transaction()?;
    let mut statement = transaction.prepare(
        "
        INSERT INTO events (
          id, title, description, date, start_time, duration_minutes, tag_id, type, priority, created_at, updated_at, scheduled, completed, completed_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
        ",
    )?;

    let mut inserted = 0usize;
    for event in events {
        statement.execute(params![
            &event.id,
            &event.title,
            event.description.as_deref(),
            &event.date,
            &event.start_time,
            event.duration_minutes,
            event.tag_id.as_deref(),
            event.event_type.as_str(),
            event.priority.as_str(),
            &event.created_at,
            &event.updated_at,
            if event.scheduled { 1 } else { 0 },
            if event.completed { 1 } else { 0 },
            event.completed_at.as_deref(),
        ])?;
        inserted += 1;
    }

    drop(statement);
    transaction.commit()?;

    Ok(inserted)
}

fn get_tag(connection: &Connection, id: &str) -> Result<Tag, AppError> {
    let tag = connection.query_row(
        "
        SELECT id, name, color, icon, created_at, sort_order
        FROM tags
        WHERE id = ?1
        ",
        params![id],
        map_tag,
    )?;

    Ok(tag)
}

fn map_tag(row: &Row<'_>) -> rusqlite::Result<Tag> {
    Ok(Tag {
        id: row.get("id")?,
        name: row.get("name")?,
        color: row.get("color")?,
        icon: row.get("icon")?,
        created_at: row.get("created_at")?,
        sort_order: row.get("sort_order")?,
    })
}

fn map_study_event(row: &Row<'_>) -> rusqlite::Result<StudyEvent> {
    Ok(StudyEvent {
        id: row.get("id")?,
        title: row.get("title")?,
        description: row.get("description")?,
        date: row.get("date")?,
        start_time: row.get("start_time")?,
        duration_minutes: row.get("duration_minutes")?,
        tag_id: row.get("tag_id")?,
        event_type: parse_event_type(&row.get::<_, String>("type")?)?,
        priority: parse_priority(&row.get::<_, String>("priority")?)?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        scheduled: row.get::<_, i64>("scheduled")? != 0,
        completed: row.get::<_, i64>("completed")? != 0,
        completed_at: row.get("completed_at")?,
    })
}

fn parse_event_type(value: &str) -> rusqlite::Result<StudyEventType> {
    StudyEventType::from_str(value).ok_or_else(|| invalid_enum_error("StudyEventType", value))
}

fn parse_priority(value: &str) -> rusqlite::Result<StudyPriority> {
    StudyPriority::from_str(value).ok_or_else(|| invalid_enum_error("StudyPriority", value))
}

fn invalid_enum_error(kind: &'static str, value: &str) -> rusqlite::Error {
    rusqlite::Error::FromSqlConversionFailure(
        0,
        Type::Text,
        std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            format!("invalid {kind} value '{value}'"),
        )
        .into(),
    )
}
