import { describe, test, expect } from 'vitest';
import { HpcAdversarialVerifier } from '../../verification/HpcAdversarialVerifier';

export async function runAdversarialTests(): Promise<{ name: string; passed: boolean; details: string }[]> {
  return HpcAdversarialVerifier.runAdversarialTests();
}

describe('SECP085 HPC Fault-Injection & Rejection Safety Test Suite', () => {
  test('All adversarial tests pass', async () => {
    const results = await runAdversarialTests();
    for (const r of results) {
      expect(r.passed).toBe(true);
    }
  });
});
