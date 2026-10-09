import { describe, test, expect } from 'vitest';
import { WasmIntegrityVerifier } from '../../verification/WasmIntegrityVerifier';

export function runWasmIntegrityTests(): { name: string; passed: boolean; details: string }[] {
  return WasmIntegrityVerifier.runWasmIntegrityTests();
}

describe('SECP085 Wasm Integrity Test Suite', () => {
  const results = runWasmIntegrityTests();
  for (const r of results) {
    test(r.name, () => {
      expect(r.passed).toBe(true);
    });
  }
});
