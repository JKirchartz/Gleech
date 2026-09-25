/**
 * @file canvas-utils.js
 * @module canvas-utils
 * @author J. Kirchartz <me@jkirchartz.com>
 * @license GPL-3.0
 * @description Image loading and canvas conversion utilities.
 * Handles conversions between File, URL, HTMLImageElement, HTMLCanvasElement,
 * OffscreenCanvas, ImageData, and ImageBitmap.
 */

import {
  databend,
  detectFormat,
  corruptJpegEntropy,
  glitchBmpStride,
  imageDataToBmp,
  bmpToImageData
} from './databend.js';

let activePreImportTechnique = 'none';
let activePreImportOptions = {};

/**
 * Configures the global pre-import databending pipeline.
 * When enabled, imported images are bent at the raw byte or header level before reaching the canvas.
 *
 * @param {string} [technique='none'] - 'none' | 'headerShear' | 'audioEcho' | 'combFilter' | 'bytebeat' | 'jpegEntropy'
 * @param {Object} [options={}] - Filter parameters
 */
export function setPreImportDatabend(technique = 'none', options = {}) {
  activePreImportTechnique = technique;
  activePreImportOptions = { ...options };
}

/**
 * Returns current pre-import databend configuration.
 *
 * @returns {{technique: string, options: Object}}
 */
export function getPreImportDatabend() {
  return {
    technique: activePreImportTechnique,
    options: { ...activePreImportOptions }
  };
}

/**
 * Ensures an image buffer is an actual browser ImageData instance before putImageData.
 *
 * @param {ImageData|{data: Uint8ClampedArray, width: number, height: number}} imgData - Source buffer
 * @param {number} [width] - Fallback width
 * @param {number} [height] - Fallback height
 * @returns {ImageData} Guaranteed ImageData instance
 */
export function ensureImageData(imgData, width, height) {
  if (typeof ImageData !== 'undefined' && imgData instanceof ImageData) {
    return imgData;
  }
  const w = (imgData && imgData.width) || width || 1;
  const h = (imgData && imgData.height) || height || 1;
  const rawData = (imgData && imgData.data)
    ? (imgData.data instanceof Uint8ClampedArray ? imgData.data : new Uint8ClampedArray(imgData.data))
    : new Uint8ClampedArray(w * h * 4);

  if (typeof ImageData !== 'undefined') {
    try {
      return new ImageData(rawData, w, h);
    } catch (e) {
      if (typeof document !== 'undefined') {
        const dummyCanvas = document.createElement('canvas');
        const dummyCtx = dummyCanvas.getContext('2d');
        if (dummyCtx) {
          const id = dummyCtx.createImageData(w, h);
          id.data.set(rawData);
          return id;
        }
      }
    }
  }
  return { width: w, height: h, data: rawData };
}

/**
 * Loads a local image file into an ImageData buffer and canvas context.
 * Seamlessly passes raw file bytes through the pre-import databending engine when configured,
 * preserving or repairing file headers to guarantee successful browser decoding.
 *
 * @param {File|Blob} file - Image file from file input or drop event
 * @param {Object} [options={}] - Optional override options (technique, strideDelta, delay, etc.)
 * @returns {Promise<{img: HTMLImageElement, width: number, height: number, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, imageData: ImageData, dataUrl: string}>} Loaded image context
 */
export async function loadImageFromFile(file, options = {}) {
  if (!file || !file.type.match(/^image\//)) {
    throw new Error('Please select a valid image file.');
  }

  const technique = options.technique || options.preImportDatabend || activePreImportTechnique;
  const filterOpts = { ...activePreImportOptions, ...options };

  // Read raw bytes from file
  const arrayBuffer = await file.arrayBuffer();
  let bytes = new Uint8Array(arrayBuffer);
  const format = detectFormat(bytes);

  // Technique: JPEG Entropy Corruptor on native JPEG files
  if (technique === 'jpegEntropy' && format === 'jpeg') {
    try {
      bytes = corruptJpegEntropy(bytes, filterOpts);
      const blob = new Blob([bytes], { type: 'image/jpeg' });
      return loadBlobToCanvas(blob);
    } catch (e) {
      console.warn('Pre-import JPEG entropy corruption failed, falling back to clean load:', e);
    }
  }

  // Technique: Direct BMP Stride Shear on native BMP files
  if (technique === 'headerShear' && format === 'bmp') {
    try {
      bytes = glitchBmpStride(bytes, filterOpts.strideDelta || 2);
      const blob = new Blob([bytes], { type: 'image/bmp' });
      return loadBlobToCanvas(blob);
    } catch (e) {
      console.warn('Pre-import BMP stride shear failed, falling back to clean load:', e);
    }
  }

  // Standard load to canvas
  const cleanLoaded = await loadBlobToCanvas(file);

  // If a post-canvas databend is active (e.g. Header Shear on PNG/JPEG, Audio Echo, Comb Filter, Bytebeat)
  if (technique && technique !== 'none' && technique !== 'jpegEntropy') {
    const rawGlitched = databend(cleanLoaded.imageData, {
      technique,
      ...filterOpts
    });
    const glitchedImageData = ensureImageData(rawGlitched, cleanLoaded.width, cleanLoaded.height);
    cleanLoaded.ctx.putImageData(glitchedImageData, 0, 0);
    cleanLoaded.imageData = glitchedImageData;
    cleanLoaded.dataUrl = cleanLoaded.canvas.toDataURL('image/png');
  }

  return cleanLoaded;
}

/**
 * Internal helper to load an image Blob or File into an HTMLCanvasElement with willReadFrequently.
 *
 * @param {Blob|File} blob - Image blob
 * @returns {Promise<{img: HTMLImageElement, width: number, height: number, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, imageData: ImageData, dataUrl: string}>}
 */
function loadBlobToCanvas(blob) {
  return new Promise((resolve, reject) => {
    const blobUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(blobUrl);
      const { width, height } = img;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      // willReadFrequently avoids GPU-to-CPU stalls when calling getImageData
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);

      resolve({ img, width, height, canvas, ctx, imageData, dataUrl: canvas.toDataURL('image/png') });
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(blobUrl);
      reject(err);
    };
    img.src = blobUrl;
  });
}

/**
 * Loads a remote image by URL with anonymous CORS headers.
 *
 * @param {string} url - Public image URL
 * @returns {Promise<{img: HTMLImageElement, width: number, height: number, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, imageData: ImageData, dataUrl: string}>} Loaded image context
 */
export async function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Enable cross-origin resource sharing to prevent canvas tainting
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const { width, height } = img;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      // Extract raw pixels to unattached canvas
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);

      resolve({ img, width, height, canvas, ctx, imageData, dataUrl: canvas.toDataURL('image/png') });
    };
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Generates a synthetic geometric calibration image with gradients, shapes, and fine lines.
 * Useful for testing dithering thresholds, Nyquist limits, and color quantization.
 *
 * @param {number} [width=240] - Pattern canvas width in pixels
 * @param {number} [height=240] - Pattern canvas height in pixels
 * @param {Object} [options={}] - Optional databending override options
 * @returns {{width: number, height: number, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, imageData: ImageData, dataUrl: string}} Generated pattern data
 */
export function createDefaultTestImage(width = 240, height = 240, options = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  // Diagonal linear gradient (tests color band quantization)
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, '#e63946');
  grad.addColorStop(0.3, '#f1faee');
  grad.addColorStop(0.6, '#a8dadc');
  grad.addColorStop(1, '#1d3557');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Geometric shapes with sharp vector edges
  ctx.fillStyle = '#ffb703';
  ctx.beginPath();
  ctx.arc(width * 0.35, height * 0.4, width * 0.25, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fb8500';
  ctx.fillRect(width * 0.45, height * 0.35, width * 0.4, height * 0.4);

  ctx.fillStyle = '#023047';
  ctx.beginPath();
  ctx.moveTo(width * 0.15, height * 0.85);
  ctx.lineTo(width * 0.5, height * 0.5);
  ctx.lineTo(width * 0.85, height * 0.85);
  ctx.closePath();
  ctx.fill();

  // High-frequency diagonal grid lines (tests Nyquist aliasing and Gibbs ringing)
  ctx.strokeStyle = '#219ebc';
  ctx.lineWidth = 3;
  for (let i = 0; i < width; i += 16) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(width, height - i);
    ctx.stroke();
  }

  let imageData = ctx.getImageData(0, 0, width, height);

  const opts = options || {};
  const technique = opts.technique || opts.preImportDatabend || activePreImportTechnique;
  if (technique && technique !== 'none') {
    const filterOpts = { ...activePreImportOptions, ...opts };
    const rawBent = databend(imageData, { technique, ...filterOpts });
    imageData = ensureImageData(rawBent, width, height);
    ctx.putImageData(imageData, 0, 0);
  }

  return {
    width,
    height,
    canvas,
    ctx,
    imageData,
    dataUrl: canvas.toDataURL('image/png')
  };
}

/**
 * Converts a worker execution result (ImageBitmap or ImageData) to a PNG Data URL.
 * Prefers OffscreenCanvas when supported for headless performance.
 *
 * @param {Object} result - Result payload from worker run
 * @param {number} result.width - Image width
 * @param {number} result.height - Image height
 * @param {ImageBitmap} [result.bitmap] - GPU texture bitmap
 * @param {ImageData} [result.imageData] - Raw pixel buffer
 * @returns {string} Data URL string (image/png)
 */
export function resultToDataUrl(result) {
  if (!result) return '';
  const { width, height, bitmap } = result;
  let imageData = result.imageData ? ensureImageData(result.imageData, width, height) : null;

  // Fast path: use OffscreenCanvas if available
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      const offscreen = new OffscreenCanvas(width, height);
      const ctx = offscreen.getContext('2d');
      if (bitmap) {
        ctx.drawImage(bitmap, 0, 0);
      } else if (imageData) {
        ctx.putImageData(imageData, 0, 0);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const cctx = canvas.getContext('2d');
      cctx.drawImage(offscreen, 0, 0);
      return canvas.toDataURL('image/png');
    } catch (e) {
      // Fall through to DOM canvas
    }
  }

  // Fallback: draw directly to DOM canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (bitmap) {
    ctx.drawImage(bitmap, 0, 0);
  } else if (imageData) {
    ctx.putImageData(imageData, 0, 0);
  }
  return canvas.toDataURL('image/png');
}

/**
 * Decodes a PNG or JPEG Data URL into an uncompressed ImageData buffer.
 *
 * @param {string} dataUrl - Base64 image data URL
 * @returns {Promise<ImageData>} Decoded raw ImageData
 */
export async function dataUrlToImageData(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, img.width, img.height));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}
