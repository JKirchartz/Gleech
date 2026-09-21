/**
 * @file index.js
 * @module gleech-node
 * @author J. Kirchartz <me@jkirchartz.com>
 * @license GPL-3.0
 * @description Isomorphic wrapper bridging Gleech's ImageData engine with Jimp for Node.js workflows.
 * Enables fluent method chaining (e.g. `img.superColorShift().ditherAtkinsons().writeAsync('out.png')`).
 */

import { gleech } from './src/core/gleech-engine.js';
import { algorithmParams } from './src/core/algorithm-params.js';

/**
 * Lazy loads Jimp when executing in a Node.js runtime.
 * Avoids bundling Jimp's Node.js dependencies into client-side browser builds.
 *
 * @returns {Promise<Object|null>} Jimp module or null
 */
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

/**
 * Decorates a Jimp image instance with Gleech algorithm methods.
 * Bridges Jimp's internal `image.bitmap` to Gleech's `{ data, width, height }` interface.
 *
 * @param {Object} image - Jimp image instance
 * @returns {Object} Decorated chainable Jimp image
 */
function decorateJimpImage(image) {
  const allAlgos = gleech.all;
  for (const algo of allAlgos) {
    image[algo] = function(...args) {
      // Proxy Jimp's bitmap buffer to match ImageData structure
      const target = {
        data: image.bitmap.data,
        width: image.bitmap.width,
        height: image.bitmap.height
      };
      gleech[algo](target, ...args);
      return image; // Chainable: img.algoA().algoB()
    };
  }

  // Helper to run numbered presets: img.preset(1) -> calls preset1()
  image.preset = function(num, ...args) {
    const fnName = 'preset' + num;
    if (typeof image[fnName] === 'function') {
      return image[fnName](...args);
    }
    return image;
  };

  // Promise-based file export helper
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
 * Reads an image file from disk and decorates it with Gleech filters.
 *
 * @param {string|Buffer} input - Filepath or buffer to load
 * @param {Function} [callback] - Optional error-first callback `(err, image)`
 * @returns {Promise<Object>} Promise resolving to decorated Jimp image
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
 * Loads an image from disk, applies a glitch filter, and writes it back to disk.
 *
 * @param {string} inputPath - Source image path
 * @param {string} outputPath - Destination image path
 * @param {string} [algorithm='theWorks'] - Glitch algorithm name
 * @param {Object} [options={}] - Options passed to the algorithm
 * @returns {Promise<Object>} Mutated Jimp image
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

export { gleech, algorithmParams };
export default gleech;
