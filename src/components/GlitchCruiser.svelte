<svelte:options customElement={{ tag: 'glitch-cruiser', shadow: 'none' }} />

<script>
  import { onMount, onDestroy } from 'svelte';
  import * as dat from 'dat.gui';
  import { gleech } from '../core/gleech-engine.js';
  import { algorithmParams } from '../core/algorithm-params.js';
  import { workerPool } from '../workers/worker-pool.js';
  import {
    loadImageFromFile,
    createDefaultTestImage,
    resultToDataUrl,
    dataUrlToImageData,
    setPreImportDatabend,
    getPreImportDatabend
  } from '../core/canvas-utils.js';

  let isGenerating = false;
  let currentSourceDataUrl = '';
  let currentSourceImageData = null;
  let tiles = []; // 9 items: index 4 is center source, 0-3 and 5-8 are mutated variations
  let seqCounter = 0;
  let activeTileId = null;
  let tileDebounceTimers = {};
  let preImportTechnique = getPreImportDatabend().technique || 'none';

  function handlePreImportChange() {
    setPreImportDatabend(preImportTechnique);
  }

  function getDefaultOptions(algo) {
    const schema = algorithmParams[algo];
    const opts = {};
    if (schema && schema.params) {
      for (const p of schema.params) {
        if (p.type === 'range') {
          opts[p.id] = typeof p.default === 'number' ? p.default : Math.round((p.min + p.max) / 2);
        } else if (p.type === 'boolean') {
          opts[p.id] = Boolean(p.default);
        } else if (p.type === 'select') {
          opts[p.id] = p.default;
        } else {
          opts[p.id] = p.default;
        }
      }
    }
    return opts;
  }

  async function handleFileInput(e) {
    const file = e.target.files && e.target.files[0];
    if (!file || !file.type.match(/^image\//)) return;
    activeTileId = null;
    const loaded = await loadImageFromFile(file);
    currentSourceDataUrl = loaded.dataUrl;
    currentSourceImageData = loaded.imageData;
    await generateGrid(currentSourceImageData, currentSourceDataUrl);
  }

  async function loadSample() {
    activeTileId = null;
    const sample = createDefaultTestImage(200, 200);
    currentSourceDataUrl = sample.dataUrl;
    currentSourceImageData = sample.imageData;
    await generateGrid(currentSourceImageData, currentSourceDataUrl);
  }

  async function generateGrid(sourceImageData, sourceDataUrl) {
    if (!sourceImageData) return;
    isGenerating = true;
    activeTileId = null;

    const functions = gleech.all.filter(name => !['theWorks', 'randomGlitch', 'glitch'].includes(name));

    // Pick 8 algorithms sequentially or randomly
    const chosenAlgos = [];
    for (let i = 0; i < 8; i++) {
      const algoName = functions[seqCounter % functions.length];
      seqCounter++;
      chosenAlgos.push(algoName);
    }

    // Run the 8 algorithms in parallel via worker pool with default options
    const promises = chosenAlgos.map(algo => {
      const opts = getDefaultOptions(algo);
      return workerPool.run({
        algorithm: algo,
        imageData: sourceImageData,
        options: opts,
        useOffscreen: true
      });
    });

    const results = await Promise.all(promises);

    // Form 9-tile layout (center is index 4)
    const newTiles = [];
    let resultIdx = 0;
    for (let i = 0; i < 9; i++) {
      if (i === 4) {
        newTiles.push({
          id: 'tile_center_' + Date.now(),
          isCenter: true,
          algorithm: 'original',
          dataUrl: sourceDataUrl,
          imageData: sourceImageData,
          options: {},
          isUpdating: false
        });
      } else {
        const res = results[resultIdx++];
        const algo = res.algorithm;
        newTiles.push({
          id: 'tile_' + i + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          isCenter: false,
          algorithm: algo,
          dataUrl: resultToDataUrl(res),
          imageData: res.imageData,
          options: getDefaultOptions(algo),
          isUpdating: false
        });
      }
    }

    tiles = newTiles;
    isGenerating = false;
  }

  async function handleTileClick(tile) {
    if (!tile || !tile.dataUrl || isGenerating) return;
    activeTileId = null;
    // Set this tile as the new source
    currentSourceDataUrl = tile.dataUrl;
    if (tile.imageData) {
      currentSourceImageData = tile.imageData;
    } else {
      currentSourceImageData = await dataUrlToImageData(tile.dataUrl);
    }
    await generateGrid(currentSourceImageData, currentSourceDataUrl);
  }

  function toggleTileGui(tileId) {
    if (activeTileId === tileId) {
      activeTileId = null;
    } else {
      activeTileId = tileId;
    }
  }

  function scheduleTileRerender(tile) {
    clearTimeout(tileDebounceTimers[tile.id]);
    tileDebounceTimers[tile.id] = setTimeout(() => {
      rerenderTile(tile);
    }, 75);
  }

  async function rerenderTile(tile) {
    if (!currentSourceImageData || !tile || tile.isCenter) return;
    tile.isUpdating = true;
    tiles = [...tiles];

    try {
      const res = await workerPool.run({
        algorithm: tile.algorithm,
        imageData: currentSourceImageData,
        options: { ...tile.options },
        useOffscreen: false
      });
      tile.dataUrl = resultToDataUrl(res);
      tile.imageData = res.imageData;
    } catch (err) {
      console.error(`Error re-rendering ${tile.algorithm}:`, err);
    } finally {
      tile.isUpdating = false;
      tiles = [...tiles];
    }
  }

  function initTileGui(node, tile) {
    const schema = algorithmParams[tile.algorithm];
    const tileGui = new dat.GUI({ autoPlace: false, width: 270 });
    node.appendChild(tileGui.domElement);

    if (schema && schema.params && schema.params.length > 0) {
      for (const param of schema.params) {
        if (param.type === 'range') {
          if (tile.options[param.id] === undefined || typeof tile.options[param.id] !== 'number') {
            tile.options[param.id] = typeof param.default === 'number' ? param.default : Math.round((param.min + param.max) / 2);
          }
          const ctrl = tileGui.add(tile.options, param.id, param.min, param.max);
          if (param.step) ctrl.step(param.step);
          ctrl.name(param.label || param.id);
          ctrl.onChange(() => {
            scheduleTileRerender(tile);
          });
        } else if (param.type === 'boolean') {
          if (tile.options[param.id] === undefined) {
            tile.options[param.id] = Boolean(param.default);
          }
          const ctrl = tileGui.add(tile.options, param.id);
          ctrl.name(param.label || param.id);
          ctrl.onChange(() => {
            scheduleTileRerender(tile);
          });
        } else if (param.type === 'select') {
          if (tile.options[param.id] === undefined) {
            tile.options[param.id] = param.default;
          }
          const ctrl = tileGui.add(tile.options, param.id, param.options);
          ctrl.name(param.label || param.id);
          ctrl.onChange(() => {
            scheduleTileRerender(tile);
          });
        }
      }
    } else {
      const infoObj = { mode: 'Stochastic variation' };
      tileGui.add(infoObj, 'mode').name('Preset Mode');
    }

    const actions = {
      reset: () => {
        tile.options = getDefaultOptions(tile.algorithm);
        scheduleTileRerender(tile);
        if (tileGui.__controllers) {
          tileGui.__controllers.forEach(c => {
            if (c.updateDisplay) c.updateDisplay();
          });
        }
      },
      reroll: () => {
        scheduleTileRerender(tile);
      }
    };
    tileGui.add(actions, 'reset').name('↺ Reset Defaults');
    tileGui.add(actions, 'reroll').name('⚄ Re-roll Tile');

    return {
      destroy() {
        tileGui.destroy();
      }
    };
  }

  onMount(() => {
    loadSample();
  });

  onDestroy(() => {
    Object.values(tileDebounceTimers).forEach(t => clearTimeout(t));
  });
</script>

<h1>Glitch Cruiser</h1>
<p>When you upload an image it appears in the center surrounded by glitchy alternatives.
   If one of these images suits your fancy, click on it and it will become the new source for the
   next round of glitches. If you do not like any of the suggested glitches, click on the center
   image, and the alternatives will change, but your source will not.
   Click the <strong>⚙ gear icon</strong> on any tile to open dat.GUI and tune its glitch parameters live!</p>

<div id="form">
  <input type="file" id="uploader" accept="image/*" on:change={handleFileInput} />
  
  <div class="pre-import-pill" title="Pre-import raw byte databending & header corruption before canvas decode">
    <span class="pre-import-tag">PRE-IMPORT:</span>
    <select id="pre_import_select_cruiser" bind:value={preImportTechnique} on:change={handlePreImportChange}>
      <option value="none">Clean (None)</option>
      <option value="headerShear">Header Stride Shear</option>
      <option value="audioEcho">Audacity PCM Echo</option>
      <option value="combFilter">Resonant Comb Filter</option>
      <option value="bytebeat">Bytebeat Audio Raster</option>
      <option value="jpegEntropy">JPEG Entropy Rot</option>
    </select>
  </div>

  <button type="button" id="sample_btn" on:click={loadSample}>Load Sample Image</button>

  {#if isGenerating}
    <div class="generating-status">
      <span class="spinner-dot"></span>
      Generating 8 multi-threaded glitch alternatives...
    </div>
  {/if}
</div>

<div id="output">
  <div class="cruiser-grid">
    {#each tiles as tile, i (tile.id)}
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
      <div
        class="cruiser-tile-card"
        class:is-center={tile.isCenter}
        class:has-gui-open={activeTileId === tile.id}
      >
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div class="image-box" on:click={() => handleTileClick(tile)}>
          <img
            src={tile.dataUrl}
            alt={tile.algorithm}
            title={tile.isCenter ? 'Center Source (click to re-roll surrounding variations)' : `Click to cruise with ${tile.algorithm}`}
          />
          {#if tile.isUpdating}
            <div class="updating-overlay">
              <span>⚡ Updating...</span>
            </div>
          {/if}
        </div>

        <div class="tile-bar">
          <span class="tile-title" title={tile.algorithm}>
            {tile.isCenter ? '★ Source Image' : tile.algorithm}
          </span>
          {#if !tile.isCenter}
            <button
              type="button"
              class="tile-gear-btn"
              class:gear-active={activeTileId === tile.id}
              on:click|stopPropagation={() => toggleTileGui(tile.id)}
              title={`Tune ${tile.algorithm} parameters with dat.GUI`}
            >
              ⚙
            </button>
          {/if}
        </div>

        {#if activeTileId === tile.id}
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div class="tile-gui-popup" on:click|stopPropagation>
            <div class="tile-gui-header">
              <span class="gui-title">{tile.algorithm} dat.GUI</span>
              <button
                type="button"
                class="gui-close-btn"
                on:click|stopPropagation={() => toggleTileGui(tile.id)}
                title="Close parameters panel"
              >
                ✕
              </button>
            </div>
            <div class="tile-gui-mount" use:initTileGui={tile}></div>
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .pre-import-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.4em;
    background: #25282c;
    border: 1px solid #3e444b;
    border-radius: 4px;
    padding: 0.25em 0.55em;
    margin: 0.2em 0.3em;
    vertical-align: middle;
  }
  .pre-import-tag {
    font-size: 0.72em;
    font-weight: bold;
    color: #4ecdc4;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }
  .pre-import-pill select {
    background: #191b1e;
    color: #f0f0f0;
    border: 1px solid #4a515a;
    border-radius: 3px;
    padding: 0.2em 0.4em;
    font-size: 0.85em;
    cursor: pointer;
  }
  .pre-import-pill select:focus {
    outline: none;
    border-color: #4ecdc4;
  }

  .generating-status {
    margin: 0.5em 0;
    padding: 0.5em 0.8em;
    background: #252525;
    color: #7de;
    border-radius: 4px;
    font-size: 0.9em;
    font-family: monospace;
    display: inline-flex;
    align-items: center;
    gap: 0.5em;
    border: 1px solid #444;
  }
  .spinner-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #0ac;
    animation: pulse 1s infinite alternate;
  }
  @keyframes pulse {
    0% { opacity: 0.3; transform: scale(0.8); }
    100% { opacity: 1; transform: scale(1.2); }
  }

  .cruiser-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
    max-width: 900px;
    margin: 1.5em auto;
    padding: 0 10px;
    box-sizing: border-box;
  }
  @media (max-width: 768px) {
    .cruiser-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 480px) {
    .cruiser-grid {
      grid-template-columns: 1fr;
    }
  }

  .cruiser-tile-card {
    position: relative;
    background: #222;
    border: 1px solid #444;
    border-radius: 4px;
    overflow: visible;
    display: flex;
    flex-direction: column;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    transition: transform 0.15s, border-color 0.15s;
  }
  .cruiser-tile-card:hover {
    border-color: #666;
  }
  .cruiser-tile-card.is-center {
    border: 2px solid #0ac;
    box-shadow: 0 0 10px rgba(0, 170, 204, 0.4);
  }
  .cruiser-tile-card.has-gui-open {
    z-index: 60;
    border-color: #0ac;
  }

  .image-box {
    position: relative;
    width: 100%;
    aspect-ratio: 1 / 1;
    background: #111;
    cursor: pointer;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .image-box img {
    width: 100% !important;
    height: 100% !important;
    object-fit: contain !important;
    display: block !important;
    margin: 0 !important;
    border: none !important;
    max-width: none !important;
  }

  .updating-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.65);
    color: #7de;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.85em;
    font-family: monospace;
    font-weight: bold;
    backdrop-filter: blur(2px);
  }

  .tile-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    background: #1c1c1c;
    border-top: 1px solid #333;
    font-size: 0.85em;
  }
  .tile-title {
    color: #ddd;
    font-family: monospace;
    font-size: 0.9em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
  }
  .is-center .tile-title {
    color: #0ac;
    font-weight: bold;
  }

  .tile-gear-btn {
    background: #333 !important;
    color: #aaa !important;
    border: 1px solid #555 !important;
    border-radius: 3px !important;
    width: 26px !important;
    height: 26px !important;
    padding: 0 !important;
    margin: 0 0 0 6px !important;
    font-size: 14px !important;
    line-height: 1 !important;
    cursor: pointer !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    transition: all 0.15s ease;
  }
  .tile-gear-btn:hover {
    background: #444 !important;
    color: #fff !important;
    border-color: #0ac !important;
    transform: rotate(30deg);
  }
  .tile-gear-btn.gear-active {
    background: #0ac !important;
    color: #fff !important;
    border-color: #08a !important;
    transform: rotate(60deg);
  }

  /* dat.GUI POPUP OVERLAY ON TILE */
  .tile-gui-popup {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 100;
    background: #1e1e1e;
    border: 1px solid #0ac;
    border-radius: 4px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.85);
    overflow: hidden;
    animation: fadeIn 0.15s ease-out;
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .tile-gui-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px;
    background: #111;
    border-bottom: 1px solid #333;
  }
  .gui-title {
    font-size: 0.85em;
    font-family: monospace;
    font-weight: bold;
    color: #7de;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .gui-close-btn {
    background: none !important;
    border: none !important;
    color: #aaa !important;
    font-size: 14px !important;
    padding: 0 4px !important;
    margin: 0 !important;
    cursor: pointer !important;
    line-height: 1 !important;
  }
  .gui-close-btn:hover {
    color: #fff !important;
  }

  .tile-gui-mount {
    padding: 0;
  }
  .tile-gui-mount :global(.dg.main) {
    width: 100% !important;
    margin: 0 !important;
    border: none !important;
  }
  .tile-gui-mount :global(.dg li:not(.folder)) {
    background: #252525 !important;
    border-bottom: 1px solid #333 !important;
  }
  .tile-gui-mount :global(.dg .c select) {
    background: #1a1a1a !important;
    color: #eee !important;
  }
  .tile-gui-mount :global(.dg .c input[type="text"]) {
    background: #1a1a1a !important;
    color: #7de !important;
  }
</style>
