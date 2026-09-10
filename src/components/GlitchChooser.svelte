<svelte:options customElement={{ tag: 'glitch-chooser', shadow: 'none' }} />

<script>
  import { onMount, onDestroy } from 'svelte';
  import * as dat from 'dat.gui';
  import { gleech } from '../core/glitch-engine.js';
  import { algorithmParams } from '../core/algorithm-params.js';
  import { workerPool } from '../workers/worker-pool.js';
  import { loadImageFromFile, createDefaultTestImage, resultToDataUrl } from '../core/canvas-utils.js';

  let selectedFunction = 'theWorks';
  let lastLoadedFunction = '';
  let isWorking = false;
  let livePreview = true;
  let originalItem = null;
  let history = []; // Stack of applied mutation states: { dataUrl, imageData, label, duration, isLivePreview }
  let displayedItem = null; // Currently active displayed state: { dataUrl, imageData, label, duration, isLivePreview }
  let currentOptions = {};

  let previewTimer = null;
  let latestRequestId = 0;
  let guiContainer = null;
  let gui = null;

  // Reactively re-initialize options and dat.GUI whenever selectedFunction changes
  $: if (selectedFunction !== lastLoadedFunction) {
    lastLoadedFunction = selectedFunction;
    initOptionsForFunction(selectedFunction);
    if (guiContainer) {
      buildGui();
    }
    if (originalItem && history.length > 0) {
      schedulePreview();
    }
  }

  function initOptionsForFunction(fnName) {
    const schema = algorithmParams[fnName];
    const initialOpts = {};
    if (schema && schema.params) {
      for (const p of schema.params) {
        if (p.type === 'range') {
          initialOpts[p.id] = typeof p.default === 'number' ? p.default : Math.round((p.min + p.max) / 2);
        } else if (p.type === 'boolean') {
          initialOpts[p.id] = Boolean(p.default);
        } else if (p.type === 'select') {
          initialOpts[p.id] = p.default;
        } else {
          initialOpts[p.id] = p.default;
        }
      }
    }
    currentOptions = initialOpts;
  }

  function buildGui() {
    if (!guiContainer) return;
    if (gui) {
      gui.destroy();
      gui = null;
    }
    guiContainer.innerHTML = '';

    const schema = algorithmParams[selectedFunction];
    if (!schema) return;

    gui = new dat.GUI({ autoPlace: false, width: 360 });
    guiContainer.appendChild(gui.domElement);

    if (schema.params && schema.params.length > 0) {
      for (const param of schema.params) {
        if (param.type === 'range') {
          if (currentOptions[param.id] === undefined || typeof currentOptions[param.id] !== 'number') {
            currentOptions[param.id] = typeof param.default === 'number' ? param.default : Math.round((param.min + param.max) / 2);
          }
          const ctrl = gui.add(currentOptions, param.id, param.min, param.max);
          if (param.step) ctrl.step(param.step);
          ctrl.name(param.label || param.id);
          ctrl.onChange(() => {
            if (livePreview) schedulePreview();
          });
        } else if (param.type === 'boolean') {
          if (currentOptions[param.id] === undefined) {
            currentOptions[param.id] = Boolean(param.default);
          }
          const ctrl = gui.add(currentOptions, param.id);
          ctrl.name(param.label || param.id);
          ctrl.onChange(() => {
            if (livePreview) schedulePreview();
          });
        } else if (param.type === 'select') {
          if (currentOptions[param.id] === undefined) {
            currentOptions[param.id] = param.default;
          }
          const ctrl = gui.add(currentOptions, param.id, param.options);
          ctrl.name(param.label || param.id);
          ctrl.onChange(() => {
            if (livePreview) schedulePreview();
          });
        }
      }
    } else {
      const infoObj = { mode: 'Stochastic variations' };
      gui.add(infoObj, 'mode').name('Preset Mode');
    }

    const actions = {
      resetDefaults: () => {
        resetParamsToDefault();
      },
      reRoll: () => {
        schedulePreview();
      }
    };
    gui.add(actions, 'resetDefaults').name('↺ Reset Defaults');
    gui.add(actions, 'reRoll').name('⚄ Re-roll / Refresh');
  }

  function schedulePreview() {
    if (!livePreview || !originalItem || history.length === 0) return;
    clearTimeout(previewTimer);
    previewTimer = setTimeout(runPreview, 80);
  }

  async function runPreview() {
    if (!originalItem || history.length === 0) return;
    const baseItem = history[history.length - 1];
    if (!baseItem || !baseItem.imageData) return;

    const reqId = ++latestRequestId;
    isWorking = true;
    try {
      const res = await workerPool.run({
        algorithm: selectedFunction,
        imageData: baseItem.imageData,
        options: { ...currentOptions },
        useOffscreen: false
      });

      if (reqId !== latestRequestId) return; // Stale render request

      const dataUrl = resultToDataUrl(res);
      displayedItem = {
        dataUrl,
        imageData: res.imageData,
        label: selectedFunction,
        duration: res.duration,
        isLivePreview: true
      };
    } catch (err) {
      if (reqId === latestRequestId) {
        console.error('Real-time preview error:', err);
      }
    } finally {
      if (reqId === latestRequestId) {
        isWorking = false;
      }
    }
  }

  function resetParamsToDefault() {
    initOptionsForFunction(selectedFunction);
    buildGui();
    schedulePreview();
  }

  async function handleFileInput(e) {
    const file = e.target.files && e.target.files[0];
    if (!file || !file.type.match(/^image\//)) return;
    clearTimeout(previewTimer);
    const loaded = await loadImageFromFile(file);
    originalItem = {
      dataUrl: loaded.dataUrl,
      imageData: loaded.imageData,
      label: 'original',
      isLivePreview: false
    };
    history = [originalItem];
    displayedItem = originalItem;
    if (livePreview) {
      schedulePreview();
    }
  }

  async function loadSample() {
    clearTimeout(previewTimer);
    const sample = createDefaultTestImage(240, 240);
    originalItem = {
      dataUrl: sample.dataUrl,
      imageData: sample.imageData,
      label: 'original',
      isLivePreview: false
    };
    history = [originalItem];
    displayedItem = originalItem;
    if (livePreview) {
      schedulePreview();
    }
  }

  onMount(() => {
    initOptionsForFunction(selectedFunction);
    buildGui();
    loadSample();
  });

  onDestroy(() => {
    if (gui) {
      gui.destroy();
      gui = null;
    }
    clearTimeout(previewTimer);
  });

  async function applyMutation() {
    if (!originalItem || isWorking) return;
    clearTimeout(previewTimer);
    isWorking = true;
    try {
      const baseItem = history[history.length - 1];
      let itemToCommit = displayedItem;
      if (!itemToCommit || itemToCommit.label !== selectedFunction || !itemToCommit.imageData || !itemToCommit.isLivePreview) {
        const res = await workerPool.run({
          algorithm: selectedFunction,
          imageData: baseItem.imageData,
          options: { ...currentOptions },
          useOffscreen: false
        });
        const dataUrl = resultToDataUrl(res);
        itemToCommit = {
          dataUrl,
          imageData: res.imageData,
          label: selectedFunction,
          duration: res.duration
        };
      }
      const finalized = { ...itemToCommit, isLivePreview: false };
      history = [...history, finalized];
      displayedItem = finalized;
    } catch (err) {
      console.error('Failed to apply mutation:', err);
      alert(err.message);
    } finally {
      isWorking = false;
    }
  }

  async function replaceMutation() {
    if (!originalItem || isWorking) return;
    clearTimeout(previewTimer);
    isWorking = true;
    try {
      const baseItem = history.length >= 2 ? history[history.length - 2] : history[0];
      const res = await workerPool.run({
        algorithm: selectedFunction,
        imageData: baseItem.imageData,
        options: { ...currentOptions },
        useOffscreen: false
      });
      const dataUrl = resultToDataUrl(res);
      const newItem = {
        dataUrl,
        imageData: res.imageData,
        label: selectedFunction,
        duration: res.duration,
        isLivePreview: false
      };
      if (history.length >= 2) {
        history = [...history.slice(0, history.length - 1), newItem];
      } else {
        history = [history[0], newItem];
      }
      displayedItem = newItem;
    } catch (err) {
      console.error('Failed to replace mutation:', err);
      alert(err.message);
    } finally {
      isWorking = false;
    }
  }

  function undoMutation() {
    if (history.length <= 1 || isWorking) return;
    clearTimeout(previewTimer);
    history = history.slice(0, history.length - 1);
    displayedItem = history[history.length - 1];
  }

  function resetToOriginal() {
    if (!originalItem || isWorking) return;
    clearTimeout(previewTimer);
    history = [originalItem];
    displayedItem = originalItem;
  }
</script>

<h1>Glitch Chooser</h1>
<p>Select an image, choose an algorithm, and tune parameters with real-time preview via dat.GUI. Click <strong>apply</strong> to chain mutations, or <strong>replace</strong> to re-roll the current step.</p>

<div id="form">
  <input type="file" id="uploader" accept="image/*" on:change={handleFileInput} />
  
  <select id="functions" bind:value={selectedFunction}>
    {#if gleech.categories}
      <optgroup label="Presets">
        {#each gleech.categories.presets as fn}
          <option value={fn}>{fn}</option>
        {/each}
      </optgroup>
      <optgroup label="JPEG & Anti-JPEG Corruption">
        {#each gleech.categories.jpegCorrupt as fn}
          <option value={fn}>{fn}</option>
        {/each}
      </optgroup>
      <optgroup label="Digital TV & Broadcast">
        {#each gleech.categories.digitalTV as fn}
          <option value={fn}>{fn}</option>
        {/each}
      </optgroup>
      <optgroup label="Analog TV & CRT">
        {#each gleech.categories.analogCRT as fn}
          <option value={fn}>{fn}</option>
        {/each}
      </optgroup>
      <optgroup label="Dithering">
        {#each gleech.categories.dithering as fn}
          <option value={fn}>{fn}</option>
        {/each}
      </optgroup>
      <optgroup label="Pixel Sorting">
        {#each gleech.categories.pixelSorting as fn}
          <option value={fn}>{fn}</option>
        {/each}
      </optgroup>
      <optgroup label="Geometry & Slicing">
        {#each gleech.categories.geometry as fn}
          <option value={fn}>{fn}</option>
        {/each}
      </optgroup>
      <optgroup label="Color Shifts">
        {#each gleech.categories.colorShifts as fn}
          <option value={fn}>{fn}</option>
        {/each}
      </optgroup>
    {:else}
      {#each gleech.all as fn}
        <option value={fn}>{fn}</option>
      {/each}
    {/if}
  </select>

  <!-- dat.GUI PARAMETER PANEL -->
  <div class="param-panel">
    <div class="param-panel-header">
      <div class="header-left">
        <strong>{algorithmParams[selectedFunction]?.label || selectedFunction}</strong>
        {#if algorithmParams[selectedFunction]?.category}
          <span class="category-tag">{algorithmParams[selectedFunction].category}</span>
        {/if}
      </div>
      <div class="header-actions">
        <label class="live-preview-toggle" title="Toggle immediate real-time rendering when parameters change">
          <input
            type="checkbox"
            bind:checked={livePreview}
            on:change={() => { if (livePreview) schedulePreview(); }}
          />
          <span>Live Preview</span>
        </label>
      </div>
    </div>

    {#if algorithmParams[selectedFunction]?.description}
      <p class="param-desc">{algorithmParams[selectedFunction].description}</p>
    {/if}

    <div bind:this={guiContainer} class="dat-gui-wrapper"></div>
  </div>

  <div class="action-buttons">
    <button id="apply" on:click={applyMutation} disabled={!displayedItem || isWorking} title="Save changes and advance mutation chain">apply</button>
    <button id="replace" on:click={replaceMutation} disabled={!displayedItem || isWorking} title="Replace current mutation with fresh variation">replace</button>
    <button id="undo" on:click={undoMutation} disabled={history.length <= 1 || isWorking} title="Undo last applied mutation">undo</button>
    <button id="reset" on:click={resetToOriginal} disabled={history.length <= 1 || isWorking} title="Reset back to original image">reset</button>
    <button type="button" id="sample_btn" on:click={loadSample} disabled={isWorking}>Load Sample</button>

    {#if isWorking}
      <span class="worker-status">
        <span class="spinner-dot"></span>
        Rendering {selectedFunction}...
      </span>
    {/if}
  </div>
</div>

<div id="output">
  {#if displayedItem}
    <div class="output-card">
      <div class="output-header">
        <h2>
          {displayedItem.label}
          {#if displayedItem.isLivePreview}
            <span class="preview-badge">Live Preview</span>
          {/if}
          {#if displayedItem.duration}
            <span class="duration-tag">({displayedItem.duration}ms)</span>
          {/if}
        </h2>
      </div>

      {#if history.length > 1}
        <div class="chain-indicator">
          <span class="chain-flow">
            {#each history as step, idx}
              {#if idx > 0}<span class="chain-arrow">→</span>{/if}
              <span class="chain-step" class:active-step={idx === history.length - 1 && !displayedItem.isLivePreview}>{step.label}</span>
            {/each}
            {#if displayedItem.isLivePreview}
              <span class="chain-arrow">→</span>
              <span class="chain-step live-step">{displayedItem.label} (preview)</span>
            {/if}
          </span>
        </div>
      {/if}

      <div class="canvas-container">
        <img src={displayedItem.dataUrl} alt={displayedItem.label} />
      </div>

      <div class="download-action">
        <a
          href={displayedItem.dataUrl}
          download={`gleech-${displayedItem.label}-${Date.now()}.png`}
          class="download-btn"
        >
          Download PNG
        </a>
      </div>
    </div>
  {:else}
    <p style="color: #888; font-style: italic;">No image loaded. Please upload an image or load the sample above.</p>
  {/if}
</div>

<style>
  .output-card {
    text-align: center;
    margin: 1.5em auto;
    max-width: 60%;
  }
  .chain-indicator {
    margin: 0.4em 0 0.8em 0;
    font-size: 0.85em;
    color: #aaa;
  }
  .chain-flow {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
    background: #252525;
    padding: 4px 10px;
    border-radius: 12px;
    border: 1px solid #444;
  }
  .chain-arrow {
    color: #7de;
    font-weight: bold;
  }
  .chain-step {
    padding: 2px 6px;
    border-radius: 4px;
    background: #333;
    color: #ccc;
    font-family: monospace;
  }
  .chain-step.active-step {
    background: #0ac;
    color: #fff;
    font-weight: bold;
  }
  .chain-step.live-step {
    background: #553;
    color: #ffd;
    border: 1px dashed #aa0;
  }
  .download-action {
    margin: 0.6em auto 1.2em auto;
    max-width: 60%;
  }
  .download-btn {
    display: inline-block;
    padding: 0.4em 1em;
    background: #0ac;
    color: #fff;
    text-decoration: none;
    border-radius: 4px;
    font-weight: bold;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    transition: background 0.15s;
  }
  .download-btn:hover {
    background: #08a;
  }
  .canvas-container {
    margin: 0.8em auto;
    display: flex;
    justify-content: center;
  }
  .output-header {
    display: flex;
    justify-content: center;
    align-items: center;
  }
  .preview-badge {
    font-size: 0.55em;
    text-transform: uppercase;
    background: #0ac;
    color: #fff;
    padding: 2px 6px;
    border-radius: 3px;
    vertical-align: middle;
    margin-left: 0.5em;
    font-weight: bold;
    letter-spacing: 0.05em;
  }
  .duration-tag {
    font-size: 0.65em;
    color: #888;
    font-weight: normal;
    margin-left: 0.4em;
  }

  /* PARAMETER PANEL STYLES */
  .param-panel {
    border: 1px solid #555;
    background: #2b2b2b;
    color: #eee;
    padding: 0.9em 1.1em;
    border-radius: 4px;
    margin: 0.8em 0.5em;
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.4);
  }
  .param-panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5em;
    border-bottom: 1px solid #444;
    padding-bottom: 0.4em;
    font-size: 0.95em;
  }
  .header-left {
    display: flex;
    align-items: center;
    gap: 0.5em;
  }
  .category-tag {
    font-size: 0.7em;
    text-transform: uppercase;
    background: #444;
    color: #7de;
    padding: 1px 5px;
    border-radius: 2px;
    border: 1px solid #555;
  }
  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.8em;
  }
  .live-preview-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.35em;
    font-size: 0.8em;
    color: #aaa;
    cursor: pointer;
    margin: 0 !important;
  }
  .live-preview-toggle input {
    margin: 0 !important;
    display: inline-block !important;
    cursor: pointer;
  }
  .param-desc {
    margin: 0 0 0.8em 0 !important;
    max-width: 100% !important;
    font-size: 0.85em;
    color: #bbb;
    font-style: italic;
    line-height: 1.4;
  }

  /* dat.GUI INTEGRATION */
  .dat-gui-wrapper {
    margin: 0.5em 0;
    display: flex;
    justify-content: center;
  }
  .dat-gui-wrapper :global(.dg.main) {
    width: 100% !important;
    max-width: 380px !important;
    margin: 0 auto !important;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5) !important;
    border: 1px solid #444 !important;
  }
  .dat-gui-wrapper :global(.dg li:not(.folder)) {
    background: #222 !important;
    border-bottom: 1px solid #333 !important;
  }
  .dat-gui-wrapper :global(.dg .c select) {
    background: #1a1a1a !important;
    color: #eee !important;
  }
  .dat-gui-wrapper :global(.dg .c input[type="text"]) {
    background: #1a1a1a !important;
    color: #7de !important;
  }

  .action-buttons {
    margin: 0.5em 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.3em;
  }
  .worker-status {
    margin-left: 0.5em;
    color: #7de;
    font-family: monospace;
    font-size: 0.85em;
    display: inline-flex;
    align-items: center;
    gap: 0.4em;
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
</style>
