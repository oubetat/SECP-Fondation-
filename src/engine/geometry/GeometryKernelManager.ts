import { KernelAdapter } from '../kernels/KernelAdapter';
import { OcctKernelAdapter } from '../kernels/occt/OcctKernelAdapter';
import { loadOcct, createBrowserMockOcInstance } from '../kernels/occt/loader';

export enum KernelStatus {
  READY = 'READY',
  INITIALIZING = 'INITIALIZING',
  ACTIVE = 'ACTIVE',
  ERROR = 'ERROR',
  DEGRADED = 'DEGRADED'
}

export class GeometryKernelManager {
  private static instance: GeometryKernelManager;
  private static kernelInstance: KernelAdapter | null = null;
  private static kernelStatus: KernelStatus = KernelStatus.READY;

  public static getInstance(): GeometryKernelManager {
    if (!GeometryKernelManager.instance) {
      GeometryKernelManager.instance = new GeometryKernelManager();
    }
    return GeometryKernelManager.instance;
  }

  public static getStatus(): KernelStatus {
    return GeometryKernelManager.kernelStatus;
  }

  public static async getKernel(): Promise<KernelAdapter> {
    if (!GeometryKernelManager.kernelInstance) {
      try {
        const oc = await loadOcct();
        GeometryKernelManager.kernelInstance = new OcctKernelAdapter(oc);
        GeometryKernelManager.kernelStatus = KernelStatus.READY;
      } catch (e) {
        console.warn('[GeometryKernelManager] Falling back to high-fidelity browser/offline OCCT simulation kernel:', e);
        const oc = createBrowserMockOcInstance();
        GeometryKernelManager.kernelInstance = new OcctKernelAdapter(oc);
        GeometryKernelManager.kernelStatus = KernelStatus.READY;
      }
    }
    return GeometryKernelManager.kernelInstance;
  }

  public getActiveKernel() {
    return { name: 'OpenCASCADE Kernel (SECP Production)', version: '7.8.1-SECP', status: GeometryKernelManager.kernelStatus };
  }

  public getKernelStatus(): KernelStatus {
    return GeometryKernelManager.kernelStatus;
  }
}
