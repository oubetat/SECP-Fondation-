import { describe, it, expect } from 'vitest';
import { HardAcceptanceGate143 } from '../HardAcceptanceGate143';

describe('WebGPU Compute Engine (GATE-143)', () => {
  it('passes all 10 qualification and capability checks in HardAcceptanceGate143', async () => {
    const results = await HardAcceptanceGate143.runAllTests();
    expect(results.length).toBe(10);
    for (const r of results) {
      expect(r.passed).toBe(true);
    }
  });

  it('validates deterministic reduction and fallback provenance', async () => {
    const results = await HardAcceptanceGate143.runAllTests();
    const reduction = results.find(r => r.gateId.includes('DETERMINISTIC'));
    expect(reduction?.passed).toBe(true);

    const fallback = results.find(r => r.gateId.includes('FALLBACK'));
    expect(fallback?.passed).toBe(true);
  });
});
