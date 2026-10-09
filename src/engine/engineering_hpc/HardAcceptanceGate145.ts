import { NativeKernelRegistry } from '../../services/compute/NativeKernelRegistry';
import { CPUCapabilityDetector } from '../../services/compute/CPUCapabilityDetector';
import { NativeHPCBackend } from '../../services/compute/NativeHPCBackend';
import { NativeHPCQualificationGate } from '../../services/compute/NativeHPCQualificationGate';

export interface Gate145Result {
  gateId: string;
  description: string;
  passed: boolean;
  verdict: string;
  details: string;
}

export class HardAcceptanceGate145 {
  public static async runAllTests(): Promise<Gate145Result[]> {
    const results: Gate145Result[] = [];

    // 1. CPU Capability Detection Test
    results.push(this.testCPUCapabilityDetection());

    // 2. Native Kernel Registry Test
    results.push(this.testNativeKernelRegistry());

    // 3. Native HPC Execution & Numerical Accuracy Test
    results.push(await this.testNativeHPCExecution());

    // 4. Native Build Provenance Test
    results.push(await this.testBuildProvenance());

    // 5. HPC Qualification Gate Test
    results.push(this.testQualificationGate());

    // 6. Native Evidence Chain Test
    results.push(await this.testEvidenceChain());

    return results;
  }

  private static testCPUCapabilityDetection(): Gate145Result {
    const fp = CPUCapabilityDetector.detect();
    const passed = fp.architecture === 'x86_64' && fp.instructionSets.includes('AVX-512');

    return {
      gateId: 'GATE-145-CPU-CAPABILITY-DETECTION',
      description: 'Detect CPU architecture and instruction set extensions (AVX-512, etc.)',
      passed,
      verdict: passed ? 'CPU_QUALIFIED' : 'FAILED',
      details: passed ? `Detected ${fp.model} with ${fp.instructionSets.join(', ')}` : 'Detection failure.'
    };
  }

  private static testNativeKernelRegistry(): Gate145Result {
    const kernels = NativeKernelRegistry.list();
    const cfd = NativeKernelRegistry.get('HPC-SOLVER-CFD-V1');
    const passed = kernels.length >= 2 && !!cfd && cfd.binaryHash.startsWith('hash-bin-');

    return {
      gateId: 'GATE-145-NATIVE-KERNEL-REGISTRY',
      description: 'Manage native HPC kernels with immutable binary hashing and build fingerprints',
      passed,
      verdict: passed ? 'REGISTRY_VERIFIED' : 'FAILED',
      details: passed ? `Registered ${kernels.length} native kernels.` : 'Registry failure.'
    };
  }

  private static async testNativeHPCExecution(): Promise<Gate145Result> {
    const backend = new NativeHPCBackend();
    const res = await backend.execute({
      kernelId: 'HPC-SOLVER-CFD-V1',
      inputs: { values: [100, 200, 300] },
      precision: 'FP64'
    });

    const passed = res.success && res.evidence?.validationResult === 'VALIDATED';

    return {
      gateId: 'GATE-145-NATIVE-HPC-EXECUTION-ACCURACY',
      description: 'Execute native HPC workloads with strict numerical validation (1e-10 tolerance)',
      passed,
      verdict: passed ? 'EXECUTION_VERIFIED' : 'FAILED',
      details: passed ? 'Native execution matched CPU reference within 1e-10 relative error.' : 'Numerical divergence detected.'
    };
  }

  private static async testBuildProvenance(): Promise<Gate145Result> {
    const backend = new NativeHPCBackend();
    const res = await backend.execute({
      kernelId: 'HPC-SOLVER-FEM-V1',
      inputs: { v: 1 },
      precision: 'FP64'
    });

    const build = res.evidence?.buildFingerprint;
    const passed = res.success && !!build?.compiler && !!build?.sourceRevision;

    return {
      gateId: 'GATE-145-BUILD-PROVENANCE-FINGERPRINTING',
      description: 'Record full native build provenance (compiler, flags, revision) in evidence',
      passed,
      verdict: passed ? 'PROVENANCE_CAPTURED' : 'FAILED',
      details: passed ? `Captured: ${build?.compiler} ${build?.compilerVersion} (Revision: ${build?.sourceRevision})` : 'Missing provenance.'
    };
  }

  private static testQualificationGate(): Gate145Result {
    const record = NativeHPCQualificationGate.qualifyBinary(
      'WORKLOAD-01',
      'hash-bin-cfd-v1-sha256',
      'env-hpc-v1',
      0.85, // 85% efficiency
      true
    );

    const isQualified = NativeHPCQualificationGate.isQualified('hash-bin-cfd-v1-sha256');

    return {
      gateId: 'GATE-145-HPC-QUALIFICATION-GATE',
      description: 'Qualify native binaries based on numerical correctness and parallel efficiency',
      passed: isQualified && record.status === 'QUALIFIED',
      verdict: isQualified ? 'BINARY_QUALIFIED' : 'FAILED',
      details: isQualified ? `Qualified with ${record.scalingEfficiency * 100}% parallel efficiency.` : 'Qualification failed.'
    };
  }

  private static async testEvidenceChain(): Promise<Gate145Result> {
    const backend = new NativeHPCBackend();
    const res = await backend.execute({
      kernelId: 'HPC-SOLVER-CFD-V1',
      inputs: { v: 2 },
      precision: 'FP64'
    });

    const passed = res.success && !!res.evidence?.evidenceHash;

    return {
      gateId: 'GATE-145-NATIVE-EVIDENCE-CHAIN',
      description: 'Generate immutable engineering evidence for native HPC executions',
      passed,
      verdict: passed ? 'EVIDENCE_GENERATED' : 'FAILED',
      details: passed ? `Evidence Hash: ${res.evidence?.evidenceHash}` : 'Evidence failure.'
    };
  }
}
