/**
 * SECP Industrial OS — Forensic Closure Verification Battery
 * PATCH-256 (3-Axis CAM Toolpath Verification)
 * PATCH-259 (Deterministic Collision Evidence & Provenance)
 * PATCH-302 (WebAssembly Compute Planner & Multi-Domain Benchmarks)
 */

import { describe, it, expect } from 'vitest';
import { HardAcceptanceGate256 } from '../../../engine/cam/toolpath/HardAcceptanceGate256';
import { HardAcceptanceGate259 } from '../../../engine/cam/collision/HardAcceptanceGate259';
import { HardAcceptanceGate302 } from '../../../engine/engineering_wasm/HardAcceptanceGate302';
import { CollisionDetectionEngine } from '../../../engine/cam/collision/CollisionDetectionEngine';
import { CollisionEvidenceGenerator } from '../../../engine/cam/collision/CollisionEvidenceGenerator';
import { WasmComputePlanner } from '../../../engine/engineering_wasm/WasmComputePlanner';

describe('PATCH-256: 3-Axis CAM Engine & Acceptance Gate 256', () => {
  it('executes all 31 reference verification tests without failure', () => {
    const report = HardAcceptanceGate256.runVerificationBattery();
    expect(report.gateId).toBe('HARD_ACCEPTANCE_GATE_256');
    expect(report.totalTests).toBe(31);
    expect(report.passedTests).toBe(31);
    expect(report.failedTests).toBe(0);
    expect(report.gatePassed).toBe(true);
    expect(report.overallScore).toBe(100);
    expect(report.capabilityStatus).toBe('CAPABILITY_PROVEN');
    expect(report.masterHash).toMatch(/^0xGATE256_[A-F0-9]{16}$/);
  });

  it('produces deterministic output across multiple runs', () => {
    const r1 = HardAcceptanceGate256.runVerificationBattery();
    const r2 = HardAcceptanceGate256.runVerificationBattery();
    expect(r1.masterHash).toBe(r2.masterHash);
    expect(r1.passedTests).toBe(r2.passedTests);
  });
});

describe('PATCH-259: Collision Detection Engine & Evidence Chain', () => {
  it('executes all 36 collision acceptance tests in Gate 259', () => {
    const summary = HardAcceptanceGate259.runAllTests();
    expect(summary.gateId).toBe('HARD_ACCEPTANCE_GATE_259_COLLISION');
    expect(summary.totalTests).toBe(36);
    expect(summary.passedCount).toBe(36);
    expect(summary.failedCount).toBe(0);
    expect(summary.allPassed).toBe(true);
    expect(summary.passRatio).toBe(1.0);
  });

  it('generates cryptographic SHA-256 signed evidence without random entropy', () => {
    const catalog = CollisionDetectionEngine.getBenchmarkCatalog();
    const bmA = catalog.find(b => b.id === 'BENCHMARK_A')!;
    const bmB = catalog.find(b => b.id === 'BENCHMARK_B')!;
    const trisA = CollisionDetectionEngine.createSampleObstacleTriangles(bmA.id);
    const trisB = CollisionDetectionEngine.createSampleObstacleTriangles(bmB.id);

    const resA1 = CollisionDetectionEngine.verifyToolpath('JOB_A', 'SETUP_1', bmA.name, bmA.toolpathNodes, bmA.tool, bmA.holder, undefined, trisA, bmA.fixture);
    const resA2 = CollisionDetectionEngine.verifyToolpath('JOB_A', 'SETUP_1', bmA.name, bmA.toolpathNodes, bmA.tool, bmA.holder, undefined, trisA, bmA.fixture);
    const resB = CollisionDetectionEngine.verifyToolpath('JOB_B', 'SETUP_1', bmB.name, bmB.toolpathNodes, bmB.tool, bmB.holder, undefined, trisB, bmB.fixture);

    // 1. Evidence format & validity
    expect(resA1.evidence.provenanceSignature).toMatch(/^sha256_[a-f0-9]{64}$/);
    expect(resA1.evidence.evidenceId).toMatch(/^EVID-COL-JOB_A-[A-F0-9]{16}$/);
    expect(resA1.evidence.gatePassed).toBe(true);
    expect(resA1.report.overallState).toBe('CLEAR');

    // 2. Determinism: identical input produces identical signature
    expect(resA1.evidence.provenanceSignature).toBe(resA2.evidence.provenanceSignature);
    expect(resA1.evidence.evidenceId).toBe(resA2.evidence.evidenceId);

    // 3. Causality: different engineering results produce different signatures
    expect(resB.evidence.gatePassed).toBe(false);
    expect(resB.report.overallState).toBe('COLLISION');
    expect(resB.evidence.provenanceSignature).not.toBe(resA1.evidence.provenanceSignature);
  });
});

describe('PATCH-302: WebAssembly Compute Planner & Gate 302', () => {
  it('executes full cross-domain benchmark measuring real speedup and tolerances', async () => {
    const planner = new WasmComputePlanner();
    const benchmarks = await planner.runFullDomainBenchmark(1000);

    expect(benchmarks.length).toBeGreaterThanOrEqual(6);
    for (const bm of benchmarks) {
      expect(bm.speedup).toBeGreaterThan(0);
      expect(bm.isCorrect).toBe(true);
      expect(bm.numericalError).toBeLessThanOrEqual(bm.tolerance);
      expect(bm.wasmDurationMs).toBeGreaterThan(0);
      expect(bm.jsDurationMs).toBeGreaterThan(0);
    }
  });

  it('passes all 60 assertions of Hard Acceptance Gate 302', async () => {
    const report = await HardAcceptanceGate302.executeBattery();
    expect(report.gateId).toBe('GATE-302-WASM-NATIVE');
    expect(report.totalAssertions).toBe(60);
    expect(report.passedAssertions).toBe(60);
    expect(report.allPassed).toBe(true);
    expect(report.statusSeparation.productionReadiness).toBe('PROVEN');
  });
});
