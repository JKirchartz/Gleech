import './components/GlitchCanvas.svelte';
import './components/GlitchCruiser.svelte';
import './components/GlitchChooser.svelte';
import './components/GlitchOnly.svelte';
import './components/GlitchDialog.svelte';
import './components/GlitchDocs.svelte';
import { gleech } from './core/gleech-engine.js';
import { workerPool } from './workers/worker-pool.js';

// Attach gleech to window for developer console and backward compatibility
if (typeof window !== 'undefined') {
  window.gleech = gleech;
  window.glitchWorkerPool = workerPool;

  // Set active nav highlighting matching style.css:
  // e.g., body#Documentation, body#glitch, body#GlitchCruiser, body#GlitchChooser
  const path = window.location.pathname;
  if (path.includes('GlitchCruiser')) {
    document.body.id = 'GlitchCruiser';
  } else if (path.includes('GlitchChooser')) {
    document.body.id = 'GlitchChooser';
  } else if (path.includes('glitch.')) {
    document.body.id = 'glitch';
  } else {
    document.body.id = 'Documentation';
  }

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
