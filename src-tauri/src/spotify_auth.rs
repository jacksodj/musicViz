// Spotify OAuth and Token Management
// Handles secure storage of OAuth tokens and PKCE code verifier

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;
use keyring::Entry;
use std::fs;
use std::path::PathBuf;
use std::env;

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
        // Try to load persisted tokens on startup (keyring or file fallback)
        let token = match Self::load_persisted_token() {
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
        println!("Attempting to save tokens to keyring...");
        println!("  Service: {}, Account: {}", KEYRING_SERVICE, KEYRING_ACCOUNT);
        println!("  Token expires at: {}", token.expires_at);

        let entry = Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT)
            .map_err(|e| {
                let err_msg = format!("Failed to create keyring entry: {:?}", e);
                println!("Keyring error (create): {}", err_msg);
                println!("  This may be a permission issue or keyring not available");
                err_msg
            })?;

        let json = serde_json::to_string(token)
            .map_err(|e| format!("Failed to serialize token: {}", e))?;

        println!("Serialized token (length: {} bytes), attempting to save to keyring...", json.len());

        entry.set_password(&json)
            .map_err(|e| {
                let err_msg = format!("Failed to save to keyring: {:?}", e);
                println!("Keyring save error: {}", err_msg);
                println!("  Platform: {}", std::env::consts::OS);
                println!("  Check if keychain/credential manager is accessible");
                err_msg
            })?;

        // Verify it was saved by immediately trying to read it back
        match entry.get_password() {
            Ok(_) => println!("Successfully saved and verified tokens in keyring"),
            Err(e) => println!("Warning: Saved but couldn't verify: {:?}", e),
        }

        Ok(())
    }

    /// Load tokens from OS keyring
    fn load_from_keyring() -> Result<Option<SpotifyToken>, String> {
        println!("Attempting to load tokens from keyring...");
        println!("  Service: {}, Account: {}", KEYRING_SERVICE, KEYRING_ACCOUNT);

        let entry = Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT)
            .map_err(|e| {
                let err_msg = format!("Failed to create keyring entry for loading: {:?}", e);
                println!("Keyring error (load/create): {}", err_msg);
                err_msg
            })?;

        match entry.get_password() {
            Ok(json) => {
                println!("Found token in keyring (length: {} bytes)", json.len());
                let token: SpotifyToken = serde_json::from_str(&json)
                    .map_err(|e| {
                        println!("Failed to deserialize token from keyring: {}", e);
                        format!("Failed to deserialize token: {}", e)
                    })?;
                println!("Successfully loaded token from keyring, expires at: {}", token.expires_at);
                Ok(Some(token))
            }
            Err(keyring::Error::NoEntry) => {
                println!("No token found in keyring (NoEntry)");
                Ok(None)
            }
            Err(e) => {
                println!("Failed to load from keyring: {:?}", e);
                println!("  Platform: {}", std::env::consts::OS);
                Err(format!("Failed to load from keyring: {:?}", e))
            }
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

    /// Determine local fallback storage path (within user config directory)
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

    /// Determine platform-specific base configuration directory
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

    /// Persist token to local file as fallback when keyring is unavailable
    fn save_to_file(token: &SpotifyToken) -> Result<(), String> {
        let dir = Self::storage_dir(true)?;
        let path = dir.join("spotify_token.json");

        let json = serde_json::to_string(token)
            .map_err(|e| format!("Failed to serialize token for file storage: {}", e))?;

        fs::write(&path, json)
            .map_err(|e| format!("Failed to write token file {:?}: {}", path, e))?;

        println!("Persisted token to file: {:?}", path);
        Ok(())
    }

    /// Load token from local file fallback
    fn load_from_file() -> Result<Option<SpotifyToken>, String> {
        let dir = match Self::storage_dir(false) {
            Ok(dir) => dir,
            Err(err) => {
                println!("File storage unavailable: {}", err);
                return Ok(None);
            }
        };

        let path = dir.join("spotify_token.json");

        if !path.exists() {
            println!("No token file found at {:?}", path);
            return Ok(None);
        }

        let json = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read token file {:?}: {}", path, e))?;

        let token: SpotifyToken = serde_json::from_str(&json)
            .map_err(|e| format!("Failed to deserialize token file {:?}: {}", path, e))?;

        println!("Loaded Spotify token from file storage (expires at: {})", token.expires_at);
        Ok(Some(token))
    }

    /// Delete token file fallback
    fn delete_file() -> Result<(), String> {
        let dir = match Self::storage_dir(false) {
            Ok(dir) => dir,
            Err(err) => {
                println!("File storage unavailable for deletion: {}", err);
                return Ok(());
            }
        };

        let path = dir.join("spotify_token.json");

        if path.exists() {
            fs::remove_file(&path)
                .map_err(|e| format!("Failed to delete token file {:?}: {}", path, e))?;
            println!("Deleted token file at {:?}", path);
        }

        Ok(())
    }

    /// Load token from keyring or file fallback
    fn load_persisted_token() -> Result<Option<SpotifyToken>, String> {
        match Self::load_from_keyring() {
            Ok(Some(token)) => return Ok(Some(token)),
            Ok(None) => {
                println!("Keyring empty, checking file storage");
            }
            Err(err) => {
                println!("Keyring load failed: {}", err);
            }
        }

        Self::load_from_file()
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

    // Persist to file fallback
    if let Err(e) = SpotifyAuthState::save_to_file(&token) {
        println!("Warning: Failed to persist token to file storage: {}", e);
    }

    Ok(())
}

/// Retrieve stored Spotify token
#[tauri::command]
pub fn get_spotify_token(
    state: State<SpotifyAuthState>,
) -> Result<Option<SpotifyToken>, String> {
    let mut token = state.token.lock().unwrap();

    // Hydrate in-memory token from keyring if empty
    if token.is_none() {
        match SpotifyAuthState::load_persisted_token() {
            Ok(Some(persisted)) => {
                println!("Loaded persisted Spotify token from storage on demand");
                *token = Some(persisted);
            }
            Ok(None) => {
                println!("No persisted Spotify token found in storage");
            }
            Err(err) => {
                println!("Failed to load Spotify token from storage on demand: {}", err);
            }
        }
    }

    if let Some(ref t) = *token {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        if now >= t.expires_at {
            println!(
                "Token expired (expired at: {}, now: {}), returning stored token for frontend refresh",
                t.expires_at,
                now
            );

            if t.refresh_token.is_none() {
                println!("Token expired and no refresh token available; returning None");
                return Ok(None);
            }
        }
    }

    Ok(token.clone())
}

/// Check if user is authenticated
#[tauri::command]
pub fn is_authenticated(state: State<SpotifyAuthState>) -> Result<bool, String> {
    let mut token = state.token.lock().unwrap();

    if token.is_none() {
        match SpotifyAuthState::load_persisted_token() {
            Ok(Some(persisted)) => {
                println!("Auth check hydrated Spotify token from storage");
                *token = Some(persisted);
            }
            Ok(None) => {
                println!("Auth check: no Spotify token available in storage");
                return Ok(false);
            }
            Err(err) => {
                println!("Auth check failed to load token from storage: {}", err);
                return Err(err);
            }
        }
    }

    if let Some(ref t) = *token {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        if now < t.expires_at {
            return Ok(true);
        }

        if t.refresh_token.is_some() {
            println!(
                "Auth check: token expired but refresh token available; treating as authenticated so frontend can refresh"
            );
            return Ok(true);
        }

        println!("Auth check: token expired and no refresh token present");
        return Ok(false);
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

    if let Err(e) = SpotifyAuthState::delete_file() {
        println!("Warning: Failed to delete token file: {}", e);
    }

    println!("Cleared Spotify tokens");
    Ok(())
}

/// Open URL in system browser
#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    println!("Opening URL: {}", url);

    #[cfg(target_os = "android")]
    {
        use jni::objects::{JObject, JValue};

        // On Android, use Intent to open browser
        println!("Android detected, using Intent to open URL");

        // Get JNI environment
        let context = ndk_context::android_context();
        let vm = unsafe { jni::JavaVM::from_raw(context.vm().cast()) }
            .map_err(|e| format!("Failed to get JavaVM: {}", e))?;
        let mut env = vm.attach_current_thread()
            .map_err(|e| format!("Failed to attach thread: {}", e))?;

        // Create Intent
        open_url_android(&mut env, &url, context.context().cast())
    }

    #[cfg(not(target_os = "android"))]
    {
        webbrowser::open(&url).map_err(|e| e.to_string())
    }
}

#[cfg(target_os = "android")]
fn open_url_android(env: &mut jni::JNIEnv, url: &str, context_ptr: *mut std::ffi::c_void) -> Result<(), String> {
    use jni::objects::{JObject, JValue};

    let context = unsafe { JObject::from_raw(context_ptr as jni::sys::jobject) };

    // Create Intent with ACTION_VIEW
    let intent_class = env.find_class("android/content/Intent")
        .map_err(|e| format!("Failed to find Intent class: {}", e))?;

    let action_view = env.new_string("android.intent.action.VIEW")
        .map_err(|e| format!("Failed to create action string: {}", e))?;

    let url_jstring = env.new_string(url)
        .map_err(|e| format!("Failed to create URL string: {}", e))?;

    // Parse URI
    let uri_class = env.find_class("android/net/Uri")
        .map_err(|e| format!("Failed to find Uri class: {}", e))?;

    let uri = env.call_static_method(
        uri_class,
        "parse",
        "(Ljava/lang/String;)Landroid/net/Uri;",
        &[JValue::Object(&url_jstring)]
    ).map_err(|e| format!("Failed to parse URI: {}", e))?
    .l().map_err(|e| format!("Failed to get URI object: {}", e))?;

    // Create Intent(ACTION_VIEW, uri)
    let intent = env.new_object(
        intent_class,
        "(Ljava/lang/String;Landroid/net/Uri;)V",
        &[JValue::Object(&action_view), JValue::Object(&uri)]
    ).map_err(|e| format!("Failed to create Intent: {}", e))?;

    // Add FLAG_ACTIVITY_NEW_TASK
    let flag_new_task = 0x10000000i32;
    let _ = env.call_method(
        &intent,
        "addFlags",
        "(I)Landroid/content/Intent;",
        &[JValue::Int(flag_new_task)]
    ).map_err(|e| format!("Failed to add flags: {}", e))?;

    // Start activity
    env.call_method(
        context,
        "startActivity",
        "(Landroid/content/Intent;)V",
        &[JValue::Object(&intent)]
    ).map_err(|e| format!("Failed to start activity: {}", e))?;

    println!("Successfully launched Intent for URL");
    Ok(())
}

/// Test keyring operations
#[tauri::command]
pub fn test_keyring() -> Result<String, String> {
    println!("\n=== Testing Keyring Operations ===");
    println!("Platform: {}", std::env::consts::OS);

    // Test creating entry
    let test_service = "musicViz_test";
    let test_account = "test_account";

    println!("1. Creating test keyring entry...");
    let entry = Entry::new(test_service, test_account)
        .map_err(|e| {
            let msg = format!("Failed to create keyring entry: {:?}", e);
            println!("  ERROR: {}", msg);
            return msg;
        })?;

    println!("  SUCCESS: Entry created");

    // Test writing
    println!("2. Writing test value...");
    let test_value = "test_password_12345";
    entry.set_password(test_value)
        .map_err(|e| {
            let msg = format!("Failed to write to keyring: {:?}", e);
            println!("  ERROR: {}", msg);
            return msg;
        })?;

    println!("  SUCCESS: Value written");

    // Test reading
    println!("3. Reading test value...");
    let read_value = entry.get_password()
        .map_err(|e| {
            let msg = format!("Failed to read from keyring: {:?}", e);
            println!("  ERROR: {}", msg);
            return msg;
        })?;

    if read_value != test_value {
        let msg = format!("Value mismatch! Expected: {}, Got: {}", test_value, read_value);
        println!("  ERROR: {}", msg);
        return Err(msg);
    }

    println!("  SUCCESS: Value read correctly");

    // Test deleting
    println!("4. Deleting test entry...");
    entry.delete_credential()
        .map_err(|e| {
            let msg = format!("Failed to delete from keyring: {:?}", e);
            println!("  ERROR: {}", msg);
            // Don't fail on delete error, just warn
            println!("  WARNING: Cleanup failed, but test passed");
        }).ok();

    println!("  SUCCESS: Entry deleted (or cleanup attempted)");

    println!("=== Keyring Test Complete ===\n");

    Ok("Keyring operations working correctly!".to_string())
}
