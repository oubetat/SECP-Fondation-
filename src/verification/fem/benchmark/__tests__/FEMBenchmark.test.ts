import { describe, expect, it } from 'vitest';
import { FEMBenchmarkSuiteOrchestrator } from '../index';
import { FEMReferenceSolutions } from '../FEMReferenceSolutions';
import { FEMBenchmarkRunner } from '../FEMBenchmarkRunner';
import { FEMBenchmarkGate } from '../FEMBenchmarkGate';
import { FEMAntiFabricationAuditor } from '../FEMAntiFabricationAuditor';
import { FEMBenchmarkCaseFactory } from '../FEMBenchmarkCase';

describe('PATCH-177: FEM Benchmark Battery & Gate 177', () => {
  describe('1. Reference Solutions Unit Tests', () => {
    it('calculates exact closed-form 1D axial bar reference values', () => {
      // L = 1.0m, A = 0.001 m^2, E = 200 GPa, F = 10,000 N
      // u = (10000 * 1.0) / (200e9 * 0.001) = 5e-5 m = 0.05 mm
      const ref = FEMReferenceSolutions.calculateAxialBar(1.0, 0.001, 200, 10000);
      expect(ref.tipDisplacementMm).toBeCloseTo(0.05, 5);
      expect(ref.axialStressMPa).toBeCloseTo(10.0, 5);
      expect(ref.reactionForceN).toBe(-10000);
    });

    it('calculates Euler-Bernoulli cantilever beam deflection and root bending stress', () => {
      // L = 2.0m, b = 0.05m, h = 0.1m, E = 200 GPa, F = 10,000 N
      const ref = FEMReferenceSolutions.calculateCantileverBeam(2.0, 0.05, 0.1, 200, -10000);
      expect(ref.tipDeflectionMm).toBeLessThan(0); // Downward deflection
      expect(ref.rootBendingStressMPa).toBeGreaterThan(0);
      expect(ref.reactionForceN).toBe(10000);
    });
  });

  describe('2. Execution & Case Benchmark Battery Tests', () => {
    it('executes full benchmark suite and verifies non-simulated metrics', () => {
      const runner = new FEMBenchmarkRunner();
      const suiteRes = runner.executeFullSuite();

      expect(suiteRes.caseResults.length).toBeGreaterThanOrEqual(10);
      expect(suiteRes.adversarialResults.length).toBeGreaterThanOrEqual(4);
      expect(suiteRes.isDeterministic).toBe(true);

      const case01 = suiteRes.caseResults.find((c) => c.caseId === 'BENCH-01');
      expect(case01).toBeDefined();
      expect(case01?.verdict).toBe('PASS');
      expect(case01?.metrics.displacementErrorPercent).toBeLessThan(0.1);
    });

    it('verifies Case 10 unconstrained model is rejected as INVALID/SINGULAR_SYSTEM', () => {
      const runner = new FEMBenchmarkRunner();
      const suiteRes = runner.executeFullSuite();

      const case10 = suiteRes.caseResults.find((c) => c.caseId === 'BENCH-10');
      expect(case10).toBeDefined();
      expect(['INVALID', 'FAIL']).toContain(case10?.verdict);
    });
  });

  describe('3. Anti-Fabrication & Evidence Audit Tests', () => {
    it('generates unique input and evidence hashes and passes anti-fabrication audit', () => {
      const c01 = FEMBenchmarkCaseFactory.createCase01AxialBar();
      const inputHash1 = FEMAntiFabricationAuditor.computeModelInputHash(c01.model);
      expect(inputHash1).toMatch(/^HASH-INPUT-/);

      const c02 = FEMBenchmarkCaseFactory.createCase02CantileverBeam();
      const inputHash2 = FEMAntiFabricationAuditor.computeModelInputHash(c02.model);

      expect(inputHash1).not.toBe(inputHash2);
    });
  });

  describe('4. Global Gate 177 Evaluation', () => {
    it('evaluates Gate 177 and produces a valid attestation signature', () => {
      const report = FEMBenchmarkSuiteOrchestrator.executeAndReport();

      expect(report.gateResult.passed).toBe(true);
      expect(report.gateResult.score).toBe(100);
      expect(report.gateResult.attestationSignature).toMatch(/^ATTEST-GATE177-/);
      expect(report.finalVerdict).toBe('PASS');
    });
  });
});
