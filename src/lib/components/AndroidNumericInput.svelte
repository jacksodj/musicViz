<script>
  import { onMount, onDestroy } from 'svelte';

  export let onSubmit = (code) => {};

  let code = '';
  let selectedButton = 0;
  const buttons = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'Delete', 'Submit'];

  function handleNumberClick(num) {
    if (num === 'Delete') {
      code = code.slice(0, -1);
    } else if (num === 'Submit' && code.length > 0) {
      onSubmit(code);
    } else if (num !== 'Submit') {
      code += num;
    }
  }

  function handleKeyPress(event) {
    const key = event.key;

    // Handle d-pad navigation
    if (key === 'ArrowUp') {
      event.preventDefault();
      selectedButton = Math.max(0, selectedButton - 3);
    } else if (key === 'ArrowDown') {
      event.preventDefault();
      selectedButton = Math.min(buttons.length - 1, selectedButton + 3);
    } else if (key === 'ArrowLeft') {
      event.preventDefault();
      selectedButton = Math.max(0, selectedButton - 1);
    } else if (key === 'ArrowRight') {
      event.preventDefault();
      selectedButton = Math.min(buttons.length - 1, selectedButton + 1);
    } else if (key === 'Enter') {
      event.preventDefault();
      handleNumberClick(buttons[selectedButton]);
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeyPress);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeyPress);
  });
</script>

<div class="numeric-input-overlay">
  <div class="numeric-input-container">
    <h2>Enter Spotify Passcode</h2>
    <div class="code-display">{code || '___'}</div>
    <div class="number-grid">
      {#each buttons as button, index}
        <button
          class="num-button"
          class:selected={selectedButton === index}
          class:action={button === 'Delete' || button === 'Submit'}
          on:click={() => handleNumberClick(button)}
        >
          {button}
        </button>
      {/each}
    </div>
    <p class="hint">Use your remote to navigate and select</p>
  </div>
</div>

<style>
  .numeric-input-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.95);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }

  .numeric-input-container {
    background: #1a1a1a;
    border-radius: 16px;
    padding: 3rem;
    text-align: center;
    max-width: 600px;
  }

  h2 {
    color: #1db954;
    margin: 0 0 2rem 0;
    font-size: 2rem;
  }

  .code-display {
    background: #000;
    color: #fff;
    font-size: 3rem;
    font-family: monospace;
    padding: 1.5rem;
    border-radius: 12px;
    margin-bottom: 2rem;
    letter-spacing: 0.5rem;
    min-height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .number-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .num-button {
    background: #2a2a2a;
    color: #fff;
    border: 3px solid transparent;
    border-radius: 12px;
    padding: 2rem;
    font-size: 2rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .num-button:hover,
  .num-button.selected {
    background: #1db954;
    border-color: #1ed760;
    transform: scale(1.05);
  }

  .num-button.action {
    background: #3a3a3a;
    font-size: 1.3rem;
  }

  .num-button.action:hover,
  .num-button.action.selected {
    background: #4a4a4a;
    border-color: #6a6a6a;
  }

  .hint {
    color: rgba(255, 255, 255, 0.6);
    font-size: 1.1rem;
    margin: 0;
  }
</style>
