use std::sync::Arc;

use crate::infra::storage::Storage;

#[derive(Clone)]
pub struct AppState {
    pub storage: Arc<Storage>,
}
