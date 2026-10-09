import { describe, it, expect } from 'vitest';
import { EvidenceIntegrityEngine } from '../../engine/evidence/integrity/EvidenceIntegrityEngine';

describe('P6-004 — Deterministic Canonicalization', () => {
  it('P6-004-A — Object insertion order invariance', () => {
    const obj1 = { a: 1, c: 3, b: 2 };
    const obj2 = { c: 3, a: 1, b: 2 };
    
    expect(EvidenceIntegrityEngine.canonicalize(obj1)).toBe(EvidenceIntegrityEngine.canonicalize(obj2));
  });

  it('P6-004-B — Float stabilization and -0 normalization', () => {
    const val1 = { floatVal: 3.1415926535 };
    const val2 = { floatVal: 3.14159265 };
    const negZero = { zero: -0 };
    const posZero = { zero: 0 };
    
    expect(EvidenceIntegrityEngine.canonicalize(val1)).toBe(EvidenceIntegrityEngine.canonicalize(val2));
    expect(EvidenceIntegrityEngine.canonicalize(negZero)).toBe(EvidenceIntegrityEngine.canonicalize(posZero));
    expect(EvidenceIntegrityEngine.canonicalize(negZero)).toBe('{"zero":0}');
  });

  it('P6-004-C — NaN and Infinity rejection', () => {
    expect(() => EvidenceIntegrityEngine.canonicalize({ val: NaN })).toThrow();
    expect(() => EvidenceIntegrityEngine.canonicalize({ val: Infinity })).toThrow();
    expect(() => EvidenceIntegrityEngine.canonicalize({ val: -Infinity })).toThrow();
  });
});
