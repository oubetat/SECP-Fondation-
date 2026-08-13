/**
 * SECP Geometry Kernel Manager
 * Handles the singleton lifecycle, initialization, and memory management of the CAD kernel.
 */

import { GeometryKernel } from './GeometryKernel';
import { OcctKernelAdapter } from '../kernels/occt/OcctKernelAdapter';
import { loadOcct } from '../kernels/occt/loader';
import { Tolerance } from './GeometryTolerance';

export enum KernelStatus {
  UNINITIALIZED = 'UNINITIALIZED',
  LOADING = 'LOADING',
  READY = 'READY',
  ERROR = 'ERROR'
}

export enum RuntimeContext {
  BROWSER = 'BROWSER',
  WEB_WORKER = 'WEB_WORKER',
  NODE = 'NODE',
  SERVER_WORKER = 'SERVER_WORKER'
}

export class GeometryKernelManager {
  private static instances = new Map<RuntimeContext, GeometryKernel>();
  private static statuses = new Map<RuntimeContext, KernelStatus>();
  private static loadingPromises = new Map<RuntimeContext, Promise<GeometryKernel>>();

  /**
   * Detects the current execution runtime environment.
   */
  public static detectContext(): RuntimeContext {
    if (typeof window === 'undefined') {
      if (typeof process !== 'undefined' && process.versions && process.versions.node) {
        return RuntimeContext.NODE;
      }
      return RuntimeContext.SERVER_WORKER;
    }
    // WebWorker detection
    if (typeof self !== 'undefined' && 'WorkerGlobalScope' in self) {
      return RuntimeContext.WEB_WORKER;
    }
    return RuntimeContext.BROWSER;
  }

  /**
   * Initializes and returns the CAD kernel instance for the specified or detected context.
   */
  public static async getKernel(context?: RuntimeContext): Promise<GeometryKernel> {
    const ctx = context || this.detectContext();
    
    const existing = this.instances.get(ctx);
    if (existing) return existing;
    
    const status = this.statuses.get(ctx) || KernelStatus.UNINITIALIZED;
    const loadingPromise = this.loadingPromises.get(ctx);
    if (status === KernelStatus.LOADING && loadingPromise) {
      return loadingPromise;
    }

    this.statuses.set(ctx, KernelStatus.LOADING);
    const newPromise = (async () => {
      try {
        console.log(`[SECP] Initializing Production CAD Kernel for context: ${ctx}...`);
        const ocInstance = await loadOcct();
        
        if (!ocInstance) throw new Error('WASM initialization returned null');

        const kernelInstance = new OcctKernelAdapter(ocInstance);
        this.instances.set(ctx, kernelInstance);
        this.statuses.set(ctx, KernelStatus.READY);
        console.log(`[SECP] CAD Kernel for context ${ctx} Ready.`);
        return kernelInstance;
      } catch (err) {
        this.statuses.set(ctx, KernelStatus.ERROR);
        console.error(`[SECP] CRITICAL: CAD Kernel for context ${ctx} failed to load.`, err);
        throw err;
      }
    })();

    this.loadingPromises.set(ctx, newPromise);
    return newPromise;
  }

  public static getStatus(context?: RuntimeContext): KernelStatus {
    const ctx = context || this.detectContext();
    return this.statuses.get(ctx) || KernelStatus.UNINITIALIZED;
  }

  /**
   * Performs a basic health check on the kernel for the specific context.
   */
  public static async healthCheck(context?: RuntimeContext): Promise<boolean> {
    const ctx = context || this.detectContext();
    const instance = this.instances.get(ctx);
    if (!instance) {
      console.warn(`[SECP] Health check failed: Kernel not initialized for context ${ctx}.`);
      return false;
    }
    try {
      const box = await instance.createBox(1, 1, 1);
      const props = await box.getProperties();
      // Verify real volume (1mm3 = 1e-9 m3) with reasonable modeling tolerance check
      const expectedVolume = 1e-9;
      const deviation = Math.abs((props.volume || 0) - expectedVolume);
      
      if (deviation > Tolerance.VALIDATION) { // More robust engineering modeling tolerance
        console.error(`[SECP] Health check failed: Volume calculation deviation too high. Dev: ${deviation}`);
        return false;
      }

      return props.isValid === true && props.faceCount === 6;
    } catch (err) {
      console.error(`[SECP] Health check encountered error in context ${ctx}:`, err);
      return false;
    }
  }

  /**
   * Disposes of the kernel for the specified or detected context.
   */
  public static dispose(context?: RuntimeContext): void {
    const ctx = context || this.detectContext();
    console.log(`[SECP] Disposing CAD Kernel for context: ${ctx}...`);
    this.instances.delete(ctx);
    this.statuses.set(ctx, KernelStatus.UNINITIALIZED);
    this.loadingPromises.delete(ctx);
  }
}
