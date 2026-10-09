import { describe, it, expect } from 'vitest';
import { AP242ValidationEngine } from '../AP242ValidationEngine';
import { HardAcceptanceGateAP242Validation } from '../HardAcceptanceGateAP242Validation';
import * as fs from 'fs';
import * as path from 'path';

describe('AP242 Validation (PATCH-036)', () => {

  const getFixture = (name: string) => {
    return fs.readFileSync(path.join(process.cwd(), `src/engine/interop/ap242-validation/__fixtures__/${name}`), 'utf8');
  };

  it('validates a correct AP242 file deterministically', () => {
    const validStp = getFixture('valid.stp');
    const result1 = AP242ValidationEngine.validate(validStp);
    const result2 = AP242ValidationEngine.validate(validStp);

    expect(result1.verdict).toBe('PASS');
    expect(result1.valid).toBe(true);
    expect(result1.entityCount).toBe(2);
    expect(result1.issues.length).toBe(0);
    
    // Determinism
    expect(result1.fileHash).toBe(result2.fileHash);
    expect(result1.evidence.inputHash).toBe(result2.evidence.inputHash);
    
    const gate = HardAcceptanceGateAP242Validation.evaluate(result1);
    expect(gate.passed).toBe(true);
  });

  it('fails on dangling references', () => {
    const danglingStp = getFixture('dangling.stp');
    const result = AP242ValidationEngine.validate(danglingStp);

    expect(result.verdict).toBe('FAIL');
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.code === 'AP242-DANGLING-REFERENCE')).toBe(true);
    
    const gate = HardAcceptanceGateAP242Validation.evaluate(result);
    expect(gate.passed).toBe(false);
  });

  it('returns UNPROVEN for unsupported schemas', () => {
    const wrongSchemaStp = getFixture('wrong_schema.stp');
    const result = AP242ValidationEngine.validate(wrongSchemaStp);

    expect(result.verdict).toBe('UNPROVEN');
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.code === 'AP242-UNSUPPORTED-SCHEMA')).toBe(true);
    
    const gate = HardAcceptanceGateAP242Validation.evaluate(result);
    expect(gate.passed).toBe(false);
  });

  it('detects invalid coordinate geometry (NaN)', () => {
    const content = getFixture('valid.stp').replace('(0.0,0.0,0.0)', '(NaN,0.0,0.0)');
    const result = AP242ValidationEngine.validate(content);

    expect(result.verdict).toBe('FAIL');
    expect(result.issues.some(i => i.code === 'AP242-INVALID-GEOMETRY-COORDINATE')).toBe(true);
  });

  it('detects topology mismatch (VERTEX_POINT referencing non-point)', () => {
    // #10 is changed to a direction instead of point, breaking VERTEX_POINT
    const content = getFixture('valid.stp').replace('CARTESIAN_POINT', 'DIRECTION');
    const result = AP242ValidationEngine.validate(content);

    expect(result.verdict).toBe('FAIL');
    expect(result.issues.some(i => i.code === 'AP242-TOPOLOGY-MISMATCH')).toBe(true);
  });
});
