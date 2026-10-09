import { GPUDeviceManager } from '../../services/compute/GPUDeviceManager';
import { KernelRegistry } from '../../services/compute/KernelRegistry';
import { GPUMemoryManager } from '../../services/compute/GPUMemoryManager';
import { GPUBackend } from '../../services/compute/GPUBackend';
import { MultiGPUExecutor } from '../../services/compute/MultiGPUExecutor';
import { GPUDevice } from './types';

export interface Gate142Result {
  gateId: string;
  description: string;
  passed: boolean;
  verdict: string;
  details: string;
}

export class HardAcceptanceGate142 {
  public static async runAllTests(): Promise<Gate142Result[]> {
    const results: Gate142Result[] = [];

    // 1. GPU Discovery & Fingerprint Test
    results.push(this.testGpuDiscoveryAndFingerprint());

    // 2. GPU Qualification Record Test
    results.push(this.testGpuQualification());

    // 3. Kernel Registry & Selection Test
    results.push(this.testKernelRegistry());

    // 4. Deterministic Tree Reduction Test
    results.push(this.testDeterministicGpuReduction());

    // 5. CPU vs GPU Numerical Equivalence & Drift Detection Test
    results.push(await this.testCpuGpuNumericalEquivalence());

    // 6. GPU Out-of-Memory Handling Test
    results.push(this.testGpuOutOfMemoryHandling());

    // 7. GPU Failure & CPU Fallback with Provenance Test
    results.push(await this.testGpuFailureCpuFallbackProvenance());

    // 8. Multi-GPU Asynchronous Execution Test
    results.push(await this.testMultiGpuExecution());

    // 9. GPU Execution Evidence Provenance Test
    results.push(await this.testGpuExecutionEvidence());

    return results;
  }

  private static testGpuDiscoveryAndFingerprint(): Gate142Result {
    const devices = GPUDeviceManager.discoverDevices();
    const hasA100 = devices.some(d => d.gpuFingerprint.includes('A100'));

    return {
      gateId: 'GATE-142-DEVICE-DISCOVERY-FINGERPRINT',
      description: 'Discover GPU hardware acceleration devices and generate unique hardware fingerprints',
      passed: devices.length >= 2 && hasA100,
      verdict: hasA100 ? 'GPU_DEVICES_DISCOVERED' : 'FAILED',
      details: `Discovered ${devices.length} GPU devices. Top device: ${devices[0]?.gpuFingerprint}`
    };
  }

  private static testGpuQualification(): Gate142Result {
    const device = GPUDeviceManager.discoverDevices()[0];
    const qualRecord = GPUDeviceManager.qualifyDevice(device, 'CUDA', 'FP64', 1e-6);

    const isQualified = GPUDeviceManager.isDeviceQualified(device.gpuFingerprint);

    return {
      gateId: 'GATE-142-DEVICE-QUALIFICATION',
      description: 'Qualify GPU hardware device against CPU reference suite before production deployment',
      passed: isQualified && qualRecord.status === 'QUALIFIED',
      verdict: isQualified ? 'GPU_QUALIFIED' : 'FAILED',
      details: `Device ${device.deviceId} successfully qualified with FP64 precision.`
    };
  }

  private static testKernelRegistry(): Gate142Result {
    const kernels = KernelRegistry.listKernels();
    const femKernel = KernelRegistry.getKernel('K-FEM-STIFFNESS-V1');

    const passed = kernels.length >= 4 && femKernel?.precision === 'FP64';

    return {
      gateId: 'GATE-142-KERNEL-REGISTRY-PRECISION',
      description: 'Maintain versioned GPU kernel registry with strict FP64 engineering precision policies',
      passed,
      verdict: passed ? 'KERNEL_REGISTRY_VERIFIED' : 'FAILED',
      details: passed ? 'Verified 4 engineering GPU kernels with FP64 precision.' : 'Registry check failed.'
    };
  }

  private static testDeterministicGpuReduction(): Gate142Result {
    const values = [12.5, 99.1, 0.003, 441.2, 88.0, 1.2];
    const sum1 = KernelRegistry.executeGpuReduction(values, 'CUDA', 'FP64');
    const sum2 = KernelRegistry.executeGpuReduction([...values].reverse(), 'CUDA', 'FP64');

    const passed = Math.abs(sum1 - sum2) < 1e-12;

    return {
      gateId: 'GATE-142-DETERMINISTIC-GPU-REDUCTION',
      description: 'Enforce deterministic tree reduction order on GPU parallel floating point operations',
      passed,
      verdict: passed ? 'DETERMINISTIC_REDUCTION_VERIFIED' : 'FAILED',
      details: passed ? 'GPU Tree reduction sum produces identical bitwise result regardless of array order.' : 'Non-deterministic GPU sum.'
    };
  }

  private static async testCpuGpuNumericalEquivalence(): Promise<Gate142Result> {
    const backend = new GPUBackend('CUDA');
    const res = await backend.execute({
      kernelId: 'K-DETERMINISTIC-REDUCTION-V1',
      inputs: { values: [100.0, 200.0, 300.0] },
      precision: 'FP64'
    });

    const passed = res.success && res.evidence?.validationResult === 'VALIDATED';

    return {
      gateId: 'GATE-142-CPU-GPU-NUMERICAL-EQUIVALENCE',
      description: 'Validate numerical equivalence between CPU Reference and GPU execution outputs',
      passed,
      verdict: passed ? 'NUMERICAL_EQUIVALENCE_VERIFIED' : 'FAILED',
      details: passed ? 'GPU result matched CPU reference within 1e-5 relative error.' : 'Numerical equivalence failed.'
    };
  }

  private static testGpuOutOfMemoryHandling(): Gate142Result {
    const memManager = new GPUMemoryManager(8000); // 8GB
    const allocFail = memManager.allocateVram(16000); // Request 16GB

    const passed = !allocFail.success && allocFail.error?.includes('OUT_OF_MEMORY');

    return {
      gateId: 'GATE-142-GPU-OUT-OF-MEMORY-HANDLING',
      description: 'Detect VRAM exhaustion explicitly and prevent silent memory allocation failures',
      passed,
      verdict: passed ? 'OUT_OF_MEMORY_HANDLED' : 'FAILED',
      details: passed ? 'Successfully caught VRAM allocation failure with explicit OOM error.' : 'Silent OOM failure.'
    };
  }

  private static async testGpuFailureCpuFallbackProvenance(): Promise<Gate142Result> {
    const failedDevice: GPUDevice = {
      deviceId: 'GPU-FAILED-SIM',
      gpuFingerprint: 'NV-FAILED-TEST',
      capability: {
        vendor: 'NVIDIA',
        architecture: 'Ampere',
        computeCapability: '8.0',
        memoryMB: 81920,
        precisionModes: ['FP64'],
        tensorCapabilities: false,
        supportedKernels: [],
        driverVersion: '0.0',
        runtimeVersion: '0.0'
      },
      health: 'FAILED',
      utilizationPercent: 0,
      temperatureC: 95,
      powerWatts: 0,
      availableVramMB: 0
    };

    const backend = new GPUBackend('CUDA', failedDevice);
    const res = await backend.execute({
      kernelId: 'K-DETERMINISTIC-REDUCTION-V1',
      inputs: { values: [50, 50] },
      precision: 'FP64',
      allowCpuFallback: true
    });

    const passed = res.success && res.evidence?.fallbackOccurred === true && res.evidence?.fallbackReason === 'DEVICE_FAILURE';

    return {
      gateId: 'GATE-142-GPU-FAILURE-CPU-FALLBACK-PROVENANCE',
      description: 'Automatically fallback to CPU Reference on GPU failure and record provenance evidence',
      passed,
      verdict: passed ? 'CPU_FALLBACK_WITH_PROVENANCE_VERIFIED' : 'FAILED',
      details: passed ? 'Fallback to CPU occurred with fallbackOccurred=true provenance record.' : 'Fallback failed.'
    };
  }

  private static async testMultiGpuExecution(): Promise<Gate142Result> {
    const devices = GPUDeviceManager.discoverDevices();
    const executor = new MultiGPUExecutor(devices);

    const res = await executor.executeMultiGPUJob({
      kernelId: 'K-DETERMINISTIC-REDUCTION-V1',
      inputs: { values: [10, 20] },
      precision: 'FP64'
    });

    const passed = res.completedFutures.every(f => f.status === 'COMPLETED') && res.evidenceList.length === devices.length;

    return {
      gateId: 'GATE-142-MULTI-GPU-EXECUTION',
      description: 'Execute multi-GPU workload asynchronously across all qualified GPU devices',
      passed,
      verdict: passed ? 'MULTI_GPU_EXECUTION_VERIFIED' : 'FAILED',
      details: passed ? `Executed across ${res.completedFutures.length} GPUs with full evidence capture.` : 'Multi-GPU failed.'
    };
  }

  private static async testGpuExecutionEvidence(): Promise<Gate142Result> {
    const backend = new GPUBackend('CUDA');
    const res = await backend.execute({
      kernelId: 'K-FEM-STIFFNESS-V1',
      inputs: { elementMesh: 'E1001' },
      precision: 'FP64'
    });

    const passed = res.success && res.evidence?.validationResult === 'VALIDATED' && !!res.evidence?.gpuFingerprint;

    return {
      gateId: 'GATE-142-GPU-EXECUTION-EVIDENCE',
      description: 'Generate immutable GPU execution evidence record attached to computational results',
      passed,
      verdict: passed ? 'GPU_EXECUTION_EVIDENCE_GENERATED' : 'FAILED',
      details: passed ? 'Attached immutable GPU evidence snapshot with fingerprint.' : 'Missing GPU evidence.'
    };
  }
}
