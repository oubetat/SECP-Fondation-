import { describe, it, expect } from 'vitest';
import { IGESFidelityEngine } from '../IGESFidelityEngine';
import { HardAcceptanceGateIGESFidelity } from '../verification/HardAcceptanceGateIGESFidelity';
import * as fs from 'fs';
import * as path from 'path';

describe('IGES Fidelity (PATCH-037)', () => {
  const getFixture = (name: string) => {
    return fs.readFileSync(path.join(process.cwd(), `src/engine/interop/iges-fidelity/__fixtures__/${name}`), 'utf8');
  };

  it('evaluates a valid IGES file correctly', () => {
    const validIgs = getFixture('valid.igs');
    const result = IGESFidelityEngine.evaluate(validIgs);

    expect(result.verdict).toBe('PASS');
    expect(result.entities.unsupported).toBe(0);
    expect(result.geometry.checked).toBe(true);
    expect(result.geometry.failed).toBe(0);

    const gate = HardAcceptanceGateIGESFidelity.evaluate(result);
    expect(gate.passed).toBe(true);
  });

  it('detects unsupported entities (e.g. NURBS surface 128) and fails topology', () => {
    const unsupportedIgs = getFixture('unsupported.igs');
    const result = IGESFidelityEngine.evaluate(unsupportedIgs);

    expect(result.verdict).toBe('FAIL'); // FAILS due to topology loss CRITICAL
    expect(result.issues.some(i => i.code === 'IGES-TOPOLOGY-LOSS')).toBe(true);

    const gate = HardAcceptanceGateIGESFidelity.evaluate(result);
    expect(gate.passed).toBe(false);
  });

  it('detects precision loss in coordinate geometry', () => {
    const precisionIgs = getFixture('precision.igs');
    const result = IGESFidelityEngine.evaluate(precisionIgs);

    expect(result.verdict).toBe('FAIL');
    expect(result.issues.some(i => i.code === 'IGES-PRECISION-LOSS')).toBe(true);
    
    const gate = HardAcceptanceGateIGESFidelity.evaluate(result);
    expect(gate.passed).toBe(false);
  });

  it('detects transformation loss in rotated geometry', () => {
    const rotatedIgs = getFixture('rotated.igs');
    const result = IGESFidelityEngine.evaluate(rotatedIgs);

    expect(result.verdict).toBe('FAIL');
    expect(result.issues.some(i => i.code === 'IGES-TRANSFORMATION-LOSS')).toBe(true);

    const gate = HardAcceptanceGateIGESFidelity.evaluate(result);
    expect(gate.passed).toBe(false);
  });

  it('handles invalid format gracefully', () => {
    const result = IGESFidelityEngine.evaluate('TRUNCATED');
    expect(result.verdict).toBe('INVALID');
    
    const gate = HardAcceptanceGateIGESFidelity.evaluate(result);
    expect(gate.passed).toBe(false);
  });
  
  it('is deterministic', () => {
    const validIgs = getFixture('valid.igs');
    const r1 = IGESFidelityEngine.evaluate(validIgs);
    const r2 = IGESFidelityEngine.evaluate(validIgs);
    
    expect(r1.inputHash).toBe(r2.inputHash);
    expect(r1.verdict).toBe(r2.verdict);
  });
});
