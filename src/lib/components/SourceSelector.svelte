<script>
  import { selectSource } from '$lib/stores/sourceStore.js';

  function handleSelectSpotify() {
    selectSource('spotify');
  }

  function handleSelectNavidrome() {
    selectSource('navidrome');
  }
</script>

<div class="source-selector">
  <div class="selector-content">
    <div class="logo-container">
      <svg class="app-logo" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="45" stroke="url(#gradient)" stroke-width="3" fill="none"/>
        <path d="M30 50 Q40 30 50 50 Q60 70 70 50" stroke="url(#gradient)" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M25 50 Q37.5 20 50 50 Q62.5 80 75 50" stroke="url(#gradient)" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.6"/>
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#1db954"/>
            <stop offset="100%" stop-color="#4fc3f7"/>
          </linearGradient>
        </defs>
      </svg>
    </div>

    <h1 class="title">musicViz</h1>
    <p class="subtitle">Choose your audio source</p>

    <div class="source-options">
      <button class="source-option spotify" on:click={handleSelectSpotify}>
        <div class="option-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
        </div>
        <div class="option-text">
          <span class="option-title">Spotify</span>
          <span class="option-desc">Stream from Spotify Premium</span>
        </div>
        <div class="option-arrow">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
          </svg>
        </div>
      </button>

      <button class="source-option navidrome" on:click={handleSelectNavidrome}>
        <div class="option-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6zm-2 16c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
          </svg>
        </div>
        <div class="option-text">
          <span class="option-title">Local Server</span>
          <span class="option-desc">Navidrome / Subsonic</span>
        </div>
        <div class="option-arrow">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
          </svg>
        </div>
      </button>
    </div>
  </div>
</div>

<style>
  .source-selector {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 2rem;
    background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%);
  }

  .selector-content {
    max-width: 450px;
    width: 100%;
    text-align: center;
  }

  .logo-container {
    width: 100px;
    height: 100px;
    margin: 0 auto 2rem;
    animation: pulse 3s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.05); opacity: 0.9; }
  }

  .app-logo {
    width: 100%;
    height: 100%;
  }

  .title {
    font-size: 2.5rem;
    font-weight: 700;
    margin: 0 0 0.5rem 0;
    background: linear-gradient(135deg, #1db954 0%, #4fc3f7 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .subtitle {
    font-size: 1.1rem;
    color: rgba(255, 255, 255, 0.6);
    margin: 0 0 3rem 0;
  }

  .source-options {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .source-option {
    display: flex;
    align-items: center;
    gap: 1rem;
    width: 100%;
    padding: 1.25rem 1.5rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    cursor: pointer;
    transition: all 0.3s ease;
    text-align: left;
  }

  .source-option:hover {
    background: rgba(255, 255, 255, 0.1);
    transform: translateY(-2px);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  }

  .source-option.spotify:hover {
    border-color: rgba(29, 185, 84, 0.5);
    box-shadow: 0 10px 30px rgba(29, 185, 84, 0.2);
  }

  .source-option.navidrome:hover {
    border-color: rgba(79, 195, 247, 0.5);
    box-shadow: 0 10px 30px rgba(79, 195, 247, 0.2);
  }

  .option-icon {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    flex-shrink: 0;
  }

  .source-option.spotify .option-icon {
    background: rgba(29, 185, 84, 0.2);
    color: #1db954;
  }

  .source-option.navidrome .option-icon {
    background: rgba(79, 195, 247, 0.2);
    color: #4fc3f7;
  }

  .option-icon svg {
    width: 28px;
    height: 28px;
  }

  .option-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .option-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: white;
  }

  .option-desc {
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.5);
  }

  .option-arrow {
    width: 24px;
    height: 24px;
    color: rgba(255, 255, 255, 0.3);
    transition: all 0.3s ease;
  }

  .source-option:hover .option-arrow {
    color: rgba(255, 255, 255, 0.7);
    transform: translateX(4px);
  }

  .option-arrow svg {
    width: 100%;
    height: 100%;
  }

  @media (max-width: 480px) {
    .source-selector {
      padding: 1.5rem;
    }

    .title {
      font-size: 2rem;
    }

    .source-option {
      padding: 1rem 1.25rem;
    }

    .option-icon {
      width: 40px;
      height: 40px;
    }

    .option-icon svg {
      width: 22px;
      height: 22px;
    }
  }
</style>
