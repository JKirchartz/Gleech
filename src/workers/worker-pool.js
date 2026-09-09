import { gleech } from '../core/glitch-engine.js';

class GlitchWorkerPool {
  constructor(size) {
    const defaultSize = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency)
      ? Math.min(Math.max(navigator.hardwareConcurrency - 1, 2), 8)
      : 4;
    this.size = size || defaultSize;
    this.workers = [];
    this.freeWorkers = [];
    this.taskQueue = [];
    this.activeTasks = new Map();
    this.taskIdCounter = 1;
    this.initialized = false;
  }

  init() {
    if (this.initialized || typeof window === 'undefined' || typeof Worker === 'undefined') {
      return;
    }
    try {
      for (let i = 0; i < this.size; i++) {
        const worker = new Worker(new URL('./glitch.worker.js', import.meta.url), { type: 'module' });
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

  handleWorkerMessage(worker, data) {
    const { id } = data;
    const task = this.activeTasks.get(id);
    if (task) {
      this.activeTasks.delete(id);
      if (data.success) {
        let resultImageData = null;
        if (data.buffer) {
          resultImageData = new ImageData(new Uint8ClampedArray(data.buffer), data.width, data.height);
        }
        task.resolve({
          algorithm: data.algorithm,
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
    this.freeWorkers.push(worker);
    this.drainQueue();
  }

  handleWorkerError(worker, err) {
    console.error('Worker error event:', err);
    // Terminate and replace faulted worker
    const idx = this.workers.indexOf(worker);
    if (idx !== -1) {
      try { worker.terminate(); } catch (e) {}
      this.workers.splice(idx, 1);
      const freeIdx = this.freeWorkers.indexOf(worker);
      if (freeIdx !== -1) this.freeWorkers.splice(freeIdx, 1);
      try {
        const replacement = new Worker(new URL('./glitch.worker.js', import.meta.url), { type: 'module' });
        replacement.onmessage = (e) => this.handleWorkerMessage(replacement, e.data);
        replacement.onerror = (e) => this.handleWorkerError(replacement, e);
        this.workers.push(replacement);
        this.freeWorkers.push(replacement);
      } catch (e) {}
    }
    this.drainQueue();
  }

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

      worker.postMessage(message, [task.buffer]);
    }
  }

  /**
   * Run a single algorithm on an ImageData instance.
   */
  async run({ algorithm, imageData, options = {}, useOffscreen = true }) {
    this.init();

    // Fallback if workers unavailable
    if (this.workers.length === 0) {
      const clonedData = new Uint8ClampedArray(imageData.data);
      const copy = new ImageData(clonedData, imageData.width, imageData.height);
      const t0 = performance.now();
      gleech[algorithm](copy, options);
      const duration = Math.round((performance.now() - t0) * 10) / 10;
      return {
        algorithm,
        imageData: copy,
        bitmap: null,
        width: copy.width,
        height: copy.height,
        duration
      };
    }

    // Clone pixel data so worker doesn't strip the original image's buffer
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
   * Run multiple algorithms on a source ImageData in parallel with progress updates.
   */
  async runBatch(algorithms, sourceImageData, options = {}, onProgress = null) {
    let completed = 0;
    const total = algorithms.length;
    const results = [];

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
