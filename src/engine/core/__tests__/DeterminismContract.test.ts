import { describe, it, expect } from 'vitest';
import { DeterminismEvaluator } from '../DeterminismEvaluator';
import {
  DeterminismContract,
  DeterminismBoundary,
  DeterminismComparison
} from '../DeterminismContract';

describe('DeterminismContract & Canonicalization Core', () => {
  it('canonicalize sorts object keys alphabetically regardless of insertion order', () => {
    const obj1 = { z: 1, a: 'hello', m: [3, 2, 1] };
    const obj2 = { a: 'hello', m: [3, 2, 1], z: 1 };

    const canon1 = DeterminismEvaluator.canonicalize(obj1);
    const canon2 = DeterminismEvaluator.canonicalize(obj2);

    expect(canon1).toBe(canon2);
    expect(canon1).toBe('{"a":"hello","m":[3,2,1],"z":1}');
  });

  it('canonicalize preserves array order strictly', () => {
    const arr1 = [1, 2, 3];
    const arr2 = [3, 2, 1];

    const canon1 = DeterminismEvaluator.canonicalize(arr1);
    const canon2 = DeterminismEvaluator.canonicalize(arr2);

    expect(canon1).not.toBe(canon2);
    expect(canon1).toBe('[1,2,3]');
    expect(canon2).toBe('[3,2,1]');
  });

  it('canonicalize distinguishes types (null, boolean, number, string, special numbers)', () => {
    expect(DeterminismEvaluator.canonicalize(null)).toBe('null');
    expect(DeterminismEvaluator.canonicalize(undefined)).toBe('__undefined__');
    expect(DeterminismEvaluator.canonicalize(true)).toBe('true');
    expect(DeterminismEvaluator.canonicalize(false)).toBe('false');
    expect(DeterminismEvaluator.canonicalize(123)).toBe('123');
    expect(DeterminismEvaluator.canonicalize('123')).toBe('"123"');
    expect(DeterminismEvaluator.canonicalize(NaN)).toBe('__NUMERIC_SPECIAL__:NaN');
    expect(DeterminismEvaluator.canonicalize(Infinity)).toBe('__NUMERIC_SPECIAL__:Infinity');
    expect(DeterminismEvaluator.canonicalize(-Infinity)).toBe('__NUMERIC_SPECIAL__:-Infinity');
    expect(DeterminismEvaluator.canonicalize(-0)).toBe('-0');
    expect(DeterminismEvaluator.canonicalize(BigInt(999))).toBe('__BIGINT__:999n');
  });

  it('canonicalize detects and rejects cyclic structures', () => {
    const cycle: Record<string, unknown> = { name: 'cycle' };
    cycle.self = cycle;

    expect(() => DeterminismEvaluator.canonicalize(cycle)).toThrow('Cyclic structure detected');
  });

  it('hash computes deterministic SHA-256 string', () => {
    const hash1 = DeterminismEvaluator.hash({ a: 1, b: 2 });
    const hash2 = DeterminismEvaluator.hash({ b: 2, a: 1 });
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('compare distinguishes exact match vs numerical equivalence with tolerance', () => {
    const outputA = { pressure: 101.3250000001, status: 'STABLE' };
    const outputB = { pressure: 101.3250000002, status: 'STABLE' };

    // With zero tolerance
    const strictComp = DeterminismEvaluator.compare(outputA, outputB, 0);
    expect(strictComp.exactMatch).toBe(false);
    expect(strictComp.equivalent).toBe(false);
    expect(strictComp.differences.length).toBeGreaterThan(0);

    // With 1e-6 tolerance
    const tolComp = DeterminismEvaluator.compare(outputA, outputB, 1e-6);
    expect(tolComp.exactMatch).toBe(false);
    expect(tolComp.equivalent).toBe(true);
    expect(tolComp.differences.length).toBe(0);
    expect(tolComp.maxAbsoluteDifference).toBeCloseTo(1e-10, 12);
  });

  it('compare identifies structural and type mismatches accurately', () => {
    const exp = { nodes: [1, 2, 3], metadata: { version: 1 } };
    const act = { nodes: [1, 2], metadata: { version: '1' } };

    const comp = DeterminismEvaluator.compare(exp, act, 0);
    expect(comp.exactMatch).toBe(false);
    expect(comp.equivalent).toBe(false);
    expect(comp.differences.some(d => d.includes('Array length mismatch'))).toBe(true);
    expect(comp.differences.some(d => d.includes('Type mismatch'))).toBe(true);
  });
});
