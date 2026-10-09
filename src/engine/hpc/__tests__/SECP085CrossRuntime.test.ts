import { describe, test, expect } from 'vitest';
import { CrossRuntimeVerifier } from '../../verification/CrossRuntimeVerifier';

export function runCrossRuntimeTests(): { name: string; passed: boolean; details: string }[] {
  return CrossRuntimeVerifier.runCrossRuntimeTests();
}

describe('SECP085 Cross-Runtime Math Equivalence Test Suite', () => {
  const results = runCrossRuntimeTests();
  for (const r of results) {
    test(r.name, () => {
      expect(r.passed).toBe(true);
    });
  }
});
