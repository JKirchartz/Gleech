/**
 * @file canvas-utils.js
 * @module canvas-utils
 * @author J. Kirchartz <me@jkirchartz.com>
 * @license GPL-3.0
 * @description Image loading and canvas conversion utilities.
 * Handles conversions between File, URL, HTMLImageElement, HTMLCanvasElement,
 * OffscreenCanvas, ImageData, and ImageBitmap.
 */

/**
 * Loads a local image file into an ImageData buffer and canvas context.
 * Uses willReadFrequently to keep backing store in CPU RAM for fast getImageData access.
 *
 * @param {File|Blob} file - Image file from file input or drop event
 * @returns {Promise<{img: HTMLImageElement, width: number, height: number, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, imageData: ImageData, dataUrl: string}>} Loaded image context
 */
export async function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    // Validate MIME type
    if (!file || !file.type.match(/^image\//)) {
      return reject(new Error('Please select a valid image file.'));
    }

    // Read file as base64 Data URL
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const { width, height } = img;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        // willReadFrequently avoids GPU-to-CPU stalls when calling getImageData
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);

        resolve({ img, width, height, canvas, ctx, imageData, dataUrl: e.target.result });
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
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
 * @returns {{width: number, height: number, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, imageData: ImageData, dataUrl: string}} Generated pattern data
 */
export function createDefaultTestImage(width = 240, height = 240) {
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

  const imageData = ctx.getImageData(0, 0, width, height);
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
  const { width, height, bitmap, imageData } = result;

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
