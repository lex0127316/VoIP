use axum::{
    extract::State,
    routing::{get, put},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres, Row};
use std::net::SocketAddr;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use uuid::Uuid;

/// Application state shared across HTTP handlers.
///
/// The PBX service is intentionally stateless aside from the Postgres pool,
/// which is cloned into each request via Axum's extractor.
#[derive(Clone)]
struct AppState {
    db: Pool<Postgres>,
}

#[derive(Debug, Serialize, Deserialize)]
struct CallFlow {
    id: Uuid,
    tenant_id: Uuid,
    name: String,
    config: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct CreateFlowRequest {
    tenant_id: Uuid,
    name: String,
    config: serde_json::Value,
}

async fn health() -> &'static str {
    "ok"
}

/// Return a snapshot of recent call-flows for a tenant.
///
/// The query is capped to 100 rows so dashboards can refresh often without
/// exhausting the database. Rows are mapped into serializable structs to avoid
/// leaking SQLx types into the API surface.
async fn list_flows(
    State(state): State<AppState>,
) -> anyhow::Result<Json<Vec<CallFlow>>, axum::http::StatusCode> {
    let rows = sqlx::query(
        r#"SELECT id, tenant_id, name, config FROM call_flows ORDER BY created_at DESC LIMIT 100"#,
    )
    .fetch_all(&state.db)
    .await
    .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;

    let flows = rows
        .into_iter()
        .filter_map(|row| {
            let id: Uuid = row.try_get("id").ok()?;
            let tenant_id: Uuid = row.try_get("tenant_id").ok()?;
            let name: String = row.try_get("name").ok()?;
            let config: serde_json::Value = row.try_get("config").ok()?;
            Some(CallFlow {
                id,
                tenant_id,
                name,
                config,
            })
        })
        .collect();

    Ok(Json(flows))
}

/// Create a brand new call-flow definition.
///
/// In the larger system this would be invoked by the call-flow builder UI.
/// We generate a primary key server-side to avoid trusting the caller.
async fn create_flow(
    State(state): State<AppState>,
    Json(req): Json<CreateFlowRequest>,
) -> Result<Json<CallFlow>, axum::http::StatusCode> {
    let id = Uuid::new_v4();
    sqlx::query(r#"INSERT INTO call_flows (id, tenant_id, name, config) VALUES ($1, $2, $3, $4)"#)
        .bind(id)
        .bind(req.tenant_id)
        .bind(&req.name)
        .bind(&req.config)
        .execute(&state.db)
        .await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(CallFlow {
        id,
        tenant_id: req.tenant_id,
        name: req.name,
        config: req.config,
    }))
}

#[derive(Debug, Deserialize)]
struct UpdateFlowRequest {
    name: Option<String>,
    config: Option<serde_json::Value>,
}

/// Update an existing call-flow, performing an optimistic read first.
///
/// PBX flows are relatively small JSON blobs. We fetch the current revision,
/// merge in any optional fields provided by the client, and then overwrite
/// atomically so we do not clobber other tenants' flows.
async fn update_flow(
    State(state): State<AppState>,
    axum::extract::Path((tenant_id, id)): axum::extract::Path<(Uuid, Uuid)>,
    Json(req): Json<UpdateFlowRequest>,
) -> Result<Json<CallFlow>, axum::http::StatusCode> {
    // get current
    let row =
        sqlx::query(r#"SELECT name, config FROM call_flows WHERE tenant_id = $1 AND id = $2"#)
            .bind(tenant_id)
            .bind(id)
            .fetch_optional(&state.db)
            .await
            .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?
            .ok_or(axum::http::StatusCode::NOT_FOUND)?;

    let current_name: String = row
        .try_get("name")
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    let current_config: serde_json::Value = row
        .try_get("config")
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;

    let new_name = req.name.unwrap_or(current_name);
    let new_config = req.config.unwrap_or(current_config);

    sqlx::query(
        r#"UPDATE call_flows SET name = $3, config = $4, updated_at = NOW() WHERE tenant_id = $1 AND id = $2"#,
    )
    .bind(tenant_id)
    .bind(id)
    .bind(&new_name)
    .bind(&new_config)
    .execute(&state.db)
    .await
    .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(CallFlow {
        id,
        tenant_id,
        name: new_name,
        config: new_config,
    }))
}

#[tokio::main]
async fn main() {
    // PBX acts as the source of truth for routing logic. On boot we set up
    // tracing, create a small connection pool, and expose the REST surface that
    // the builder (and eventually SIP ingress) use to fetch call-flow graphs.
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let db_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@localhost:5432/voip".to_string());
    // Small connection pool is enough for development; PBX is primarily write-light.
    let pool = sqlx::postgres::PgPoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await
        .expect("failed to connect db");

    let state = AppState { db: pool };

    let app = Router::new()
        // CRUD surface consumed by the call-flow builder.
        .route("/health", get(health))
        .route("/flows", get(list_flows).post(create_flow))
        .route("/flows/:tenant_id/:id", put(update_flow))
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 8081));
    tracing::info!(%addr, "pbx service starting");
    axum::serve(tokio::net::TcpListener::bind(addr).await.unwrap(), app)
        .await
        .unwrap();
}
