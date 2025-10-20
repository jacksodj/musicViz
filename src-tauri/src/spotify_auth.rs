// Spotify OAuth and Token Management
// Handles secure storage of OAuth tokens and PKCE code verifier

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;
use keyring::Entry;

// Keychain service and account names
const KEYRING_SERVICE: &str = "musicViz";
const KEYRING_ACCOUNT: &str = "spotify_tokens";

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
        // Try to load persisted tokens on startup
        let token = match Self::load_from_keyring() {
            Ok(Some(t)) => {
                println!("Loaded persisted Spotify tokens");
                Some(t)
            }
            Ok(None) => {
                println!("No persisted Spotify tokens found");
                None
            }
            Err(e) => {
                println!("Failed to load persisted tokens: {}", e);
                None
            }
        };

        Self {
            token: Mutex::new(token),
        }
    }

    /// Save tokens to OS keyring
    fn save_to_keyring(token: &SpotifyToken) -> Result<(), String> {
        let entry = Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT)
            .map_err(|e| format!("Failed to create keyring entry: {}", e))?;

        let json = serde_json::to_string(token)
            .map_err(|e| format!("Failed to serialize token: {}", e))?;

        entry.set_password(&json)
            .map_err(|e| format!("Failed to save to keyring: {}", e))?;

        println!("Saved tokens to keyring");
        Ok(())
    }

    /// Load tokens from OS keyring
    fn load_from_keyring() -> Result<Option<SpotifyToken>, String> {
        let entry = Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT)
            .map_err(|e| format!("Failed to create keyring entry: {}", e))?;

        match entry.get_password() {
            Ok(json) => {
                let token = serde_json::from_str(&json)
                    .map_err(|e| format!("Failed to deserialize token: {}", e))?;
                Ok(Some(token))
            }
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(format!("Failed to load from keyring: {}", e))
        }
    }

    /// Delete tokens from OS keyring
    fn delete_from_keyring() -> Result<(), String> {
        let entry = Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT)
            .map_err(|e| format!("Failed to create keyring entry: {}", e))?;

        match entry.delete_credential() {
            Ok(()) => {
                println!("Deleted tokens from keyring");
                Ok(())
            }
            Err(keyring::Error::NoEntry) => Ok(()), // Already deleted
            Err(e) => Err(format!("Failed to delete from keyring: {}", e))
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

    // Save to memory
    let mut state_token = state.token.lock().unwrap();
    *state_token = Some(token.clone());

    println!("Stored Spotify token (expires at: {})", expires_at);

    // Persist to OS keychain
    if let Err(e) = SpotifyAuthState::save_to_keyring(&token) {
        println!("Warning: Failed to persist token to keyring: {}", e);
        // Don't fail the operation if persistence fails - memory storage still works
    }

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
    // Clear from memory
    let mut token = state.token.lock().unwrap();
    *token = None;

    // Clear from keyring
    if let Err(e) = SpotifyAuthState::delete_from_keyring() {
        println!("Warning: Failed to delete tokens from keyring: {}", e);
    }

    println!("Cleared Spotify tokens");
    Ok(())
}

/// Open URL in system browser
#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    println!("Opening URL: {}", url);
    webbrowser::open(&url).map_err(|e| e.to_string())
}
