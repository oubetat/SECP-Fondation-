import { describe, test, expect } from 'vitest';
import { HpcPerformanceVerifier } from '../../verification/HpcPerformanceVerifier';

export function runPerformanceTests(): { name: string; passed: boolean; details: string }[] {
  return HpcPerformanceVerifier.runPerformanceTests();
}

describe('SECP085 HPC Performance and Optimization Test Suite', () => {
  const results = runPerformanceTests();
  for (const r of results) {
    test(r.name, () => {
      expect(r.passed).toBe(true);
    });
  }
});
