# Gleech

Universal image glitching and 3-bit dithering engine for **Node.js CLI & scripts** and **Web Browsers** — a modernized fork of [Glitchy3bitDither](https://github.com/jkirchartz/Glitchy3bitdither), this initial commit was made with AIStudio.Google.Com and Gemini 3.8 in under an hour (bittersweet, since the original version cost me months of actual brainpower & free time.) before Gemini got stuck in an endless loop and chewed through the rest of my day's limit, so I figured it was time for an initial commit... it works fine in the preview window, let's see how Github handles it.

Gleech is an aleatoric image mutation tool capable of procedural pixel sorting, ordered/error-diffusion dithering, CRT emulation, and chromatic displacement. Run it directly in your terminal, integrate it into Node.js automated workflows, or embed its zero-dependency engine in browser applications with multi-threaded Web Workers and OffscreenCanvas.

the below information is probably already outdated:

---

## Features

- **68 Algorithmic Mutators**: A unified suite of 68 glitch, dithering, pixel sorting, JPEG corruption, CRT/VCR tracking, and chromatic mutation algorithms.
- **Node.js CLI Application**: First-class command-line interface executable via `npx` or installed globally.
- **Programmatic Node.js Library**: Supports async/await, method chaining pipelines, and file-to-file processing.
- **Zero-Dependency Browser Engine**: The core glitch engine runs directly on standard `ImageData` and typed pixel arrays.
- **High-Performance Web Workers**: OffscreenCanvas support and zero-copy transferable memory buffers prevent UI freezing during intensive batch renders.
- **Modular Svelte Web Components**: Custom elements (`<glitch-docs>`, `<glitch-cruiser>`, `<glitch-chooser>`, `<glitch-only>`) usable in any HTML page.

---

## Web Applications & Interactive Explorers

When running the web app (built with Vite):

- **[Documentation & Live Explorer](index.html) (`/index.html` or `/`)**: Interactive testing playground with worker execution metrics, CLI generators, and a searchable algorithm catalog.
- **[Glitch Only](glitch.html) (`/glitch.html`)**: Single-canvas focused interactive glitch tool with real-time controls.
- **[Glitch Cruiser](GlitchCruiser.html) (`/GlitchCruiser.html`)**: Automated cruising mode running simultaneous randomized glitch permutations.
- **[Glitch Chooser](GlitchChooser.html) (`/GlitchChooser.html`)**: Evolutionary side-by-side selection tool allowing you to iteratively steer glitch mutations.

---

## Command-Line Interface (CLI)

Run directly using `npx` (no global installation required):

```bash
npx gleech glitch input.jpg output.png ditherFloydSteinberg
```

Or install globally:

```bash
npm install -g gleech
```

### CLI Syntax

```bash
gleech <algorithm> <input> <output> [parameters...]
```

You can also pass `<input> <output> [algorithm]` or use the legacy `gleech glitch <in> <out> [algo]` syntax.

### CLI Options & Commands

| Command / Option | Description |
|---|---|
| `gleech <algo> <in> <out> [params...]` | Glitches an input image using the chosen algorithm and writes to output. |
| `gleech <in> <out> [algo]` | Convenience syntax defaulting to `theWorks` if algorithm is omitted. |
| `gleech list` | Prints a categorized directory of all 68 algorithms. |
| `gleech info <algo>` | Displays details and calling syntax for a specific algorithm. |
| `-v, --version` | Outputs current version number. |

### CLI Examples

```bash
# Direct algorithm invocation:
gleech ditherFloydSteinberg photo.jpg dithered.png

# Full randomized multi-pass glitch:
gleech theWorks photo.jpg glitched.png

# Pixel funk with custom 8px block size parameter:
gleech pixelFunk photo.jpg funky.png 8

# Directional short byte sorting:
gleech shortsort photo.jpg sorted.png

# Retro Macintosh Atkinson dithering:
gleech ditherAtkinsons photo.jpg mac.png

# List all available algorithms:
gleech list
```

---

## Programmatic Library Usage (`npm install gleech`)

### 1. Node.js (Async/Await & Method Chaining)

Read any image file, chain multiple glitch filters, and save the result:

```javascript
import { gleech } from 'gleech';

// Option A: Quick one-liner file processing
await gleech.glitchFile('portrait.jpg', 'glitched.png', 'ditherFloydSteinberg');

// Option B: Multi-filter pipeline with method chaining
const image = await gleech.read('photo.jpg');
image
  .pixelFunk(6)
  .shortsort()
  .ditherBayer();

await image.writeAsync('glitched-pipeline.png');
console.log('Glitch finished!');
```

Legacy Node callback style is also supported:

```javascript
gleech.read('photo.jpg', (err, image) => {
  if (err) throw err;
  image.fractal().ditherBayer().write('output.png');
});
```

### 2. Browser & HTML5 Canvas

The core engine operates on standard `ImageData` with zero external dependencies:

```javascript
import { gleech } from 'gleech/core';

const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');
const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

// In-place mutation:
gleech.theWorks(imageData);

// Render back to canvas:
ctx.putImageData(imageData, 0, 0);
```

### 3. Multi-Threaded Web Workers & OffscreenCanvas

For smooth 60fps browser UI performance, transfer buffers to a worker thread:

```javascript
import { gleech } from 'gleech/core';

self.onmessage = (e) => {
  const { buffer, width, height, algo } = e.data;
  const imageData = new ImageData(new Uint8ClampedArray(buffer), width, height);

  gleech[algo](imageData);

  // Transfer back to main thread without memory copies:
  self.postMessage({ buffer: imageData.data.buffer }, [imageData.data.buffer]);
};
```

---

## Algorithm Catalog

### Presets & Random Chains
- `theWorks`: Randomly shuffles and cascades multiple non-sorting glitch filters for a complete overhaul.
- `randomGlitch`: Randomly selects 3 to 6 distinct glitch algorithms and applies them in sequence.
- `glitch`: Runs 10 consecutive random passes mixing color shifts, dithering, and inversions.
- `preset1` - `preset4`: Curated composite recipe presets.

### JPEG & Anti-JPEG Corruption
- `jpegBlockRot`: Simulates discrete cosine transform (DCT) 8x8 block boundary corruption with progressive degradation.
- `mosquitoRings`: High-frequency edge ringing artifacts around sharp transitions.
- `chromaBleed420`: Subsamples color planes to 4:2:0 format with lateral color smear.
- `huffmanSlip`: Simulates bitstream corruption causing cascading horizontal pixel drift.
- `nyquistPoison`: Injects high-frequency checkerboard noise exceeding sampling limits.
- `restartMarkerDrop`: Simulates lost JPEG RST markers resetting MCU row alignments.
- `quantizeCrush`: Heavy quantization matrix division crushing subtle gradients into stepped bands.
- `subsamplingShear`: Diagonal shearing on subsampled color planes.
- `ghostBlocks`: Echoes previous 8x8 block states into subsequent blocks.

### Digital TV & Broadcast Corruption
- `tsPacketLoss`: Emulates MPEG transport stream 188-byte packet drops causing rectangular tears.
- `macroblockFreeze`: Simulates dropped P-frames freezing macroblock coordinates.
- `digitalArtifacts`: Composite broadcast reception interference and signal degradation.

### Analog TV, VCR & CRT Emulation
- `DrumrollHorizontal` / `DrumrollVertical`: Horizontal and vertical sync slip emulation.
- `DrumrollHorizontalWave` / `DrumrollVerticalWave`: Sinusoidal wave flutter and tracking wobble.
- `vcrTracking`: Realistic VHS head tracking misalignment band with noise snow.
- `verticalHold`: V-Hold rolling distortion drifting the raster frame.
- `antennaGhost`: RF broadcast multipath reception ghost reflections.
- `interlaceJitter`: Alternating field comb artifacts from high-motion interlaced video.

### Dithering (Ordered & Error-Diffusion)
- `ditherFloydSteinberg`: Classic error-diffusion dithering distributing quantization error to 4 neighboring pixels.
- `ditherAtkinsons`: Bill Atkinson (Apple Macintosh) error-diffusion dither with 1/8 error dispersal.
- `ditherBayer`: Ordered Bayer matrix threshold dithering producing a retro crosshatch texture.
- `ditherBayer3`: Expanded 3-bit color Bayer matrix dither producing vibrant primary color patterns.
- `dither8Bit`: Reduces color depth to classic 8-bit aesthetic with randomized error distribution.
- `ditherHalftone`: Emulates print halftone dot screening using mathematical thresholding.
- `ditherBitmask`: Fast bitwise bitmask quantization truncating lower color bits.
- `ditherRandom`: Monochrome random threshold noise dithering resembling photocopier artifacts.
- `ditherRandom3`: RGB multi-channel random threshold dither creating speckled color noise.

### Pixel Sorting & Byte Mutators
- `pixelFunk` & `superPixelFunk`: Digital mosaic corruption with configurable block displacements.
- `sort`: Horizontal byte sort across pixel streams based on luminance intensity.
- `shortsort`: Short-stride byte sort creating fine directional brushed-metal glitch trails.
- `shortdumbsort`: Random-pivot byte sorting creating fragmented, unpredictable jagged streaks.
- `slicesort`: Slices image into partitions and independently sorts each slice.
- `sortStripe`: Interleaved zebra-stripe pixel sorting creating horizontal barcode-like scan traces.
- `sortRows`: Individual row-by-row pixel sorting creating liquid horizontal color smear streaks.
- `randomSortRows`: Stochastically selects random pixel rows to sort, preserving partial image structure.
- `dumbSortRows`: Heavily randomized row sorting with coarse pivot thresholds.
- `pixelSort`: Adaptive threshold-based pixel sort simulating classic ASDF / Processing sorting.

### Slicing & Geometry
- `slice`, `slice2`, `slice3`: Displaces horizontal image slices sideways, emulating analog tracking errors.
- `superSlice`, `superSlice2`: Aggressive multi-pass slicing with chromatic displacement between slices.
- `scanlines`: Emulates CRT monitor scanlines by darkening alternate raster rows.
- `focusImage`: Sharp high-contrast edge amplification and center focus thresholding.
- `fractal`, `fractal2`: Fractal feedback loop copying and blending scaled quad segments.
- `fractalGhosts` (1 - 4): Displaced ghost echoes with variable opacity overlays and geometric recursion.

### Color Plane Shifts & Inversion
- `rgb_glitch`: Displaces red, green, and blue color planes along randomized coordinate vectors.
- `superShift`: Wide-amplitude chromatic offset with channel inversion on wrap.
- `colorShift`, `colorShift2`: Cyclic RGB channel rotation across pixel buffers.
- `redShift`, `greenShift`, `blueShift`: Isolates and amplifies individual color channels.
- `invert`: Inverts all RGB pixel values (255 - value) producing negative exposure.

---

## Development & Testing

```bash
# Install dependencies
npm install

# Start development server on port 3000
npm run dev

# Run CLI and engine unit verification tests
npm test

# Check syntax across CLI, library, and worker code
npm run lint

# Compile production bundles
npm run build
```

---

## License & Credits

- Based on Nolan Caudill's [3bitdither](https://github.com/mncaudill/3bitdither) (MIT License).
- Extended, modernized, and maintained by [JKirchartz](https://github.com/jkirchartz/Glitchy3bitdither).
- Distributed under the terms of the **GPL 3.0** license.
