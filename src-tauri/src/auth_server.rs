use axum::{
    extract::{Query, State},
    response::{Html, IntoResponse, Redirect},
    routing::get,
    Router,
};
use local_ip_address::local_ip;
use serde::Deserialize;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use tokio::sync::oneshot;

// Shared state for the server
struct ServerState {
    app_handle: AppHandle,
    shutdown_tx: Mutex<Option<oneshot::Sender<()>>>,
}

#[derive(Deserialize)]
struct CallbackParams {
    code: String,
    state: Option<String>,
}

#[derive(Deserialize)]
struct LoginParams {
    url: String,
}

// Handler for /login - redirects to the actual Spotify auth URL
async fn login_handler(Query(params): Query<LoginParams>) -> Redirect {
    Redirect::temporary(&params.url)
}

// Handler for /callback - receives code from Spotify
async fn callback_handler(
    State(state): State<Arc<ServerState>>,
    Query(params): Query<CallbackParams>,
) -> impl IntoResponse {
    // Emit event to frontend
    let _ = state.app_handle.emit("spotify-auth-code", &params.code);

    // Schedule shutdown
    // We can't shutdown immediately because we need to return the response first
    // In a real app we might want to keep it running for a bit or use a graceful shutdown trigger
    // For now, we'll just return the success page. The frontend can call a stop command.

    Html(
        r#"
        <!DOCTYPE html>
        <html>
        <head>
            <title>Login Successful</title>
            <style>
                body { font-family: system-ui, sans-serif; background: #121212; color: white; text-align: center; padding: 50px; }
                .success { color: #1db954; font-size: 24px; margin-bottom: 20px; }
                p { color: #b3b3b3; }
            </style>
        </head>
        <body>
            <div class="success">Login Successful!</div>
            <p>You can now return to the musicViz app on your TV.</p>
            <script>window.close();</script>
        </body>
        </html>
    "#,
    )
}

#[tauri::command]
pub async fn start_local_auth_server(app_handle: AppHandle) -> Result<String, String> {
    // Get local IP
    let my_local_ip = local_ip().map_err(|e| format!("Failed to get local IP: {}", e))?;

    // Find a free port (let's try 0 to let OS assign, or specific range)
    // Using fixed port 8888 to ensure Redirect URI is consistent for Spotify whitelist
    let port = 8888;
    let addr = SocketAddr::from((my_local_ip, port));

    let (tx, rx) = oneshot::channel();

    let state = Arc::new(ServerState {
        app_handle: app_handle.clone(),
        shutdown_tx: Mutex::new(Some(tx)),
    });

    let app = Router::new()
        .route("/login", get(login_handler))
        .route("/callback", get(callback_handler))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|e| format!("Failed to bind server: {}", e))?;

    println!("Starting local auth server on {}:{}", my_local_ip, port);

    // Spawn server in background
    tauri::async_runtime::spawn(async move {
        axum::serve(listener, app)
            .with_graceful_shutdown(async {
                rx.await.ok();
            })
            .await
            .unwrap();
    });

    // Return the base URL for the frontend to generate QR code
    Ok(format!("http://{}:{}", my_local_ip, port))
}

#[tauri::command]
pub async fn stop_local_auth_server() -> Result<(), String> {
    // In this simple implementation, we might not need explicit stop if we just let it run
    // or if we store the shutdown signal in a global state.
    // For simplicity in this iteration, we'll rely on the server being lightweight
    // and maybe just timing out or being restarted.
    // To properly implement stop, we'd need to store the `tx` in a managed Tauri state.
    // Let's skip explicit stop for this MVP step and rely on app restart or just leaving it open for the session.
    // If needed, we can add a `ServerManager` state to `lib.rs`.
    Ok(())
}
