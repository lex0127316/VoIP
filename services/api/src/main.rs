//! HTTP facade consumed by the Next.js frontend while the deeper services are
//! still taking shape. Every handler returns deterministic data so the UI can
//! exercise navigation, state machines, and error boundaries.

use axum::{http::Method, routing::get, Json, Router};
use serde_json::json;
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

/// Lightweight health probe used by readiness checks and dashboards.
async fn health() -> Json<serde_json::Value> {
    Json(json!({"status":"ok"}))
}

/// Stub out metrics normally delivered by the analytics stack.
async fn metrics_overview() -> Json<serde_json::Value> {
    Json(json!({
        "activeCalls": 12,
        "concurrentCapacity": 48,
        "avgHandleTime": 305,
        "serviceLevel": 0.92,
        "abandonedRate": 0.04
    }))
}

/// Simulate a paged set of users for the admin portal.
async fn list_users() -> Json<serde_json::Value> {
    Json(json!({
        "users": [
            {
                "id": "1",
                "name": "Avery Harper",
                "email": "avery@example.com",
                "role": "admin",
                "status": "active"
            },
            {
                "id": "2",
                "name": "Morgan Lee",
                "email": "morgan@example.com",
                "role": "agent",
                "status": "active"
            },
            {
                "id": "3",
                "name": "Riley Chen",
                "email": "riley@example.com",
                "role": "supervisor",
                "status": "invited"
            }
        ]
    }))
}

/// Accept user provisioning requests.
//
// In production this would publish to a queue or call into the PBX. For now we
// acknowledge immediately so the UI can exercise optimistic updates.
async fn invite_user() -> Json<serde_json::Value> {
    Json(json!({ "ok": true }))
}

/// Mirror PBX data so the builder can render a canonical call-flow.
async fn list_callflows() -> Json<serde_json::Value> {
    Json(json!({
        "callflows": [
            {
                "id": "default",
                "name": "Main IVR",
                "updatedAt": chrono::Utc::now().to_rfc3339(),
                "nodes": [
                    {
                        "id": "welcome",
                        "type": "menu",
                        "label": "Welcome prompt"
                    },
                    {
                        "id": "sales",
                        "type": "queue",
                        "label": "Route to sales queue",
                        "target": "sales_queue"
                    },
                    {
                        "id": "support",
                        "type": "queue",
                        "label": "Route to support queue",
                        "target": "support_queue"
                    },
                    {
                        "id": "after-hours",
                        "type": "voicemail",
                        "label": "After hours voicemail",
                        "target": "general_vm"
                    }
                ]
            }
        ]
    }))
}

/// Persist a call-flow change coming from the UI.
async fn upsert_callflow() -> Json<serde_json::Value> {
    Json(json!({ "ok": true }))
}

/// Provide synthetic voice analytics for the dashboard.
///
/// The data mimics what an OLAP pipeline would eventually emit (hourly buckets,
/// moving averages, sentiment inference, etc.).
async fn analytics_voice() -> Json<serde_json::Value> {
    let series: Vec<_> = (0..8)
        .map(|idx| {
            let ts = chrono::Utc::now() - chrono::Duration::hours(idx);
            json!({
                "timestamp": ts.to_rfc3339(),
                "calls": 20 + idx * 3,
                "avgDuration": 180 + idx * 12,
                "sentiment": 0.65 + (idx as f64) * 0.02
            })
        })
        .collect();

    Json(json!({ "series": series }))
}

/// Boot the API shim, layering permissive CORS so the local Next.js app can
/// talk to it without extra plumbing.
#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let port = std::env::var("API_PORT")
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(8081);

    // Frontend and API live on different origins during local development so we
    // allow every origin/method while prototyping. Tighten before production.
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers(Any);

    let app = Router::new()
        // Keep routes minimal; each mirrors a section of the dashboard UI.
        .route("/health", get(health))
        .route("/metrics/overview", get(metrics_overview))
        .route("/users", get(list_users).post(invite_user))
        .route("/callflows", get(list_callflows).put(upsert_callflow))
        .route("/analytics/voice", get(analytics_voice))
        .layer(cors);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!(%addr, "api service starting");

    let listener = match tokio::net::TcpListener::bind(addr).await {
        Ok(listener) => listener,
        Err(error) => {
            tracing::error!(%error, %addr, "failed to bind api listener");
            return;
        }
    };

    if let Err(error) = axum::serve(listener, app).await {
        tracing::error!(%error, "api server exited with error");
    }
}
