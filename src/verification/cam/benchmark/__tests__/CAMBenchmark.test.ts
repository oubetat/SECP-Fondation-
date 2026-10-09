import { describe, it, expect, beforeAll } from 'vitest';
import { CAMBenchmarkRunner } from '../CAMBenchmarkRunner';
import { CAMBenchmarkSuiteReport } from '../types';

describe('PATCH-179: CAM Benchmark Battery & Gate 179', () => {
  let report: CAMBenchmarkSuiteReport;

  beforeAll(async () => {
    report = await CAMBenchmarkRunner.runSuite();
  });

  it('executes Case 01 2.5D Pocket with PASS verdict', () => {
    const res = report.caseResults.find(c => c.caseId === 'BENCH-CAM-01');
    expect(res?.verdict).toBe('PASS');
    expect(res?.metrics.segmentCount).toBeGreaterThan(0);
  });

  it('executes Case 02 Contour Milling with PASS verdict', () => {
    const res = report.caseResults.find(c => c.caseId === 'BENCH-CAM-02');
    expect(res?.verdict).toBe('PASS');
  });

  it('executes Case 03 Facing with PASS verdict', () => {
    const res = report.caseResults.find(c => c.caseId === 'BENCH-CAM-03');
    expect(res?.verdict).toBe('PASS');
  });

  it('returns NOT_SUPPORTED for Case 04 Drilling', () => {
    const res = report.caseResults.find(c => c.caseId === 'BENCH-CAM-04');
    expect(res?.verdict).toBe('NOT_SUPPORTED');
  });

  it('returns PASS for Case 07 Gouge Detection', () => {
    const res = report.caseResults.find(c => c.caseId === 'BENCH-CAM-07');
    expect(res?.verdict).toBe('PASS');
  });

  it('returns PASS for Case 08 Toolpath Continuity', () => {
    const res = report.caseResults.find(c => c.caseId === 'BENCH-CAM-08');
    expect(res?.verdict).toBe('PASS');
  });

  it('returns PASS for Case 15 Toolpath Determinism', () => {
    const res = report.caseResults.find(c => c.caseId === 'BENCH-CAM-15');
    expect(res?.verdict).toBe('PASS');
  });

  it('returns PASS for Case 18 Adversarial CAM Rejection', () => {
    const res = report.caseResults.find(c => c.caseId === 'BENCH-CAM-18');
    expect(res?.verdict).toBe('PASS');
  });

  it('returns PASS for Case 19 CAM CAD Integrity', () => {
    const res = report.caseResults.find(c => c.caseId === 'BENCH-CAM-19');
    expect(res?.verdict).toBe('PASS');
  });

  it('evaluates Gate 179 correctly based on supported features', () => {
    expect(report.gateResult.passed).toBe(true);
    expect(report.gateResult.score).toBe(100);
    expect(report.gateResult.attestationSignature).toMatch(/^ATTEST-GATE179-/);
  });
});
