/**
 * @file worker-pool.js
 * @module worker-pool
 * @author J. Kirchartz <me@jkirchartz.com>
 * @license GPL-3.0
 * @description Multi-threaded Web Worker pool for offloading image processing tasks.
 * Uses transferable ArrayBuffers and OffscreenCanvas for zero-copy message passing.
 */

import { gleech } from '../core/gleech-engine.js';

/**
 * Worker pool managing background Web Workers for parallel glitch rendering.
 */
class GlitchWorkerPool {
  /**
   * Initializes the pool configuration.
   *
   * @param {number} [size] - Number of workers to allocate (defaults to cores - 1, clamped [2, 8])
   */
  constructor(size) {
    const defaultSize = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency)
      ? Math.min(Math.max(navigator.hardwareConcurrency - 1, 2), 8)
      : 4;
    this.size = size || defaultSize;
    this.workers = [];            // Active background worker instances
    this.freeWorkers = [];        // Available idle workers
    this.taskQueue = [];          // Pending task queue
    this.activeTasks = new Map(); // Active task promises keyed by task ID
    this.taskIdCounter = 1;
    this.initialized = false;
  }

  /**
   * Spawns worker threads on first use.
   * Guards against non-browser environments (Node.js/SSR).
   */
  init() {
    if (this.initialized || typeof window === 'undefined' || typeof Worker === 'undefined') {
      return;
    }
    try {
      for (let i = 0; i < this.size; i++) {
        // Instantiate module worker
        const worker = new Worker(new URL('./gleech.worker.js', import.meta.url), { type: 'module' });
        worker.onmessage = (e) => this.handleWorkerMessage(worker, e.data);
        worker.onerror = (err) => this.handleWorkerError(worker, err);
        this.workers.push(worker);
        this.freeWorkers.push(worker);
      }
      this.initialized = true;
    } catch (err) {
      console.warn('Could not initialize Web Worker pool, using fallback execution:', err);
    }
  }

  /**
   * Handles incoming completion or error messages from workers.
   *
   * @param {Worker} worker - Responding worker instance
   * @param {Object} data - Message payload from worker
   */
  handleWorkerMessage(worker, data) {
    const { id } = data;
    const task = this.activeTasks.get(id);
    if (task) {
      this.activeTasks.delete(id);
      if (data.success) {
        let resultImageData = null;
        // Rebuild ImageData from transferred buffer if present
        if (data.buffer) {
          resultImageData = new ImageData(new Uint8ClampedArray(data.buffer), data.width, data.height);
        }
        task.resolve({
          algorithm: data.algorithm,
          subAlgorithms: data.subAlgorithms || null,
          imageData: resultImageData,
          bitmap: data.bitmap || null,
          width: data.width,
          height: data.height,
          duration: data.duration
        });
      } else {
        task.reject(new Error(data.error || 'Worker error'));
      }
    }
    // Return worker to available pool and process queued tasks
    this.freeWorkers.push(worker);
    this.drainQueue();
  }

  /**
   * Handles worker exceptions and replaces dead threads.
   *
   * @param {Worker} worker - Faulted worker instance
   * @param {ErrorEvent} err - Error payload
   */
  handleWorkerError(worker, err) {
    console.error('Worker error event:', err);
    const idx = this.workers.indexOf(worker);
    if (idx !== -1) {
      try { worker.terminate(); } catch (e) {}
      this.workers.splice(idx, 1);
      const freeIdx = this.freeWorkers.indexOf(worker);
      if (freeIdx !== -1) this.freeWorkers.splice(freeIdx, 1);

      // Spawn fresh replacement worker thread
      try {
        const replacement = new Worker(new URL('./gleech.worker.js', import.meta.url), { type: 'module' });
        replacement.onmessage = (e) => this.handleWorkerMessage(replacement, e.data);
        replacement.onerror = (e) => this.handleWorkerError(replacement, e);
        this.workers.push(replacement);
        this.freeWorkers.push(replacement);
      } catch (e) {}
    }
    this.drainQueue();
  }

  /**
   * Dispatches queued tasks to idle workers with transferable buffer ownership.
   */
  drainQueue() {
    while (this.freeWorkers.length > 0 && this.taskQueue.length > 0) {
      const worker = this.freeWorkers.pop();
      const task = this.taskQueue.shift();
      this.activeTasks.set(task.id, task);

      const message = {
        id: task.id,
        algorithm: task.algorithm,
        buffer: task.buffer,
        width: task.width,
        height: task.height,
        options: task.options,
        useOffscreen: task.useOffscreen !== false
      };

      // Transfer ArrayBuffer ownership to avoid structured clone copy overhead
      worker.postMessage(message, [task.buffer]);
    }
  }

  /**
   * Executes a glitch algorithm on an ImageData instance.
   *
   * @param {Object} params - Execution parameters
   * @param {string} params.algorithm - Name of the algorithm in gleech engine
   * @param {ImageData} params.imageData - Source image data
   * @param {Object} [params.options={}] - Algorithm configuration options
   * @param {boolean} [params.useOffscreen=true] - Whether to render to ImageBitmap via OffscreenCanvas
   * @returns {Promise<{algorithm: string, imageData: ImageData|null, bitmap: ImageBitmap|null, width: number, height: number, duration: number}>} Execution result
   */
  async run({ algorithm, imageData, options = {}, useOffscreen = true }) {
    this.init();

    // Fallback path: execute synchronously on main thread if workers unavailable
    if (this.workers.length === 0) {
      const clonedData = new Uint8ClampedArray(imageData.data);
      const copy = new ImageData(clonedData, imageData.width, imageData.height);
      const t0 = performance.now();
      gleech[algorithm](copy, options);
      const duration = Math.round((performance.now() - t0) * 10) / 10;
      const subAlgorithms = (algorithm === 'theWorks' && gleech.theWorks && gleech.theWorks.lastSelected)
        ? [...gleech.theWorks.lastSelected]
        : (algorithm === 'randomGlitch' && gleech.randomGlitch && gleech.randomGlitch.lastSelected)
          ? [...gleech.randomGlitch.lastSelected]
          : null;
      return {
        algorithm,
        subAlgorithms,
        imageData: copy,
        bitmap: null,
        width: copy.width,
        height: copy.height,
        duration
      };
    }

    // Clone backing buffer so original image is not detached on transfer
    const copyBuffer = new Uint8ClampedArray(imageData.data).buffer;
    const taskId = this.taskIdCounter++;

    return new Promise((resolve, reject) => {
      this.taskQueue.push({
        id: taskId,
        algorithm,
        buffer: copyBuffer,
        width: imageData.width,
        height: imageData.height,
        options,
        useOffscreen,
        resolve,
        reject
      });
      this.drainQueue();
    });
  }

  /**
   * Runs multiple algorithms in parallel across the worker pool.
   *
   * @param {string[]} algorithms - Array of algorithm names to execute
   * @param {ImageData} sourceImageData - Baseline image to apply effects to
   * @param {Object} [options={}] - Options passed to algorithms
   * @param {Function} [onProgress=null] - Progress callback receiving `{ result, completed, total }`
   * @returns {Promise<Array<Object>>} Array of execution results
   */
  async runBatch(algorithms, sourceImageData, options = {}, onProgress = null) {
    let completed = 0;
    const total = algorithms.length;

    const promises = algorithms.map(async (algo) => {
      try {
        const res = await this.run({
          algorithm: algo,
          imageData: sourceImageData,
          options: options.options,
          useOffscreen: options.useOffscreen !== false
        });
        completed++;
        if (onProgress) {
          onProgress({ result: res, completed, total });
        }
        return res;
      } catch (err) {
        console.error(`Error running algorithm ${algo}:`, err);
        completed++;
        const errResult = { algorithm: algo, error: err.message, completed, total };
        if (onProgress) {
          onProgress({ result: errResult, completed, total });
        }
        return errResult;
      }
    });

    return Promise.all(promises);
  }

  /**
   * Terminates all worker threads and resets queue state.
   */
  terminate() {
    for (const w of this.workers) {
      try { w.terminate(); } catch (e) {}
    }
    this.workers = [];
    this.freeWorkers = [];
    this.taskQueue = [];
    this.activeTasks.clear();
    this.initialized = false;
  }
}

export const workerPool = new GlitchWorkerPool();
export default workerPool;
