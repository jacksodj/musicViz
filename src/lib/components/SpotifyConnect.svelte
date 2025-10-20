<script>
  import { onMount } from 'svelte';
  import { SpotifyAuth } from '$lib/auth/SpotifyAuth.js';
  import {
    authStatus,
    currentUser,
    authError,
    isAuthenticated,
    isAuthenticating,
    setAuthenticated,
    setAuthError,
    setAuthenticating,
    resetAuth,
  } from '$lib/stores/authStore.js';

  let spotifyAuth;
  let checkingAuth = true;

  onMount(async () => {
    spotifyAuth = new SpotifyAuth();

    // Check if already authenticated
    const isAuth = await spotifyAuth.isAuthenticated();

    if (isAuth) {
      try {
        // Get stored token and user info
        const token = await spotifyAuth.getStoredToken();
        const user = await spotifyAuth.getCurrentUser();

        setAuthenticated(user, token.access_token);
        console.log('User already authenticated:', user.display_name);
      } catch (error) {
        console.error('Failed to load user data:', error);
        resetAuth();
      }
    }

    checkingAuth = false;

    // Setup deep link listener for OAuth callback
    const { listen } = await import('@tauri-apps/api/event');

    const unlisten = await listen('deep-link', async (event) => {
      console.log('Deep link event received:', event.payload);

      try {
        // Extract authorization code from URL
        const url = event.payload;
        const urlObj = new URL(url);
        const code = urlObj.searchParams.get('code');

        if (code) {
          console.log('Authorization code received, exchanging for token...');
          await handleCallback(code);
        } else {
          console.error('No authorization code in callback URL');
          setAuthError('Invalid callback URL');
        }
      } catch (error) {
        console.error('Failed to handle deep link:', error);
        setAuthError(error.message);
      }
    });

    // Cleanup listener on component destroy
    return () => {
      unlisten();
    };
  });

  async function handleConnect() {
    try {
      setAuthenticating();

      // Start OAuth flow
      await spotifyAuth.startAuth();

      // Note: The actual token exchange will happen when we receive the callback
      // For now, we'll manually trigger it for testing
      console.log('Authorization window opened. Waiting for callback...');
    } catch (error) {
      setAuthError(error.message);
    }
  }

  async function handleLogout() {
    try {
      await spotifyAuth.logout();
      resetAuth();
      console.log('Logged out successfully');
    } catch (error) {
      setAuthError(error.message);
    }
  }

  // TODO: This will be called when OAuth callback is received
  // For Phase 1, we'll need to setup a deep link handler
  async function handleCallback(code) {
    try {
      setAuthenticating();

      // Exchange code for token
      await spotifyAuth.exchangeCodeForToken(code);

      // Get user info
      const user = await spotifyAuth.getCurrentUser();
      const token = await spotifyAuth.getStoredToken();

      setAuthenticated(user, token.access_token);
      console.log('Successfully authenticated:', user.display_name);
    } catch (error) {
      setAuthError(error.message);
    }
  }
</script>

<div class="spotify-connect">
  {#if checkingAuth}
    <div class="loading">
      <div class="spinner"></div>
      <p>Checking authentication...</p>
    </div>
  {:else if $isAuthenticated}
    <div class="authenticated">
      <div class="user-info">
        {#if $currentUser.images && $currentUser.images.length > 0}
          <img
            src={$currentUser.images[0].url}
            alt={$currentUser.display_name}
            class="avatar"
          />
        {:else}
          <div class="avatar-placeholder">
            {$currentUser.display_name?.charAt(0) || 'U'}
          </div>
        {/if}
        <div class="user-details">
          <p class="user-name">{$currentUser.display_name}</p>
          <p class="user-email">{$currentUser.email}</p>
        </div>
      </div>
      <button class="btn btn-secondary" on:click={handleLogout}>
        Disconnect
      </button>
    </div>
  {:else if $isAuthenticating}
    <div class="authenticating">
      <div class="spinner"></div>
      <p>Connecting to Spotify...</p>
      <p class="hint">
        A browser window should open. Please authorize musicViz.
      </p>
    </div>
  {:else}
    <div class="connect-prompt">
      <div class="spotify-logo">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"
          />
        </svg>
      </div>
      <h2>Connect to Spotify</h2>
      <p>
        Connect your Spotify account to start visualizing your music in
        real-time.
      </p>
      <button class="btn btn-primary" on:click={handleConnect}>
        <svg
          class="btn-icon"
          viewBox="0 0 24 24"
          fill="currentColor"
          width="20"
          height="20"
        >
          <path
            d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"
          />
        </svg>
        Connect with Spotify
      </button>
      {#if $authError}
        <p class="error">{$authError}</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .spotify-connect {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 2rem;
    background: linear-gradient(135deg, #1db954 0%, #191414 100%);
  }

  .loading,
  .authenticating {
    text-align: center;
    color: white;
  }

  .spinner {
    width: 50px;
    height: 50px;
    margin: 0 auto 1rem;
    border: 4px solid rgba(255, 255, 255, 0.1);
    border-top: 4px solid #1db954;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .connect-prompt {
    background: rgba(0, 0, 0, 0.8);
    border-radius: 12px;
    padding: 3rem;
    max-width: 500px;
    text-align: center;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  }

  .spotify-logo {
    width: 80px;
    height: 80px;
    margin: 0 auto 2rem;
    color: #1db954;
  }

  .spotify-logo svg {
    width: 100%;
    height: 100%;
  }

  h2 {
    color: white;
    margin-bottom: 1rem;
    font-size: 2rem;
    font-weight: 600;
  }

  p {
    color: rgba(255, 255, 255, 0.8);
    margin-bottom: 2rem;
    line-height: 1.6;
  }

  .hint {
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.6);
    margin-top: 1rem;
    margin-bottom: 0;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 2rem;
    border: none;
    border-radius: 30px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    text-decoration: none;
  }

  .btn-primary {
    background: #1db954;
    color: white;
  }

  .btn-primary:hover {
    background: #1ed760;
    transform: translateY(-2px);
    box-shadow: 0 5px 20px rgba(29, 185, 84, 0.4);
  }

  .btn-secondary {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .btn-secondary:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .btn-icon {
    flex-shrink: 0;
  }

  .error {
    color: #ff6b6b;
    background: rgba(255, 107, 107, 0.1);
    border: 1px solid rgba(255, 107, 107, 0.3);
    border-radius: 8px;
    padding: 1rem;
    margin-top: 1rem;
    margin-bottom: 0;
  }

  .authenticated {
    background: rgba(0, 0, 0, 0.8);
    border-radius: 12px;
    padding: 2rem;
    max-width: 400px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2rem;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }

  .avatar {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    object-fit: cover;
  }

  .avatar-placeholder {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: #1db954;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2rem;
    font-weight: 600;
  }

  .user-details {
    text-align: left;
  }

  .user-name {
    color: white;
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0;
  }

  .user-email {
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.9rem;
    margin: 0.5rem 0 0;
  }
</style>
