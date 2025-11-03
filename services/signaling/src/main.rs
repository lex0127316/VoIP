use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::{
    extract::{Query, State},
    http::HeaderMap,
    response::IntoResponse,
    routing::get,
    Router,
};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::Deserialize;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::broadcast;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[derive(Clone)]
struct AppState {
    decoding_key: Arc<DecodingKey>,
    validation: Validation,
    redis: Option<redis::aio::ConnectionManager>,
    // broadcast presence updates (simple demo)
    presence_tx: broadcast::Sender<String>,
}

#[derive(Deserialize)]
struct WsParams {
    token: Option<String>,
}

fn bearer_token(headers: &HeaderMap) -> Option<String> {
    headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .map(|s| s.to_string())
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    headers: HeaderMap,
    Query(params): Query<WsParams>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let token = bearer_token(&headers).or(params.token);
    let Some(token) = token else {
        return axum::http::StatusCode::UNAUTHORIZED;
    };

    let claims = match decode::<dto::AuthClaims>(&token, &state.decoding_key, &state.validation) {
        Ok(d) => d.claims,
        Err(err) => {
            tracing::warn!(error = %err, "jwt decode failed");
            return axum::http::StatusCode::UNAUTHORIZED;
        }
    };

    ws.on_upgrade(move |socket| handle_socket(socket, state, claims))
}

async fn handle_socket(mut socket: WebSocket, state: AppState, claims: dto::AuthClaims) {
    let presence_key = format!(
        "presence:{}:{}",
        claims.tenant_id.as_hyphenated(),
        claims.sub.as_hyphenated()
    );

    // mark online and start TTL refresh
    if let Some(mut conn) = state.redis.clone() {
        let _ = redis::cmd("SET")
            .arg(&presence_key)
            .arg("online")
            .arg("EX")
            .arg(60)
            .query_async::<_, ()>(&mut conn)
            .await;
    }

    let mut refresh_interval = tokio::time::interval(std::time::Duration::from_secs(30));
    let mut refresh_task_conn = state.redis.clone();
    let presence_key_clone = presence_key.clone();
    let refresh_handle = tokio::spawn(async move {
        loop {
            refresh_interval.tick().await;
            if let Some(mut conn) = refresh_task_conn.clone() {
                let _ = redis::cmd("EXPIRE")
                    .arg(&presence_key_clone)
                    .arg(60)
                    .query_async::<_, ()>(&mut conn)
                    .await;
            }
        }
    });

    let _ = state
        .presence_tx
        .send(format!("online:{}:{}", claims.tenant_id, claims.sub));

    while let Some(Ok(msg)) = socket.recv().await {
        match msg {
            Message::Text(t) => {
                tracing::debug!(payload = %t, "ws text");
                let _ = socket.send(Message::Text(t)).await;
            }
            Message::Binary(b) => {
                tracing::debug!(size = b.len(), "ws binary");
            }
            Message::Ping(p) => {
                let _ = socket.send(Message::Pong(p)).await;
            }
            Message::Close(_) => break,
            _ => {}
        }
    }

    refresh_handle.abort();
    if let Some(mut conn) = state.redis.clone() {
        let _ = redis::cmd("DEL")
            .arg(&presence_key)
            .query_async::<_, ()>(&mut conn)
            .await;
    }
    let _ = state
        .presence_tx
        .send(format!("offline:{}:{}", claims.tenant_id, claims.sub));
}

#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let jwt_secret =
        std::env::var("JWT_SECRET").unwrap_or_else(|_| "dev_secret_change_me".to_string());
    let decoding_key = Arc::new(DecodingKey::from_secret(jwt_secret.as_bytes()));
    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;

    let redis_url = std::env::var("REDIS_URL").ok();
    let redis_manager = if let Some(url) = redis_url {
        match redis::Client::open(url) {
            Ok(client) => match client.get_tokio_connection_manager().await {
                Ok(mgr) => Some(mgr),
                Err(err) => {
                    tracing::warn!(error = %err, "failed to connect to redis");
                    None
                }
            },
            Err(err) => {
                tracing::warn!(error = %err, "invalid redis url");
                None
            }
        }
    } else {
        None
    };

    let (presence_tx, _rx) = broadcast::channel(1024);

    let state = AppState {
        decoding_key,
        validation,
        redis: redis_manager,
        presence_tx,
    };

    let app = Router::new()
        .route("/health", get(|| async { "ok" }))
        .route(
            "/ws",
            get(
                |ws: WebSocketUpgrade,
                 headers: HeaderMap,
                 params: Query<WsParams>,
                 State(state): State<AppState>| async move {
                    ws_handler(ws, headers, params, State(state)).await
                },
            ),
        )
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 8080));
    tracing::info!(%addr, "signaling service starting");
    axum::serve(tokio::net::TcpListener::bind(addr).await.unwrap(), app)
        .await
        .unwrap();
}
