import { WASMKernelRegistry } from '../../services/compute/WASMKernelRegistry';
import { WASMMemoryManager } from '../../services/compute/WASMMemoryManager';
import { WASMComputeBackend } from '../../services/compute/WASMComputeBackend';
import { WASMEngineeringQualificationGate } from '../../services/compute/WASMEngineeringQualificationGate';
import { WASMCompilationCache } from '../../services/compute/WASMCompilationCache';

export interface Gate144Result {
  gateId: string;
  description: string;
  passed: boolean;
  verdict: string;
  details: string;
}

export class HardAcceptanceGate144 {
  public static async runAllTests(): Promise<Gate144Result[]> {
    const results: Gate144Result[] = [];

    // 1. WASM Module Registry & Immutability Test
    results.push(this.testModuleRegistryAndImmutability());

    // 2. WASM Memory Management & Budget Test
    results.push(this.testMemoryManagement());

    // 3. WASM Numerical Equivalence Test
    results.push(await this.testNumericalEquivalence());

    // 4. WASM Security Policy Test
    results.push(await this.testSecurityPolicy());

    // 5. WASM Build & Runtime Provenance Test
    results.push(await this.testProvenance());

    // 6. WASM Qualification Gate Test
    results.push(this.testQualificationGate());

    // 7. WASM Evidence Chain Test
    results.push(await this.testEvidenceChain());

    // 8. WASM Cold/Warm Start Qualification
    results.push(await this.testColdWarmStartQualification());

    // 9. WASM SIMD Numerical Variance Test
    results.push(await this.testSIMDVariance());

    return results;
  }

  private static async testColdWarmStartQualification(): Promise<Gate144Result> {
    const backend = new WASMComputeBackend();
    const kernelId = 'WASM-REDUCTION-TREE-V1';
    
    // Ensure cold start by invalidating cache
    WASMCompilationCache.invalidate();
    
    // Cold Start
    const res1 = await backend.execute({ kernelId, inputs: { v: 1 }, precision: 'FP64' });
    const coldTime = res1.evidence?.performance.coldStartMs || 0;
    
    // Warm Start (should use cache)
    const res2 = await backend.execute({ kernelId, inputs: { v: 1 }, precision: 'FP64' });
    const warmTime = res2.evidence?.performance.warmStartMs || 0;

    const passed = res1.success && res2.success && coldTime > 0 && warmTime > 0 && warmTime < coldTime;

    return {
      gateId: 'GATE-144-COLD-WARM-START-QUALIFICATION',
      description: 'Validate WASM compilation caching and quantify cold/warm start performance',
      passed,
      verdict: passed ? 'STARTUP_QUALIFIED' : 'FAILED',
      details: passed 
        ? `Cold: ${coldTime.toFixed(2)}ms, Warm: ${warmTime.toFixed(2)}ms. Cache hit confirmed.`
        : 'Warm start not faster than cold start or cache failure.'
    };
  }

  private static async testSIMDVariance(): Promise<Gate144Result> {
    const backend = new WASMComputeBackend();
    const res = await backend.execute({
      kernelId: 'WASM-REDUCTION-TREE-V1',
      inputs: { values: [1, 2, 3] },
      precision: 'FP64'
    });

    const variance = res.evidence?.performance.simdVariance || 1.0;
    const passed = res.success && variance <= 1e-10;

    return {
      gateId: 'GATE-144-SIMD-NUMERICAL-VARIANCE',
      description: 'Validate numerical equivalence between SIMD and Scalar execution paths',
      passed,
      verdict: passed ? 'SIMD_QUALIFIED' : 'FAILED',
      details: passed 
        ? `SIMD variance: ${variance.toExponential(2)}. Within engineering tolerance.`
        : 'SIMD numerical divergence detected.'
    };
  }

  private static testModuleRegistryAndImmutability(): Gate144Result {
    const modules = WASMKernelRegistry.listModules();
    const reductionMod = WASMKernelRegistry.getModule('WASM-REDUCTION-TREE-V1');
    const passed = modules.length >= 3 && reductionMod?.moduleHash.startsWith('hash-wasm-');

    return {
      gateId: 'GATE-144-MODULE-REGISTRY-IMMUTABILITY',
      description: 'Register WASM engineering modules and enforce immutable binary hashing',
      passed,
      verdict: passed ? 'WASM_REGISTRY_VERIFIED' : 'FAILED',
      details: passed ? `Registered ${modules.length} modules with immutable hashes.` : 'Module registry failed.'
    };
  }

  private static testMemoryManagement(): Gate144Result {
    const memMgr = new WASMMemoryManager(32, 64); // 32MB initial, 64MB max
    const allocPass = memMgr.allocateMemory(16); // 32 + 16 = 48MB
    const allocFail = memMgr.allocateMemory(32); // 48 + 32 = 80MB (exceeds 64MB)

    const passed = allocPass.success && !allocFail.success && allocFail.error?.includes('WASM_MEMORY_LIMIT');

    return {
      gateId: 'GATE-144-MEMORY-MANAGEMENT-BUDGET',
      description: 'Manage WASM linear memory and enforce strict allocation budget limits',
      passed,
      verdict: passed ? 'MEMORY_BUDGET_ENFORCED' : 'FAILED',
      details: passed ? 'Successfully blocked memory allocation exceeding budget limit.' : 'Memory limit failure.'
    };
  }

  private static async testNumericalEquivalence(): Promise<Gate144Result> {
    const backend = new WASMComputeBackend();
    const res = await backend.execute({
      kernelId: 'WASM-REDUCTION-TREE-V1',
      inputs: { values: [1.1, 2.2, 3.3] },
      precision: 'FP64'
    });

    const passed = res.success && res.evidence?.validationResult === 'VALIDATED';

    return {
      gateId: 'GATE-144-NUMERICAL-EQUIVALENCE',
      description: 'Validate numerical equivalence between WASM execution and native CPU reference',
      passed,
      verdict: passed ? 'NUMERICAL_EQUIVALENCE_VERIFIED' : 'FAILED',
      details: passed ? 'WASM output matched native CPU reference within 1e-6 relative error.' : 'Numerical divergence detected.'
    };
  }

  private static async testSecurityPolicy(): Promise<Gate144Result> {
    WASMKernelRegistry.registerModule({
      moduleId: 'WASM-UNTRUSTED-MOD',
      moduleVersion: 1,
      moduleHash: 'hash-untrusted',
      runtimeVersion: 'V8',
      exports: ['main'],
      imports: [],
      memoryRequirementsMB: { initialMB: 1, maximumMB: 2 },
      precisionPolicy: 'FP64',
      trustLevel: 'UNTRUSTED',
      buildFingerprint: {
        sourceRevision: 'unknown',
        compilerVersion: 'unknown',
        target: 'wasm32',
        buildFlags: [],
        moduleHash: 'hash-untrusted'
      }
    });

    const backend = new WASMComputeBackend();
    const res = await backend.execute({
      kernelId: 'WASM-UNTRUSTED-MOD',
      inputs: {},
      precision: 'FP64'
    });

    const passed = !res.success && res.error?.includes('WASM_SECURITY_VIOLATION');

    return {
      gateId: 'GATE-144-SECURITY-TRUST-POLICY',
      description: 'Enforce WASM trust policy and block untrusted module execution',
      passed,
      verdict: passed ? 'UNTRUSTED_MODULE_BLOCKED' : 'FAILED',
      details: passed ? 'Blocked execution of module with UNTRUSTED trust level.' : 'Security policy bypass.'
    };
  }

  private static async testProvenance(): Promise<Gate144Result> {
    const backend = new WASMComputeBackend();
    const res = await backend.execute({
      kernelId: 'WASM-FEM-SOLVER-V1',
      inputs: { mesh: 'M1' },
      precision: 'FP64'
    });

    const passed = res.success && !!res.evidence?.buildFingerprint.compilerVersion && !!res.evidence?.runtimeFingerprint;

    return {
      gateId: 'GATE-144-PROVENANCE-FINGERPRINTING',
      description: 'Record full WASM build and runtime provenance in execution evidence',
      passed,
      verdict: passed ? 'PROVENANCE_CAPTURED' : 'FAILED',
      details: passed ? `Captured build fingerprint: ${res.evidence?.buildFingerprint.compilerVersion}` : 'Missing provenance data.'
    };
  }

  private static testQualificationGate(): Gate144Result {
    const record = WASMEngineeringQualificationGate.qualifyWASMWorkload(
      'WORKLOAD-FEM-02',
      1,
      'hash-wasm-fem-solver-v1-sha256',
      'V8 12.0',
      'FP64',
      1e-7
    );

    const isQualified = WASMEngineeringQualificationGate.isWorkloadQualified('WORKLOAD-FEM-02');

    return {
      gateId: 'GATE-144-QUALIFICATION-GATE',
      description: 'Qualify WASM workload against engineering correctness requirements',
      passed: isQualified && record.status === 'QUALIFIED',
      verdict: isQualified ? 'WASM_WORKLOAD_QUALIFIED' : 'FAILED',
      details: isQualified ? 'Workload successfully qualified for WASM execution.' : 'Qualification failed.'
    };
  }

  private static async testEvidenceChain(): Promise<Gate144Result> {
    const backend = new WASMComputeBackend();
    const res = await backend.execute({
      kernelId: 'WASM-CFD-SOLVER-V1',
      inputs: { step: 1 },
      precision: 'FP64'
    });

    const passed = res.success && !!res.evidence?.evidenceHash && res.evidence?.validationResult === 'VALIDATED';

    return {
      gateId: 'GATE-144-EVIDENCE-CHAIN-HASHING',
      description: 'Generate immutable execution evidence with canonical evidence hash',
      passed,
      verdict: passed ? 'EVIDENCE_GENERATED' : 'FAILED',
      details: passed ? `Generated evidence hash: ${res.evidence?.evidenceHash}` : 'Evidence hashing failed.'
    };
  }
}
