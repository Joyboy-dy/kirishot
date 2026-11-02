//! Captures kept in memory while a selection, a thumbnail or an editor uses them.
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use crate::capture::types::CaptureSession;

#[derive(Default)]
pub struct CaptureStore {
    sessions: Mutex<HashMap<String, Arc<CaptureSession>>>,
}

impl CaptureStore {
    pub fn insert(&self, session: CaptureSession) -> String {
        let id = session.id.clone();
        self.sessions
            .lock()
            .unwrap()
            .insert(id.clone(), Arc::new(session));
        id
    }

    pub fn get(&self, id: &str) -> Option<Arc<CaptureSession>> {
        self.sessions.lock().unwrap().get(id).cloned()
    }

    pub fn remove(&self, id: &str) {
        self.sessions.lock().unwrap().remove(id);
    }

    #[cfg(test)]
    pub fn len(&self) -> usize {
        self.sessions.lock().unwrap().len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn empty_session(id: &str) -> CaptureSession {
        CaptureSession {
            id: id.into(),
            taken_at: chrono::Local::now(),
            monitors: Vec::new(),
            windows: Vec::new(),
            pointer: None,
        }
    }

    #[test]
    fn store_insert_get_remove() {
        let store = CaptureStore::default();
        let id = store.insert(empty_session("01JBX4"));
        assert_eq!(id, "01JBX4");
        assert!(store.get(&id).is_some());
        assert_eq!(store.len(), 1);
        store.remove(&id);
        assert!(store.get(&id).is_none());
        assert_eq!(store.len(), 0);
    }
}
