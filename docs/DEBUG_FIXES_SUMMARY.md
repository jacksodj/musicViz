# Debug Fixes Summary

## Issues Addressed

### 1. Credentials Not Persisting Across App Restarts

**Problem**: Spotify authentication tokens were not being saved/restored across application rebuilds and relaunches.

**Solution Implemented**:
- Added OS keyring integration using the `keyring` crate in Rust backend
- Implemented `save_to_keyring()` and `load_from_keyring()` functions
- Added `checkExistingAuth()` function in authStore.js
- Added automatic token restoration on app startup in +page.svelte
- Added comprehensive error logging to diagnose keyring issues
- Added `test_keyring` command for testing keyring operations

**Files Modified**:
- `src-tauri/src/spotify_auth.rs` - Added keyring persistence functionality
- `src/lib/stores/authStore.js` - Added checkExistingAuth() function
- `src/routes/+page.svelte` - Added auth restoration on mount
- `src-tauri/Cargo.toml` - Added keyring dependency

### 2. Canvas Rendering Issues (0x0 Dimensions)

**Problem**: Canvas plugins were getting 0x0 dimension canvases that weren't in the DOM, potentially due to iframe interference from Spotify SDK.

**Solution Implemented**:
- Modified canvas plugins to get fresh dimensions from `ctx.canvas` at render time
- Added canvas class validation to ensure we're targeting the correct canvas
- Added extensive debug logging to track canvas state
- Added automatic canvas recovery if wrong canvas is detected
- Added immediate dimension setting in PluginManager's $effect

**Files Modified**:
- `src/lib/visualizations/SpectrumBars.js` - Get dimensions from ctx.canvas
- `src/lib/visualizations/Waveform.js` - Get dimensions from ctx.canvas
- `src/lib/plugins/types.js` - Added canvas class validation and recovery
- `src/lib/components/PluginManager.svelte` - Added canvas debugging and immediate sizing

## Testing Instructions

### Test Keyring Functionality

1. **Open the browser console** in the running app (Cmd+Option+I on Mac)

2. **Run the keyring test**:
   ```javascript
   testKeyring()
   ```
   This will:
   - Test basic keyring operations
   - Check for existing stored tokens
   - Display authentication status

3. **Check Rust backend logs** in the terminal where you ran the app for detailed keyring operation logs

4. **Test persistence**:
   - Authenticate with Spotify
   - Close the app completely
   - Rebuild with `npm run tauri build`
   - Relaunch the app
   - Check if you're still authenticated (should auto-restore)

### Test Canvas Rendering

1. **Check console output** for canvas debugging:
   - Look for `[PluginManager] Found X canvas elements`
   - Check which canvas has the `plugin-canvas` class
   - Verify canvas dimensions are non-zero

2. **Switch between plugins** using the menu to verify canvas rendering:
   - SpectrumBars should show frequency bars
   - Waveform should show waveform visualization
   - Both should display mock data if not playing music

3. **Look for error messages**:
   - `[SpectrumBars] Canvas has zero dimensions` indicates the issue persists
   - `[CanvasPlugin] ERROR: Canvas does not have plugin-canvas class!` indicates iframe interference

## Monitoring Points

### In Browser Console:
```javascript
// Check all canvases in document
document.querySelectorAll('canvas').forEach((c, i) => {
  console.log(`Canvas ${i}:`, {
    class: c.className,
    width: c.width,
    height: c.height,
    parent: c.parentElement?.className,
    inDOM: document.body.contains(c)
  });
});

// Check if Spotify iframe exists
document.querySelectorAll('iframe').forEach((f, i) => {
  console.log(`Iframe ${i}:`, f.src);
});
```

### In Rust Backend Logs:
- `Attempting to save tokens to keyring...`
- `Successfully saved and verified tokens in keyring`
- `Attempting to load tokens from keyring...`
- `Successfully loaded token from keyring`

## Expected Behavior

1. **Authentication Persistence**:
   - After authenticating once, closing and reopening the app should maintain authentication
   - The keyring test should show "Keyring operations working correctly!"
   - Tokens should survive app rebuilds

2. **Canvas Rendering**:
   - No more "zero dimension" warnings after initial setup
   - Visualizations should render immediately when selected
   - Canvas should maintain correct dimensions during window resizes

## Troubleshooting

### If Keyring Still Doesn't Work:
1. On macOS, check Keychain Access app for "musicViz" entries
2. Ensure the app has keychain permissions in System Settings
3. Run `testKeyring()` to diagnose specific failures

### If Canvas Still Shows 0x0:
1. Check if multiple canvases exist (iframe interference)
2. Verify the canvas has class `plugin-canvas`
3. Look for canvas recreation events in the console
4. Check if canvas is actually in the DOM

## Next Steps If Issues Persist

1. **For Keyring**: May need to handle platform-specific keyring APIs differently or add fallback to encrypted file storage
2. **For Canvas**: May need to isolate Spotify SDK iframe more completely or use a different canvas management strategy