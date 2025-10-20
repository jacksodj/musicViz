# Development Setup

## Local Development Testing

For local development testing (using `npm run tauri dev`), the OAuth flow uses `https://localhost:1420/callback` instead of the deep link `musicviz://callback`.

### Spotify Dashboard Configuration

**IMPORTANT:** You must add the localhost redirect URI to your Spotify app:

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Select your musicViz app
3. Click "Edit Settings"
4. Under "Redirect URIs", add:
   - `https://localhost:1420/callback` (for dev testing - HTTPS required by Spotify)
   - `musicviz://callback` (for production builds)
5. Click "Save"

**Note:** Spotify requires HTTPS for redirect URIs. The dev server is configured to use a self-signed certificate.

### Environment Files

- **`.env`** - Production configuration (uses `musicviz://callback`)
  - Committed to git
  - Used for production builds

- **`.env.local`** - Local development override (uses `https://localhost:1420/callback`)
  - NOT committed to git (in .gitignore)
  - Automatically overrides `.env` during development

### Development Workflow

1. **Development Testing:**
   ```bash
   npm run tauri dev
   ```
   - Uses `.env.local` (localhost HTTPS callback)
   - OAuth redirects to `https://localhost:1420/callback`
   - Browser console logs are visible
   - Hot reload enabled
   - **Note:** Browser will warn about self-signed certificate - this is normal, click "Advanced" and "Proceed"

2. **Production Build:**
   ```bash
   npm run tauri build
   ```
   - Uses `.env` (deep link callback)
   - OAuth redirects to `musicviz://callback`
   - macOS handles deep link automatically

### Troubleshooting

**Issue:** OAuth redirects to built app instead of dev server

**Solution:** Check that:
- `.env.local` exists and contains `VITE_SPOTIFY_REDIRECT_URI=https://localhost:1420/callback`
- Dev server is running at `https://localhost:1420/`
- Spotify Dashboard has `https://localhost:1420/callback` in Redirect URIs

**Issue:** "Invalid redirect URI" error from Spotify

**Solution:** Add `https://localhost:1420/callback` to Spotify Dashboard (see instructions above). Note: Spotify requires HTTPS.

**Issue:** Browser shows "Your connection is not private" warning

**Solution:** This is normal for local HTTPS development with self-signed certificates. Click "Advanced" → "Proceed to localhost (unsafe)" to continue.
