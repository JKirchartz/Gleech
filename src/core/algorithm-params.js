/**
 * @file algorithm-params.js
 * @module algorithm-params
 * @author J. Kirchartz <me@jkirchartz.com>
 * @license GPL-3.0
 * @description Parameter schemas and specifications for Gleech glitch and dithering algorithms.
 * Used by UI controls to render interactive sliders and by the CLI to parse command-line flags.
 */

export const algorithmParams = {
  // === Presets ===
  theWorks: {
    name: 'theWorks',
    label: 'The Works',
    category: 'presets',
    description: 'Stochastically chains 2–5 distinct non-preset glitch algorithms to mutilate the original image without overriding it',
    params: [
      { id: 'iterations', label: 'Glitch Count', type: 'range', min: 2, max: 5, step: 1, default: 'auto', defaultHint: 'Random (2–5 distinct glitches)' }
    ]
  },
  randomGlitch: {
    name: 'randomGlitch',
    label: 'Random Glitch',
    category: 'presets',
    description: 'Randomly samples 2–4 distinct non-preset glitch algorithms',
    params: [
      { id: 'amount', label: 'Glitch Count', type: 'range', min: 2, max: 4, step: 1, default: 'auto', defaultHint: 'Random (2–4 distinct glitches)' }
    ]
  },
  glitch: {
    name: 'glitch',
    label: 'Glitch',
    category: 'presets',
    description: 'Stochastic combination of slicing, channel swapping, and sorting',
    params: [
      { id: 'iterations', label: 'Iterations', type: 'range', min: 1, max: 20, step: 1, default: 'auto', defaultHint: 'Random (5–10 steps)' }
    ]
  },
  preset1: {
    name: 'preset1',
    label: 'Preset 1 (Funk + Shift + Floyd)',
    category: 'presets',
    description: 'Pixel funk clustered blocks combined with super color shift and Floyd-Steinberg dithering',
    params: []
  },
  preset2: {
    name: 'preset2',
    label: 'Preset 2 (Slice + RGB + CRT Wave)',
    category: 'presets',
    description: 'Horizontal slicing paired with RGB channel displacement and CRT sine wave',
    params: []
  },
  preset3: {
    name: 'preset3',
    label: 'Preset 3 (JPEG Rot + Ghost + VCR)',
    category: 'presets',
    description: 'DCT 8x8 block rotation, RF multipath antenna ghosts, and bottom VCR head tracking noise',
    params: []
  },
  preset4: {
    name: 'preset4',
    label: 'Preset 4 (TS Loss + Interlace + Bayer)',
    category: 'presets',
    description: 'MPEG-TS packet drop macroblocks, interlace comb jitter, and Bayer matrix dithering',
    params: []
  },

  // === JPEG & Anti-JPEG Corruption ===
  jpegBlockRot: {
    name: 'jpegBlockRot',
    label: 'JPEG Block Rot',
    category: 'jpegCorrupt',
    description: 'Rotates discrete cosine transform (DCT) macroblocks and swaps chroma matrices',
    params: [
      { id: 'blockSize', label: 'Block Size (px)', type: 'select', options: [8, 16, 32], default: 8, defaultHint: '8x8 DCT standard' },
      { id: 'rotations', label: 'Rotations', type: 'range', min: 1, max: 80, step: 1, default: 'auto', defaultHint: 'Random (15–40 blocks)' },
      { id: 'chromaShift', label: 'Chroma Inversion', type: 'boolean', default: true, defaultHint: 'Inverts UV channels on rot' }
    ]
  },
  mosquitoRings: {
    name: 'mosquitoRings',
    label: 'Mosquito Noise & Rings',
    category: 'jpegCorrupt',
    description: 'Simulates Gibbs ringing artifacts and high-frequency mosquito distortion around sharp edges',
    params: [
      { id: 'radius', label: 'Ring Radius (px)', type: 'range', min: 2, max: 16, step: 1, default: 4, defaultHint: '4px kernel' },
      { id: 'intensity', label: 'Ringing Intensity', type: 'range', min: 5, max: 100, step: 5, default: 25, defaultHint: '25% contrast shift' },
      { id: 'density', label: 'Artifact Density', type: 'range', min: 5, max: 50, step: 1, default: 'auto', defaultHint: 'Random (10–25 points)' }
    ]
  },
  chromaBleed420: {
    name: 'chromaBleed420',
    label: 'Chroma Bleed 4:2:0',
    category: 'jpegCorrupt',
    description: 'Simulates YUV 4:2:0 subsampling color smearing across horizontal luma transitions',
    params: [
      { id: 'bleed', label: 'Bleed Distance (px)', type: 'range', min: 2, max: 64, step: 2, default: 'auto', defaultHint: 'Random (8–26px)' },
      { id: 'direction', label: 'Bleed Direction', type: 'select', options: ['right', 'left', 'down'], default: 'right', defaultHint: 'Horizontal right' }
    ]
  },
  huffmanSlip: {
    name: 'huffmanSlip',
    label: 'Huffman Bit Slip',
    category: 'jpegCorrupt',
    description: 'Simulates Huffman entropy decoding desynchronization, drifting downstream scanline rows',
    params: [
      { id: 'slips', label: 'Bit Slip Count', type: 'range', min: 1, max: 8, step: 1, default: 'auto', defaultHint: 'Random (1–3 slips)' },
      { id: 'drift', label: 'Drift Shift (px)', type: 'range', min: 5, max: 150, step: 5, default: 'auto', defaultHint: 'Random (20–80px)' }
    ]
  },
  nyquistPoison: {
    name: 'nyquistPoison',
    label: 'Nyquist Limit Poison',
    category: 'jpegCorrupt',
    description: 'Injects spatial frequency aliasing exceeding the Nyquist sampling limit into high-frequency blocks',
    params: [
      { id: 'frequency', label: 'Checker Grid Frequency', type: 'range', min: 2, max: 20, step: 1, default: 4, defaultHint: '4px grid' },
      { id: 'opacity', label: 'Pattern Opacity (%)', type: 'range', min: 10, max: 100, step: 5, default: 'auto', defaultHint: 'Random (20–42%)' }
    ]
  },
  restartMarkerDrop: {
    name: 'restartMarkerDrop',
    label: 'Restart Marker Drop',
    category: 'jpegCorrupt',
    description: 'Simulates missing JPEG restart markers (RST), drifting DC predictions and color quantization',
    params: [
      { id: 'drops', label: 'Dropped Markers', type: 'range', min: 1, max: 8, step: 1, default: 'auto', defaultHint: 'Random (2–5 markers)' },
      { id: 'mode', label: 'Corruption Mode', type: 'select', options: ['random', 'green', 'magenta', 'dcShift', 'invert'], default: 'random', defaultHint: 'Stochastic' }
    ]
  },
  quantizeCrush: {
    name: 'quantizeCrush',
    label: 'Quantization Crush',
    category: 'jpegCorrupt',
    description: 'Simulates aggressive JPEG quantization matrices, reducing high-frequency detail into stepped tiers',
    params: [
      { id: 'levels', label: 'Color Levels', type: 'range', min: 2, max: 32, step: 1, default: 4, defaultHint: '4 tonal steps' },
      { id: 'blockSize', label: 'Matrix Block Size (px)', type: 'select', options: [4, 8, 16], default: 8, defaultHint: '8x8 matrix' }
    ]
  },
  subsamplingShear: {
    name: 'subsamplingShear',
    label: 'Subsampling Shear',
    category: 'jpegCorrupt',
    description: 'Shears alternating U and V color channel rows across subsampled macroblock boundaries',
    params: [
      { id: 'shear', label: 'Shear Displacement (px)', type: 'range', min: 4, max: 64, step: 2, default: 'auto', defaultHint: 'Random (8–40px)' },
      { id: 'rows', label: 'Affected Row Bands', type: 'range', min: 1, max: 8, step: 1, default: 'auto', defaultHint: 'Random (1–4 bands)' }
    ]
  },
  ghostBlocks: {
    name: 'ghostBlocks',
    label: 'Ghost Blocks',
    category: 'jpegCorrupt',
    description: 'Scatters ghosted and inverted DCT macroblocks across previous frame coordinates',
    params: [
      { id: 'count', label: 'Block Count', type: 'range', min: 5, max: 60, step: 1, default: 'auto', defaultHint: 'Random (20–50 blocks)' },
      { id: 'blockSize', label: 'Block Size (px)', type: 'select', options: ['auto', 8, 16, 32], default: 'auto', defaultHint: 'Random (8 or 16px)' },
      { id: 'blend', label: 'Blend Mode', type: 'select', options: ['random', 'xor', 'inv', 'swap'], default: 'random', defaultHint: 'Stochastic' }
    ]
  },

  // === Digital TV & Broadcast ===
  tsPacketLoss: {
    name: 'tsPacketLoss',
    label: 'Transport Stream Loss',
    category: 'digitalTV',
    description: 'Simulates DVB/ATSC MPEG Transport Stream packet drops with corrupted neon and magenta macroblocks',
    params: [
      { id: 'losses', label: 'Packet Drops', type: 'range', min: 1, max: 12, step: 1, default: 'auto', defaultHint: 'Random (3–8 packets)' },
      { id: 'mbSize', label: 'Macroblock Size (px)', type: 'select', options: [8, 16, 32], default: 16, defaultHint: '16x16 standard' },
      { id: 'color', label: 'Artifact Palette', type: 'select', options: ['random', 'neonGreen', 'magenta', 'stripe'], default: 'random', defaultHint: 'Broadcast glitch colors' }
    ]
  },
  macroblockFreeze: {
    name: 'macroblockFreeze',
    label: 'Macroblock Freeze',
    category: 'digitalTV',
    description: 'Freezes macroblocks across motion vectors, smearing static blocks across successive scanline positions',
    params: [
      { id: 'blocks', label: 'Frozen Blocks', type: 'range', min: 1, max: 15, step: 1, default: 'auto', defaultHint: 'Random (3–7 blocks)' },
      { id: 'length', label: 'Smear Streak Length', type: 'range', min: 2, max: 16, step: 1, default: 'auto', defaultHint: 'Random (3–8 mb)' },
      { id: 'mbSize', label: 'Macroblock Size (px)', type: 'select', options: [8, 16, 32], default: 16, defaultHint: '16x16' }
    ]
  },
  digitalArtifacts: {
    name: 'digitalArtifacts',
    label: 'Digital Artifacts',
    category: 'digitalTV',
    description: 'Generates random digital bit-flips, mosaic compression errors, and channel offsets',
    params: [
      { id: 'count', label: 'Artifact Count', type: 'range', min: 5, max: 50, step: 1, default: 'auto', defaultHint: 'Random (15–35)' },
      { id: 'blockSize', label: 'Block Size (px)', type: 'select', options: [8, 16, 32], default: 16, defaultHint: '16x16' },
      { id: 'type', label: 'Artifact Type', type: 'select', options: ['random', 'bitFlip', 'mosaic', 'channelShift'], default: 'random', defaultHint: 'Stochastic' }
    ]
  },

  // === Analog TV & CRT ===
  DrumrollHorizontal: {
    name: 'DrumrollHorizontal',
    label: 'Horizontal Drumroll',
    category: 'analogCRT',
    description: 'Horizontal sync desynchronization tearing across horizontal raster scanlines',
    params: [
      { id: 'rolls', label: 'Roll Bands', type: 'range', min: 1, max: 8, step: 1, default: 'auto', defaultHint: 'Random (1–3 bands)' },
      { id: 'offset', label: 'Displacement (px)', type: 'range', min: 5, max: 120, step: 5, default: 'auto', defaultHint: 'Random width' }
    ]
  },
  DrumrollVertical: {
    name: 'DrumrollVertical',
    label: 'Vertical Drumroll',
    category: 'analogCRT',
    description: 'Vertical sync desynchronization tearing down vertical columns',
    params: [
      { id: 'rolls', label: 'Roll Bands', type: 'range', min: 1, max: 8, step: 1, default: 'auto', defaultHint: 'Random (1–3 bands)' },
      { id: 'offset', label: 'Displacement (px)', type: 'range', min: 5, max: 120, step: 5, default: 'auto', defaultHint: 'Random height' }
    ]
  },
  DrumrollHorizontalWave: {
    name: 'DrumrollHorizontalWave',
    label: 'Horizontal CRT Wave',
    category: 'analogCRT',
    description: 'Displaces scanlines along a horizontal trigonometric sine wave with analog power hum',
    params: [
      { id: 'frequency', label: 'Wave Frequency', type: 'range', min: 1, max: 16, step: 0.5, default: 'auto', defaultHint: 'Random (2–6 cycles)' },
      { id: 'amplitude', label: 'Wave Amplitude (px)', type: 'range', min: 2, max: 40, step: 1, default: 'auto', defaultHint: 'Random (5–25px)' }
    ]
  },
  DrumrollVerticalWave: {
    name: 'DrumrollVerticalWave',
    label: 'Vertical CRT Wave',
    category: 'analogCRT',
    description: 'Displaces scanlines along a vertical trigonometric sine wave',
    params: [
      { id: 'frequency', label: 'Wave Frequency', type: 'range', min: 1, max: 16, step: 0.5, default: 'auto', defaultHint: 'Random (2–6 cycles)' },
      { id: 'amplitude', label: 'Wave Amplitude (px)', type: 'range', min: 2, max: 40, step: 1, default: 'auto', defaultHint: 'Random (5–25px)' }
    ]
  },
  vcrTracking: {
    name: 'vcrTracking',
    label: 'VCR Head Tracking',
    category: 'analogCRT',
    description: 'Simulates VHS helical scan tracking errors, bottom head-switching jitter, and snowy static noise',
    params: [
      { id: 'bandHeight', label: 'Tracking Band (px)', type: 'range', min: 10, max: 80, step: 1, default: 'auto', defaultHint: 'Random (25–65px)' },
      { id: 'jitter', label: 'Jitter Severity (px)', type: 'range', min: 2, max: 40, step: 1, default: 'auto', defaultHint: 'Random (10–30px)' },
      { id: 'snowDensity', label: 'Static Snow Density (%)', type: 'range', min: 10, max: 100, step: 5, default: 60, defaultHint: '60% noise' }
    ]
  },
  verticalHold: {
    name: 'verticalHold',
    label: 'Vertical Hold Roll',
    category: 'analogCRT',
    description: 'Loss of vertical sync (V-HOLD) causing the frame to roll vertically, revealing the retrace blanking bar',
    params: [
      { id: 'offset', label: 'Roll Offset (px)', type: 'range', min: 10, max: 200, step: 5, default: 'auto', defaultHint: 'Random (20–50% height)' },
      { id: 'barHeight', label: 'Blanking Bar Height (px)', type: 'range', min: 5, max: 45, step: 1, default: 'auto', defaultHint: 'Random (18–32px)' }
    ]
  },
  antennaGhost: {
    name: 'antennaGhost',
    label: 'Antenna RF Ghost',
    category: 'analogCRT',
    description: 'Simulates multipath analog RF broadcast reflections with phase delay ghosts',
    params: [
      { id: 'ghosts', label: 'Ghost Count', type: 'range', min: 1, max: 4, step: 1, default: 'auto', defaultHint: 'Random (1–3 reflections)' },
      { id: 'offset', label: 'Phase Delay (px)', type: 'range', min: 5, max: 60, step: 1, default: 'auto', defaultHint: 'Random (12–40px)' },
      { id: 'opacity', label: 'Ghost Opacity (%)', type: 'range', min: 10, max: 80, step: 5, default: 40, defaultHint: '40% transmission' }
    ]
  },
  interlaceJitter: {
    name: 'interlaceJitter',
    label: 'Interlace Comb Jitter',
    category: 'analogCRT',
    description: 'Even/odd field interlace desynchronization causing rapid comb serrations on high motion',
    params: [
      { id: 'offset', label: 'Jitter Offset (px)', type: 'range', min: 1, max: 25, step: 1, default: 'auto', defaultHint: 'Random (6–18px)' },
      { id: 'alternate', label: 'Alternate Odd Rows', type: 'boolean', default: true, defaultHint: 'Even vs odd rows' }
    ]
  },

  // === Dithering ===
  ditherFloydSteinberg: {
    name: 'ditherFloydSteinberg',
    label: 'Floyd-Steinberg Dither',
    category: 'dithering',
    description: 'Classical 4-pixel error-diffusion dithering algorithm',
    params: [
      { id: 'threshold', label: 'Luminance Threshold', type: 'range', min: 0, max: 255, step: 1, default: 128, defaultHint: '128 mid-grey' },
      { id: 'color', label: 'RGB Channel Dither', type: 'boolean', default: false, defaultHint: 'Monochrome vs per-channel' }
    ]
  },
  ditherAtkinsons: {
    name: 'ditherAtkinsons',
    label: 'Atkinson Dither',
    category: 'dithering',
    description: 'Bill Atkinson (Apple Macintosh) error-diffusion preserving specular whites with 3/4 error attenuation',
    params: [
      { id: 'threshold', label: 'Luminance Threshold', type: 'range', min: 0, max: 255, step: 1, default: 128, defaultHint: '128 mid-grey' }
    ]
  },
  ditherBayer: {
    name: 'ditherBayer',
    label: 'Bayer Matrix Dither (2-Tone)',
    category: 'dithering',
    description: 'Ordered dithering using recursive threshold matrices (2x2, 3x3, 4x4, 8x8)',
    params: [
      { id: 'mapIndex', label: 'Matrix Size', type: 'select', options: ['auto', 0, 1, 2, 3], default: 'auto', defaultHint: 'Random (0=2x2, 1=3x3, 2=4x4, 3=8x8)' }
    ]
  },
  ditherBayer3: {
    name: 'ditherBayer3',
    label: 'Bayer 3-Bit RGB Dither',
    category: 'dithering',
    description: '8-color 3-bit RGB ordered threshold matrix dithering',
    params: [
      { id: 'mapIndex', label: 'Matrix Size', type: 'select', options: ['auto', 0, 1, 2, 3], default: 'auto', defaultHint: 'Random (0=2x2, 1=3x3, 2=4x4, 3=8x8)' }
    ]
  },
  dither8Bit: {
    name: 'dither8Bit',
    label: '8-Bit Average Dither',
    category: 'dithering',
    description: 'Block averaging quantizer downsampling pixels into 8-color retro computer clusters',
    params: [
      { id: 'size', label: 'Cluster Block Size (px)', type: 'range', min: 2, max: 16, step: 1, default: 4, defaultHint: '4x4 block average' }
    ]
  },
  ditherHalftone: {
    name: 'ditherHalftone',
    label: 'Halftone Dot Screen',
    category: 'dithering',
    description: 'Simulates CMYK newsprint rotogravure halftone dots',
    params: [
      { id: 'size', label: 'Dot Grid Size (px)', type: 'range', min: 2, max: 12, step: 1, default: 3, defaultHint: '3x3 grid' }
    ]
  },
  ditherBitmask: {
    name: 'ditherBitmask',
    label: 'Bitmask Quantizer',
    category: 'dithering',
    description: 'Logical bitwise AND masking across color byte channels',
    params: [
      { id: 'mask', label: 'Bitmask Value (1–255)', type: 'range', min: 1, max: 255, step: 1, default: 'auto', defaultHint: 'Random (1–125)' }
    ]
  },
  ditherRandom: {
    name: 'ditherRandom',
    label: 'Random White Noise Dither',
    category: 'dithering',
    description: 'Stochastic noise thresholding creating organic film grain',
    params: [
      { id: 'threshold', label: 'Noise Threshold (0–255)', type: 'range', min: 0, max: 255, step: 1, default: 'auto', defaultHint: 'Random (0–128)' }
    ]
  },
  ditherRandom3: {
    name: 'ditherRandom3',
    label: 'Random 3-Bit RGB Noise Dither',
    category: 'dithering',
    description: 'Stochastic RGB noise thresholding yielding chromatic speckle',
    params: [
      { id: 'threshold', label: 'Noise Threshold (0–255)', type: 'range', min: 0, max: 255, step: 1, default: 'auto', defaultHint: 'Random (0–128)' }
    ]
  },

  // === Pixel Sorting ===
  pixelFunk: {
    name: 'pixelFunk',
    label: 'Pixel Funk',
    category: 'pixelSorting',
    description: 'Pixelates random blocks across the image with cluster jitter',
    params: [
      { id: 'pixelation', label: 'Block Size (px)', type: 'range', min: 2, max: 32, step: 1, default: 'auto', defaultHint: 'Random (2–10px)' },
      { id: 'chance', label: 'Glitch Chance (%)', type: 'range', min: 10, max: 100, step: 5, default: 'auto', defaultHint: 'Random (~50%)' }
    ]
  },
  superPixelFunk: {
    name: 'superPixelFunk',
    label: 'Super Pixel Funk',
    category: 'pixelSorting',
    description: 'Enlarged pixelation blocks infused with primary color tinting',
    params: [
      { id: 'pixelation', label: 'Block Size (px)', type: 'range', min: 2, max: 40, step: 1, default: 'auto', defaultHint: 'Random (2–15px)' },
      { id: 'chance', label: 'Glitch Chance (%)', type: 'range', min: 10, max: 100, step: 5, default: 'auto', defaultHint: 'Random (~50%)' },
      { id: 'color', label: 'Tint Channel', type: 'select', options: ['random', 'red', 'green', 'blue'], default: 'random', defaultHint: 'Stochastic primary' }
    ]
  },
  sort: {
    name: 'sort',
    label: 'Whole Image Sort',
    category: 'pixelSorting',
    description: 'Sorts entire image pixel buffer by luminance or color channel values',
    params: [
      { id: 'direction', label: 'Sort Direction', type: 'select', options: ['auto', 'asc', 'desc'], default: 'auto', defaultHint: 'Coin toss' },
      { id: 'channel', label: 'Comparison Metric', type: 'select', options: ['auto', 'avg', 'red', 'green', 'blue'], default: 'auto', defaultHint: 'Stochastic' }
    ]
  },
  shortsort: {
    name: 'shortsort',
    label: 'Short Segment Sort',
    category: 'pixelSorting',
    description: 'Sorts short contiguous segments of the pixel buffer',
    params: [
      { id: 'segments', label: 'Segment Count', type: 'range', min: 1, max: 16, step: 1, default: 'auto', defaultHint: 'Random (1–5 segments)' }
    ]
  },
  shortdumbsort: {
    name: 'shortdumbsort',
    label: 'Short Dumb Sort',
    category: 'pixelSorting',
    description: 'Sorts short segments by raw integer buffer cast without channel parsing',
    params: [
      { id: 'segments', label: 'Segment Count', type: 'range', min: 1, max: 16, step: 1, default: 'auto', defaultHint: 'Random (1–5 segments)' }
    ]
  },
  slicesort: {
    name: 'slicesort',
    label: 'Slice Sort',
    category: 'pixelSorting',
    description: 'Takes arbitrary slices and sorts their pixel arrays',
    params: [
      { id: 'iterations', label: 'Sort Passes', type: 'range', min: 1, max: 8, step: 1, default: 'auto', defaultHint: 'Random (1–3 passes)' }
    ]
  },
  sortStripe: {
    name: 'sortStripe',
    label: 'Stripe Sort',
    category: 'pixelSorting',
    description: 'Sorts isolated vertical column stripes across the canvas',
    params: [
      { id: 'stripes', label: 'Stripe Count', type: 'range', min: 1, max: 8, step: 1, default: 'auto', defaultHint: 'Random (1–4 stripes)' }
    ]
  },
  sortRows: {
    name: 'sortRows',
    label: 'Row Sort',
    category: 'pixelSorting',
    description: 'Sorts horizontal pixel rows sequentially',
    params: [
      { id: 'step', label: 'Row Interval Step', type: 'range', min: 1, max: 16, step: 1, default: 1, defaultHint: 'Every row' }
    ]
  },
  randomSortRows: {
    name: 'randomSortRows',
    label: 'Random Row Sort',
    category: 'pixelSorting',
    description: 'Sorts randomly selected horizontal scanlines',
    params: [
      { id: 'chance', label: 'Row Probability (%)', type: 'range', min: 10, max: 100, step: 5, default: 'auto', defaultHint: 'Random (~50%)' }
    ]
  },
  dumbSortRows: {
    name: 'dumbSortRows',
    label: 'Dumb Row Sort',
    category: 'pixelSorting',
    description: 'Quickly sorts rows by 32-bit pixel value',
    params: [
      { id: 'chance', label: 'Row Probability (%)', type: 'range', min: 10, max: 100, step: 5, default: 'auto', defaultHint: 'Random (~50%)' }
    ]
  },
  pixelSort: {
    name: 'pixelSort',
    label: 'Threshold Pixel Sort (Kim Asendorf)',
    category: 'pixelSorting',
    description: 'Classic interval-based sorting between brightness thresholds',
    params: [
      { id: 'threshold', label: 'Brightness Cutoff', type: 'range', min: 0, max: 255, step: 1, default: 128, defaultHint: '128 threshold' },
      { id: 'direction', label: 'Sort Axis', type: 'select', options: ['horizontal', 'vertical'], default: 'horizontal', defaultHint: 'Horizontal rows' }
    ]
  },

  // === Geometry & Slicing ===
  slice: {
    name: 'slice',
    label: 'Horizontal Slice',
    category: 'geometry',
    description: 'Displaces random rectangular horizontal bands of pixels across the canvas',
    params: [
      { id: 'slices', label: 'Slice Count', type: 'range', min: 1, max: 16, step: 1, default: 'auto', defaultHint: 'Random (2–6 slices)' }
    ]
  },
  slice2: {
    name: 'slice2',
    label: 'Subtle Slice 2',
    category: 'geometry',
    description: 'Subtle high-frequency horizontal band displacements',
    params: [
      { id: 'slices', label: 'Slice Count', type: 'range', min: 1, max: 20, step: 1, default: 'auto', defaultHint: 'Random (2–11 slices)' }
    ]
  },
  slice3: {
    name: 'slice3',
    label: 'Aggressive Slice 3',
    category: 'geometry',
    description: 'Wide horizontal band offsets with wrap-around tearing',
    params: [
      { id: 'slices', label: 'Slice Count', type: 'range', min: 1, max: 25, step: 1, default: 'auto', defaultHint: 'Random (5–20 slices)' }
    ]
  },
  superSlice: {
    name: 'superSlice',
    label: 'Super Slice',
    category: 'geometry',
    description: 'Cascading sequence of multi-slice passes',
    params: [
      { id: 'iterations', label: 'Iterations', type: 'range', min: 1, max: 12, step: 1, default: 'auto', defaultHint: 'Random (1–10 passes)' }
    ]
  },
  superSlice2: {
    name: 'superSlice2',
    label: 'Super Slice 2',
    category: 'geometry',
    description: 'Iterative multi-algorithm slicing pipeline',
    params: [
      { id: 'iterations', label: 'Iterations', type: 'range', min: 1, max: 8, step: 1, default: 'auto', defaultHint: 'Random (1–5 passes)' }
    ]
  },
  scanlines: {
    name: 'scanlines',
    label: 'CRT Scanlines',
    category: 'geometry',
    description: 'Overlays analog CRT aperture grille horizontal phosphor scanlines',
    params: [
      { id: 'density', label: 'Spacing Interval (px)', type: 'range', min: 2, max: 20, step: 1, default: 'auto', defaultHint: 'Random (3–15px)' },
      { id: 'thickness', label: 'Line Thickness (px)', type: 'range', min: 1, max: 4, step: 1, default: 'auto', defaultHint: 'Random (1–3px)' },
      { id: 'opacity', label: 'Line Opacity (%)', type: 'range', min: 10, max: 100, step: 5, default: 50, defaultHint: '50% darkness' }
    ]
  },
  focusImage: {
    name: 'focusImage',
    label: 'Focus Radial Blur',
    category: 'geometry',
    description: 'Distorts edge sharpness while maintaining central focal alignment',
    params: [
      { id: 'radius', label: 'Kernel Radius (px)', type: 'range', min: 2, max: 20, step: 1, default: 'auto', defaultHint: 'Random (2–10px)' }
    ]
  },
  fractal: {
    name: 'fractal',
    label: 'Recursive Fractal',
    category: 'geometry',
    description: 'Recursively subdivides and clones quadrant frames across the canvas',
    params: [
      { id: 'passes', label: 'Fractal Passes', type: 'range', min: 1, max: 6, step: 1, default: 2, defaultHint: '2 subdivisions' }
    ]
  },
  fractal2: {
    name: 'fractal2',
    label: 'Recursive Fractal 2',
    category: 'geometry',
    description: 'High-frequency fractal repetition across scaled viewports',
    params: [
      { id: 'passes', label: 'Fractal Passes', type: 'range', min: 1, max: 8, step: 1, default: 'auto', defaultHint: 'Random (2–8 passes)' }
    ]
  },
  fractalGhosts: {
    name: 'fractalGhosts',
    label: 'Fractal Ghosts',
    category: 'geometry',
    description: 'Overlays translucent fractal ghost reflections across the image',
    params: [
      { id: 'ghosts', label: 'Ghost Count', type: 'range', min: 1, max: 8, step: 1, default: 'auto', defaultHint: 'Random (1–5 ghosts)' }
    ]
  },
  fractalGhosts2: {
    name: 'fractalGhosts2',
    label: 'Fractal Ghosts 2',
    category: 'geometry',
    description: 'Multi-scale fractal ghost reflections',
    params: [
      { id: 'ghosts', label: 'Ghost Count', type: 'range', min: 1, max: 10, step: 1, default: 'auto', defaultHint: 'Random (1–10 ghosts)' }
    ]
  },
  fractalGhosts3: {
    name: 'fractalGhosts3',
    label: 'Fractal Ghosts 3 (Color Channel)',
    category: 'geometry',
    description: 'Fractal ghosting applied selectively to individual color channels',
    params: [
      { id: 'ghosts', label: 'Ghost Count', type: 'range', min: 1, max: 10, step: 1, default: 'auto', defaultHint: 'Random (1–10 ghosts)' },
      { id: 'channel', label: 'Target Channel', type: 'select', options: ['auto', 0, 1, 2, 3], default: 'auto', defaultHint: 'Random channel' }
    ]
  },
  fractalGhosts4: {
    name: 'fractalGhosts4',
    label: 'Fractal Ghosts 4',
    category: 'geometry',
    description: 'High-density color channel fractal reflection',
    params: [
      { id: 'channel', label: 'Target Channel', type: 'select', options: ['auto', 0, 1, 2, 3], default: 'auto', defaultHint: 'Random channel' }
    ]
  },

  // === Color Shifts ===
  rgb_glitch: {
    name: 'rgb_glitch',
    label: 'RGB Chromatic Aberration',
    category: 'colorShifts',
    description: 'Splits red, green, and blue color channels with spatial displacement',
    params: [
      { id: 'shift', label: 'Displacement (px)', type: 'range', min: 1, max: 40, step: 1, default: 'auto', defaultHint: 'Random (5–20px)' },
      { id: 'slices', label: 'Banded Slices', type: 'range', min: 1, max: 8, step: 1, default: 'auto', defaultHint: 'Random (1–4 bands)' }
    ]
  },
  superShift: {
    name: 'superShift',
    label: 'Super Color Shift',
    category: 'colorShifts',
    description: 'Displaces all primary color planes across multiple coordinate axes',
    params: [
      { id: 'shift', label: 'Offset Magnitude (px)', type: 'range', min: 1, max: 25, step: 1, default: 'auto', defaultHint: 'Random (1–10px)' }
    ]
  },
  colorShift: {
    name: 'colorShift',
    label: 'Channel Swap',
    category: 'colorShifts',
    description: 'Permutes RGB color channel values (e.g. Red->Blue, Green->Red)',
    params: [
      { id: 'mode', label: 'Swap Pattern', type: 'select', options: ['random', 'swap', 'cycle'], default: 'random', defaultHint: 'Stochastic swap' }
    ]
  },
  colorShift2: {
    name: 'colorShift2',
    label: 'Color Invert Shift',
    category: 'colorShifts',
    description: 'Inverts selective color components with chromatic tinting',
    params: [
      { id: 'mode', label: 'Invert Mode', type: 'select', options: ['random', 'invert', 'tint'], default: 'random', defaultHint: 'Stochastic' }
    ]
  },
  redShift: {
    name: 'redShift',
    label: 'Red Channel Shift',
    category: 'colorShifts',
    description: 'Selectively boosts or shifts the red color spectrum',
    params: [
      { id: 'amount', label: 'Shift Amount', type: 'range', min: 1, max: 128, step: 1, default: 'auto', defaultHint: 'Random (1–64)' }
    ]
  },
  greenShift: {
    name: 'greenShift',
    label: 'Green Channel Shift',
    category: 'colorShifts',
    description: 'Selectively boosts or shifts the green color spectrum',
    params: [
      { id: 'amount', label: 'Shift Amount', type: 'range', min: 1, max: 128, step: 1, default: 'auto', defaultHint: 'Random (1–64)' }
    ]
  },
  blueShift: {
    name: 'blueShift',
    label: 'Blue Channel Shift',
    category: 'colorShifts',
    description: 'Selectively boosts or shifts the blue color spectrum',
    params: [
      { id: 'amount', label: 'Shift Amount', type: 'range', min: 1, max: 128, step: 1, default: 'auto', defaultHint: 'Random (1–64)' }
    ]
  },
  invert: {
    name: 'invert',
    label: 'Invert Colors',
    category: 'colorShifts',
    description: 'Inverts RGB tonal values',
    params: [
      { id: 'channel', label: 'Target Channels', type: 'select', options: ['all', 'red', 'green', 'blue'], default: 'all', defaultHint: 'Full color invert' }
    ]
  }
};
