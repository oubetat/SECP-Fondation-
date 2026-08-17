/**
 * PATCH-SECP-085: Cross-Runtime Numerical Equivalence Test Suite
 *
 * Verifies exact mathematical equivalence between TypeScript reference implementations
 * and WebAssembly production kernels across FEA, CFD, 5-Axis CAM, and NURBS Class-A surfacing.
 */

import { describe, test, expect } from 'vitest';
import { HpcEngineBroker } from '../HpcEngineBroker';

export function runCrossRuntimeTests(): { name: string; passed: boolean; details: string }[] {
  const results: { name: string; passed: boolean; details: string }[] = [];

  try {
    const auditReports = HpcEngineBroker.runCrossRuntimeEquivalenceAudit();

    for (const report of auditReports) {
      results.push({
        name: `Cross-Runtime Equivalence: ${report.kernelName}`,
        passed: report.isNumericallyEquivalent,
        details: report.isNumericallyEquivalent
          ? `Numerically Equivalent (Max Diff: ${report.maxAbsoluteDifference.toExponential(4)}, Tol: ${report.tolerance})`
          : `Numerical Mismatch! Max Diff: ${report.maxAbsoluteDifference}`
      });
    }
  } catch (err: any) {
    results.push({ name: 'Cross-Runtime Equivalence Audit', passed: false, details: err.message });
  }

  return results;
}

describe('SECP085 Cross-Runtime Equivalence Test Suite', () => {
  const results = runCrossRuntimeTests();
  for (const r of results) {
    test(r.name, () => {
      expect(r.passed).toBe(true);
    });
  }
});
