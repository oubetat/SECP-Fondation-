/**
 * PATCH-178: Materials Benchmark Battery & Gate 178 Vitest Test Suite
 *
 * Validates all 16 material benchmark cases, truth rules, anti-fabrication audits,
 * and Gate 178 attestation signature generation.
 */

import { describe, expect, it } from 'vitest';
import { MaterialsBenchmarkSuiteOrchestrator } from '../index';
import { MaterialsReferenceSolutions } from '../MaterialsReferenceSolutions';
import { MaterialsBenchmarkCaseRunner } from '../MaterialsBenchmarkCase';
import { MaterialsAntiFabricationAuditor } from '../MaterialsAntiFabricationAuditor';

describe('PATCH-178: Materials Benchmark Battery & Gate 178', () => {
  describe('1. Reference Solutions Accuracy', () => {
    it('calculates analytical elastic constants matching Hooke Law equations', () => {
      const ref = MaterialsReferenceSolutions.calculateElasticConstants(200e9, 0.3);
      expect(ref.shearModulusPa).toBeCloseTo(76.923e9, -6);
      expect(ref.bulkModulusPa).toBeCloseTo(166.667e9, -6);
    });

    it('calculates 1D uniaxial tension closed-form displacement correctly', () => {
      const ref = MaterialsReferenceSolutions.calculateUniaxialElastic(100000, 2.0, 0.01, 200e9);
      expect(ref.stressPa).toBe(10000000);
      expect(ref.strain).toBe(0.00005);
      expect(ref.displacementM).toBe(0.0001);
    });
  });

  describe('2. Individual Benchmark Case Execution', () => {
    it('executes Case 01 Elastic Consistency with PASS verdict', () => {
      const res = MaterialsBenchmarkCaseRunner.runCase01();
      expect(res.caseId).toBe('BENCH-MAT-01');
      expect(res.verdict).toBe('PASS');
      expect(res.metrics.relativeErrorPercent).toBeLessThanOrEqual(0.001);
    });

    it('executes Case 02 Uniaxial Elastic Response with PASS verdict', () => {
      const res = MaterialsBenchmarkCaseRunner.runCase02();
      expect(res.caseId).toBe('BENCH-MAT-02');
      expect(res.verdict).toBe('PASS');
      expect(res.metrics.relativeErrorPercent).toBeLessThanOrEqual(0.01);
    });

    it('executes Case 03 Poisson Response with PASS verdict', () => {
      const res = MaterialsBenchmarkCaseRunner.runCase03();
      expect(res.caseId).toBe('BENCH-MAT-03');
      expect(res.verdict).toBe('PASS');
      expect(res.metrics.relativeErrorPercent).toBeLessThanOrEqual(0.01);
    });

    it('executes Case 06 Unit System Consistency with PASS verdict', () => {
      const res = MaterialsBenchmarkCaseRunner.runCase06();
      expect(res.caseId).toBe('BENCH-MAT-06');
      expect(res.verdict).toBe('PASS');
      expect(res.metrics.absoluteError).toBeLessThanOrEqual(1e-12);
    });

    it('executes Case 10 Plasticity Response with PASS verdict', () => {
      const res = MaterialsBenchmarkCaseRunner.runCase10();
      expect(res.caseId).toBe('BENCH-MAT-10');
      expect(res.verdict).toBe('PASS');
      expect(res.metrics.relativeErrorPercent).toBeLessThanOrEqual(0.1);
    });

    it('executes Case 15 Extreme Invalid Input Rejection with PASS verdict', () => {
      const res = MaterialsBenchmarkCaseRunner.runCase15();
      expect(res.caseId).toBe('BENCH-MAT-15');
      expect(res.verdict).toBe('PASS');
    });
  });

  describe('3. Anti-Fabrication & Truth Audit', () => {
    it('detects static or mocked evidence hash violations', () => {
      const mockResult: any = [
        {
          caseId: 'BENCH-MAT-01',
          evidenceHash: 'STATIC_HASH',
          evidencePacket: { materialId: 'M1', materialProperties: {} },
          metrics: { measuredValue: 1.0 },
          verdict: 'PASS'
        }
      ];

      const audit = MaterialsAntiFabricationAuditor.auditSuite(mockResult);
      expect(audit.passed).toBe(false);
      expect(audit.violationsCount).toBeGreaterThan(0);
    });
  });

  describe('4. Full Suite & Gate 178 Evaluation', () => {
    it('evaluates Gate 178 and produces score 100 with valid attestation signature', () => {
      const report = MaterialsBenchmarkSuiteOrchestrator.executeAndReport();

      expect(report.caseResults.length).toBe(16);
      expect(report.gateResult.passed).toBe(true);
      expect(report.gateResult.score).toBe(100);
      expect(report.gateResult.attestationSignature).toMatch(/^ATTEST-GATE178-/);
      expect(report.finalVerdict).toBe('PASS');
      expect(report.evidenceLedgerId).toBeDefined();
    });
  });
});
