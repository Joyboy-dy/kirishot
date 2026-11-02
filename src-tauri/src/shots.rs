//! Captures waiting for their automatic action, from the moment they are taken until the
//! thumbnail expires or an editor takes them over (spec J2 § 6.2).
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use image::RgbaImage;

use crate::output::CaptureMeta;
use crate::settings::model::AutoAction;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ShotState {
    Pending,
    Delivered,
    Editing,
}

struct Shot {
    image: Arc<RgbaImage>,
    meta: CaptureMeta,
    action: AutoAction,
    state: ShotState,
    copied: bool,
    temp_png: Option<PathBuf>,
}

/// What callers read about a shot; the image is shared, not copied.
#[derive(Clone)]
pub struct ShotView {
    pub image: Arc<RgbaImage>,
    pub meta: CaptureMeta,
    pub action: AutoAction,
    pub state: ShotState,
    pub copied: bool,
    pub temp_png: Option<PathBuf>,
}

#[derive(Default)]
pub struct ShotStore {
    shots: Mutex<HashMap<String, Shot>>,
}

impl ShotStore {
    pub fn insert(&self, image: RgbaImage, meta: CaptureMeta, action: AutoAction) -> String {
        let id = ulid::Ulid::generate().to_string();
        let shot = Shot {
            image: Arc::new(image),
            meta,
            action,
            state: ShotState::Pending,
            copied: false,
            temp_png: None,
        };
        self.shots.lock().unwrap().insert(id.clone(), shot);
        id
    }

    pub fn get(&self, id: &str) -> Option<ShotView> {
        let shots = self.shots.lock().unwrap();
        let s = shots.get(id)?;
        Some(ShotView {
            image: s.image.clone(),
            meta: s.meta.clone(),
            action: s.action,
            state: s.state,
            copied: s.copied,
            temp_png: s.temp_png.clone(),
        })
    }

    /// Pending → Delivered: returns the action to run, once. Any other state gives `None`.
    pub fn expire(&self, id: &str) -> Option<AutoAction> {
        let mut shots = self.shots.lock().unwrap();
        let shot = shots.get_mut(id)?;
        if shot.state != ShotState::Pending {
            return None;
        }
        shot.state = ShotState::Delivered;
        Some(shot.action)
    }

    /// Pending or Delivered → Editing; `false` when the shot is gone.
    pub fn begin_edit(&self, id: &str) -> bool {
        let mut shots = self.shots.lock().unwrap();
        match shots.get_mut(id) {
            Some(shot) => {
                shot.state = ShotState::Editing;
                true
            }
            None => false,
        }
    }

    pub fn mark_copied(&self, id: &str) {
        if let Some(shot) = self.shots.lock().unwrap().get_mut(id) {
            shot.copied = true;
        }
    }

    pub fn set_temp_png(&self, id: &str, path: PathBuf) {
        if let Some(shot) = self.shots.lock().unwrap().get_mut(id) {
            shot.temp_png = Some(path);
        }
    }

    /// Forgets a shot unless an editor uses it; returns its temporary file to delete.
    pub fn release(&self, id: &str) -> Option<PathBuf> {
        let mut shots = self.shots.lock().unwrap();
        if shots.get(id)?.state == ShotState::Editing {
            return None;
        }
        shots.remove(id)?.temp_png
    }

    /// Forgets a shot whatever its state (its editor closed, or it was deleted).
    pub fn remove(&self, id: &str) -> Option<PathBuf> {
        self.shots.lock().unwrap().remove(id)?.temp_png
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Barrier;

    fn meta() -> CaptureMeta {
        CaptureMeta {
            taken_at: chrono::Local::now(),
            window_title: None,
        }
    }

    fn store_with_one() -> (ShotStore, String) {
        let store = ShotStore::default();
        let id = store.insert(RgbaImage::new(4, 3), meta(), AutoAction::SaveAndCopy);
        (store, id)
    }

    #[test]
    fn insert_gives_a_ulid_and_a_pending_shot() {
        let (store, id) = store_with_one();
        assert_eq!(id.len(), 26);
        let shot = store.get(&id).unwrap();
        assert_eq!(shot.state, ShotState::Pending);
        assert_eq!(shot.image.dimensions(), (4, 3));
        assert!(!shot.copied);
    }

    #[test]
    fn expire_runs_once() {
        let (store, id) = store_with_one();
        assert_eq!(store.expire(&id), Some(AutoAction::SaveAndCopy));
        assert_eq!(store.expire(&id), None);
        assert_eq!(store.get(&id).unwrap().state, ShotState::Delivered);
    }

    #[test]
    fn editing_cancels_the_automatic_action() {
        let (store, id) = store_with_one();
        assert!(store.begin_edit(&id));
        assert_eq!(store.expire(&id), None);
    }

    #[test]
    fn edit_after_expiry_still_opens() {
        let (store, id) = store_with_one();
        store.expire(&id);
        assert!(store.begin_edit(&id));
        assert_eq!(store.get(&id).unwrap().state, ShotState::Editing);
    }

    #[test]
    fn release_keeps_an_editing_shot() {
        let (store, id) = store_with_one();
        store.begin_edit(&id);
        store.release(&id);
        assert!(store.get(&id).is_some());
        store.remove(&id);
        assert!(store.get(&id).is_none());
    }

    #[test]
    fn release_returns_the_temp_file() {
        let (store, id) = store_with_one();
        store.set_temp_png(&id, PathBuf::from("a.png"));
        store.mark_copied(&id);
        assert!(store.get(&id).unwrap().copied);
        assert_eq!(store.release(&id), Some(PathBuf::from("a.png")));
        assert!(store.get(&id).is_none());
        assert!(!store.begin_edit(&id));
    }

    #[test]
    fn concurrent_expire_runs_once() {
        let (store, id) = store_with_one();
        let barrier = Barrier::new(8);
        let ran = std::thread::scope(|s| {
            let handles: Vec<_> = (0..8)
                .map(|_| {
                    s.spawn(|| {
                        barrier.wait();
                        store.expire(&id).is_some()
                    })
                })
                .collect();
            handles
                .into_iter()
                .map(|h| h.join().unwrap())
                .filter(|ran| *ran)
                .count()
        });
        assert_eq!(ran, 1);
    }
}
