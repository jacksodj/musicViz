/**
 * Milkdrop Plugin Health Check
 *
 * Copy and paste this entire script into the browser console
 * after selecting a Milkdrop preset to diagnose rendering issues.
 *
 * NOTE: This script takes 2 seconds to complete as it monitors render calls.
 */

(function() {
  console.log('=== MILKDROP HEALTH CHECK ===\n');

  // 1. Canvas Element Check
  console.log('1. CANVAS ELEMENT:');
  const canvas = document.querySelector('.plugin-canvas');
  if (!canvas) {
    console.error('  ❌ Canvas element not found!');
    return;
  }
  console.log('  ✓ Canvas element exists');
  console.log('  - Canvas physical dimensions:', canvas.width, 'x', canvas.height);
  const rect = canvas.getBoundingClientRect();
  console.log('  - Canvas CSS dimensions:', Math.floor(rect.width), 'x', Math.floor(rect.height));
  console.log('  - Canvas position:', `x:${rect.x}, y:${rect.y}, top:${rect.top}, left:${rect.left}`);

  if (canvas.width === 0 || canvas.height === 0) {
    console.error('  ❌ Canvas has ZERO dimensions! This is the problem.');
  } else {
    console.log('  ✓ Canvas has valid dimensions');
  }
  console.log('');

  // 2. Canvas Visibility Check
  console.log('2. CANVAS VISIBILITY:');
  const styles = window.getComputedStyle(canvas);
  console.log('  - display:', styles.display);
  console.log('  - visibility:', styles.visibility);
  console.log('  - opacity:', styles.opacity);
  console.log('  - z-index:', styles.zIndex);
  console.log('  - position:', styles.position);

  const isVisible = styles.display !== 'none' &&
                   styles.visibility !== 'hidden' &&
                   parseFloat(styles.opacity) > 0;
  if (!isVisible) {
    console.error('  ❌ Canvas is not visible!');
  } else {
    console.log('  ✓ Canvas is visible');
  }
  console.log('');

  // 3. WebGL Context Check
  console.log('3. WEBGL CONTEXT:');
  const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
  if (!gl) {
    console.error('  ❌ No WebGL context found!');
    // Check if it has a 2D context instead
    const ctx2d = canvas.getContext('2d');
    if (ctx2d) {
      console.error('  ❌ Canvas has 2D context instead of WebGL! This prevents Butterchurn from working.');
    }
  } else {
    console.log('  ✓ WebGL context exists');
    const viewport = gl.getParameter(gl.VIEWPORT);
    console.log('  - Viewport:', viewport);
    console.log('  - Renderer:', gl.getParameter(gl.RENDERER));
    console.log('  - Vendor:', gl.getParameter(gl.VENDOR));
  }
  console.log('');

  // 4. PluginManager Check
  console.log('4. PLUGIN MANAGER:');
  const pluginManager = document.querySelector('.plugin-manager');
  if (!pluginManager) {
    console.error('  ❌ PluginManager not found!');
  } else {
    console.log('  ✓ PluginManager exists');
    const pmRect = pluginManager.getBoundingClientRect();
    console.log('  - PluginManager dimensions:', Math.floor(pmRect.width), 'x', Math.floor(pmRect.height));
  }
  console.log('');

  // 5. Device Info
  console.log('5. DEVICE INFO:');
  console.log('  - Device Pixel Ratio:', window.devicePixelRatio);
  console.log('  - Window size:', window.innerWidth, 'x', window.innerHeight);
  console.log('');

  // 6. Animation Frame Check
  console.log('6. RENDER LOOP CHECK:');
  console.log('  Monitoring render calls for 2 seconds...');

  let renderCount = 0;
  const originalRequestAnimationFrame = window.requestAnimationFrame;
  window.requestAnimationFrame = function(callback) {
    renderCount++;
    return originalRequestAnimationFrame.call(window, callback);
  };

  setTimeout(() => {
    window.requestAnimationFrame = originalRequestAnimationFrame;
    console.log(`  - Render calls in 2 seconds: ${renderCount}`);
    if (renderCount === 0) {
      console.error('  ❌ No render loop detected!');
    } else if (renderCount < 30) {
      console.warn('  ⚠️  Low frame rate detected:', Math.round(renderCount / 2), 'fps');
    } else {
      console.log('  ✓ Render loop active:', Math.round(renderCount / 2), 'fps');
    }

    // 7. AudioContext Check
    console.log('');
    console.log('7. AUDIOCONTEXT CHECK:');

    try {
      // Check if there's a global AudioContext
      if (window.AudioContext) {
        console.log('  ✓ AudioContext API available');
      }

      // Try to detect active AudioContext state from logs
      console.log('  Note: Check console logs for:');
      console.log('    - "[MilkdropPlugin] AudioContext state in render: running"');
      console.log('    - "[MilkdropPlugin] AudioContext resumed successfully"');
      console.log('  If you see "suspended", that may be the issue.');

    } catch (e) {
      console.error('  ❌ Error checking AudioContext:', e);
    }
    console.log('');

    // 8. Summary
    console.log('=== DIAGNOSIS ===');
    performDiagnosis();
  }, 2000);

  function performDiagnosis() {
    const issues = [];

    if (!canvas) {
      issues.push('Canvas element missing');
    } else {
      if (canvas.width === 0 || canvas.height === 0) {
        issues.push('Canvas has zero dimensions (0x0)');
      }
      if (!isVisible) {
        issues.push('Canvas is not visible');
      }
      if (!gl) {
        issues.push('No WebGL context (needed for Butterchurn)');
        const ctx2d = canvas.getContext('2d');
        if (ctx2d) {
          issues.push('Canvas has 2D context blocking WebGL');
        }
      }
    }

    if (renderCount === 0) {
      issues.push('No render loop detected (requestAnimationFrame not being called)');
    }

    if (issues.length === 0) {
      console.log('✓ No obvious issues detected. Butterchurn should be working.');
      console.log('  If you still see no visualization:');
      console.log('  - Scroll up and check AudioContext logs');
      console.log('  - Look for "[MilkdropPlugin] Render call #1" through #5');
      console.log('  - Try selecting a different preset');
    } else {
      console.error('❌ Issues found:');
      issues.forEach((issue, i) => {
        console.error(`  ${i + 1}. ${issue}`);
      });
    }

    console.log('\n=== END HEALTH CHECK ===');
  }
})();
