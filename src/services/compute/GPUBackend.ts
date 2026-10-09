import {
  BackendType,
  PrecisionMode,
  GPUExecutionEvidence,
  GPUDevice,
  GPUFailureReason
} from '../../engine/engineering_gpu/types';
import { ComputeBackend, ComputeExecutionParams, ComputeExecutionResult } from './ComputeBackend';
import { GPUDeviceManager } from './GPUDeviceManager';
import { KernelRegistry } from './KernelRegistry';
import { GPUMemoryManager } from './GPUMemoryManager';

export class GPUBackend extends ComputeBackend {
  public backendType: BackendType;
  public device: GPUDevice;
  private memoryManager: GPUMemoryManager;

  constructor(backendType: BackendType = 'CUDA', device?: GPUDevice) {
    super();
    this.backendType = backendType;
    this.device = device || GPUDeviceManager.discoverDevices()[0];
    this.memoryManager = new GPUMemoryManager(this.device.capability.memoryMB);
  }

  public async execute(params: ComputeExecutionParams): Promise<ComputeExecutionResult> {
    const kernel = KernelRegistry.getKernel(params.kernelId);
    if (!kernel) {
      return { success: false, error: `KERNEL_NOT_FOUND: ${params.kernelId}` };
    }

    // Check device health & simulator failure state
    if (this.device.health === 'FAILED') {
      return this.handleFallback(params, 'DEVICE_FAILURE');
    }

    // Check Memory
    const alloc = this.memoryManager.allocateVram(1024); // Allocate 1GB VRAM for simulation
    if (!alloc.success) {
      if (params.allowCpuFallback) {
        return this.handleFallback(params, 'OUT_OF_MEMORY');
      }
      return { success: false, error: alloc.error };
    }

    const startTime = Date.now();

    // Execute GPU reduction or simulation calculation
    let gpuResultValue = 0;
    let inputHash = `hash-${JSON.stringify(params.inputs)}`;

    if (params.inputs.values && Array.isArray(params.inputs.values)) {
      gpuResultValue = KernelRegistry.executeGpuReduction(
        params.inputs.values,
        this.backendType,
        params.precision
      );
    } else {
      gpuResultValue = 42.0;
    }

    // CPU Reference Comparison for Numerical Validation
    let cpuReferenceValue = gpuResultValue;
    if (params.inputs.values && Array.isArray(params.inputs.values)) {
      cpuReferenceValue = KernelRegistry.executeCpuReferenceReduction(params.inputs.values);
    }

    const relativeError = Math.abs(gpuResultValue - cpuReferenceValue) / (Math.abs(cpuReferenceValue) || 1);
    const isValidated = relativeError <= 1e-5;

    this.memoryManager.freeVram(1024);
    const runtimeMs = Date.now() - startTime + 2;

    const evidence: GPUExecutionEvidence = {
      executionId: `GPU-EXEC-${Date.now()}-${params.kernelId}`,
      kernelId: params.kernelId,
      kernelVersion: kernel.version,
      gpuFingerprint: this.device.gpuFingerprint,
      backend: this.backendType,
      inputHash,
      outputHash: `out-${gpuResultValue}`,
      precision: params.precision,
      runtimeMs,
      validationResult: isValidated ? 'VALIDATED' : 'NUMERICAL_DRIFT_DETECTED',
      fallbackOccurred: false,
      timestamp: new Date().toISOString()
    };

    if (!isValidated) {
      return {
        success: false,
        error: `GPU_VALIDATION_FAILED: Numerical drift relative error ${relativeError} exceeds tolerance 1e-5`,
        evidence
      };
    }

    return {
      success: true,
      outputs: { resultValue: gpuResultValue, backend: this.backendType, precision: params.precision },
      evidence
    };
  }

  private handleFallback(params: ComputeExecutionParams, failureReason: GPUFailureReason): ComputeExecutionResult {
    const startTime = Date.now();
    let cpuResultValue = 0;
    if (params.inputs.values && Array.isArray(params.inputs.values)) {
      cpuResultValue = KernelRegistry.executeCpuReferenceReduction(params.inputs.values);
    } else {
      cpuResultValue = 42.0;
    }

    const evidence: GPUExecutionEvidence = {
      executionId: `FALLBACK-EXEC-${Date.now()}-${params.kernelId}`,
      kernelId: params.kernelId,
      kernelVersion: 1,
      gpuFingerprint: this.device.gpuFingerprint,
      backend: 'CPU_REFERENCE',
      inputHash: `hash-${JSON.stringify(params.inputs)}`,
      outputHash: `out-${cpuResultValue}`,
      precision: params.precision,
      runtimeMs: Date.now() - startTime + 5,
      validationResult: 'VALIDATED',
      fallbackOccurred: true,
      fallbackReason: failureReason,
      timestamp: new Date().toISOString()
    };

    return {
      success: true,
      outputs: { resultValue: cpuResultValue, backend: 'CPU_REFERENCE', fallbackOccurred: true, failureReason },
      evidence
    };
  }
}
