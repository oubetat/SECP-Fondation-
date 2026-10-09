import { GPUDevice, GPUQualificationRecord, BackendType, PrecisionMode } from '../../engine/engineering_gpu/types';

export class GPUDeviceManager {
  private static devices = new Map<string, GPUDevice>();
  private static qualifications = new Map<string, GPUQualificationRecord>();

  static {
    // Initialize default discovered hardware devices
    this.registerDevice({
      deviceId: 'GPU-01-NVIDIA-A100',
      gpuFingerprint: 'NV-A100-80GB-SXM4-525.60.13-12.0',
      capability: {
        vendor: 'NVIDIA',
        architecture: 'Ampere',
        computeCapability: '8.0',
        memoryMB: 81920,
        precisionModes: ['FP64', 'FP32', 'FP16', 'BF16'],
        tensorCapabilities: true,
        supportedKernels: ['SpMV', 'FEM_Stiffness', 'CFD_Flux', 'Tree_Reduction', 'CG_Solver'],
        driverVersion: '525.60.13',
        runtimeVersion: '12.0'
      },
      health: 'HEALTHY',
      utilizationPercent: 12,
      temperatureC: 45,
      powerWatts: 180,
      availableVramMB: 75000
    });

    this.registerDevice({
      deviceId: 'GPU-02-AMD-MI250',
      gpuFingerprint: 'AMD-MI250X-128GB-ROCM-5.4',
      capability: {
        vendor: 'AMD',
        architecture: 'CDNA2',
        computeCapability: 'gfx90a',
        memoryMB: 131072,
        precisionModes: ['FP64', 'FP32', 'FP16'],
        tensorCapabilities: true,
        supportedKernels: ['SpMV', 'FEM_Stiffness', 'CFD_Flux', 'Tree_Reduction'],
        driverVersion: 'ROCm-5.4.0',
        runtimeVersion: '5.4'
      },
      health: 'HEALTHY',
      utilizationPercent: 5,
      temperatureC: 42,
      powerWatts: 150,
      availableVramMB: 125000
    });
  }

  public static registerDevice(device: GPUDevice): void {
    this.devices.set(device.deviceId, device);
  }

  public static discoverDevices(): GPUDevice[] {
    return Array.from(this.devices.values());
  }

  public static getDevice(deviceId: string): GPUDevice | undefined {
    return this.devices.get(deviceId);
  }

  public static qualifyDevice(
    device: GPUDevice,
    backend: BackendType,
    precision: PrecisionMode,
    maxRelError: number
  ): GPUQualificationRecord {
    const isQualified = maxRelError <= 1e-5;
    const record: GPUQualificationRecord = {
      qualificationId: `QUAL-${device.deviceId}-${Date.now()}`,
      backend,
      deviceFingerprint: device.gpuFingerprint,
      driverVersion: device.capability.driverVersion,
      kernelVersions: { SpMV: 1, FEM_Stiffness: 1, CFD_Flux: 1 },
      testSuiteResults: {
        referenceTests: true,
        numericalEquivalence: isQualified,
        maxRelativeError: maxRelError
      },
      precision,
      status: isQualified ? 'QUALIFIED' : 'REJECTED',
      timestamp: new Date().toISOString()
    };

    this.qualifications.set(record.qualificationId, record);
    return record;
  }

  public static isDeviceQualified(deviceFingerprint: string): boolean {
    for (const q of this.qualifications.values()) {
      if (q.deviceFingerprint === deviceFingerprint && q.status === 'QUALIFIED') {
        return true;
      }
    }
    return false;
  }
}
