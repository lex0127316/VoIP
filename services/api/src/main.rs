use axum::{http::Method, routing::get, Json, Router};
use serde_json::json;
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

async fn health() -> Json<serde_json::Value> {
    Json(json!({"status":"ok"}))
}

async fn metrics_overview() -> Json<serde_json::Value> {
    Json(json!({
        "activeCalls": 12,
        "concurrentCapacity": 48,
        "avgHandleTime": 305,
        "serviceLevel": 0.92,
        "abandonedRate": 0.04
    }))
}

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

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(health))
        .route("/metrics/overview", get(metrics_overview))
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
