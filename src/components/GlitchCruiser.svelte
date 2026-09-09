<svelte:options customElement={{ tag: 'glitch-cruiser', shadow: 'none' }} />

<script>
  import { onMount } from 'svelte';
  import { gleech } from '../core/glitch-engine.js';
  import { workerPool } from '../workers/worker-pool.js';
  import { loadImageFromFile, createDefaultTestImage, resultToDataUrl, dataUrlToImageData } from '../core/canvas-utils.js';

  let isGenerating = false;
  let currentSourceDataUrl = '';
  let currentSourceImageData = null;
  let tiles = []; // 9 items: index 4 is the center source, 0-3 and 5-8 are mutated variations
  let seqCounter = 0;

  async function handleFileInput(e) {
    const file = e.target.files && e.target.files[0];
    if (!file || !file.type.match(/^image\//)) return;
    const loaded = await loadImageFromFile(file);
    currentSourceDataUrl = loaded.dataUrl;
    currentSourceImageData = loaded.imageData;
    await generateGrid(currentSourceImageData, currentSourceDataUrl);
  }

  async function loadSample() {
    const sample = createDefaultTestImage(200, 200);
    currentSourceDataUrl = sample.dataUrl;
    currentSourceImageData = sample.imageData;
    await generateGrid(currentSourceImageData, currentSourceDataUrl);
  }

  async function generateGrid(sourceImageData, sourceDataUrl) {
    if (!sourceImageData) return;
    isGenerating = true;

    const functions = gleech.all.filter(name => !['theWorks', 'randomGlitch', 'glitch'].includes(name));

    // Pick 8 algorithms sequentially or randomly
    const chosenAlgos = [];
    for (let i = 0; i < 8; i++) {
      const algoName = functions[seqCounter % functions.length];
      seqCounter++;
      chosenAlgos.push(algoName);
    }

    // Run the 8 algorithms in parallel via worker pool
    const promises = chosenAlgos.map(algo =>
      workerPool.run({
        algorithm: algo,
        imageData: sourceImageData,
        useOffscreen: true
      })
    );

    const results = await Promise.all(promises);

    // Form 9-tile layout (center is index 4)
    const newTiles = [];
    let resultIdx = 0;
    for (let i = 0; i < 9; i++) {
      if (i === 4) {
        newTiles.push({
          isCenter: true,
          algorithm: 'original',
          dataUrl: sourceDataUrl,
          imageData: sourceImageData
        });
      } else {
        const res = results[resultIdx++];
        newTiles.push({
          isCenter: false,
          algorithm: res.algorithm,
          dataUrl: resultToDataUrl(res),
          imageData: res.imageData
        });
      }
    }

    tiles = newTiles;
    isGenerating = false;
  }

  async function handleTileClick(tile) {
    if (!tile || !tile.dataUrl || isGenerating) return;
    // Set this tile as the new source
    currentSourceDataUrl = tile.dataUrl;
    if (tile.imageData) {
      currentSourceImageData = tile.imageData;
    } else {
      currentSourceImageData = await dataUrlToImageData(tile.dataUrl);
    }
    await generateGrid(currentSourceImageData, currentSourceDataUrl);
  }
</script>

<h1>Glitch Cruiser</h1>
<p>When you upload an image it appears in the center surrounded by glitchy alternatives.
    If one of these images suits your fancy, click on it and it will become the new source for the
    next round of glitches. If you do not like any of the suggested glitches, click on the center
    image, and the alternatives will change, but your source will not.</p>

<div id="form">
  <input type="file" id="uploader" accept="image/*" on:change={handleFileInput} />
  <button type="button" id="sample_btn" on:click={loadSample}>Load Sample Image</button>

  {#if isGenerating}
    <div style="margin: 0.5em 0; padding: 0.5em; background: #333; color: #7de; border-radius: 4px; font-size: 0.9em; font-family: monospace;">
      Generating 8 multi-threaded glitch alternatives...
    </div>
  {/if}
</div>

<div id="output">
  {#each tiles as tile, i (i + (tile.dataUrl ? tile.dataUrl.slice(-16) : ''))}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
    <img
      src={tile.dataUrl}
      alt={tile.algorithm}
      title={tile.isCenter ? 'Center Source (click to re-roll surrounding variations)' : `Click to cruise using ${tile.algorithm}`}
      style="cursor: pointer; {tile.isCenter ? 'border: 2px solid #0ac;' : ''}"
      on:click={() => handleTileClick(tile)}
    />
  {/each}
</div>
