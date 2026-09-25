/**
 * @file gleech.worker.js
 * @module gleech-worker
 * @author J. Kirchartz <me@jkirchartz.com>
 * @license GPL-3.0
 * @description Dedicated Web Worker thread for executing Gleech algorithms off the main thread.
 * Receives transferable ArrayBuffers, applies in-place pixel manipulation, and posts back
 * an ImageBitmap (fast GPU rendering) or the mutated ArrayBuffer.
 */

import { gleech } from '../core/gleech-engine.js';

self.onmessage = async function(e) {
  const { id, algorithm, buffer, width, height, options, useOffscreen } = e.data;
  const startTime = performance.now();

  try {
    if (typeof gleech[algorithm] !== 'function') {
      throw new Error(`Algorithm "${algorithm}" not found in gleech`);
    }

    // Wrap transferred ArrayBuffer in typed array and ImageData structure
    const dataArray = new Uint8ClampedArray(buffer);
    const imageData = new ImageData(dataArray, width, height);

    // Execute glitch algorithm in worker thread
    const res = gleech[algorithm](imageData, options);
    if (res && res.data && res.data !== dataArray) {
      dataArray.set(res.data);
    }

    const subAlgorithms = (algorithm === 'theWorks' && gleech.theWorks && gleech.theWorks.lastSelected)
      ? [...gleech.theWorks.lastSelected]
      : (algorithm === 'randomGlitch' && gleech.randomGlitch && gleech.randomGlitch.lastSelected)
        ? [...gleech.randomGlitch.lastSelected]
        : null;

    const duration = Math.round((performance.now() - startTime) * 10) / 10;

    // Fast path: transfer ImageBitmap via OffscreenCanvas for direct GPU drawing
    if (useOffscreen && typeof OffscreenCanvas !== 'undefined') {
      try {
        const offscreen = new OffscreenCanvas(width, height);
        const ctx = offscreen.getContext('2d');
        ctx.putImageData(imageData, 0, 0);
        const bitmap = offscreen.transferToImageBitmap();
        self.postMessage(
          { id, success: true, algorithm, subAlgorithms, bitmap, width, height, duration },
          [bitmap]
        );
        return;
      } catch (offscreenErr) {
        console.warn('OffscreenCanvas transfer fallback:', offscreenErr);
      }
    }

    // Fallback path: transfer ArrayBuffer ownership back to main thread
    self.postMessage(
      { id, success: true, algorithm, subAlgorithms, buffer: imageData.data.buffer, width, height, duration },
      [imageData.data.buffer]
    );
  } catch (err) {
    self.postMessage({
      id,
      success: false,
      algorithm,
      error: err && err.message ? err.message : String(err)
    });
  }
};
