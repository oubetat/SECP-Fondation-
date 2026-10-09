import { describe, it, expect } from 'vitest';
import { JTFidelityEngine } from '../JTFidelityEngine';
import { HardAcceptanceGateJTFidelity } from '../../../validation/HardAcceptanceGateJTFidelity';
import * as fs from 'fs';
import * as path from 'path';

describe('JT Fidelity Engine (PATCH-038)', () => {

  const getFixture = (name: string) => {
    return fs.readFileSync(path.join(process.cwd(), `src/engine/interop/jt-fidelity/__fixtures__/${name}`));
  };

  it('evaluates a valid JT file correctly (PASS)', () => {
    const validJt = getFixture('valid.jt');
    const result = JTFidelityEngine.evaluate(validJt);

    expect(result.verdict).toBe('PASS');
    expect(result.issues.length).toBe(0);
    expect(result.geometry.checked).toBe(true);
    expect(result.geometry.passed).toBe(1);

    const gate = HardAcceptanceGateJTFidelity.evaluate(result);
    expect(gate.passed).toBe(true);
  });

  it('detects structure violations like duplicate IDs (FAIL)', () => {
    const duplicateJt = getFixture('duplicate.jt');
    const result = JTFidelityEngine.evaluate(duplicateJt);

    expect(result.verdict).toBe('FAIL');
    expect(result.issues.some(i => i.code === 'JT-DUPLICATE-ID')).toBe(true);

    const gate = HardAcceptanceGateJTFidelity.evaluate(result);
    expect(gate.passed).toBe(false);
  });

  it('detects unsupported entities and marks as UNPROVEN', () => {
    const unsupportedJt = getFixture('unsupported.jt');
    const result = JTFidelityEngine.evaluate(unsupportedJt);

    expect(result.verdict).toBe('UNPROVEN');
    expect(result.issues.some(i => i.code === 'JT-UNSUPPORTED-ENTITIES')).toBe(true);

    const gate = HardAcceptanceGateJTFidelity.evaluate(result);
    expect(gate.passed).toBe(false);
    expect(gate.verdict).toBe('UNPROVEN');
  });

  it('detects tessellation deviation out of tolerance (FAIL)', () => {
    const devJt = getFixture('tessellation_deviation.jt');
    const result = JTFidelityEngine.evaluate(devJt);

    expect(result.verdict).toBe('FAIL');
    expect(result.issues.some(i => i.code === 'JT-TESSELLATION-DEVIATION')).toBe(true);
  });

  it('detects corrupted or missing headers (INVALID)', () => {
    const corruptedJt = getFixture('corrupted.jt');
    const result = JTFidelityEngine.evaluate(corruptedJt);

    expect(result.verdict).toBe('INVALID');
    expect(result.issues.some(i => i.code === 'JT-INVALID-FORMAT')).toBe(true);

    const gate = HardAcceptanceGateJTFidelity.evaluate(result);
    expect(gate.passed).toBe(false);
    expect(gate.verdict).toBe('INVALID');
  });

  it('detects tampered outputs (FAIL)', () => {
    const tamperedJt = getFixture('tampered.jt');
    const result = JTFidelityEngine.evaluate(tamperedJt);

    expect(result.verdict).toBe('FAIL');
    expect(result.issues.some(i => i.code === 'JT-TAMPERED-OUTPUT')).toBe(true);
  });

  it('is deterministic when parsing identical inputs', () => {
    const validJt = getFixture('valid.jt');
    const r1 = JTFidelityEngine.evaluate(validJt);
    const r2 = JTFidelityEngine.evaluate(validJt);
    
    expect(r1.inputHash).toBe(r2.inputHash);
    expect(r1.verdict).toBe(r2.verdict);
    expect(r1.evidence.inputHash).toBe(r2.evidence.inputHash);
  });
});
