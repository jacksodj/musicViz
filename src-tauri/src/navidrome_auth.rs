// Navidrome/Subsonic credential storage
// Handles secure storage of server URL, username, and password

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;
use keyring::Entry;
use std::fs;
use std::path::PathBuf;
use std::env;

// Keychain service and account names
const KEYRING_SERVICE: &str = "musicViz";
const KEYRING_ACCOUNT: &str = "navidrome_credentials";

/// Navidrome server credentials
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NavidromeCredentials {
    pub server_url: String,
    pub username: String,
    pub password: String,
}

/// Credential storage state
pub struct NavidromeAuthState {
    credentials: Mutex<Option<NavidromeCredentials>>,
}

impl NavidromeAuthState {
    pub fn new() -> Self {
        // Try to load persisted credentials on startup
        let creds = match Self::load_persisted_credentials() {
            Ok(Some(c)) => {
                println!("[NavidromeAuth] Loaded persisted credentials for {}", c.username);
                Some(c)
            }
            Ok(None) => {
                println!("[NavidromeAuth] No persisted credentials found");
                None
            }
            Err(e) => {
                println!("[NavidromeAuth] Failed to load persisted credentials: {}", e);
                None
            }
        };

        Self {
            credentials: Mutex::new(creds),
        }
    }

    /// Save credentials to OS keyring
    fn save_to_keyring(creds: &NavidromeCredentials) -> Result<(), String> {
        println!("[NavidromeAuth] Saving credentials to keyring...");
        println!("  Service: {}, Account: {}", KEYRING_SERVICE, KEYRING_ACCOUNT);

        let entry = Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT)
            .map_err(|e| {
                let err_msg = format!("Failed to create keyring entry: {:?}", e);
                println!("[NavidromeAuth] Keyring error: {}", err_msg);
                err_msg
            })?;

        let json = serde_json::to_string(creds)
            .map_err(|e| format!("Failed to serialize credentials: {}", e))?;

        entry.set_password(&json)
            .map_err(|e| {
                let err_msg = format!("Failed to save to keyring: {:?}", e);
                println!("[NavidromeAuth] Keyring save error: {}", err_msg);
                err_msg
            })?;

        println!("[NavidromeAuth] Successfully saved credentials to keyring");
        Ok(())
    }

    /// Load credentials from OS keyring
    fn load_from_keyring() -> Result<Option<NavidromeCredentials>, String> {
        println!("[NavidromeAuth] Loading credentials from keyring...");

        let entry = Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT)
            .map_err(|e| format!("Failed to create keyring entry: {:?}", e))?;

        match entry.get_password() {
            Ok(json) => {
                let creds: NavidromeCredentials = serde_json::from_str(&json)
                    .map_err(|e| format!("Failed to deserialize credentials: {}", e))?;
                println!("[NavidromeAuth] Loaded credentials from keyring for user: {}", creds.username);
                Ok(Some(creds))
            }
            Err(keyring::Error::NoEntry) => {
                println!("[NavidromeAuth] No credentials in keyring");
                Ok(None)
            }
            Err(e) => {
                println!("[NavidromeAuth] Keyring load error: {:?}", e);
                Err(format!("Failed to load from keyring: {:?}", e))
            }
        }
    }

    /// Delete credentials from OS keyring
    fn delete_from_keyring() -> Result<(), String> {
        let entry = Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT)
            .map_err(|e| format!("Failed to create keyring entry: {}", e))?;

        match entry.delete_credential() {
            Ok(()) => {
                println!("[NavidromeAuth] Deleted credentials from keyring");
                Ok(())
            }
            Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(format!("Failed to delete from keyring: {}", e))
        }
    }

    /// Determine platform-specific config directory
    fn base_config_dir() -> Result<PathBuf, String> {
        #[cfg(target_os = "macos")]
        {
            if let Ok(home) = env::var("HOME") {
                return Ok(PathBuf::from(home).join("Library").join("Application Support"));
            }
        }

        #[cfg(target_os = "windows")]
        {
            if let Ok(roaming) = env::var("APPDATA") {
                return Ok(PathBuf::from(roaming));
            }
        }

        #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
        {
            if let Ok(home) = env::var("HOME") {
                return Ok(PathBuf::from(home).join(".config"));
            }
        }

        Err("Unable to determine configuration directory".to_string())
    }

    /// Get storage directory
    fn storage_dir(create: bool) -> Result<PathBuf, String> {
        let mut dir = Self::base_config_dir()?;
        dir.push("musicViz");

        if create {
            if let Err(e) = fs::create_dir_all(&dir) {
                return Err(format!("Failed to create storage directory {:?}: {}", dir, e));
            }
        }

        Ok(dir)
    }

    /// Save credentials to file (fallback)
    fn save_to_file(creds: &NavidromeCredentials) -> Result<(), String> {
        let dir = Self::storage_dir(true)?;
        let path = dir.join("navidrome_credentials.json");

        let json = serde_json::to_string(creds)
            .map_err(|e| format!("Failed to serialize credentials: {}", e))?;

        fs::write(&path, json)
            .map_err(|e| format!("Failed to write credentials file: {}", e))?;

        println!("[NavidromeAuth] Saved credentials to file: {:?}", path);
        Ok(())
    }

    /// Load credentials from file (fallback)
    fn load_from_file() -> Result<Option<NavidromeCredentials>, String> {
        let dir = match Self::storage_dir(false) {
            Ok(dir) => dir,
            Err(_) => return Ok(None),
        };

        let path = dir.join("navidrome_credentials.json");

        if !path.exists() {
            return Ok(None);
        }

        let json = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read credentials file: {}", e))?;

        let creds: NavidromeCredentials = serde_json::from_str(&json)
            .map_err(|e| format!("Failed to deserialize credentials: {}", e))?;

        println!("[NavidromeAuth] Loaded credentials from file for user: {}", creds.username);
        Ok(Some(creds))
    }

    /// Delete credentials file (fallback)
    fn delete_file() -> Result<(), String> {
        let dir = match Self::storage_dir(false) {
            Ok(dir) => dir,
            Err(_) => return Ok(()),
        };

        let path = dir.join("navidrome_credentials.json");

        if path.exists() {
            fs::remove_file(&path)
                .map_err(|e| format!("Failed to delete credentials file: {}", e))?;
            println!("[NavidromeAuth] Deleted credentials file");
        }

        Ok(())
    }

    /// Load credentials from keyring or file
    fn load_persisted_credentials() -> Result<Option<NavidromeCredentials>, String> {
        match Self::load_from_keyring() {
            Ok(Some(creds)) => return Ok(Some(creds)),
            Ok(None) => println!("[NavidromeAuth] Keyring empty, checking file storage"),
            Err(err) => println!("[NavidromeAuth] Keyring load failed: {}", err),
        }

        Self::load_from_file()
    }
}

/// Store Navidrome credentials securely
#[tauri::command]
pub fn store_navidrome_credentials(
    state: State<NavidromeAuthState>,
    server_url: String,
    username: String,
    password: String,
) -> Result<(), String> {
    println!("[NavidromeAuth] Storing credentials for {} at {}", username, server_url);

    let creds = NavidromeCredentials {
        server_url,
        username,
        password,
    };

    // Save to memory
    let mut state_creds = state.credentials.lock().unwrap();
    *state_creds = Some(creds.clone());

    // Persist to keyring
    if let Err(e) = NavidromeAuthState::save_to_keyring(&creds) {
        println!("[NavidromeAuth] Warning: Failed to save to keyring: {}", e);
    }

    // Persist to file fallback
    if let Err(e) = NavidromeAuthState::save_to_file(&creds) {
        println!("[NavidromeAuth] Warning: Failed to save to file: {}", e);
    }

    Ok(())
}

/// Retrieve stored Navidrome credentials
#[tauri::command]
pub fn get_navidrome_credentials(
    state: State<NavidromeAuthState>,
) -> Result<Option<NavidromeCredentials>, String> {
    let mut creds = state.credentials.lock().unwrap();

    // Hydrate from storage if empty
    if creds.is_none() {
        match NavidromeAuthState::load_persisted_credentials() {
            Ok(Some(persisted)) => {
                println!("[NavidromeAuth] Hydrated credentials from storage");
                *creds = Some(persisted);
            }
            Ok(None) => {
                println!("[NavidromeAuth] No credentials in storage");
            }
            Err(err) => {
                println!("[NavidromeAuth] Failed to load from storage: {}", err);
            }
        }
    }

    Ok(creds.clone())
}

/// Check if Navidrome credentials exist
#[tauri::command]
pub fn has_navidrome_credentials(
    state: State<NavidromeAuthState>,
) -> Result<bool, String> {
    let creds = state.credentials.lock().unwrap();
    Ok(creds.is_some())
}

/// Clear stored Navidrome credentials (logout)
#[tauri::command]
pub fn navidrome_logout(
    state: State<NavidromeAuthState>,
) -> Result<(), String> {
    println!("[NavidromeAuth] Logging out...");

    // Clear from memory
    let mut creds = state.credentials.lock().unwrap();
    *creds = None;

    // Clear from keyring
    if let Err(e) = NavidromeAuthState::delete_from_keyring() {
        println!("[NavidromeAuth] Warning: Failed to delete from keyring: {}", e);
    }

    // Clear from file
    if let Err(e) = NavidromeAuthState::delete_file() {
        println!("[NavidromeAuth] Warning: Failed to delete file: {}", e);
    }

    println!("[NavidromeAuth] Logout complete");
    Ok(())
}
