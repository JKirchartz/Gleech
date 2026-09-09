import './components/GlitchCanvas.svelte';
import './components/GlitchCruiser.svelte';
import './components/GlitchChooser.svelte';
import './components/GlitchOnly.svelte';
import './components/GlitchDialog.svelte';
import './components/GlitchDocs.svelte';
import { gleech } from './core/glitch-engine.js';
import { workerPool } from './workers/worker-pool.js';

// Attach gleech to window for developer console and backward compatibility
if (typeof window !== 'undefined') {
  window.gleech = gleech;
  window.glitchWorkerPool = workerPool;

  // Set active nav highlighting matching style.css:
  // e.g., body#index, body#glitch, body#GlitchCruiser, body#GlitchChooser
  const path = window.location.pathname;
  let pageId = 'index';
  if (path.includes('GlitchCruiser')) {
    pageId = 'GlitchCruiser';
  } else if (path.includes('GlitchChooser')) {
    pageId = 'GlitchChooser';
  } else if (path.includes('glitch.')) {
    pageId = 'glitch';
  } else if (path.includes('gleech.js')) {
    pageId = 'Documentation';
  } else {
    pageId = 'index';
  }
  document.body.id = pageId;

  // Legacy helper function drawDitherResult for backward compatibility
  window.drawDitherResult = function(canvas, ditherer, text, append) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const output = document.getElementById('output');
    if (typeof gleech[ditherer] === 'function') {
      ctx.putImageData(gleech[ditherer](imageData), 0, 0);
    }
    const img = document.createElement('img');
    img.src = canvas.toDataURL('image/png');
    img.alt = ditherer;
    if (text && output) {
      const h2 = document.createElement('h2');
      h2.innerText = ditherer;
      output.appendChild(h2);
    }
    if (output) {
      if (append) {
        output.appendChild(img);
      } else {
        output.insertBefore(img, output.childNodes[0]);
      }
    }
  };
}
