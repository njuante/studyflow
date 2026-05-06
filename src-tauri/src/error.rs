use serde::ser::{SerializeStruct, Serializer};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("database error: {0}")]
    Database(String),
    #[error("io error: {0}")]
    Io(String),
    #[error("path resolution error: {0}")]
    Path(String),
    #[error("invalid data: {0}")]
    InvalidData(String),
    #[error("resource not found: {0}")]
    NotFound(String),
    #[error("state error: {0}")]
    State(String),
}

impl AppError {
    fn code(&self) -> &'static str {
        match self {
            Self::Database(_) => "database_error",
            Self::Io(_) => "io_error",
            Self::Path(_) => "path_error",
            Self::InvalidData(_) => "invalid_data",
            Self::NotFound(_) => "not_found",
            Self::State(_) => "state_error",
        }
    }
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut state = serializer.serialize_struct("AppError", 2)?;
        state.serialize_field("code", self.code())?;
        state.serialize_field("message", &self.to_string())?;
        state.end()
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(value: rusqlite::Error) -> Self {
        Self::Database(value.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(value: std::io::Error) -> Self {
        Self::Io(value.to_string())
    }
}

impl From<tauri::Error> for AppError {
    fn from(value: tauri::Error) -> Self {
        Self::Path(value.to_string())
    }
}
