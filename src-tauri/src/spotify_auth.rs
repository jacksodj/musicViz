// Spotify OAuth and Token Management
// Handles secure storage of OAuth tokens and PKCE code verifier

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

/// Temporary storage for PKCE code_verifier during OAuth flow
pub struct PKCEState {
    code_verifier: Mutex<Option<String>>,
}

impl PKCEState {
    pub fn new() -> Self {
        Self {
            code_verifier: Mutex::new(None),
        }
    }
}

/// Spotify access and refresh tokens
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpotifyToken {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: u64,
}

/// Token storage state
pub struct SpotifyAuthState {
    token: Mutex<Option<SpotifyToken>>,
}

impl SpotifyAuthState {
    pub fn new() -> Self {
        Self {
            token: Mutex::new(None),
        }
    }
}

/// Store PKCE code_verifier temporarily during OAuth flow
#[tauri::command]
pub fn store_code_verifier(state: State<PKCEState>, code_verifier: String) -> Result<(), String> {
    let len = code_verifier.len();
    let mut verifier = state.code_verifier.lock().unwrap();
    *verifier = Some(code_verifier);
    println!("Stored code_verifier (length: {})", len);
    Ok(())
}

/// Retrieve PKCE code_verifier for token exchange
#[tauri::command]
pub fn get_code_verifier(state: State<PKCEState>) -> Result<String, String> {
    let mut verifier = state.code_verifier.lock().unwrap();
    let code = verifier
        .take() // Take and clear (one-time use)
        .ok_or_else(|| "No code verifier found".to_string())?;

    println!("Retrieved code_verifier (length: {})", code.len());
    Ok(code)
}

/// Store Spotify access and refresh tokens securely
#[tauri::command]
pub fn store_spotify_token(
    state: State<SpotifyAuthState>,
    access_token: String,
    refresh_token: Option<String>,
    expires_in: u64,
) -> Result<(), String> {
    let expires_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs()
        + expires_in;

    let token = SpotifyToken {
        access_token,
        refresh_token,
        expires_at,
    };

    let mut state_token = state.token.lock().unwrap();
    *state_token = Some(token.clone());

    println!("Stored Spotify token (expires at: {})", expires_at);

    // TODO Phase 2: Persist to OS keychain
    // macOS: Use keyring-rs crate
    // Android: Use EncryptedSharedPreferences

    Ok(())
}

/// Retrieve stored Spotify token
#[tauri::command]
pub fn get_spotify_token(
    state: State<SpotifyAuthState>,
) -> Result<Option<SpotifyToken>, String> {
    let token = state.token.lock().unwrap();

    if let Some(ref t) = *token {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        if now >= t.expires_at {
            println!("Token expired (expired at: {}, now: {})", t.expires_at, now);
            return Ok(None);
        }
    }

    Ok(token.clone())
}

/// Check if user is authenticated
#[tauri::command]
pub fn is_authenticated(state: State<SpotifyAuthState>) -> Result<bool, String> {
    let token = state.token.lock().unwrap();

    if let Some(ref t) = *token {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        return Ok(now < t.expires_at);
    }

    Ok(false)
}

/// Clear stored tokens (logout)
#[tauri::command]
pub fn logout(state: State<SpotifyAuthState>) -> Result<(), String> {
    let mut token = state.token.lock().unwrap();
    *token = None;
    println!("Cleared Spotify tokens");
    Ok(())
}

/// Open URL in system browser
#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    println!("Opening URL: {}", url);
    webbrowser::open(&url).map_err(|e| e.to_string())
}
