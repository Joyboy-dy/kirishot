use serde::{Deserialize, Serialize};

/// Stable error codes shared with the front end, which translates them.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, specta::Type, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ErrorCode {
    Capture,
    NoActiveCapture,
    InvalidSelection,
    Encode,
    Save,
    Clipboard,
    Settings,
    Shortcut,
    Window,
    Internal,
}

/// The only error type that crosses the IPC boundary.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type, thiserror::Error)]
#[error("{message}")]
pub struct KirishotError {
    pub code: ErrorCode,
    pub message: String,
}

impl KirishotError {
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

pub type KResult<T> = Result<T, KirishotError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn error_serializes_as_code_and_message() {
        let e = KirishotError::new(ErrorCode::Save, "Disque plein");
        assert_eq!(
            serde_json::to_value(&e).unwrap(),
            serde_json::json!({"code": "save", "message": "Disque plein"})
        );
    }
}
