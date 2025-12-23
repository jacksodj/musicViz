<script>
  import { onMount } from 'svelte';
  import { clearSource } from '$lib/stores/sourceStore.js';
  import {
    navidromeAuthStatus,
    navidromeUser,
    navidromeServerUrl,
    navidromeAuthError,
    isNavidromeAuthenticated,
    isNavidromeAuthenticating,
    authenticateNavidrome,
    logoutNavidrome,
    checkExistingNavidromeAuth,
  } from '$lib/stores/navidromeAuthStore.js';

  let serverUrl = $state('http://pimusic.local:4533');
  let username = $state('');
  let password = $state('');
  let checkingAuth = $state(true);
  let showPassword = $state(false);

  onMount(async () => {
    // Check for existing authentication
    const restored = await checkExistingNavidromeAuth();
    if (restored) {
      console.log('[NavidromeConnect] Restored existing authentication');
    }
    checkingAuth = false;
  });

  async function handleConnect() {
    if (!serverUrl || !username || !password) {
      return;
    }

    const result = await authenticateNavidrome(serverUrl, username, password);
    if (result.success) {
      // Clear password from memory
      password = '';
    }
  }

  async function handleLogout() {
    await logoutNavidrome();
  }

  function handleBack() {
    clearSource();
  }

  function handleKeyPress(event) {
    if (event.key === 'Enter') {
      handleConnect();
    }
  }
</script>

<div class="navidrome-connect">
  {#if checkingAuth}
    <div class="loading">
      <div class="spinner"></div>
      <p>Checking authentication...</p>
    </div>
  {:else if $isNavidromeAuthenticated}
    <div class="authenticated">
      <div class="server-info">
        <div class="server-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6zm-2 16c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
          </svg>
        </div>
        <div class="server-details">
          <p class="server-name">{$navidromeServerUrl}</p>
          <p class="user-name">Logged in as {$navidromeUser}</p>
        </div>
      </div>
      <button class="btn btn-secondary" onclick={handleLogout}>
        Disconnect
      </button>
    </div>
  {:else if $isNavidromeAuthenticating}
    <div class="authenticating">
      <div class="spinner"></div>
      <p>Connecting to server...</p>
    </div>
  {:else}
    <div class="connect-prompt">
      <button class="back-btn" onclick={handleBack} aria-label="Back to source selection">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
        </svg>
      </button>

      <div class="server-logo">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6zm-2 16c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
        </svg>
      </div>

      <h2>Connect to Navidrome</h2>
      <p class="subtitle">Enter your server details</p>

      <div class="form">
        <div class="input-group">
          <label for="serverUrl">Server URL</label>
          <input
            id="serverUrl"
            type="url"
            bind:value={serverUrl}
            placeholder="http://192.168.1.100:4533"
            onkeypress={handleKeyPress}
          />
        </div>

        <div class="input-group">
          <label for="username">Username</label>
          <input
            id="username"
            type="text"
            bind:value={username}
            placeholder="Enter username"
            autocomplete="username"
            onkeypress={handleKeyPress}
          />
        </div>

        <div class="input-group">
          <label for="password">Password</label>
          <div class="password-wrapper">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              bind:value={password}
              placeholder="Enter password"
              autocomplete="current-password"
              onkeypress={handleKeyPress}
            />
            <button
              type="button"
              class="toggle-password"
              onclick={() => showPassword = !showPassword}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {#if showPassword}
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
                </svg>
              {:else}
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                </svg>
              {/if}
            </button>
          </div>
        </div>

        <button
          class="btn btn-primary connect-btn"
          onclick={handleConnect}
          disabled={!serverUrl || !username || !password}
          type="button"
        >
          <svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
          </svg>
          Connect
        </button>

        {#if $navidromeAuthError}
          <p class="error">{$navidromeAuthError}</p>
        {/if}
      </div>

      <p class="hint">
        Supports Navidrome, Subsonic, and compatible servers
      </p>
    </div>
  {/if}
</div>

<style>
  .navidrome-connect {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    min-height: 100vh;
    height: 100%;
    padding: 1rem 2rem 3rem;
    background: linear-gradient(135deg, #4fc3f7 0%, #0a0a0a 100%);
    overflow-y: auto;
    overflow-x: hidden;
    box-sizing: border-box;
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
    border-top: 4px solid #4fc3f7;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .connect-prompt {
    position: relative;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(20px);
    border-radius: 16px;
    padding: 1.5rem;
    max-width: 400px;
    width: 100%;
    text-align: center;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    margin: 1rem 0;
  }

  .back-btn {
    position: absolute;
    top: 1rem;
    left: 1rem;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .back-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    color: white;
  }

  .back-btn svg {
    width: 24px;
    height: 24px;
  }

  .server-logo {
    width: 50px;
    height: 50px;
    margin: 0 auto 0.75rem;
    padding: 0.75rem;
    background: rgba(79, 195, 247, 0.2);
    border-radius: 16px;
    color: #4fc3f7;
  }

  .server-logo svg {
    width: 100%;
    height: 100%;
  }

  h2 {
    color: white;
    margin: 0 0 0.25rem 0;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .subtitle {
    color: rgba(255, 255, 255, 0.6);
    margin: 0 0 1rem 0;
    font-size: 0.9rem;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-bottom: 1rem;
  }

  .input-group {
    text-align: left;
  }

  .input-group label {
    display: block;
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.8rem;
    font-weight: 500;
    margin-bottom: 0.25rem;
  }

  .input-group input {
    width: 100%;
    padding: 0.625rem 0.75rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: white;
    font-size: 0.95rem;
    transition: all 0.2s ease;
  }

  .input-group input::placeholder {
    color: rgba(255, 255, 255, 0.3);
  }

  .input-group input:focus {
    outline: 3px solid #4fc3f7;
    outline-offset: 2px;
    border-color: #4fc3f7;
    background: rgba(79, 195, 247, 0.1);
  }

  .password-wrapper {
    position: relative;
  }

  .password-wrapper input {
    padding-right: 3rem;
  }

  .toggle-password {
    position: absolute;
    right: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    transition: color 0.2s ease;
  }

  .toggle-password:hover {
    color: rgba(255, 255, 255, 0.8);
  }

  .toggle-password svg {
    width: 20px;
    height: 20px;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 1rem 2rem;
    border: none;
    border-radius: 30px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    text-decoration: none;
    margin-top: 0.5rem;
  }

  .btn-primary {
    background: #4fc3f7;
    color: #0a0a0a;
  }

  .btn-primary:hover:not(:disabled) {
    background: #81d4fa;
    transform: translateY(-2px);
    box-shadow: 0 5px 20px rgba(79, 195, 247, 0.4);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary:focus {
    outline: 3px solid #81d4fa;
    outline-offset: 2px;
  }

  .connect-btn {
    width: 100%;
    margin-top: 1rem;
    padding: 1rem 1.5rem;
    font-size: 1.1rem;
    min-height: 50px;
    border: 2px solid #4fc3f7;
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
    padding: 0.875rem 1rem;
    margin: 0;
    font-size: 0.9rem;
    text-align: left;
  }

  .hint {
    display: none;
  }

  .authenticated {
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(20px);
    border-radius: 16px;
    padding: 2rem;
    max-width: 400px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2rem;
  }

  .server-info {
    display: flex;
    align-items: center;
    gap: 1.25rem;
  }

  .server-icon {
    width: 60px;
    height: 60px;
    padding: 0.875rem;
    background: rgba(79, 195, 247, 0.2);
    border-radius: 16px;
    color: #4fc3f7;
  }

  .server-icon svg {
    width: 100%;
    height: 100%;
  }

  .server-details {
    text-align: left;
  }

  .server-name {
    color: white;
    font-size: 1rem;
    font-weight: 500;
    margin: 0 0 0.25rem 0;
    word-break: break-all;
  }

  .user-name {
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.9rem;
    margin: 0;
  }

  @media (max-width: 480px) {
    .navidrome-connect {
      padding: 1.5rem;
    }

    .connect-prompt {
      padding: 2rem 1.5rem;
    }

    h2 {
      font-size: 1.5rem;
    }
  }
</style>
