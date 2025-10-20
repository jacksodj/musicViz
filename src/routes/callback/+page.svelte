<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { SpotifyAuth } from '$lib/auth/SpotifyAuth.js';
  import { setAuthenticated, setAuthError } from '$lib/stores/authStore.js';

  let status = 'processing'; // 'processing', 'success', 'error'
  let message = 'Processing authentication...';

  onMount(async () => {
    try {
      // Get authorization code from URL query params
      const code = $page.url.searchParams.get('code');
      const error = $page.url.searchParams.get('error');

      if (error) {
        throw new Error(`Spotify authorization error: ${error}`);
      }

      if (!code) {
        throw new Error('No authorization code received from Spotify');
      }

      console.log('OAuth callback received, exchanging code for token...');

      // Create SpotifyAuth instance and exchange code for token
      const spotifyAuth = new SpotifyAuth();
      await spotifyAuth.exchangeCodeForToken(code);

      // Get user info
      const user = await spotifyAuth.getCurrentUser();
      const token = await spotifyAuth.getStoredToken();

      setAuthenticated(user, token.access_token);

      status = 'success';
      message = `Successfully authenticated as ${user.display_name}!`;

      console.log('Authentication successful, redirecting to home...');

      // Redirect to home page after 2 seconds
      setTimeout(() => {
        goto('/');
      }, 2000);
    } catch (err) {
      console.error('OAuth callback error:', err);
      status = 'error';
      message = err.message || 'Authentication failed';
      setAuthError(message);

      // Redirect to home page after 5 seconds
      setTimeout(() => {
        goto('/');
      }, 5000);
    }
  });
</script>

<div class="callback-container">
  <div class="callback-card">
    {#if status === 'processing'}
      <div class="spinner"></div>
      <h2>Authenticating...</h2>
      <p>{message}</p>
    {:else if status === 'success'}
      <div class="success-icon">✓</div>
      <h2>Success!</h2>
      <p>{message}</p>
      <p class="redirect-message">Redirecting to app...</p>
    {:else}
      <div class="error-icon">✗</div>
      <h2>Authentication Failed</h2>
      <p class="error-message">{message}</p>
      <p class="redirect-message">Redirecting to home...</p>
    {/if}
  </div>
</div>

<style>
  .callback-container {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background: linear-gradient(135deg, #1db954 0%, #191414 100%);
    padding: 2rem;
  }

  .callback-card {
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(20px);
    border-radius: 20px;
    padding: 3rem;
    max-width: 500px;
    text-align: center;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }

  .spinner {
    width: 60px;
    height: 60px;
    margin: 0 auto 2rem auto;
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

  .success-icon {
    width: 80px;
    height: 80px;
    margin: 0 auto 2rem auto;
    border-radius: 50%;
    background: #1db954;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 3rem;
    font-weight: bold;
  }

  .error-icon {
    width: 80px;
    height: 80px;
    margin: 0 auto 2rem auto;
    border-radius: 50%;
    background: #ff6b6b;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 3rem;
    font-weight: bold;
  }

  h2 {
    color: white;
    margin-bottom: 1rem;
    font-size: 2rem;
    font-weight: 600;
  }

  p {
    color: rgba(255, 255, 255, 0.8);
    margin-bottom: 1rem;
    line-height: 1.6;
  }

  .error-message {
    color: #ff6b6b;
  }

  .redirect-message {
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.6);
    margin-top: 2rem;
    margin-bottom: 0;
  }
</style>
