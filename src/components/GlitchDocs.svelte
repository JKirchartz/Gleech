<svelte:options customElement={{ tag: 'glitch-docs', shadow: 'none' }} />

<script>
  import { onMount } from 'svelte';
  import { gleech } from '../core/gleech-engine.js';
  import { algorithmParams } from '../core/algorithm-params.js';
  import { workerPool } from '../workers/worker-pool.js';
  import { createDefaultTestImage, resultToDataUrl } from '../core/canvas-utils.js';

  let selectedAlgorithm = 'theWorks';
  let isTesting = false;
  let testDuration = 0;
  let previewUrl = '';
  let originalSampleUrl = '';
  let sampleImageData = null;
  let activeFilter = 'all';
  let searchQuery = '';
  let copiedCommand = '';
  let currentOptions = {};

  $: {
    const schema = algorithmParams[selectedAlgorithm];
    const initialOpts = {};
    if (schema && schema.params) {
      for (const p of schema.params) {
        initialOpts[p.id] = p.default;
      }
    }
    currentOptions = initialOpts;
  }

  function updateParam(id, val) {
    currentOptions = {
      ...currentOptions,
      [id]: val
    };
  }

  function resetParamsToDefault() {
    const schema = algorithmParams[selectedAlgorithm];
    const initialOpts = {};
    if (schema && schema.params) {
      for (const p of schema.params) {
        initialOpts[p.id] = p.default;
      }
    }
    currentOptions = initialOpts;
  }

  function resetInteractiveTest() {
    if (originalSampleUrl) {
      previewUrl = originalSampleUrl;
      testDuration = 0;
    }
  }

  $: dynamicCliCommand = (() => {
    let cmd = `gleech ${selectedAlgorithm} input.jpg output.png`;
    const schema = algorithmParams[selectedAlgorithm];
    if (schema && schema.params) {
      for (const p of schema.params) {
        const val = currentOptions[p.id];
        if (val !== undefined && val !== 'auto') {
          cmd += ` --${p.id}=${val}`;
        }
      }
    }
    return cmd;
  })();

  const algorithmDetails = {
    theWorks: { category: 'preset', desc: 'Randomly shuffles and cascades multiple non-sorting glitch filters for a complete overhaul.' },
    randomGlitch: { category: 'preset', desc: 'Randomly picks 3 to 6 distinct glitch algorithms and applies them in sequence.' },
    glitch: { category: 'preset', desc: 'Runs 10 consecutive random passes mixing color shifts, dithering, and inversions.' },
    preset1: { category: 'preset', desc: 'Curated combination: Color shift + Atkinson dither + horizontal slice.' },
    preset2: { category: 'preset', desc: 'Curated combination: Drumroll wave + Floyd-Steinberg + RGB glitch.' },
    preset3: { category: 'preset', desc: 'Curated combination: Fractal ghosts + shortsort + Bayer dither.' },
    preset4: { category: 'preset', desc: 'Curated combination: Scanlines + pixelFunk + channel inversion.' },

    ditherFloydSteinberg: { category: 'dither', desc: 'Classic error-diffusion dithering distributing quantization error to 4 neighboring pixels.' },
    ditherAtkinsons: { category: 'dither', desc: 'Bill Atkinson (Apple Macintosh) error-diffusion dither with 1/8 error dispersal.' },
    ditherBayer: { category: 'dither', desc: 'Ordered Bayer matrix threshold dithering producing a characteristic retro crosshatch texture.' },
    ditherBayer3: { category: 'dither', desc: 'Expanded 3-bit color Bayer matrix dither producing vibrant primary color patterns.' },
    dither8Bit: { category: 'dither', desc: 'Reduces color depth to classic 8-bit aesthetic with randomized error distribution.' },
    ditherHalftone: { category: 'dither', desc: 'Emulates print halftone dot screening using mathematical thresholding.' },
    ditherBitmask: { category: 'dither', desc: 'Fast bitwise bitmask quantization truncating lower color bits.' },
    ditherRandom: { category: 'dither', desc: 'Monochrome random threshold noise dithering resembling photocopier artifacts.' },
    ditherRandom3: { category: 'dither', desc: 'RGB multi-channel random threshold dither creating speckled color noise.' },

    pixelFunk: { category: 'sort', desc: 'Mutates random square pixel blocks with configurable block size for digital mosaic corruption.' },
    superPixelFunk: { category: 'sort', desc: 'High-intensity mosaic corruption with randomized multi-scale block transfers.' },
    sort: { category: 'sort', desc: 'Horizontal pixel sorting across pixel byte streams based on luminance intensity.' },
    shortsort: { category: 'sort', desc: 'Short-stride byte sort creating fine directional brushed-metal glitch trails.' },
    shortdumbsort: { category: 'sort', desc: 'Random-pivot byte sorting creating fragmented, unpredictable jagged streaks.' },
    slicesort: { category: 'sort', desc: 'Slices image into vertical/horizontal partitions and independently sorts each slice.' },
    sortStripe: { category: 'sort', desc: 'Interleaved zebra-stripe pixel sorting creating horizontal barcode-like scan traces.' },
    sortRows: { category: 'sort', desc: 'Individual row-by-row pixel sorting creating liquid horizontal color smear streaks.' },
    randomSortRows: { category: 'sort', desc: 'Stochastically selects random pixel rows to sort, preserving partial image structure.' },
    dumbSortRows: { category: 'sort', desc: 'Heavily randomized row sorting with coarse pivot thresholds.' },
    pixelSort: { category: 'sort', desc: 'Adaptive threshold-based pixel sort simulating classic ASDF / Processing sorting.' },

    slice: { category: 'slice', desc: 'Displaces random horizontal image slices sideways, emulating analog tracking errors.' },
    slice2: { category: 'slice', desc: 'Alternating bidirectional slice displacement with wrapped edges.' },
    slice3: { category: 'slice', desc: 'Dense multi-frequency slice glitch with variable horizontal amplitude.' },
    superSlice: { category: 'slice', desc: 'Aggressive multi-pass slicing with chromatic displacement between slices.' },
    superSlice2: { category: 'slice', desc: 'Complex layered slice shifts with inter-channel channel bleeding.' },
    scanlines: { category: 'slice', desc: 'Emulates CRT monitor scanlines by darkening alternate raster rows.' },
    focusImage: { category: 'slice', desc: 'Sharp high-contrast edge amplification and center focus thresholding.' },
    fractal: { category: 'slice', desc: 'Fractal feedback loop copying and blending scaled quad segments.' },
    fractal2: { category: 'slice', desc: 'Inverted fractal recursion with alternate quadrant mirroring.' },
    fractalGhosts: { category: 'slice', desc: 'Semitransparent displaced ghost echoes with variable opacity overlays.' },
    fractalGhosts2: { category: 'slice', desc: 'Dual-axis ghosting displacement producing chromatic ghost trails.' },
    fractalGhosts3: { category: 'slice', desc: 'High-frequency ghost echoes producing vibrating holographic artifacts.' },
    fractalGhosts4: { category: 'slice', desc: 'Cascading geometric ghost feedback across multiple scale factors.' },

    DrumrollHorizontal: { category: 'drumroll', desc: 'Horizontal CRT horizontal-hold slip emulation causing tearing bands.' },
    DrumrollVertical: { category: 'drumroll', desc: 'Vertical V-Hold rolling distortion shifting frame alignment downward.' },
    DrumrollHorizontalWave: { category: 'drumroll', desc: 'Sinusoidal horizontal wave displacement emulating tape flutter.' },
    DrumrollVerticalWave: { category: 'drumroll', desc: 'Vertical sinusoidal wave warping producing wobbling tape distortion.' },
    vcrTracking: { category: 'drumroll', desc: 'Simulates VCR rotary head-switch tracking errors with quadratic skew, snow bursts, and chroma phase drift.' },
    verticalHold: { category: 'drumroll', desc: 'Lost analog TV vertical sync (V-HOLD roll), rendering thick dark VBI blanking bar and teletext pulse lines.' },
    antennaGhost: { category: 'drumroll', desc: 'Multipath RF television reception echoes, producing delayed, attenuated, edge-emphasized ghost reflections.' },
    interlaceJitter: { category: 'drumroll', desc: 'Simulates 480i / 576i interlaced field misregistration with horizontal comb tearing on odd scanlines.' },

    jpegBlockRot: { category: 'jpeg', desc: 'JPEG 8×8 MCU macroblock phase desync, DC baseline drift, and boundary edge spikes.' },
    mosquitoRings: { category: 'jpeg', desc: 'Simulates Gibbs phenomenon with resonant damped cosine ringing halos around high-contrast edges.' },
    chromaBleed420: { category: 'jpeg', desc: 'Decimates YCbCr chrominance to 16×16 blocks, quantizes color depth, and introduces asymmetric phase smear.' },
    huffmanSlip: { category: 'jpeg', desc: 'Simulates JPEG variable-length Huffman entropy bitstream desync, causing cascading diagonal neon shifts.' },
    nyquistPoison: { category: 'jpeg', desc: 'Anti-JPEG adversarial spatial checkerboard oscillation forcing maximum-magnitude 8×8 AC coefficients.' },
    restartMarkerDrop: { category: 'jpeg', desc: 'Simulates dropped JPEG restart (RST) markers causing horizontal strip shearing and DC baseline jump.' },
    quantizeCrush: { category: 'jpeg', desc: 'Zeroes out low-frequency DC gradients while amplifying high-frequency corner variations across 8×8 blocks.' },
    subsamplingShear: { category: 'jpeg', desc: 'Horizontal chrominance plane shear across macro-slices while preserving sharp monochrome luminance.' },
    ghostBlocks: { category: 'jpeg', desc: 'Interleaved MCU frame-buffer memory leak, stamping cloned macroblocks with XOR/inverted blending.' },

    tsPacketLoss: { category: 'digitaltv', desc: 'Simulates DVB/ATSC MPEG transport stream dropped packets, defaulting missing macroblocks to neon green or lilac.' },
    macroblockFreeze: { category: 'digitaltv', desc: 'Simulates dropped I-frames with drifting P-frame motion vectors smearing 16×16 blocks across coordinates.' },
    digitalArtifacts: { category: 'digitaltv', desc: 'MPEG-2 / H.264 entropy decode desync with discrete cosine ringing and rectangular bitplane flips.' },

    rgb_glitch: { category: 'shift', desc: 'Displaces red, green, and blue color planes along randomized coordinate vectors.' },
    superShift: { category: 'shift', desc: 'Wide-amplitude chromatic offset with channel inversion on wrap.' },
    colorShift: { category: 'shift', desc: 'Rotates color channel indices (R->G, G->B, B->R) across pixel buffers.' },
    colorShift2: { category: 'shift', desc: 'Reverse color channel cyclic shift with luminance modulation.' },
    redShift: { category: 'shift', desc: 'Isolates and amplifies the red channel while suppressing green and blue.' },
    greenShift: { category: 'shift', desc: 'Isolates and amplifies the green channel producing phosphor CRT green.' },
    blueShift: { category: 'shift', desc: 'Isolates and amplifies the blue channel producing deep cyan-blue ambiance.' },
    invert: { category: 'shift', desc: 'Inverts all RGB pixel values (255 - value) producing negative exposure.' }
  };

  const categoryLabels = {
    preset: 'Preset',
    jpeg: 'JPEG Corrupt',
    digitaltv: 'Digital TV',
    drumroll: 'Analog TV & CRT',
    dither: 'Dither',
    sort: 'Pixel Sort',
    slice: 'Geometry',
    shift: 'Color Shift'
  };

  const allAlgorithmsList = Object.keys(algorithmDetails);

  $: filteredAlgorithms = allAlgorithmsList.filter(name => {
    const item = algorithmDetails[name] || { category: 'other', desc: '' };
    if (activeFilter !== 'all' && item.category !== activeFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return name.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q);
    }
    return true;
  });

  async function runInteractiveTest(algo = selectedAlgorithm) {
    selectedAlgorithm = algo;
    if (!sampleImageData) {
      const sample = createDefaultTestImage(240, 240);
      sampleImageData = sample.imageData;
      originalSampleUrl = sample.dataUrl;
    }
    isTesting = true;
    try {
      const res = await workerPool.run({
        algorithm: algo,
        imageData: sampleImageData,
        options: { ...currentOptions },
        useOffscreen: true
      });
      testDuration = res.duration;
      previewUrl = resultToDataUrl(res);
    } catch (err) {
      console.error('Interactive test error:', err);
    } finally {
      isTesting = false;
    }
  }

  function copyToClipboard(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      copiedCommand = text;
      setTimeout(() => { copiedCommand = ''; }, 2000);
    }
  }

  onMount(() => {
    const sample = createDefaultTestImage(240, 240);
    sampleImageData = sample.imageData;
    originalSampleUrl = sample.dataUrl;
    previewUrl = sample.dataUrl;
  });
</script>

<div class="docs-wrapper">
  <div class="docs-hero">
    <h1>Gleech Documentation</h1>
    <p class="lead">Universal image glitching and 3-bit dithering engine for <strong>Node.js CLI &amp; scripts</strong> and <strong>Web Browsers</strong>.</p>
    
    <div class="quick-badges">
      <span class="badge">Node.js CLI &amp; API</span>
      <span class="badge">Zero-Dependency Browser Core</span>
      <span class="badge">Web Workers &amp; OffscreenCanvas</span>
      <span class="badge">68 Algorithmic Mutators</span>
    </div>
  </div>

  <!-- INTERACTIVE PLAYGROUND -->
  <section class="docs-card interactive-section">
    <h2>Live Algorithm Explorer</h2>
    <p>Test any algorithm instantly with multi-threaded Web Workers and zero UI blocking.</p>

    <div class="interactive-grid">
      <div class="interactive-preview">
        {#if previewUrl}
          <img src={previewUrl} alt={selectedAlgorithm} class="preview-img" />
        {/if}
        <div class="preview-meta">
          <strong>{selectedAlgorithm}</strong>
          {#if testDuration > 0}
            <span class="time-badge">{testDuration}ms</span>
          {/if}
        </div>
      </div>

      <div class="interactive-controls">
        <label for="algo-select">Select Algorithm to Preview:</label>
        <select id="algo-select" bind:value={selectedAlgorithm} on:change={() => runInteractiveTest(selectedAlgorithm)}>
          {#if gleech.categories}
            <optgroup label="Presets">
              {#each gleech.categories.presets as name}
                <option value={name}>{name}</option>
              {/each}
            </optgroup>
            <optgroup label="JPEG &amp; Anti-JPEG Corruption">
              {#each gleech.categories.jpegCorrupt as name}
                <option value={name}>{name}</option>
              {/each}
            </optgroup>
            <optgroup label="Digital TV &amp; Broadcast">
              {#each gleech.categories.digitalTV as name}
                <option value={name}>{name}</option>
              {/each}
            </optgroup>
            <optgroup label="Analog TV &amp; CRT">
              {#each gleech.categories.analogCRT as name}
                <option value={name}>{name}</option>
              {/each}
            </optgroup>
            <optgroup label="Dithering">
              {#each gleech.categories.dithering as name}
                <option value={name}>{name}</option>
              {/each}
            </optgroup>
            <optgroup label="Pixel Sorting">
              {#each gleech.categories.pixelSorting as name}
                <option value={name}>{name}</option>
              {/each}
            </optgroup>
            <optgroup label="Geometry &amp; Slicing">
              {#each gleech.categories.geometry as name}
                <option value={name}>{name}</option>
              {/each}
            </optgroup>
            <optgroup label="Color Shifts">
              {#each gleech.categories.colorShifts as name}
                <option value={name}>{name}</option>
              {/each}
            </optgroup>
          {:else}
            {#each gleech.all as name}
              <option value={name}>{name}</option>
            {/each}
          {/if}
        </select>

        {#if algorithmDetails[selectedAlgorithm]}
          <p class="algo-explanation">
            {algorithmDetails[selectedAlgorithm].desc}
          </p>
        {/if}

        {#if algorithmParams[selectedAlgorithm] && algorithmParams[selectedAlgorithm].params && algorithmParams[selectedAlgorithm].params.length > 0}
          <div class="params-box">
            <div class="params-header">
              <span class="params-title">Editable Parameters</span>
              <button type="button" class="btn-subtle-reset" on:click={resetParamsToDefault}>
                Reset to Random Defaults
              </button>
            </div>
            <div class="params-grid">
              {#each algorithmParams[selectedAlgorithm].params as param}
                <div class="param-row">
                  <div class="param-label-group">
                    <span class="param-label">{param.label}</span>
                    <span class="param-hint">
                      {currentOptions[param.id] === 'auto' ? `(Auto: ${param.defaultHint || 'randomized'})` : (param.type === 'boolean' ? '' : currentOptions[param.id])}
                    </span>
                  </div>

                  {#if param.type === 'range'}
                    <div class="param-input-group">
                      <input
                        type="range"
                        min={param.min}
                        max={param.max}
                        step={param.step || 1}
                        value={currentOptions[param.id] === 'auto' ? Math.round((param.min + param.max) / 2) : currentOptions[param.id]}
                        on:input={(e) => updateParam(param.id, Number(e.target.value))}
                      />
                      <button
                        type="button"
                        class="btn-auto"
                        class:active={currentOptions[param.id] === 'auto'}
                        on:click={() => updateParam(param.id, currentOptions[param.id] === 'auto' ? Math.round((param.min + param.max) / 2) : 'auto')}
                        title="Toggle between automatic randomized value and user-fixed value"
                      >
                        {currentOptions[param.id] === 'auto' ? 'Auto ⚄' : 'Manual'}
                      </button>
                    </div>
                  {:else if param.type === 'select'}
                    <div class="param-input-group">
                      <select
                        class="param-select"
                        value={currentOptions[param.id]}
                        on:change={(e) => updateParam(param.id, e.target.value)}
                      >
                        {#if param.default === 'auto'}
                          <option value="auto">Auto (Randomized)</option>
                        {/if}
                        {#each param.options as opt}
                          <option value={opt}>{opt}</option>
                        {/each}
                      </select>
                    </div>
                  {:else if param.type === 'boolean'}
                    <div class="param-input-group">
                      <label class="checkbox-label">
                        <input
                          type="checkbox"
                          checked={currentOptions[param.id] === true || currentOptions[param.id] === 'true'}
                          on:change={(e) => updateParam(param.id, e.target.checked)}
                        />
                        <span>Enabled</span>
                      </label>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <div class="btn-row">
          <button type="button" class="btn-primary" on:click={() => runInteractiveTest(selectedAlgorithm)} disabled={isTesting}>
            {isTesting ? 'Processing...' : 'Run Algorithm'}
          </button>
          <button type="button" class="btn-secondary" on:click={() => runInteractiveTest('theWorks')}>
            Surprise Me (theWorks)
          </button>
          <button type="button" class="btn-reset" on:click={resetInteractiveTest} disabled={isTesting} title="Reset to original test image">
            Reset Image
          </button>
        </div>

        <div class="cli-snippet">
          <code>{dynamicCliCommand}</code>
          <button type="button" class="btn-copy" on:click={() => copyToClipboard(dynamicCliCommand)}>
            {copiedCommand === dynamicCliCommand ? 'Copied!' : 'Copy CLI'}
          </button>
        </div>
      </div>
    </div>
  </section>

  <!-- CLI APPLICATION GUIDE -->
  <section class="docs-card">
    <h2>Node.js CLI Application</h2>
    <p>Gleech includes a first-class command-line interface executable via <code>npx</code> or installed globally.</p>

    <div class="code-block">
      <div class="code-header">Terminal / Shell</div>
      <pre><code># Run directly with npx without global install:
npx gleech ditherFloydSteinberg photo.jpg art.png

# Or install globally:
npm install -g gleech

# Run any glitch algorithm:
gleech theWorks photo.jpg glitched.png

# Pixel funk with custom block size parameter (e.g. 8px):
gleech pixelFunk photo.jpg funky.png 8

# List all 52 available algorithms:
gleech list

# Inspect a specific algorithm:
gleech info shortsort</code></pre>
    </div>

    <h3>CLI Commands &amp; Options</h3>
    <table class="docs-table">
      <thead>
        <tr>
          <th>Command / Option</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>gleech &lt;algo&gt; &lt;in&gt; &lt;out&gt; [params...]</code></td>
          <td>Direct invocation: glitches an input image with the specified algorithm and writes to output.</td>
        </tr>
        <tr>
          <td><code>gleech &lt;in&gt; &lt;out&gt; [algo]</code></td>
          <td>Convenience invocation: defaults to <code>theWorks</code> if algorithm is omitted.</td>
        </tr>
        <tr>
          <td><code>gleech list</code></td>
          <td>Prints a categorized catalog of all 52 algorithms.</td>
        </tr>
        <tr>
          <td><code>gleech info &lt;algo&gt;</code></td>
          <td>Displays detailed information and calling syntax for a specific algorithm.</td>
        </tr>
        <tr>
          <td><code>-v, --version</code></td>
          <td>Outputs the current version of gleech.</td>
        </tr>
      </tbody>
    </table>
  </section>

  <!-- PROGRAMMATIC LIBRARY GUIDE -->
  <section class="docs-card">
    <h2>JavaScript / TypeScript Library Usage</h2>
    <p>Use Gleech in any Node.js backend service, build script, or browser application.</p>

    <div class="code-block">
      <div class="code-header">Install via npm</div>
      <pre><code>npm install gleech</code></pre>
    </div>

    <h3>1. Node.js (Async/Await &amp; Method Chaining)</h3>
    <p>Read any image file, chain multiple glitch filters, and save the result:</p>
    <div class="code-block">
      <div class="code-header">example-node.js (ESM)</div>
      <pre><code>import &#123; gleech &#125; from 'gleech';

// Option A: Quick one-liner file processing
await gleech.glitchFile('portrait.jpg', 'glitched.png', 'ditherFloydSteinberg');

// Option B: Multi-filter pipeline with method chaining
const image = await gleech.read('photo.jpg');
image
  .pixelFunk(6)
  .shortsort()
  .ditherBayer();

await image.writeAsync('glitched-pipeline.png');
console.log('Glitch finished!');</code></pre>
    </div>

    <h3>2. Browser / HTML5 Canvas</h3>
    <p>The core engine operates on standard <code>ImageData</code> and typed arrays with zero browser dependencies:</p>
    <div class="code-block">
      <div class="code-header">browser-app.js</div>
      <pre><code>import &#123; gleech &#125; from 'gleech/core';

const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');
const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

// In-place mutation
gleech.theWorks(imageData);

// Render back to canvas
ctx.putImageData(imageData, 0, 0);</code></pre>
    </div>

    <h3>3. Multi-Threaded Web Workers &amp; OffscreenCanvas</h3>
    <p>For smooth 60fps browser UI performance, transfer buffers to a Web Worker:</p>
    <div class="code-block">
      <div class="code-header">worker.js</div>
      <pre><code>import &#123; gleech &#125; from 'gleech/core';

self.onmessage = (e) =&gt; &#123;
  const &#123; buffer, width, height, algo &#125; = e.data;
  const imageData = new ImageData(new Uint8ClampedArray(buffer), width, height);

  gleech[algo](imageData);

  // Transfer back to main thread without memory copies
  self.postMessage(&#123; buffer: imageData.data.buffer &#125;, [imageData.data.buffer]);
&#125;;</code></pre>
    </div>
  </section>

  <!-- ALGORITHM DIRECTORY & FILTER -->
  <section class="docs-card">
    <h2>Algorithm Catalog ({filteredAlgorithms.length} of {allAlgorithmsList.length})</h2>
    <p>Browse the complete unified collection of 68 glitch, dithering, and mutation algorithms.</p>

    <div class="filter-bar">
      <div class="filter-tabs">
        <button type="button" class="tab {activeFilter === 'all' ? 'active' : ''}" on:click={() => activeFilter = 'all'}>All ({allAlgorithmsList.length})</button>
        <button type="button" class="tab {activeFilter === 'preset' ? 'active' : ''}" on:click={() => activeFilter = 'preset'}>Presets (7)</button>
        <button type="button" class="tab {activeFilter === 'jpeg' ? 'active' : ''}" on:click={() => activeFilter = 'jpeg'}>JPEG Corrupt (9)</button>
        <button type="button" class="tab {activeFilter === 'digitaltv' ? 'active' : ''}" on:click={() => activeFilter = 'digitaltv'}>Digital TV (3)</button>
        <button type="button" class="tab {activeFilter === 'drumroll' ? 'active' : ''}" on:click={() => activeFilter = 'drumroll'}>Analog TV &amp; CRT (8)</button>
        <button type="button" class="tab {activeFilter === 'dither' ? 'active' : ''}" on:click={() => activeFilter = 'dither'}>Dithering (9)</button>
        <button type="button" class="tab {activeFilter === 'sort' ? 'active' : ''}" on:click={() => activeFilter = 'sort'}>Pixel Sort (11)</button>
        <button type="button" class="tab {activeFilter === 'slice' ? 'active' : ''}" on:click={() => activeFilter = 'slice'}>Geometry (13)</button>
        <button type="button" class="tab {activeFilter === 'shift' ? 'active' : ''}" on:click={() => activeFilter = 'shift'}>Color Shifts (8)</button>
      </div>
      <input
        type="text"
        class="search-box"
        placeholder="Filter algorithms (e.g. dither, sort, wave)..."
        bind:value={searchQuery}
      />
    </div>

    <div class="algo-cards-grid">
      {#each filteredAlgorithms as name (name)}
        {@const details = algorithmDetails[name] || { category: 'preset', desc: '' }}
        <div class="algo-card cat-{details.category}">
          <div class="algo-card-top">
            <h4 class="algo-name">{name}</h4>
            <span class="algo-tag tag-{details.category}">
              {categoryLabels[details.category] || details.category}
            </span>
          </div>
          <p class="algo-desc">{details.desc}</p>
          <div class="algo-card-footer">
            <button type="button" class="btn-mini" on:click={() => runInteractiveTest(name)}>
              Preview Live
            </button>
            <button type="button" class="btn-mini-copy" on:click={() => copyToClipboard(`gleech glitch in.jpg out.png ${name}`)}>
              Copy CLI
            </button>
          </div>
        </div>
      {/each}
    </div>
  </section>
</div>

<style>
  .docs-wrapper {
    max-width: 960px;
    margin: 1.5em auto 3em;
    padding: 0 1em;
    color: #222;
  }
  .docs-hero {
    margin-bottom: 2em;
    text-align: left;
  }
  .docs-hero h1 {
    font-size: 2.2em;
    margin-bottom: 0.3em;
    color: #222;
  }
  .lead {
    font-size: 1.15em;
    line-height: 1.6;
    color: #555;
    margin-bottom: 1em;
  }
  .quick-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5em;
    margin-top: 0.5em;
  }
  .badge {
    display: inline-block;
    background: #444;
    color: #eee;
    padding: 0.3em 0.8em;
    border-radius: 4px;
    font-size: 0.85em;
    font-weight: bold;
  }
  .docs-card {
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 1.5em;
    margin-bottom: 2em;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  }
  .docs-card h2 {
    font-size: 1.4em;
    margin-bottom: 0.4em;
    color: #333;
  }
  .docs-card h3 {
    font-size: 1.15em;
    margin-top: 1.4em;
    margin-bottom: 0.5em;
    color: #444;
  }
  .docs-card p {
    line-height: 1.6;
    margin-bottom: 1em;
    color: #444;
  }
  /* Interactive section */
  .interactive-grid {
    display: grid;
    grid-template-columns: 260px 1fr;
    gap: 1.5em;
    align-items: start;
    margin-top: 1em;
  }
  @media (max-width: 700px) {
    .interactive-grid {
      grid-template-columns: 1fr;
    }
  }
  .interactive-preview {
    background: #222;
    padding: 0.75em;
    border-radius: 6px;
    text-align: center;
  }
  .preview-img {
    max-width: 100%;
    height: auto;
    image-rendering: pixelated;
    border: 1px solid #555;
  }
  .preview-meta {
    margin-top: 0.5em;
    color: #eee;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.9em;
  }
  .time-badge {
    background: #0ac;
    color: #fff;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 0.8em;
  }
  .interactive-controls label {
    display: block;
    font-weight: bold;
    margin-bottom: 0.5em;
  }
  .interactive-controls select {
    width: 100%;
    padding: 0.6em;
    font-size: 1em;
    border: 1px solid #aaa;
    border-radius: 4px;
    margin-bottom: 1em;
  }
  .algo-explanation {
    background: #f7f7f7;
    padding: 0.8em;
    border-left: 3px solid #0ac;
    font-size: 0.95em;
    margin-bottom: 1em;
  }
  .btn-row {
    display: flex;
    gap: 0.5em;
    margin-bottom: 1em;
  }
  .btn-primary {
    background: #0ac;
    color: #fff;
    border: 1px solid #08a;
    padding: 0.6em 1.2em;
    border-radius: 4px;
    font-weight: bold;
    cursor: pointer;
  }
  .btn-primary:hover {
    background: #09b;
  }
  .btn-secondary {
    background: #444;
    color: #eee;
    border: 1px solid #333;
    padding: 0.6em 1.2em;
    border-radius: 4px;
    cursor: pointer;
  }
  .btn-secondary:hover {
    background: #555;
  }
  .btn-reset {
    background: #542222;
    color: #fcc;
    border: 1px solid #733333;
    padding: 0.6em 1.2em;
    border-radius: 4px;
    font-weight: bold;
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn-reset:hover {
    background: #733333;
    color: #fff;
  }
  .btn-reset:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .params-box {
    background: #fbfbfb;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    padding: 0.85em 1em;
    margin-bottom: 1em;
  }
  .params-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75em;
    padding-bottom: 0.35em;
    border-bottom: 1px solid #eaeaea;
  }
  .params-title {
    font-size: 0.85em;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #444;
  }
  .btn-subtle-reset {
    font-size: 0.78em;
    background: none;
    border: none;
    color: #08a;
    padding: 2px 4px;
    cursor: pointer;
    text-decoration: underline;
  }
  .btn-subtle-reset:hover {
    color: #057;
  }
  .params-grid {
    display: flex;
    flex-direction: column;
    gap: 0.75em;
  }
  .param-row {
    display: flex;
    flex-direction: column;
    gap: 0.25em;
  }
  .param-label-group {
    display: flex;
    justify-content: space-between;
    font-size: 0.85em;
  }
  .param-label {
    font-weight: 600;
    color: #333;
  }
  .param-hint {
    color: #666;
    font-family: monospace;
    font-size: 0.88em;
  }
  .param-input-group {
    display: flex;
    align-items: center;
    gap: 0.5em;
  }
  .param-input-group input[type="range"] {
    flex: 1;
    margin: 0;
    cursor: pointer;
  }
  .btn-auto {
    background: #eee;
    color: #555;
    border: 1px solid #ccc;
    font-size: 0.75em;
    padding: 0.25em 0.6em;
    border-radius: 3px;
    cursor: pointer;
    white-space: nowrap;
  }
  .btn-auto.active {
    background: #0ac;
    color: #fff;
    border-color: #08a;
    font-weight: bold;
  }
  .param-select {
    width: 100%;
    padding: 0.4em;
    font-size: 0.9em;
    border: 1px solid #ccc;
    border-radius: 4px;
    margin-bottom: 0 !important;
  }
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.4em;
    font-size: 0.88em;
    cursor: pointer;
    margin-bottom: 0 !important;
  }
  .cli-snippet {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #2b2b2b;
    color: #7de;
    padding: 0.5em 0.8em;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.85em;
  }
  .btn-copy {
    background: #444;
    color: #eee;
    border: 1px solid #666;
    padding: 3px 8px;
    border-radius: 3px;
    font-size: 0.8em;
    cursor: pointer;
  }
  .btn-copy:hover {
    background: #666;
  }
  /* Code blocks */
  .code-block {
    background: #2b2b2b;
    color: #f1f1f1;
    border-radius: 6px;
    overflow: hidden;
    margin-bottom: 1.2em;
  }
  .code-header {
    background: #1f1f1f;
    padding: 0.4em 1em;
    font-size: 0.8em;
    color: #999;
    border-bottom: 1px solid #3a3a3a;
  }
  .code-block pre {
    margin: 0;
    padding: 1em;
    overflow-x: auto;
    font-family: monospace;
    font-size: 0.9em;
    line-height: 1.5;
  }
  /* Tables */
  .docs-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 1em;
    font-size: 0.95em;
  }
  .docs-table th, .docs-table td {
    padding: 0.7em 0.9em;
    border: 1px solid #ddd;
    text-align: left;
  }
  .docs-table th {
    background: #f3f3f3;
    color: #333;
  }
  /* Catalog */
  .filter-bar {
    margin: 1.2em 0;
  }
  .filter-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4em;
    margin-bottom: 0.8em;
  }
  .tab {
    background: #eee;
    border: 1px solid #ccc;
    color: #444;
    padding: 0.4em 0.8em;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85em;
  }
  .tab.active {
    background: #444;
    color: #fff;
    border-color: #333;
  }
  .search-box {
    width: 100%;
    padding: 0.6em;
    font-size: 0.95em;
    border: 1px solid #ccc;
    border-radius: 4px;
  }
  .algo-cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 1em;
    margin-top: 1em;
  }
  .algo-card {
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    padding: 1em;
    background: #fafafa;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .algo-card.cat-preset { border-top: 3px solid #9333ea; }
  .algo-card.cat-jpeg { border-top: 3px solid #d97706; }
  .algo-card.cat-digitaltv { border-top: 3px solid #059669; }
  .algo-card.cat-drumroll { border-top: 3px solid #db2777; }
  .algo-card.cat-dither { border-top: 3px solid #0284c7; }
  .algo-card.cat-sort { border-top: 3px solid #ea580c; }
  .algo-card.cat-slice { border-top: 3px solid #16a34a; }
  .algo-card.cat-shift { border-top: 3px solid #2563eb; }
  .algo-card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5em;
  }
  .algo-name {
    font-size: 1.05em;
    margin: 0;
    color: #222;
  }
  .algo-tag {
    font-size: 0.7em;
    padding: 2px 6px;
    border-radius: 3px;
    font-weight: bold;
    text-transform: uppercase;
  }
  .tag-preset { background: #f3e8ff; color: #7e22ce; }
  .tag-jpeg { background: #fef3c7; color: #b45309; }
  .tag-digitaltv { background: #d1fae5; color: #047857; }
  .tag-drumroll { background: #fce7f3; color: #be185d; }
  .tag-dither { background: #e0f2fe; color: #0369a1; }
  .tag-sort { background: #ffedd5; color: #c2410c; }
  .tag-slice { background: #dcfce7; color: #15803d; }
  .tag-shift { background: #dbeafe; color: #1d4ed8; }
  .algo-desc {
    font-size: 0.85em;
    color: #666;
    line-height: 1.4;
    margin-bottom: 1em;
    flex-grow: 1;
  }
  .algo-card-footer {
    display: flex;
    gap: 0.5em;
  }
  .btn-mini {
    background: #444;
    color: #eee;
    border: 1px solid #333;
    padding: 4px 8px;
    border-radius: 3px;
    font-size: 0.75em;
    cursor: pointer;
  }
  .btn-mini:hover {
    background: #0ac;
    color: #fff;
    border-color: #08a;
  }
  .btn-mini-copy {
    background: #eee;
    color: #444;
    border: 1px solid #ccc;
    padding: 4px 8px;
    border-radius: 3px;
    font-size: 0.75em;
    cursor: pointer;
  }
  .btn-mini-copy:hover {
    background: #ddd;
  }
</style>
