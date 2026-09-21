<svelte:options customElement={{ tag: 'glitch-canvas', shadow: 'none' }} />

<script>
  import { onMount } from 'svelte';
  import { workerPool } from '../workers/worker-pool.js';
  import { loadImageFromUrl, resultToDataUrl } from '../core/canvas-utils.js';

  export let src = '';
  export let algorithm = 'theWorks';
  export let autostart = true;
  export let alt = 'Glitched Canvas';

  let canvasEl;
  let processing = false;
  let duration = 0;
  let errorMsg = '';
  let resultDataUrl = '';

  export async function process(inputSrc = src, algo = algorithm) {
    if (!inputSrc) return;
    processing = true;
    errorMsg = '';
    try {
      const { imageData, width, height } = await loadImageFromUrl(inputSrc);
      const res = await workerPool.run({
        algorithm: algo,
        imageData,
        useOffscreen: true
      });
      duration = res.duration;
      resultDataUrl = resultToDataUrl(res);

      if (canvasEl) {
        canvasEl.width = width;
        canvasEl.height = height;
        const ctx = canvasEl.getContext('2d');
        if (res.bitmap) {
          ctx.drawImage(res.bitmap, 0, 0);
        } else if (res.imageData) {
          ctx.putImageData(res.imageData, 0, 0);
        }
      }

      // Dispatch custom event
      if (canvasEl) {
        canvasEl.dispatchEvent(new CustomEvent('glitch:complete', {
          bubbles: true,
          detail: { algorithm: algo, duration, dataUrl: resultDataUrl }
        }));
      }
    } catch (err) {
      console.error('GlitchCanvas error:', err);
      errorMsg = err.message;
    } finally {
      processing = false;
    }
  }

  onMount(() => {
    if (autostart && src) {
      process();
    }
  });

  $: if (src && autostart) {
    process(src, algorithm);
  }
</script>

<div class="glitch-canvas-wrapper" style="display:inline-block;position:relative;">
  {#if processing}
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.7);color:#fff;padding:4px 8px;border-radius:4px;font-size:12px;">
      Rendering ({algorithm})...
    </div>
  {/if}
  {#if errorMsg}
    <div style="color:#f66;font-size:12px;">{errorMsg}</div>
  {/if}
  <canvas bind:this={canvasEl} aria-label={alt} style="display:inline-block;max-width:100%;image-rendering:pixelated;"></canvas>
</div>
