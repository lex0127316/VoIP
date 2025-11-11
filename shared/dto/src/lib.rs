use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TenantScopedId {
    pub tenant_id: Uuid,
    pub id: Uuid,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthClaims {
    pub sub: Uuid, // user id
    pub tenant_id: Uuid,
    pub exp: usize,
    pub iat: usize,
}
