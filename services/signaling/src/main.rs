use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::{
    extract::{Query, State},
    http::HeaderMap,
    routing::get,
    Router,
};
use axum::response::{IntoResponse, Response};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::Deserialize;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::broadcast;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

/// Shared application state carried into each websocket session.
///
/// We keep the compiled JWT keys, an optional Redis connection used for
/// coarse presence tracking, and a broadcast channel that propagates events
/// (online/offline) to every connected task.
#[derive(Clone)]
struct AppState {
    decoding_key: Arc<DecodingKey>,
    validation: Validation,
    redis: Option<redis::aio::ConnectionManager>,
    // Broadcast presence updates so other connections can react.
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

/// Entry point for every websocket upgrade.
///
/// We accept a bearer token either via `Authorization` or query string and
/// synchronously verify it before upgrading.  This keeps malformed or expired
/// clients from consuming websocket capacity.
async fn ws_handler(
    ws: WebSocketUpgrade,
    headers: HeaderMap,
    Query(params): Query<WsParams>,
    State(state): State<AppState>,
) -> Response {
    let token = bearer_token(&headers).or(params.token);
    let Some(token) = token else {
        return axum::http::StatusCode::UNAUTHORIZED.into_response();
    };

    let claims = match decode::<dto::AuthClaims>(&token, &state.decoding_key, &state.validation) {
        Ok(d) => d.claims,
        Err(err) => {
            tracing::warn!(error = %err, "jwt decode failed");
            return axum::http::StatusCode::UNAUTHORIZED.into_response();
        }
    };

    ws.on_upgrade(move |socket| handle_socket(socket, state, claims))
}

/// Drive the lifetime of a single websocket connection.
///
/// The task keeps track of per-user presence in Redis, echoes messages for now,
/// and ensures the TTL is refreshed via a background task.  When the client
/// disconnects we clean up the Redis keys and broadcast that the agent left.
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
    let refresh_task_conn = state.redis.clone();
    let presence_key_clone = presence_key.clone();
    // Keep the presence indicator alive while the connection stays up.
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

    // Notify other listeners that the agent is now available for routing.
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
    // Broadcast the offline signal so supervisor dashboards can update instantly.
    let _ = state
        .presence_tx
        .send(format!("offline:{}:{}", claims.tenant_id, claims.sub));
}

/// Bootstrap the signaling service: configure tracing, JWT validation, Redis
/// (if available) and expose the websocket endpoint used by the softphone.
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
    // JWTs issued by the API include expiry; enforce it at the edge so expired
    // agents cannot reconnect without refreshing their session.
    validation.validate_exp = true;

    // Presence is optional; when configured we store agent availability in Redis so
    // other services (routing, analytics) can read it without binding to this process.
    let redis_url = std::env::var("REDIS_URL").ok();
    let redis_manager = if let Some(url) = redis_url {
        match redis::Client::open(url) {
            Ok(client) => match client.get_connection_manager().await {
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

    // High fan-out presence channel. If receivers lag behind we drop messages rather
    // than block signalling threads, hence the reasonably large buffer.
    let (presence_tx, _rx) = broadcast::channel(1024);

    let state = AppState {
        decoding_key,
        validation,
        redis: redis_manager,
        presence_tx,
    };

    // Expose the websocket entry point consumed by the web softphone.
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
