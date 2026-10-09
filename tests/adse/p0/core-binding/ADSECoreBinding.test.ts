import { describe, it, expect } from 'vitest';
import { runADSERepresentativePath } from '../../../../src/engine/adse/p0/ADSERepresentativePath';

describe('ADSE-P0 Core Binding Suite', () => {
  it('executes the full representative path binding ADSE capabilities to SECP Core', async () => {
    const result = await runADSERepresentativePath();
    expect(result.success).toBe(true);
    expect(result.envelope).toBeDefined();
    expect(result.evidenceLeafHash).toBeDefined();
    expect(result.gateResultsSummary.DECLARE).toBe(true);
    expect(result.gateResultsSummary.EXECUTE).toBe(true);
    expect(result.gateResultsSummary.CORE_BIND).toBe(true);
    expect(result.gateResultsSummary.CANONICAL_BIND).toBe(true);
    expect(result.gateResultsSummary.VERIFY).toBe(true);
    expect(result.gateResultsSummary.EVIDENCE).toBe(true);
    expect(result.gateResultsSummary.PERSIST).toBe(true);
    expect(result.gateResultsSummary.BENCHMARK).toBe(true);
    expect(result.gateResultsSummary.PUBLISH).toBe(true);
  });
});
