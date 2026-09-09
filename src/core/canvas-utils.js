/**
 * Utility functions for loading images and rendering with Canvas / OffscreenCanvas
 */

export async function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.match(/^image\//)) {
      return reject(new Error('Please select a valid image file.'));
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const { width, height } = img;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
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

export async function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const { width, height } = img;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
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
 * Creates a built-in retro test canvas image for instant testing
 */
export function createDefaultTestImage(width = 240, height = 240) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  // Vibrant gradient background
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, '#e63946');
  grad.addColorStop(0.3, '#f1faee');
  grad.addColorStop(0.6, '#a8dadc');
  grad.addColorStop(1, '#1d3557');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Geometric shapes
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

  // Fine detail lines for dithering demonstration
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
 * Converts a worker result (bitmap or imageData) into an HTML Image data URL or renders to canvas
 */
export function resultToDataUrl(result) {
  if (!result) return '';
  const { width, height, bitmap, imageData } = result;

  // Use OffscreenCanvas if available
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      const offscreen = new OffscreenCanvas(width, height);
      const ctx = offscreen.getContext('2d');
      if (bitmap) {
        ctx.drawImage(bitmap, 0, 0);
      } else if (imageData) {
        ctx.putImageData(imageData, 0, 0);
      }
      // Return canvas data URL via temp canvas or blob
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const cctx = canvas.getContext('2d');
      cctx.drawImage(offscreen, 0, 0);
      return canvas.toDataURL('image/png');
    } catch (e) {
      // Fall through to standard canvas
    }
  }

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
 * Extract ImageData from an image or data URL
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
