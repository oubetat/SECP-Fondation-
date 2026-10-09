import { describe, it, expect } from 'vitest';
import { CanonicalSerializer } from '../CanonicalSerializer';
import { CanonicalSerializationGate } from '../CanonicalSerializationGate';
import {
  CircularReferenceError,
  NonFiniteNumberError,
  UnsupportedTypeError,
  PrototypePollutionAttemptError
} from '../CanonicalSerializationErrors';

describe('PATCH-009 — CanonicalSerialization Adversarial & Stress Suite', () => {
  // A. Same object, different insertion order
  it('ADVERSARIAL A: Object insertion order invariance across permutations', () => {
    const o1 = { c: 3, b: 2, a: 1 };
    const o2 = { a: 1, c: 3, b: 2 };
    const o3 = { b: 2, a: 1, c: 3 };

    const r1 = CanonicalSerializer.serialize(o1);
    const r2 = CanonicalSerializer.serialize(o2);
    const r3 = CanonicalSerializer.serialize(o3);

    expect(r1.canonicalString).toBe(r2.canonicalString);
    expect(r2.canonicalString).toBe(r3.canonicalString);
    expect(r1.canonicalString).toBe('{"a":1,"b":2,"c":3}');
  });

  // B. Deep nested objects with reversed keys
  it('ADVERSARIAL B: Deep nested objects with reversed keys produce identical outputs', () => {
    const d1 = {
      layer1: {
        z: { k2: 'v2', k1: 'v1' },
        a: { m2: 2, m1: 1 }
      }
    };
    const d2 = {
      layer1: {
        a: { m1: 1, m2: 2 },
        z: { k1: 'v1', k2: 'v2' }
      }
    };
    expect(CanonicalSerializer.serialize(d1).canonicalString).toBe(
      CanonicalSerializer.serialize(d2).canonicalString
    );
  });

  // C. Unicode composed/decomposed strings
  it('ADVERSARIAL C: Unicode composed and decomposed representations match canonically', () => {
    const angstrom1 = '\u212B'; // Angstrom sign
    const angstrom2 = '\u0041\u030A'; // A with ring above
    const res1 = CanonicalSerializer.serialize({ unit: angstrom1 });
    const res2 = CanonicalSerializer.serialize({ unit: angstrom2 });
    expect(res1.canonicalString).toBe(res2.canonicalString);
  });

  // D. Prototype pollution attempts
  it('ADVERSARIAL D: Rejects prototype pollution attempts via dangerous keys', () => {
    const maliciousObj = Object.create(null);
    maliciousObj['__proto__'] = { admin: true };

    expect(() => {
      CanonicalSerializer.serialize(maliciousObj);
    }).toThrow(PrototypePollutionAttemptError);
  });

  // E. __proto__ property
  it('ADVERSARIAL E: Explicit __proto__ property blocked', () => {
    const raw: any = {};
    Object.defineProperty(raw, '__proto__', {
      value: { exploited: true },
      enumerable: true
    });
    expect(() => {
      CanonicalSerializer.serialize(raw);
    }).toThrow(PrototypePollutionAttemptError);
  });

  // F. constructor property
  it('ADVERSARIAL F: constructor property as key blocked for safety', () => {
    const raw = { constructor: 'fake' };
    expect(() => {
      CanonicalSerializer.serialize(raw);
    }).toThrow(PrototypePollutionAttemptError);
  });

  // G. Circular reference
  it('ADVERSARIAL G: Complex multi-node cyclic graph detected and rejected', () => {
    const a: any = { id: 'A' };
    const b: any = { id: 'B' };
    const c: any = { id: 'C' };
    a.b = b;
    b.c = c;
    c.a = a;

    expect(() => {
      CanonicalSerializer.serialize(a);
    }).toThrow(CircularReferenceError);
  });

  // H. Very deeply nested object (within recursion safety limit)
  it('ADVERSARIAL H: Deeply nested tree (depth 50) serializes deterministically', () => {
    let deep: any = { leaf: 'value' };
    for (let i = 0; i < 50; i++) {
      deep = { [`level_${String(i).padStart(3, '0')}`]: deep };
    }
    const res = CanonicalSerializer.serialize(deep);
    expect(res.canonicalString).toBeDefined();
    expect(res.byteLength).toBeGreaterThan(0);
  });

  // I. NaN
  it('ADVERSARIAL I: NaN is rejected', () => {
    expect(() => CanonicalSerializer.serialize(NaN)).toThrow(NonFiniteNumberError);
  });

  // J. Infinity
  it('ADVERSARIAL J: +Infinity is rejected', () => {
    expect(() => CanonicalSerializer.serialize(Infinity)).toThrow(NonFiniteNumberError);
  });

  // K. -Infinity
  it('ADVERSARIAL K: -Infinity is rejected', () => {
    expect(() => CanonicalSerializer.serialize(-Infinity)).toThrow(NonFiniteNumberError);
  });

  // L. -0
  it('ADVERSARIAL L: -0 is normalized to 0', () => {
    const res = CanonicalSerializer.serialize([-0, 0]);
    expect(res.canonicalString).toBe('[0,0]');
  });

  // M. Huge finite number
  it('ADVERSARIAL M: Huge finite number is preserved deterministically', () => {
    const huge = 1.79e300;
    const res = CanonicalSerializer.serialize({ val: huge });
    expect(res.canonicalString).toBe(`{"val":${huge}}`);
  });

  // N. Tiny finite number
  it('ADVERSARIAL N: Tiny finite number is preserved deterministically', () => {
    const tiny = 1e-15;
    const res = CanonicalSerializer.serialize({ val: tiny });
    expect(res.canonicalString).toBe('{"val":1e-15}');
  });

  // O. BigInt
  it('ADVERSARIAL O: Huge BigInt serialized into typed marker structure', () => {
    const big = BigInt('987654321098765432109876543210');
    const res = CanonicalSerializer.serialize({ big });
    expect(res.canonicalString).toBe('{"big":{"$type":"bigint","$value":"987654321098765432109876543210"}}');
  });

  // P. Function injection
  it('ADVERSARIAL P: Function injection is rejected', () => {
    expect(() => CanonicalSerializer.serialize({ exec: () => 'malicious' })).toThrow(
      UnsupportedTypeError
    );
  });

  // Q. Symbol
  it('ADVERSARIAL Q: Symbol is rejected', () => {
    expect(() => CanonicalSerializer.serialize({ sym: Symbol('id') })).toThrow(
      UnsupportedTypeError
    );
  });

  // R. Array with reordered elements
  it('ADVERSARIAL R: Array with reordered elements produces non-identical outputs', () => {
    const a1 = [1, 2, 3];
    const a2 = [3, 2, 1];
    expect(CanonicalSerializer.serialize(a1).canonicalString).not.toBe(
      CanonicalSerializer.serialize(a2).canonicalString
    );
  });

  // S. Date mutation attempt
  it('ADVERSARIAL S: Date object in input is untouched after serialization', () => {
    const d = new Date('2026-08-18T05:00:00.000Z');
    const timeBefore = d.getTime();
    CanonicalSerializer.serialize({ recordedAt: d });
    expect(d.getTime()).toBe(timeBefore);
  });

  // T. Input mutation detection
  it('ADVERSARIAL T: Deep input object remains untouched after serialization', () => {
    const input = {
      name: 'FEA Mesh',
      elements: [{ id: 1, stress: 240.5 }, { id: 2, stress: 180.2 }],
      flags: { check: true }
    };
    const snap = JSON.stringify(input);
    CanonicalSerializer.serialize(input);
    expect(JSON.stringify(input)).toBe(snap);
  });

  // Gate check
  it('CanonicalSerializationGate evaluates to PASS', () => {
    const gateResult = CanonicalSerializationGate.evaluate();
    expect(gateResult.verdict).toBe('PASS');
    expect(gateResult.checks.every((c) => c.passed)).toBe(true);
  });
});
