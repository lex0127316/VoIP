use axum::{routing::get, Json, Router};
use serde_json::json;
use std::net::SocketAddr;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

async fn health() -> Json<serde_json::Value> {
    Json(json!({"status":"ok"}))
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

    let app = Router::new().route("/health", get(health));
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
