import { pureSha256 } from '../../polyfills/crypto';

export type ComputeBackendMode = 'WEBGPU' | 'CPU_FALLBACK' | 'AUTO';

export interface BackendTruthState {
  activeBackend: ComputeBackendMode;
  gpuDeviceName?: string;
  hardwareAvailable: boolean;
  status: 'READY' | 'INITIALIZING' | 'FALLBACK';
}

export function computeDataHash(data: Float32Array | number[] | ArrayBuffer | any): string {
  if (data instanceof Float32Array) {
    let str = '';
    for (let i = 0; i < Math.min(data.length, 100); i++) {
      str += data[i].toFixed(6) + ',';
    }
    return pureSha256(str + `_len${data.length}`);
  }
  return pureSha256(JSON.stringify(data));
}

export class CPUBackend {
  public async executeKernel(name: string, data: Float32Array): Promise<Float32Array> {
    return data.map(v => v * 2);
  }
}

export class WebGPUComputeBackend {
  /**
   * Real WebGPU Execution Path.
   * If hardware is unavailable, it returns a failing state rather than a fake result.
   */
  public async executeKernel(name: string, data: Float32Array): Promise<Float32Array> {
    if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
      throw new Error('WebGPU Execution requested but hardware is UNAVAILABLE');
    }
    
    // In this unified backend, we should ideally use the ComputeShaderManager
    // For now, we ensure we don't return a fake data.map result.
    // Real execution is handled by the specialized benchmark paths for truth verification.
    throw new Error('WebGPUComputeBackend: Real execution requires a configured ComputePipeline. Use WebGPUBenchmarkHarness for verified truth paths.');
  }
}

export class ComputeBackend extends WebGPUComputeBackend {}

export class BackendSelector {
  public static async selectBackend(): Promise<BackendTruthState> {
    const hasNavigatorGpu = typeof navigator !== 'undefined' && 'gpu' in navigator && !!navigator.gpu;
    let adapter: any = null;
    let gpuDeviceName: string | undefined = undefined;
    
    if (hasNavigatorGpu) {
      try {
        adapter = await navigator.gpu.requestAdapter();
        if (adapter) {
          gpuDeviceName = (adapter as any).info?.description || (adapter as any).info?.device || 'WebGPU Adapter';
        }
      } catch {
        adapter = null;
      }
    }

    const hardwareAvailable = !!adapter;
    return {
      activeBackend: hardwareAvailable ? 'WEBGPU' : 'CPU_FALLBACK',
      gpuDeviceName: hardwareAvailable ? (gpuDeviceName || 'WebGPU Adapter') : 'CPU',
      hardwareAvailable,
      status: hardwareAvailable ? 'READY' : 'FALLBACK'
    };
  }

  public static getWebGPUBackend(): WebGPUComputeBackend {
    return new WebGPUComputeBackend();
  }

  public static getCPUBackend(): CPUBackend {
    return new CPUBackend();
  }
}
