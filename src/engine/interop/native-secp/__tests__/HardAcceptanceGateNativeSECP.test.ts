import { describe, it, expect } from 'vitest';
import { NativeSECPFixtures } from '../__fixtures__/NativeSECPFixtures';
import { HardAcceptanceGateNativeSECP } from '../verification/HardAcceptanceGateNativeSECP';

describe('PATCH-039: Hard Acceptance Gate for Native SECP', () => {

  it('yields PASS for valid native document with verified round-trip and integrity', () => {
    const doc = NativeSECPFixtures.createValidCubeDocument();
    const evaluation = HardAcceptanceGateNativeSECP.evaluate(doc);

    expect(evaluation.passed).toBe(true);
    expect(evaluation.verdict).toBe('PASS');
    expect(evaluation.metrics.schemaValid).toBe(true);
    expect(evaluation.metrics.integrityVerified).toBe(true);
    expect(evaluation.metrics.roundTripPassed).toBe(true);
    expect(evaluation.metrics.criticalCount).toBe(0);
  });

  it('yields FAIL when document integrity is tampered', () => {
    const doc = NativeSECPFixtures.createValidCubeDocument();
    const tampered = {
      ...doc,
      integrity: {
        ...doc.integrity,
        canonicalHash: 'tampered_hash_value_000000000000000000000000000000000000000000000000'
      }
    };

    const evaluation = HardAcceptanceGateNativeSECP.evaluate(tampered);

    expect(evaluation.passed).toBe(false);
    expect(evaluation.verdict).toBe('FAIL');
    expect(evaluation.metrics.integrityVerified).toBe(false);
  });

  it('yields INVALID when format header or container is broken', () => {
    const broken = '{"invalid": "format"}';
    const evaluation = HardAcceptanceGateNativeSECP.evaluate(broken);

    expect(evaluation.passed).toBe(false);
    expect(evaluation.verdict).toBe('INVALID');
    expect(evaluation.metrics.schemaValid).toBe(false);
  });
});
