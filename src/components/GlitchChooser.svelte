<svelte:options customElement={{ tag: 'glitch-chooser', shadow: 'none' }} />

<script>
  import { onMount } from 'svelte';
  import { gleech } from '../core/glitch-engine.js';
  import { workerPool } from '../workers/worker-pool.js';
  import { loadImageFromFile, createDefaultTestImage, resultToDataUrl, dataUrlToImageData } from '../core/canvas-utils.js';

  let selectedFunction = 'theWorks';
  let isWorking = false;
  let sourceImageData = null;
  let currentImageData = null;
  let originalDataUrl = '';
  let images = []; // list of generated images

  async function handleFileInput(e) {
    const file = e.target.files && e.target.files[0];
    if (!file || !file.type.match(/^image\//)) return;
    const loaded = await loadImageFromFile(file);
    originalDataUrl = loaded.dataUrl;
    sourceImageData = loaded.imageData;
    currentImageData = loaded.imageData;
    images = [{ dataUrl: originalDataUrl, label: 'original' }];
  }

  async function loadSample() {
    const sample = createDefaultTestImage(240, 240);
    originalDataUrl = sample.dataUrl;
    sourceImageData = sample.imageData;
    currentImageData = sample.imageData;
    images = [{ dataUrl: originalDataUrl, label: 'original' }];
  }

  async function applyMutation() {
    if (!currentImageData || isWorking) return;
    isWorking = true;
    try {
      const res = await workerPool.run({
        algorithm: selectedFunction,
        imageData: currentImageData,
        useOffscreen: true
      });
      const dataUrl = resultToDataUrl(res);
      currentImageData = res.imageData;
      images = [{ dataUrl, label: selectedFunction, duration: res.duration }, ...images];
    } catch (err) {
      console.error('Failed to apply mutation:', err);
      alert(err.message);
    } finally {
      isWorking = false;
    }
  }

  async function replaceMutation() {
    if (!currentImageData || isWorking) return;
    isWorking = true;
    try {
      const res = await workerPool.run({
        algorithm: selectedFunction,
        imageData: currentImageData,
        useOffscreen: true
      });
      const dataUrl = resultToDataUrl(res);
      currentImageData = res.imageData;
      if (images.length > 0) {
        images[0] = { dataUrl, label: selectedFunction, duration: res.duration };
        images = [...images];
      } else {
        images = [{ dataUrl, label: selectedFunction, duration: res.duration }];
      }
    } catch (err) {
      console.error('Failed to replace mutation:', err);
      alert(err.message);
    } finally {
      isWorking = false;
    }
  }

  function resetToOriginal() {
    if (!sourceImageData) return;
    currentImageData = sourceImageData;
    images = [{ dataUrl: originalDataUrl, label: 'original' }];
  }
</script>

<h1>Glitch Chooser</h1>
<p>Select an image, then apply a mutation. Each time you apply a mutation a new image is created from the input. Each time you replace a mutation the new image is replaced.</p>

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

  <button id="apply" on:click={applyMutation} disabled={!currentImageData || isWorking}>apply</button>
  <button id="replace" on:click={replaceMutation} disabled={!currentImageData || isWorking}>replace</button>
  <button id="reset" on:click={resetToOriginal} disabled={!sourceImageData || isWorking}>reset</button>
  <button type="button" id="sample_btn" on:click={loadSample}>Load Sample</button>

  {#if isWorking}
    <span style="margin-left: 0.5em; color: #7de; font-family: monospace;">Processing {selectedFunction} via Web Worker...</span>
  {/if}
</div>

<div id="output">
  {#each images as img, i (i + img.dataUrl.slice(-16))}
    <h2>{img.label} {#if img.duration}<span style="font-size:0.65em;color:#888;font-weight:normal;">({img.duration}ms)</span>{/if}</h2>
    <img src={img.dataUrl} alt={img.label} />
  {/each}
</div>
