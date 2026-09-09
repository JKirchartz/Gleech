import { gleech } from '../core/glitch-engine.js';

self.onmessage = async function(e) {
  const { id, algorithm, buffer, width, height, options, useOffscreen } = e.data;
  const startTime = performance.now();

  try {
    if (typeof gleech[algorithm] !== 'function') {
      throw new Error(`Algorithm "${algorithm}" not found in gleech`);
    }

    // Wrap buffer in ImageData
    const dataArray = new Uint8ClampedArray(buffer);
    const imageData = new ImageData(dataArray, width, height);

    // Apply algorithm
    gleech[algorithm](imageData, options);

    const duration = Math.round((performance.now() - startTime) * 10) / 10;

    // Check if OffscreenCanvas can produce an ImageBitmap for zero-copy rendering
    if (useOffscreen && typeof OffscreenCanvas !== 'undefined') {
      try {
        const offscreen = new OffscreenCanvas(width, height);
        const ctx = offscreen.getContext('2d');
        ctx.putImageData(imageData, 0, 0);
        const bitmap = offscreen.transferToImageBitmap();
        self.postMessage(
          { id, success: true, algorithm, bitmap, width, height, duration },
          [bitmap]
        );
        return;
      } catch (offscreenErr) {
        console.warn('OffscreenCanvas transfer fallback:', offscreenErr);
      }
    }

    // Return modified pixel buffer via transferable object
    self.postMessage(
      { id, success: true, algorithm, buffer: imageData.data.buffer, width, height, duration },
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
