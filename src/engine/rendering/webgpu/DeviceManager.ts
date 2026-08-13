/// <reference types="@webgpu/types" />

/**
 * WebGPU Device Manager
 * Requests adapters, logical devices, and manages hardware capabilities.
 */

export class DeviceManager {
  private adapter: GPUAdapter | null = null;
  private device: GPUDevice | null = null;

  public async initialize(powerPreference: 'high-performance' | 'low-power' = 'high-performance'): Promise<boolean> {
    try {
      if (typeof window === 'undefined' || !('gpu' in navigator)) {
        console.warn('WebGPU is not supported on this browser or platform.');
        return false;
      }

      const gpu = (navigator as any).gpu as GPU;
      this.adapter = await gpu.requestAdapter({
        powerPreference,
      });

      if (!this.adapter) {
        console.warn('No suitable GPU Adapter found.');
        return false;
      }

      // Query limits and features if needed
      const requiredLimits: Record<string, number> = {};
      if (this.adapter.limits.maxBindGroups >= 4) {
        requiredLimits['maxBindGroups'] = 4;
      }

      this.device = await this.adapter.requestDevice({
        requiredLimits,
      });

      // Listen to unhandled device loss or errors to handle fallback gracefully
      this.device.lost.then((info) => {
        console.error(`WebGPU Device lost: ${info.message}. Reason: ${info.reason}`);
        this.device = null;
      });

      return true;
    } catch (err) {
      console.error('Failed to initialize WebGPU hardware device:', err);
      return false;
    }
  }

  public getDevice(): GPUDevice {
    if (!this.device) {
      throw new Error('GPUDevice is not initialized. Please call initialize() first.');
    }
    return this.device;
  }

  public getAdapter(): GPUAdapter {
    if (!this.adapter) {
      throw new Error('GPUAdapter is not initialized. Please call initialize() first.');
    }
    return this.adapter;
  }

  public isReady(): boolean {
    return this.device !== null;
  }

  public destroy(): void {
    if (this.device) {
      this.device.destroy();
      this.device = null;
    }
    this.adapter = null;
  }
}
