# Spotify Authentication on NVIDIA Shield

## Current Status

✅ **OAuth Flow Working**: The Spotify OAuth implementation successfully:
- Detects Android platform
- Navigates to Spotify login page
- Accepts username input
- Reaches 2FA passcode screen
- Configured for deep-link callback (`musicviz://callback`)

❌ **Known Issue**: Android TV WebView keyboard input doesn't work on Spotify's 2FA passcode field

## Workarounds

### Option 1: Use Account Without 2FA (Recommended for Testing)
1. Create or use a Spotify account without two-factor authentication
2. This allows you to complete OAuth without the passcode step
3. Best for development and testing on Shield

### Option 2: Use Physical/Bluetooth Keyboard
1. Connect a USB or Bluetooth keyboard to your Shield
2. Complete the OAuth flow
3. Use the physical keyboard to enter the 2FA passcode
4. The passcode field should accept input from hardware keyboards

### Option 3: "Remember Device" Option
1. If Spotify shows a "Remember this device" checkbox during login
2. Check it to avoid 2FA on subsequent logins
3. Note: This option may not always be available

### Option 4: App Password (If Available)
1. Check if Spotify offers app-specific passwords
2. Generate one for musicViz on Shield
3. Use it instead of your regular password

## Technical Details

### Why the Keyboard Doesn't Work

Android TV's soft keyboard has limited WebView integration, especially with:
- Dynamically created input fields
- Fields with specific input types (numeric, tel, etc.)
- Fields created by JavaScript after page load

Spotify's 2FA passcode field falls into these categories, causing the keyboard to appear but not send characters to the input field.

### What We Tried

1. ✅ **Deep-link configuration**: Added intent filter for `musicviz://callback`
2. ✅ **WebView debugging enabled**: For troubleshooting with Chrome DevTools
3. ❌ **Custom WebView settings**: Android doesn't allow easy customization of Tauri's WebView
4. ❌ **Focus management**: Limited control over WebView input focus from Kotlin

## Testing

To test OAuth on Shield:

```bash
# Build and install APK
npm run tauri android build -- --apk --debug
adb connect <shield-ip>
adb install -r src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk

# Launch app
adb shell am start -n com.dennisjackson.musicviz/.MainActivity

# Monitor logs
adb logcat | grep -E "(musicviz|spotify|OAuth|Auth)"
```

## Future Improvements

Potential solutions to explore:
1. **Custom numeric input overlay**: Create an app-specific number pad that injects code via JavaScript
2. **Spotify Web API alternatives**: Investigate if Spotify supports any TV-specific auth flows
3. **Browser OAuth**: Open system browser instead of in-app WebView (requires browser on Shield)
4. **Tauri WebView hooks**: Wait for Tauri 2 to expose WebView customization APIs

## Related Files

- `src/lib/auth/SpotifyAuth.js` - OAuth implementation with Android detection
- `src-tauri/gen/android/app/src/main/AndroidManifest.xml` - Deep-link configuration
- `src-tauri/gen/android/app/src/main/java/com/dennisjackson/musicviz/MainActivity.kt` - WebView setup
