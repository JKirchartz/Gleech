<svelte:options customElement={{ tag: 'glitch-only', shadow: 'none' }} />

<script>
  import { gleech } from '../core/glitch-engine.js';
  import { workerPool } from '../workers/worker-pool.js';
  import { loadImageFromFile, createDefaultTestImage, resultToDataUrl } from '../core/canvas-utils.js';

  let isProcessing = false;
  let progress = 0;
  let results = [];

  async function handleFileInput(e) {
    const file = e.target.files && e.target.files[0];
    if (!file || !file.type.match(/^image\//)) return;
    const loaded = await loadImageFromFile(file);
    await runGlitches(loaded.imageData);
  }

  async function loadSample() {
    const sample = createDefaultTestImage(240, 240);
    await runGlitches(sample.imageData);
  }

  async function runGlitches(sourceImageData) {
    if (!sourceImageData) return;
    isProcessing = true;
    results = [];
    progress = 0;

    // 5 iterations of each random glitch function = 15 runs
    const queue = [];
    for (let i = 0; i < 5; i++) {
      queue.push('theWorks');
      queue.push('randomGlitch');
      queue.push('glitch');
    }

    const total = queue.length;
    let completed = 0;

    const promises = queue.map(async (algo) => {
      try {
        const res = await workerPool.run({
          algorithm: algo,
          imageData: sourceImageData,
          useOffscreen: true
        });
        completed++;
        progress = Math.round((completed / total) * 100);
        const dataUrl = resultToDataUrl(res);
        results = [...results, { algorithm: algo, dataUrl, duration: res.duration }];
        return res;
      } catch (err) {
        console.error('Error running glitch:', err);
      }
    });

    await Promise.all(promises);
    isProcessing = false;
  }
</script>

<h1>Glitches</h1>
<p>Pick an image to get random multi-pass glitch examples.</p>

<div id="form">
  <input type="file" id="uploader" accept="image/*" on:change={handleFileInput} />
  <button type="button" id="sample_btn" on:click={loadSample}>Load Sample Image</button>

  {#if isProcessing}
    <div style="margin: 0.5em 0; padding: 0.5em; background: #333; color: #7de; border-radius: 4px; font-size: 0.9em; font-family: monospace;">
      Worker Pool Progress: {results.length} / 15 glitch iterations ({progress}%)
    </div>
  {/if}
</div>

<div id="output">
  {#each results as res, i (i + res.dataUrl.slice(-16))}
    <img src={res.dataUrl} alt={res.algorithm} title="{res.algorithm} ({res.duration}ms)" />
  {/each}
</div>
