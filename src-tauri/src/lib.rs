// Spotify authentication module
mod spotify_auth;

// Govee integration module
mod govee;

use tauri::{Emitter, Manager};
use tauri_plugin_deep_link::DeepLinkExt;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_deep_link::init())
        // Initialize Spotify authentication state
        .manage(spotify_auth::PKCEState::new())
        .manage(spotify_auth::SpotifyAuthState::new())
        // Initialize Govee state
        .manage(govee::GoveeState::default())
        // Setup deep link handler for OAuth callback
        .setup(|app| {
            let handle = app.handle().clone();

            // Listen for deep link events from the plugin
            app.deep_link().on_open_url(move |event| {
                for url in event.urls() {
                    println!("Deep link received: {}", url);

                    // Emit event to frontend with the full URL
                    let _ = handle.emit("deep-link", url.as_str());
                }
            });

            // Enable DevTools for debugging in production builds
            #[cfg(not(debug_assertions))]
            {
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                }
            }

            Ok(())
        })
        // Register commands
        .invoke_handler(tauri::generate_handler![
            greet,
            // Spotify auth commands
            spotify_auth::store_code_verifier,
            spotify_auth::get_code_verifier,
            spotify_auth::store_spotify_token,
            spotify_auth::get_spotify_token,
            spotify_auth::is_authenticated,
            spotify_auth::logout,
            spotify_auth::open_url,
            spotify_auth::test_keyring,
            // Govee integration commands
            govee::govee_discover_devices,
            govee::govee_send_lan_command,
            govee::govee_get_device,
            govee::govee_get_all_devices,
            govee::govee_clear_devices,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
