/**
 * @file test/test-rig.js
 * @module test-rig
 * @author J. Kirchartz <me@jkirchartz.com>
 * @license GPL-3.0
 * @description Automated analysis and verification test rig for Gleech algorithms.
 * Evaluates:
 * - Buffer length invariance and memory bounds
 * - Numerical integrity (absence of NaN or Infinity)
 * - Non-zero mutation rate (prevents silent no-ops)
 * - Alpha channel retention (prevents 100% transparency loss)
 * - Shannon entropy deltas (quantization vs noise injection)
 * - Stride handling on odd and prime dimensions (37x23)
 * - Classification as deterministic vs stochastic
 */

import { gleech, algorithmParams } from '../index.js';
import { resolve } from 'path';

/**
 * Synthesizes a four-quadrant calibration test pattern:
 * - Q1 (Top-Left): Pseudo-random hash noise (for sorting and bit mutators)
 * - Q2 (Top-Right): High-contrast 4px checkerboard (for DCT and edge detection)
 * - Q3 (Bottom-Left): Multi-channel RGB gradient (for dithering and color shifts)
 * - Q4 (Bottom-Right): Alternating horizontal color bars (for slicing and scanlines)
 *
 * @param {number} [width=64] - Pattern width
 * @param {number} [height=64] - Pattern height
 * @returns {{data: Uint8ClampedArray, width: number, height: number}} Pattern image data
 */
export function createCalibrationPattern(width = 64, height = 64) {
  const data = new Uint8ClampedArray(width * height * 4);
  const midX = Math.floor(width / 2);
  const midY = Math.floor(height / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (x < midX && y < midY) {
        // Q1: Pseudo-random unsorted noise
        const pseudoRand = ((x * 1597 + y * 51749 + 1013904223) >>> 0) % 256;
        data[idx] = pseudoRand;
        data[idx + 1] = (pseudoRand * 3) % 256;
        data[idx + 2] = (pseudoRand * 7) % 256;
      } else if (x >= midX && y < midY) {
        // Q2: High-contrast checkerboard with step edges
        const isWhite = (Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0;
        const val = isWhite ? 250 : 5;
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
      } else if (x < midX && y >= midY) {
        // Q3: Smooth color gradient
        data[idx] = Math.floor((x / midX) * 255);
        data[idx + 1] = Math.floor(((y - midY) / (height - midY)) * 255);
        data[idx + 2] = Math.floor(((x + y) / (width + height)) * 255);
      } else {
        // Q4: High-contrast alternating bars
        const isBar = (y % 4 < 2);
        data[idx] = isBar ? 240 : 20;
        data[idx + 1] = isBar ? 20 : 240;
        data[idx + 2] = (x * 8) % 256;
      }
      data[idx + 3] = 255;
    }
  }
  return { data, width, height };
}

/**
 * Generates an image with a multi-axis RGB gradient.
 *
 * @param {number} [width=64] - Canvas width
 * @param {number} [height=64] - Canvas height
 * @returns {{data: Uint8ClampedArray, width: number, height: number}} Generated image
 */
export function createGradient(width = 64, height = 64) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      data[idx] = Math.floor((x / width) * 255);       // Red: Horizontal
      data[idx + 1] = Math.floor((y / height) * 255);   // Green: Vertical
      data[idx + 2] = Math.floor(((x + y) / (width + height)) * 255); // Blue: Diagonal
      data[idx + 3] = 255;                             // Alpha: opaque
    }
  }
  return { data, width, height };
}

/**
 * Generates a two-tone geometric checkerboard.
 *
 * @param {number} [width=64] - Canvas width
 * @param {number} [height=64] - Canvas height
 * @param {number} [blockSize=8] - Tile size in pixels
 * @returns {{data: Uint8ClampedArray, width: number, height: number}} Generated image
 */
export function createCheckerboard(width = 64, height = 64, blockSize = 8) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const isWhite = (Math.floor(x / blockSize) + Math.floor(y / blockSize)) % 2 === 0;
      const val = isWhite ? 240 : 15;
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  }
  return { data, width, height };
}

/**
 * Generates a solid color field for edge-case boundary testing.
 *
 * @param {number} [width=64] - Canvas width
 * @param {number} [height=64] - Canvas height
 * @param {number} [r=255] - Red channel
 * @param {number} [g=255] - Green channel
 * @param {number} [b=255] - Blue channel
 * @returns {{data: Uint8ClampedArray, width: number, height: number}} Generated image
 */
export function createSolid(width = 64, height = 64, r = 255, g = 255, b = 255) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  }
  return { data, width, height };
}

/**
 * Deep clones an ImageData-compatible image structure and its backing buffer.
 *
 * @param {{data: Uint8ClampedArray, width: number, height: number}} img - Source image
 * @returns {{data: Uint8ClampedArray, width: number, height: number}} Cloned image
 */
export function cloneImage(img) {
  return {
    width: img.width,
    height: img.height,
    data: new Uint8ClampedArray(img.data)
  };
}

/**
 * Computes Shannon entropy (bits per pixel) based on Rec. 601 luminance.
 * Entropy measures information density: 0.0 for uniform flats to 8.0 for pure noise.
 * Formula: H = - sum(p * log2(p))
 *
 * @param {{data: Uint8ClampedArray, width: number, height: number}} img - Target image
 * @returns {number} Shannon entropy in bits [0.0 - 8.0]
 */
export function calculateEntropy(img) {
  const hist = new Uint32Array(256);
  const total = img.width * img.height;
  if (total === 0) return 0;

  // Build 256-bin luminance histogram using Rec. 601 luma weights
  for (let i = 0; i < img.data.length; i += 4) {
    const y = Math.round(0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2]);
    hist[Math.min(255, Math.max(0, y))]++;
  }

  let entropy = 0;
  for (let i = 0; i < 256; i++) {
    if (hist[i] > 0) {
      const p = hist[i] / total;
      entropy -= p * Math.log2(p);
    }
  }
  return entropy;
}

/**
 * Compares an original image buffer with its mutated output.
 * Evaluates buffer invariants, NaN occurrence, mutation rate, and entropy shift.
 *
 * @param {{data: Uint8ClampedArray, width: number, height: number}} original - Original image
 * @param {{data: Uint8ClampedArray, width: number, height: number}} glitched - Mutated image
 * @param {number} elapsedMs - Execution duration in milliseconds
 * @returns {Object} Analysis metrics
 */
export function analyzeMutation(original, glitched, elapsedMs) {
  const totalPixels = original.width * original.height;
  const expectedLen = totalPixels * 4;

  const lengthValid = glitched.data && glitched.data.length === expectedLen;
  let changedPixels = 0;
  let totalChannelDiff = 0;
  let maxChannelDiff = 0;
  let hasNaN = false;
  let alphaWipedCount = 0;

  if (lengthValid) {
    for (let i = 0; i < expectedLen; i += 4) {
      const r1 = original.data[i];
      const g1 = original.data[i + 1];
      const b1 = original.data[i + 2];
      const a1 = original.data[i + 3];

      const r2 = glitched.data[i];
      const g2 = glitched.data[i + 1];
      const b2 = glitched.data[i + 2];
      const a2 = glitched.data[i + 3];

      // Check for illegal NaN values
      if (Number.isNaN(r2) || Number.isNaN(g2) || Number.isNaN(b2) || Number.isNaN(a2)) {
        hasNaN = true;
      }

      // Check if alpha was accidentally cleared to transparent
      if (a1 > 0 && a2 === 0) {
        alphaWipedCount++;
      }

      const diffR = Math.abs(r1 - r2);
      const diffG = Math.abs(g1 - g2);
      const diffB = Math.abs(b1 - b2);

      if (diffR > 0 || diffG > 0 || diffB > 0) {
        changedPixels++;
        totalChannelDiff += (diffR + diffG + diffB);
        const maxLocal = Math.max(diffR, diffG, diffB);
        if (maxLocal > maxChannelDiff) maxChannelDiff = maxLocal;
      }
    }
  }

  const mutationRate = totalPixels > 0 ? (changedPixels / totalPixels) * 100 : 0;
  const mae = totalPixels > 0 ? totalChannelDiff / (totalPixels * 3) : 0;
  const origEntropy = calculateEntropy(original);
  const glitchedEntropy = lengthValid ? calculateEntropy(glitched) : 0;
  const entropyDelta = glitchedEntropy - origEntropy;

  // Verification criteria:
  // 1. Buffer length maintained
  // 2. No NaN values
  // 3. Changed at least 1 pixel (mutationRate > 0)
  // 4. Did not wipe 100% of non-transparent pixels to transparent
  const isAlphaWiped = alphaWipedCount === totalPixels && totalPixels > 0;
  const passed = lengthValid && !hasNaN && mutationRate > 0 && !isAlphaWiped;

  return {
    passed,
    lengthValid,
    hasNaN,
    isAlphaWiped,
    changedPixels,
    totalPixels,
    mutationRate: Number(mutationRate.toFixed(2)),
    mae: Number(mae.toFixed(2)),
    maxChannelDiff,
    origEntropy: Number(origEntropy.toFixed(3)),
    glitchedEntropy: Number(glitchedEntropy.toFixed(3)),
    entropyDelta: Number(entropyDelta.toFixed(3)),
    elapsedMs: Number(elapsedMs.toFixed(2))
  };
}

/**
 * Classifies an algorithm as deterministic or stochastic by executing it twice
 * on identical clones of the input image.
 *
 * @param {string} algo - Algorithm name in gleech engine
 * @param {{data: Uint8ClampedArray, width: number, height: number}} testImg - Base image
 * @returns {boolean} True if deterministic, false if stochastic
 */
export function testDeterminism(algo, testImg) {
  const cloneA = cloneImage(testImg);
  const cloneB = cloneImage(testImg);

  gleech[algo](cloneA);
  gleech[algo](cloneB);

  for (let i = 0; i < cloneA.data.length; i++) {
    if (cloneA.data[i] !== cloneB.data[i]) {
      return false; // Byte discrepancy indicates stochastic behavior
    }
  }
  return true; // Exact byte match indicates deterministic behavior
}

/**
 * Executes the full verification test rig across all registered algorithms.
 *
 * @param {Object} [options={}] - Runner options
 * @param {string} [options.algo=null] - Single algorithm name to test
 * @param {boolean} [options.json=false] - Output results as JSON
 * @returns {Promise<Array<Object>>} Test result records
 */
export async function runTestRig(options = {}) {
  const specificAlgo = options.algo || null;
  const algosToTest = specificAlgo ? [specificAlgo] : gleech.all;

  console.log(`\n======================================================`);
  console.log(`   GLEECH TEST RIG: ALEATORIC ALGORITHM VERIFICATION  `);
  console.log(`======================================================`);
  console.log(`Evaluating ${algosToTest.length} algorithms across:`);
  console.log(`- Buffer Invariance & NaN Integrity`);
  console.log(`- Non-Zero Pixel Mutation Rate (Anti-NoOp)`);
  console.log(`- Alpha Channel Retention`);
  console.log(`- Shannon Entropy Delta`);
  console.log(`- Determinism vs. Stochasticity Classification`);
  console.log(`- Stride Robustness (Odd Dimensions: 37x23)`);
  console.log(`======================================================\n`);

  const results = [];
  const basePattern = createCalibrationPattern(64, 64);
  const oddStridePattern = createCalibrationPattern(37, 23); // Prime/odd dimensions test stride integrity

  for (const algo of algosToTest) {
    if (typeof gleech[algo] !== 'function') {
      results.push({
        algo,
        passed: false,
        error: `Not a function in gleech engine`
      });
      continue;
    }

    try {
      const origLog = console.log;
      console.log = () => {}; // Temporarily silence engine debug logs

      // 1. Test standard mutation & metrics on calibration target (with stochastic retry if coin tossed no-op)
      let testInput = cloneImage(basePattern);
      let startTime = performance.now();
      gleech[algo](testInput);
      let elapsedMs = performance.now() - startTime;
      let metrics = analyzeMutation(basePattern, testInput, elapsedMs);

      if (!metrics.passed && metrics.mutationRate === 0) {
        for (let retry = 0; retry < 3 && (!metrics.passed && metrics.mutationRate === 0); retry++) {
          testInput = cloneImage(basePattern);
          startTime = performance.now();
          gleech[algo](testInput);
          elapsedMs = performance.now() - startTime;
          metrics = analyzeMutation(basePattern, testInput, elapsedMs);
        }
      }

      // 2. Test determinism (run twice on fresh clones)
      const isDeterministic = testDeterminism(algo, basePattern);

      // 3. Test odd stride dimensions (prevent edge crashes on non-4 byte or odd rows)
      let oddStridePassed = true;
      try {
        const oddInput = cloneImage(oddStridePattern);
        gleech[algo](oddInput);
        if (!oddInput.data || oddInput.data.length !== 37 * 23 * 4) {
          oddStridePassed = false;
        }
      } catch {
        oddStridePassed = false;
      }

      console.log = origLog; // Restore console.log

      const overallPass = metrics.passed && oddStridePassed;

      results.push({
        algo,
        passed: overallPass,
        isDeterministic,
        oddStridePassed,
        ...metrics
      });
    } catch (err) {
      results.push({
        algo,
        passed: false,
        error: err.message || String(err)
      });
    }
  }

  // --- Output Formatting ---
  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
    return results;
  }

  // Tabular output
  const colAlgo = 26;
  const colPass = 8;
  const colMode = 15;
  const colMut = 12;
  const colMae = 10;
  const colEnt = 12;
  const colTime = 10;

  const header = 
    'Algorithm'.padEnd(colAlgo) +
    'Status'.padEnd(colPass) +
    'Mode'.padEnd(colMode) +
    'Mutation %'.padEnd(colMut) +
    'MAE'.padEnd(colMae) +
    'Δ Entropy'.padEnd(colEnt) +
    'Time (ms)'.padEnd(colTime);

  console.log(header);
  console.log('-'.repeat(header.length));

  let totalPassed = 0;
  let deterministicCount = 0;
  let stochasticCount = 0;
  let totalTime = 0;
  let totalMutationRate = 0;

  for (const r of results) {
    if (!r.passed) {
      const line = 
        r.algo.padEnd(colAlgo) +
        '[FAIL]'.padEnd(colPass) +
        '-'.padEnd(colMode) +
        '-'.padEnd(colMut) +
        '-'.padEnd(colMae) +
        '-'.padEnd(colEnt) +
        (r.error ? r.error.slice(0, 20) : 'Metrics fail');
      console.log(`\x1b[31m${line}\x1b[0m`);
    } else {
      totalPassed++;
      totalTime += r.elapsedMs;
      totalMutationRate += r.mutationRate;

      if (r.isDeterministic) deterministicCount++;
      else stochasticCount++;

      const modeStr = r.isDeterministic ? 'Deterministic' : 'Stochastic';
      const line = 
        r.algo.padEnd(colAlgo) +
        '[PASS]'.padEnd(colPass) +
        modeStr.padEnd(colMode) +
        `${r.mutationRate}%`.padEnd(colMut) +
        `${r.mae}`.padEnd(colMae) +
        `${r.entropyDelta > 0 ? '+' : ''}${r.entropyDelta}`.padEnd(colEnt) +
        `${r.elapsedMs}ms`.padEnd(colTime);
      console.log(line);
    }
  }

  console.log('-'.repeat(header.length));
  console.log(`\n=== GLEECH TEST RIG SUMMARY ===`);
  console.log(`Total Evaluated:      ${results.length}`);
  console.log(`Passed:               ${totalPassed} / ${results.length} (${((totalPassed / results.length) * 100).toFixed(1)}%)`);
  console.log(`Deterministic:        ${deterministicCount}`);
  console.log(`Aleatoric/Stochastic: ${stochasticCount}`);
  console.log(`Avg Mutation Rate:    ${(totalMutationRate / (totalPassed || 1)).toFixed(1)}% of pixels`);
  console.log(`Avg Execution Time:   ${(totalTime / (totalPassed || 1)).toFixed(2)} ms`);

  if (totalPassed < results.length) {
    console.error(`\n[WARNING] ${results.length - totalPassed} algorithm(s) failed verification criteria.`);
    process.exitCode = 1;
  } else {
    console.log(`\n\x1b[32m[SUCCESS] All algorithms verified intact, non-trivial, and memory-safe.\x1b[0m\n`);
  }

  return results;
}

// Run CLI directly if executed as main module
if (process.argv[1] && process.argv[1].endsWith('test-rig.js')) {
  const args = process.argv.slice(2);
  const jsonFlag = args.includes('--json');
  const algoArg = args.find(a => !a.startsWith('--'));

  runTestRig({ algo: algoArg, json: jsonFlag }).catch(err => {
    console.error('Fatal Test Rig error:', err);
    process.exit(1);
  });
}
