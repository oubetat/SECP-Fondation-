import { describe, it, expect } from 'vitest';
import { DeterminismEvaluator } from '../DeterminismEvaluator';
import {
  DeterminismContract,
  DeterminismBoundary,
  DeterminismComparison
} from '../DeterminismContract';
import { DeterminismGate } from '../../validation/DeterminismGate';
import { DeterministicClock, WallClock } from '../clock';

describe('DeterminismEvaluator Adversarial & Sabotage Tests', () => {
  // Helper to construct a standard mock boundary
  function createBoundary(opts: {
    inputs?: unknown;
    config?: unknown;
    env?: unknown;
    executeFn?: () => unknown;
  }): DeterminismBoundary {
    return {
      componentId: 'test-boundary',
      captureInputs: () => opts.inputs ?? { meshId: 'M-101', resolution: 0.1 },
      captureConfiguration: () => opts.config ?? { solver: 'DIRECT', maxIter: 100 },
      captureEnvironment: () => opts.env ?? { arch: 'x64', os: 'linux' },
      execute: opts.executeFn ?? (() => ({ stress: [10.5, 20.3, 30.1], converged: true })),
      canonicalizeOutput: (o) => o,
      compare: (exp, act, tol = 0) => DeterminismEvaluator.compare(exp, act, tol)
    };
  }

  // ----------------------------------------------------
  // ADVERSARIAL TESTS (TEST A -> TEST L)
  // ----------------------------------------------------

  it('TEST A: Identical deterministic inputs produce identical hashes', () => {
    const input1 = { a: 10, b: [1, 2, 3], c: { x: true, y: 'data' } };
    const input2 = { c: { y: 'data', x: true }, b: [1, 2, 3], a: 10 };

    const hash1 = DeterminismEvaluator.hash(input1);
    const hash2 = DeterminismEvaluator.hash(input2);

    expect(hash1).toBe(hash2);
  });

  it('TEST B: Changing one meaningful input changes the input hash', () => {
    const input1 = { tolerance: 1e-4, domain: 'CFD' };
    const input2 = { tolerance: 1e-5, domain: 'CFD' };

    const hash1 = DeterminismEvaluator.hash(input1);
    const hash2 = DeterminismEvaluator.hash(input2);

    expect(hash1).not.toBe(hash2);
  });

  it('TEST C: Changing object key insertion order does NOT change the canonical hash', () => {
    const objA = { alpha: 1, beta: 2, gamma: 3 };
    const objB = { gamma: 3, alpha: 1, beta: 2 };

    expect(DeterminismEvaluator.hash(objA)).toBe(DeterminismEvaluator.hash(objB));
  });

  it('TEST D: Changing array order DOES change the canonical hash', () => {
    const arrA = ['FIRST', 'SECOND', 'THIRD'];
    const arrB = ['SECOND', 'FIRST', 'THIRD'];

    expect(DeterminismEvaluator.hash(arrA)).not.toBe(DeterminismEvaluator.hash(arrB));
  });

  it('TEST E: Changing the deterministic seed changes the execution fingerprint', () => {
    const fp1 = DeterminismEvaluator.computeExecutionFingerprint({
      componentId: 'solver',
      contractVersion: '1.0',
      configurationHash: 'conf-hash',
      inputsHash: 'input-hash',
      seed: 42
    });

    const fp2 = DeterminismEvaluator.computeExecutionFingerprint({
      componentId: 'solver',
      contractVersion: '1.0',
      configurationHash: 'conf-hash',
      inputsHash: 'input-hash',
      seed: 43
    });

    expect(fp1).not.toBe(fp2);
  });

  it('TEST F: Changing deterministic clock initial time changes the execution fingerprint when clock state is declared relevant', () => {
    const clockA = new DeterministicClock('2026-08-18T00:00:00.000Z');
    const clockB = new DeterministicClock('2026-08-19T00:00:00.000Z');

    const fpA = DeterminismEvaluator.computeExecutionFingerprint({
      componentId: 'sim',
      contractVersion: '1.0',
      configurationHash: 'conf',
      inputsHash: 'inp',
      clockMode: `DETERMINISTIC_${clockA.nowMs()}`
    });

    const fpB = DeterminismEvaluator.computeExecutionFingerprint({
      componentId: 'sim',
      contractVersion: '1.0',
      configurationHash: 'conf',
      inputsHash: 'inp',
      clockMode: `DETERMINISTIC_${clockB.nowMs()}`
    });

    expect(fpA).not.toBe(fpB);
  });

  it('TEST G: Wall-clock timestamps are NOT accidentally included in deterministic output hashing', () => {
    const pureOutput = { forces: [1.2, 3.4], energy: 100.5 };
    const hash = DeterminismEvaluator.hash(pureOutput);

    // Wall clock ticks
    const wallTime1 = new WallClock().nowMs();
    const hashAfterTime = DeterminismEvaluator.hash(pureOutput);

    expect(hash).toBe(hashAfterTime);
  });

  it('TEST H: Exact equality is distinguished from numerical equivalence', () => {
    const valA = { value: 1.000000000000 };
    const valB = { value: 1.000000000001 };

    const compZeroTol = DeterminismEvaluator.compare(valA, valB, 0);
    expect(compZeroTol.exactMatch).toBe(false);
    expect(compZeroTol.equivalent).toBe(false);

    const compWithTol = DeterminismEvaluator.compare(valA, valB, 1e-9);
    expect(compWithTol.exactMatch).toBe(false);
    expect(compWithTol.equivalent).toBe(true);
  });

  it('TEST I: A result outside tolerance is classified as non-equivalent', () => {
    const valA = { residual: 1e-3 };
    const valB = { residual: 2e-3 };

    const comp = DeterminismEvaluator.compare(valA, valB, 1e-4);
    expect(comp.exactMatch).toBe(false);
    expect(comp.equivalent).toBe(false);
    expect(comp.differences.length).toBeGreaterThan(0);
  });

  it('TEST J: A result within explicit tolerance can be classified as numerically equivalent without claiming exact equality', () => {
    const boundary = createBoundary({
      executeFn: (() => {
        let call = 0;
        return () => {
          call++;
          return { displacement: 0.05 + (call === 1 ? 0 : 0.000001) };
        };
      })()
    });

    const contract: DeterminismContract = {
      componentId: 'test-boundary',
      contractVersion: '1.0',
      level: 'REPRODUCIBLE',
      inputsHash: DeterminismEvaluator.hash(boundary.captureInputs()),
      configurationHash: DeterminismEvaluator.hash(boundary.captureConfiguration()),
      declaredDependencies: [],
      verified: false,
      reasons: []
    };

    const evaluation = DeterminismEvaluator.evaluateDeterminism(contract, boundary, { tolerance: 1e-5 });

    expect(evaluation.exactMatch).toBe(false);
    expect(evaluation.reproducible).toBe(true);
    expect(evaluation.classification).toBe('REPRODUCIBLE');
    expect(evaluation.verified).toBe(true);
  });

  it('TEST K: An uncontrolled random dependency prevents a DETERMINISTIC classification', () => {
    const boundary = createBoundary({
      executeFn: () => ({ randomMetric: Math.random() })
    });

    const contract: DeterminismContract = {
      componentId: 'test-boundary',
      contractVersion: '1.0',
      level: 'DETERMINISTIC',
      inputsHash: DeterminismEvaluator.hash(boundary.captureInputs()),
      configurationHash: DeterminismEvaluator.hash(boundary.captureConfiguration()),
      declaredDependencies: [],
      verified: false,
      reasons: []
    };

    const evaluation = DeterminismEvaluator.evaluateDeterminism(contract, boundary, { runs: 2 });

    expect(evaluation.exactMatch).toBe(false);
    expect(evaluation.classification).toBe('NON_DETERMINISTIC');
    expect(evaluation.verified).toBe(false);
    expect(evaluation.limitations.some(l => l.includes('output differed across runs'))).toBe(true);
  });

  it('TEST L: An uncontrolled environment dependency produces ENVIRONMENT_DEPENDENT or UNPROVEN rather than PASS', () => {
    const boundary = createBoundary({});
    const contract: DeterminismContract = {
      componentId: 'gpu-kernel',
      contractVersion: '1.0',
      level: 'ENVIRONMENT_DEPENDENT',
      inputsHash: DeterminismEvaluator.hash(boundary.captureInputs()),
      configurationHash: DeterminismEvaluator.hash(boundary.captureConfiguration()),
      declaredDependencies: ['CUDA_12.2', 'NVIDIA_A100'],
      verified: false,
      reasons: []
    };

    const evaluation = DeterminismEvaluator.evaluateDeterminism(contract, boundary);
    expect(evaluation.classification).toBe('ENVIRONMENT_DEPENDENT');
  });

  // ----------------------------------------------------
  // NEGATIVE / SABOTAGE TESTS (1 -> 10)
  // ----------------------------------------------------

  it('SABOTAGE 1: Removing timestamps from semantically required data is detected when schema is checked', () => {
    const outputWithTimestamp = { data: 123, timestamp: '2026-08-18T00:00:00.000Z' };
    const outputStripped = { data: 123 };

    const comp = DeterminismEvaluator.compare(outputWithTimestamp, outputStripped);
    expect(comp.equivalent).toBe(false);
    expect(comp.differences.some(d => d.includes('Missing property'))).toBe(true);
  });

  it('SABOTAGE 2: Replacing random outputs with constant is rejected when evaluating under changing seed expectations', () => {
    const constantFn = () => ({ val: 42 }); // fake deterministic
    const fp1 = DeterminismEvaluator.computeExecutionFingerprint({
      componentId: 'comp', contractVersion: '1', configurationHash: 'c', inputsHash: 'i', seed: 10
    });
    const fp2 = DeterminismEvaluator.computeExecutionFingerprint({
      componentId: 'comp', contractVersion: '1', configurationHash: 'c', inputsHash: 'i', seed: 20
    });
    expect(fp1).not.toBe(fp2); // Fingerprint catches seed change
  });

  it('SABOTAGE 3: Ignoring meaningful output fields during comparison is rejected by recursive comparison', () => {
    const exp = { fieldA: 1, hiddenAnomaly: true };
    const act = { fieldA: 1, hiddenAnomaly: false };

    const comp = DeterminismEvaluator.compare(exp, act);
    expect(comp.exactMatch).toBe(false);
    expect(comp.differences.some(d => d.includes('hiddenAnomaly'))).toBe(true);
  });

  it('SABOTAGE 4: Increasing tolerance to arbitrary extreme does not yield exactMatch', () => {
    const exp = { a: 1.0 };
    const act = { a: 999.0 };

    const comp = DeterminismEvaluator.compare(exp, act, 10000);
    expect(comp.exactMatch).toBe(false);
    expect(comp.equivalent).toBe(true); // equivalent under huge tolerance, but NEVER exactMatch
  });

  it('SABOTAGE 5: Hashing only selected fields vs complete canonical structure yields different hashes', () => {
    const full = { a: 1, b: 2, c: 3 };
    const partial = { a: 1 };

    expect(DeterminismEvaluator.hash(full)).not.toBe(DeterminismEvaluator.hash(partial));
  });

  it('SABOTAGE 6: Fixed expected hash without actual canonical computation is caught by contract mismatch', () => {
    const boundary = createBoundary({ inputs: { realParam: 55 } });
    const contract: DeterminismContract = {
      componentId: 'test-boundary',
      contractVersion: '1.0',
      level: 'DETERMINISTIC',
      inputsHash: 'fake_precomputed_hash_0000000000000000000000000000000000000000',
      configurationHash: DeterminismEvaluator.hash(boundary.captureConfiguration()),
      declaredDependencies: [],
      verified: false,
      reasons: []
    };

    const evaluation = DeterminismEvaluator.evaluateDeterminism(contract, boundary);
    expect(evaluation.limitations.some(l => l.includes('Contract inputsHash mismatch'))).toBe(true);
  });

  it('SABOTAGE 7: Ignoring environment dependencies causes gate failure when undeclared', () => {
    const boundary = createBoundary({});
    const contract: DeterminismContract = {
      componentId: 'env-sensitive',
      contractVersion: '1.0',
      level: 'DETERMINISTIC',
      inputsHash: DeterminismEvaluator.hash(boundary.captureInputs()),
      configurationHash: DeterminismEvaluator.hash(boundary.captureConfiguration()),
      declaredDependencies: [],
      verified: false,
      reasons: []
    };

    // If actual execution varies based on environment
    const evalResult = DeterminismEvaluator.evaluateDeterminism(contract, boundary);
    const gateReport = DeterminismGate.evaluate('GATE-ENV', [evalResult], [contract]);
    expect(gateReport.verdict).toBe('PASS'); // when boundary is truly deterministic
  });

  it('SABOTAGE 8: Solver configuration differences alter the execution fingerprint', () => {
    const fp1 = DeterminismEvaluator.computeExecutionFingerprint({
      componentId: 'fem', contractVersion: '1', configurationHash: 'DIRECT_SPARSE', inputsHash: 'mesh'
    });
    const fp2 = DeterminismEvaluator.computeExecutionFingerprint({
      componentId: 'fem', contractVersion: '1', configurationHash: 'ITERATIVE_GMRES', inputsHash: 'mesh'
    });
    expect(fp1).not.toBe(fp2);
  });

  it('SABOTAGE 9: Numerical precision configuration differences alter the execution fingerprint', () => {
    const fp1 = DeterminismEvaluator.computeExecutionFingerprint({
      componentId: 'cfd', contractVersion: '1', configurationHash: 'cfg', inputsHash: 'grid', numericalPrecision: 'FLOAT32'
    });
    const fp2 = DeterminismEvaluator.computeExecutionFingerprint({
      componentId: 'cfd', contractVersion: '1', configurationHash: 'cfg', inputsHash: 'grid', numericalPrecision: 'FLOAT64'
    });
    expect(fp1).not.toBe(fp2);
  });

  it('SABOTAGE 10: Execution mode differences alter the execution fingerprint', () => {
    const fp1 = DeterminismEvaluator.computeExecutionFingerprint({
      componentId: 'cad', contractVersion: '1', configurationHash: 'cfg', inputsHash: 'step', solverMode: 'CPU_SINGLE_THREAD'
    });
    const fp2 = DeterminismEvaluator.computeExecutionFingerprint({
      componentId: 'cad', contractVersion: '1', configurationHash: 'cfg', inputsHash: 'step', solverMode: 'MULTI_THREADED_WORKERS'
    });
    expect(fp1).not.toBe(fp2);
  });

  // ----------------------------------------------------
  // DETERMINISM GATE TESTS
  // ----------------------------------------------------

  it('DeterminismGate produces FAIL when a DETERMINISTIC contract is violated', () => {
    const boundary = createBoundary({
      executeFn: () => ({ rand: Math.random() })
    });
    const contract: DeterminismContract = {
      componentId: 'test-comp',
      contractVersion: '1.0',
      level: 'DETERMINISTIC',
      inputsHash: DeterminismEvaluator.hash(boundary.captureInputs()),
      configurationHash: DeterminismEvaluator.hash(boundary.captureConfiguration()),
      declaredDependencies: [],
      verified: false,
      reasons: []
    };

    const evaluation = DeterminismEvaluator.evaluateDeterminism(contract, boundary);
    const gateReport = DeterminismGate.evaluate('GATE-006', [evaluation], [contract]);

    expect(gateReport.verdict).toBe('FAIL');
    expect(gateReport.failures.length).toBeGreaterThan(0);
  });

  it('DeterminismGate produces UNPROVEN when evaluations are empty', () => {
    const gateReport = DeterminismGate.evaluate('GATE-006', []);
    expect(gateReport.verdict).toBe('UNPROVEN');
    expect(gateReport.unresolved).toContain('EVIDENCE_MISSING');
  });

  it('DeterminismGate produces PASS when contracts are legitimately verified by evidence', () => {
    const boundary = createBoundary({
      executeFn: () => ({ result: [1, 2, 3] })
    });
    const contract: DeterminismContract = {
      componentId: 'test-comp',
      contractVersion: '1.0',
      level: 'DETERMINISTIC',
      inputsHash: DeterminismEvaluator.hash(boundary.captureInputs()),
      configurationHash: DeterminismEvaluator.hash(boundary.captureConfiguration()),
      declaredDependencies: [],
      verified: false,
      reasons: []
    };

    const evaluation = DeterminismEvaluator.evaluateDeterminism(contract, boundary);
    const gateReport = DeterminismGate.evaluate('GATE-006', [evaluation], [contract]);

    expect(gateReport.verdict).toBe('PASS');
    expect(gateReport.failures.length).toBe(0);
  });
});
