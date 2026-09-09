/*
 * index.js
 * Copyright (C) 2017-2026 jkirchartz <me@jkirchartz.com>
 *
 * Distributed under terms of the GPL 3.0 license.
 */

import { gleech } from './src/core/glitch-engine.js';

// Lazy-load Jimp only when in Node.js
let jimpModule = null;
async function getJimp() {
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    if (!jimpModule) {
      const mod = await import('jimp');
      jimpModule = mod.default || mod;
    }
    return jimpModule;
  }
  return null;
}

function decorateJimpImage(image) {
  const allAlgos = gleech.all;
  for (const algo of allAlgos) {
    image[algo] = function(...args) {
      const target = {
        data: image.bitmap.data,
        width: image.bitmap.width,
        height: image.bitmap.height
      };
      gleech[algo](target, ...args);
      return image;
    };
  }
  if (!image.writeAsync) {
    image.writeAsync = function(path) {
      return new Promise((resolve, reject) => {
        image.write(path, (err) => {
          if (err) reject(err);
          else resolve(image);
        });
      });
    };
  }
  return image;
}

/**
 * Reads an image file and returns a chainable Gleech/Jimp image.
 * Supports both Promise and Node-style callback:
 *   const img = await gleech.read('photo.jpg');
 *   img.pixelFunk().write('out.jpg');
 *
 *   gleech.read('photo.jpg', (err, img) => {
 *     img.theWorks().write('out.jpg');
 *   });
 */
gleech.read = function read(input, callback) {
  const promise = (async () => {
    const Jimp = await getJimp();
    if (!Jimp) {
      throw new Error('gleech.read() requires a Node.js environment.');
    }
    const image = await Jimp.read(input);
    decorateJimpImage(image);
    return image;
  })();

  if (typeof callback === 'function') {
    promise.then(img => callback(null, img)).catch(err => callback(err));
    return;
  }
  return promise;
};

/**
 * Glitch an image file from inputPath and write to outputPath.
 */
gleech.glitchFile = async function glitchFile(inputPath, outputPath, algorithm = 'theWorks', options = {}) {
  const image = await gleech.read(inputPath);
  if (typeof image[algorithm] === 'function') {
    image[algorithm](options);
  } else if (typeof gleech[algorithm] === 'function') {
    const target = {
      data: image.bitmap.data,
      width: image.bitmap.width,
      height: image.bitmap.height
    };
    gleech[algorithm](target, options);
  } else {
    throw new Error(`Unknown glitch algorithm: "${algorithm}"`);
  }
  if (outputPath) {
    await image.writeAsync(outputPath);
  }
  return image;
};

export { gleech };
export default gleech;
