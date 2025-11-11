use axum::http::StatusCode;
use axum::{
    extract::State,
    routing::{get, post},
    Json, Router,
};
use serde::Serialize;
use std::{
    collections::HashMap,
    net::{Ipv4Addr, SocketAddr},
    sync::Arc,
};
use tokio::{net::UdpSocket, sync::RwLock};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use uuid::Uuid;

/// Shared state for the media relay HTTP API.
///
/// Each allocation creates a [`Relay`] (backed by a UDP socket) which is stored
/// so subsequent HTTP calls can look it up for tear-down/inspection.
#[derive(Clone)]
struct AppState {
    relays: Arc<RwLock<HashMap<Uuid, Arc<Relay>>>>,
}

struct Relay {
    id: Uuid,
    socket: Arc<UdpSocket>,
    side_a: Arc<RwLock<Option<SocketAddr>>>,
    side_b: Arc<RwLock<Option<SocketAddr>>>,
}

impl Relay {
    /// Allocate a brand new UDP relay and spawn the forwarding loop.
    ///
    /// We bind an ephemeral port, keep track of which endpoint is "side A" or
    /// "side B" based on a lightweight `HELLO` handshake, then mirror RTP/SRTP
    /// datagrams between both sides.  The `tokio::spawn` keeps the hot packet
    /// loop off the HTTP executor.
    async fn new() -> anyhow::Result<(Arc<Relay>, u16)> {
        let socket = UdpSocket::bind((Ipv4Addr::UNSPECIFIED, 0)).await?;
        let local_port = socket.local_addr()?.port();
        let socket = Arc::new(socket);
        let relay = Arc::new(Relay {
            id: Uuid::new_v4(),
            socket: socket.clone(),
            side_a: Arc::new(RwLock::new(None)),
            side_b: Arc::new(RwLock::new(None)),
        });

        // receive loop
        let relay_clone = relay.clone();
        tokio::spawn(async move {
            let mut buf = vec![0u8; 2048];
            loop {
                match relay_clone.socket.recv_from(&mut buf).await {
                    Ok((n, from)) => {
                        if n == 0 {
                            continue;
                        }

                        // On first packets from each side expect a small handshake: b"HELLO " + side ("a" or "b")
                        // This avoids mis-routing stray RTP noise and mirrors the ICE nominated pair.
                        if buf[..n].starts_with(b"HELLO ") {
                            let side = &buf[6..n];
                            if side == b"a" {
                                let mut a = relay_clone.side_a.write().await;
                                *a = Some(from);
                                tracing::info!(%from, "relay side A bound");
                            } else if side == b"b" {
                                let mut b = relay_clone.side_b.write().await;
                                *b = Some(from);
                                tracing::info!(%from, "relay side B bound");
                            }
                            continue;
                        }

                        let is_a = {
                            let a = relay_clone.side_a.read().await;
                            a.map(|addr| addr == from).unwrap_or(false)
                        };

                        let is_b = {
                            let b = relay_clone.side_b.read().await;
                            b.map(|addr| addr == from).unwrap_or(false)
                        };

                        // Forward traffic toward the opposite negotiated leg.
                        if is_a {
                            if let Some(to) = *relay_clone.side_b.read().await {
                                // We ignore send errors here; the next inbound packet will retry.
                                let _ = relay_clone.socket.send_to(&buf[..n], to).await;
                            }
                        } else if is_b {
                            if let Some(to) = *relay_clone.side_a.read().await {
                                let _ = relay_clone.socket.send_to(&buf[..n], to).await;
                            }
                        } else {
                            // unknown sender; ignore until handshake is received
                        }
                    }
                    Err(err) => {
                        tracing::warn!(error = %err, "udp recv failed");
                        break;
                    }
                }
            }
        });

        Ok((relay, local_port))
    }
}

#[derive(Serialize)]
struct AllocResponse {
    session_id: Uuid,
    relay_port: u16,
}

async fn alloc(
    State(state): State<AppState>,
    Json(_): Json<serde_json::Value>,
) -> Result<Json<AllocResponse>, StatusCode> {
    // RTP allocations are short lived, so we keep them in memory behind an RwLock.
    let (relay, port) = Relay::new()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let id = relay.id;
    state.relays.write().await.insert(id, relay);
    Ok(Json(AllocResponse {
        session_id: id,
        relay_port: port,
    }))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct IceServersResponse {
    ice_servers: Vec<serde_json::Value>,
}

async fn ice_servers() -> Json<IceServersResponse> {
    let mut servers = Vec::new();
    if let Ok(urls) = std::env::var("STUN_URLS") {
        let list: Vec<String> = urls
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();
        if !list.is_empty() {
            servers.push(serde_json::json!({"urls": list}));
        }
    }
    if let (Ok(url), Ok(username), Ok(credential)) = (
        std::env::var("TURN_URL"),
        std::env::var("TURN_USERNAME"),
        std::env::var("TURN_PASSWORD"),
    ) {
        servers.push(serde_json::json!({
            "urls": [url],
            "username": username,
            "credential": credential
        }));
    }
    Json(IceServersResponse { ice_servers: servers })
}

#[tokio::main]
async fn main() {
    // The media service bridges WebRTC media planes (via UDP) and exposes ICE
    // configuration so browsers know which STUN/TURN servers to use. The async
    // runtime primarily hosts the UDP forwarding tasks spawned per allocation.
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let state = AppState {
        relays: Arc::new(RwLock::new(HashMap::new())),
    };

    let app = Router::new()
        // REST endpoints consumed by the WebRTC layer for allocation + ICE details.
        .route("/health", get(|| async { "ok" }))
        .route("/alloc", post(alloc))
        .route("/ice", get(ice_servers))
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 8083));
    tracing::info!(%addr, "media service starting (UDP relay + ICE config)");
    axum::serve(tokio::net::TcpListener::bind(addr).await.unwrap(), app)
        .await
        .unwrap();
}
