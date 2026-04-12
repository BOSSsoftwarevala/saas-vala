// STEP 58: ZERO FREEZE GUARANTEE - No blocking UI, async all heavy tasks
export class AsyncTaskManager {
  private static instance: AsyncTaskManager;
  private taskQueue: Map<string, Promise<any>> = new Map();
  private workerPool: Worker[] = [];
  private maxWorkers = 4;

  static getInstance(): AsyncTaskManager {
    if (!AsyncTaskManager.instance) {
      AsyncTaskManager.instance = new AsyncTaskManager();
    }
    return AsyncTaskManager.instance;
  }

  constructor() {
    this.initializeWorkerPool();
  }

  private initializeWorkerPool() {
    // Initialize web workers for heavy computations
    for (let i = 0; i < this.maxWorkers; i++) {
      try {
        const worker = new Worker('/workers/async-worker.js');
        this.workerPool.push(worker);
      } catch (error) {
        console.warn('Failed to create web worker:', error);
      }
    }
  }

  // Run heavy task asynchronously without blocking UI
  async runAsync<T>(
    taskId: string,
    task: () => Promise<T> | T,
    options: {
      timeout?: number;
      priority?: 'low' | 'normal' | 'high';
      useWorker?: boolean;
    } = {}
  ): Promise<T> {
    // Check if task is already running
    if (this.taskQueue.has(taskId)) {
      return this.taskQueue.get(taskId) as Promise<T>;
    }

    const { timeout = 30000, priority = 'normal', useWorker = false } = options;

    const taskPromise = new Promise<T>(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.taskQueue.delete(taskId);
        reject(new Error(`Task ${taskId} timed out after ${timeout}ms`));
      }, timeout);

      try {
        let result: T;

        if (useWorker && this.workerPool.length > 0) {
          // Use web worker for CPU-intensive tasks
          result = await this.runInWorker(taskId, task);
        } else {
          // Use requestIdleCallback for non-blocking execution
          result = await this.runWithIdleCallback(task);
        }

        clearTimeout(timeoutId);
        this.taskQueue.delete(taskId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        this.taskQueue.delete(taskId);
        reject(error);
      }
    });

    this.taskQueue.set(taskId, taskPromise);
    return taskPromise;
  }

  private async runWithIdleCallback<T>(task: () => Promise<T> | T): Promise<T> {
    return new Promise((resolve, reject) => {
      const runTask = () => {
        try {
          const result = task();
          if (result instanceof Promise) {
            result.then(resolve).catch(reject);
          } else {
            resolve(result);
          }
        } catch (error) {
          reject(error);
        }
      };

      if ('requestIdleCallback' in window) {
        requestIdleCallback(runTask, { timeout: 100 });
      } else {
        // Fallback for browsers that don't support requestIdleCallback
        setTimeout(runTask, 0);
      }
    });
  }

  private async runInWorker<T>(taskId: string, task: () => Promise<T> | T): Promise<T> {
    const worker = this.getAvailableWorker();
    if (!worker) {
      // Fallback to main thread if no workers available
      return this.runWithIdleCallback(task);
    }

    return new Promise((resolve, reject) => {
      const messageHandler = (event: MessageEvent) => {
        if (event.data.taskId === taskId) {
          worker.removeEventListener('message', messageHandler);
          worker.removeEventListener('error', errorHandler);
          
          if (event.data.success) {
            resolve(event.data.result);
          } else {
            reject(new Error(event.data.error));
          }
        }
      };

      const errorHandler = (error: ErrorEvent) => {
        worker.removeEventListener('message', messageHandler);
        worker.removeEventListener('error', errorHandler);
        reject(error);
      };

      worker.addEventListener('message', messageHandler);
      worker.addEventListener('error', errorHandler);

      // Send task to worker
      worker.postMessage({
        taskId,
        taskString: task.toString()
      });
    });
  }

  private getAvailableWorker(): Worker | null {
    // Simple round-robin worker selection
    return this.workerPool[Math.floor(Math.random() * this.workerPool.length)] || null;
  }

  // Batch process multiple items without blocking UI
  async batchProcess<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    options: {
      batchSize?: number;
      delayBetweenBatches?: number;
      onProgress?: (processed: number, total: number) => void;
    } = {}
  ): Promise<R[]> {
    const { batchSize = 10, delayBetweenBatches = 10, onProgress } = options;
    const results: R[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      // Process batch in parallel
      const batchResults = await Promise.all(
        batch.map(item => this.runAsync(`batch_${i}_${item}`, () => processor(item)))
      );

      results.push(...batchResults);

      // Report progress
      if (onProgress) {
        onProgress(Math.min(i + batchSize, items.length), items.length);
      }

      // Small delay to prevent UI blocking
      if (i + batchSize < items.length && delayBetweenBatches > 0) {
        await this.delay(delayBetweenBatches);
      }
    }

    return results;
  }

  // Debounced function execution
  debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number,
    immediate?: boolean
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;

    return (...args: Parameters<T>) => {
      const later = () => {
        timeout = null;
        if (!immediate) func(...args);
      };

      const callNow = immediate && !timeout;

      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(later, wait);

      if (callNow) func(...args);
    };
  }

  // Throttled function execution
  throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle = false;

    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // Async delay
  delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Run task with automatic retry
  async runWithRetry<T>(
    taskId: string,
    task: () => Promise<T>,
    options: {
      maxRetries?: number;
      retryDelay?: number;
      backoffMultiplier?: number;
    } = {}
  ): Promise<T> {
    const { maxRetries = 3, retryDelay = 1000, backoffMultiplier = 2 } = options;
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.runAsync(`${taskId}_attempt_${attempt}`, task);
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries) {
          const delay = retryDelay * Math.pow(backoffMultiplier, attempt);
          await this.delay(delay);
        }
      }
    }

    throw lastError!;
  }

  // Cancel running task
  cancelTask(taskId: string): boolean {
    return this.taskQueue.delete(taskId);
  }

  // Get task status
  getTaskStatus(taskId: string): 'running' | 'completed' | 'not_found' {
    if (this.taskQueue.has(taskId)) {
      return 'running';
    }
    return 'not_found';
  }

  // Clear all tasks
  clearAllTasks() {
    this.taskQueue.clear();
  }

  // Memory-efficient image processing
  async processImageAsync(
    imageFile: File,
    options: {
      maxWidth?: number;
      maxHeight?: number;
      quality?: number;
      format?: 'jpeg' | 'png' | 'webp';
    } = {}
  ): Promise<Blob> {
    const { maxWidth = 1920, maxHeight = 1080, quality = 0.8, format = 'jpeg' } = options;

    return this.runAsync('image_processing', async () => {
      return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
          // Calculate new dimensions
          let { width, height } = img;
          
          if (width > maxWidth) {
            height = (maxWidth / width) * height;
            width = maxWidth;
          }
          
          if (height > maxHeight) {
            width = (maxHeight / height) * width;
            height = maxHeight;
          }

          canvas.width = width;
          canvas.height = height;

          // Draw and compress
          ctx?.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Failed to process image'));
              }
            },
            `image/${format}`,
            quality
          );
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = URL.createObjectURL(imageFile);
      });
    }, { useWorker: true });
  }

  // Large text processing without blocking
  async processLargeTextAsync(
    text: string,
    processor: (chunk: string) => Promise<string>,
    chunkSize: number = 10000
  ): Promise<string> {
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.slice(i, i + chunkSize));
    }

    const processedChunks = await this.batchProcess(
      chunks,
      processor,
      { batchSize: 3, delayBetweenBatches: 5 }
    );

    return processedChunks.join('');
  }

  // Cleanup
  destroy() {
    this.clearAllTasks();
    this.workerPool.forEach(worker => worker.terminate());
    this.workerPool = [];
  }
}

export const asyncTaskManager = AsyncTaskManager.getInstance();

// Utility functions for common async operations
export const asyncUtils = {
  // Debounced search
  debounceSearch: (searchFn: (query: string) => void, delay: number = 300) => {
    return asyncTaskManager.debounce(searchFn, delay);
  },

  // Throttled scroll handler
  throttleScroll: (scrollFn: () => void, limit: number = 16) => { // ~60fps
    return asyncTaskManager.throttle(scrollFn, limit);
  },

  // Async image load
  loadImageAsync: (src: string): Promise<HTMLImageElement> => {
    return asyncTaskManager.runAsync(`load_image_${src}`, () => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });
    });
  },

  // Async file read
  readFileAsync: (file: File): Promise<string> => {
    return asyncTaskManager.runAsync(`read_file_${file.name}`, () => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsText(file);
      });
    });
  }
};
