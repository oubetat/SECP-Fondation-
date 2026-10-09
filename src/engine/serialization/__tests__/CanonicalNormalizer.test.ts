import { describe, it, expect } from 'vitest';
import { CanonicalNormalizer } from '../CanonicalNormalizer';
import {
  NonFiniteNumberError,
  UndefinedInArrayError,
  UnsupportedTypeError
} from '../CanonicalSerializationErrors';

describe('PATCH-009 — CanonicalNormalizer Unit Test Suite', () => {
  it('normalizes primitives correctly and freezes complex outputs', () => {
    expect(CanonicalNormalizer.normalize(null)).toBe(null);
    expect(CanonicalNormalizer.normalize(true)).toBe(true);
    expect(CanonicalNormalizer.normalize(false)).toBe(false);
    expect(CanonicalNormalizer.normalize(42)).toBe(42);
    expect(CanonicalNormalizer.normalize('hello')).toBe('hello');

    const normObj = CanonicalNormalizer.normalize({ b: 2, a: 1 });
    expect(Object.isFrozen(normObj)).toBe(true);
    expect(Object.keys(normObj as object)).toEqual(['a', 'b']);
  });

  it('normalizes bigints into typed markers', () => {
    const norm = CanonicalNormalizer.normalize(BigInt(999999999999));
    expect(norm).toEqual({ $type: 'bigint', $value: '999999999999' });
    expect(Object.isFrozen(norm)).toBe(true);
  });

  it('normalizes Dates into ISO-8601 UTC strings', () => {
    const d = new Date('2026-08-18T10:00:00.000Z');
    expect(CanonicalNormalizer.normalize(d)).toBe('2026-08-18T10:00:00.000Z');
  });

  it('rejects invalid Date objects', () => {
    const invalidDate = new Date('invalid date string');
    expect(() => {
      CanonicalNormalizer.normalize(invalidDate);
    }).toThrow(NonFiniteNumberError);
  });

  it('rejects undefined at root', () => {
    expect(() => {
      CanonicalNormalizer.normalize(undefined);
    }).toThrow(UnsupportedTypeError);
  });

  it('recursively normalizes nested structures and preserves array order', () => {
    const input = {
      matrix: [
        [1, 2],
        [3, 4]
      ],
      meta: {
        creator: 'engineer-01',
        active: true
      }
    };
    const norm = CanonicalNormalizer.normalize(input) as any;
    expect(norm.matrix[0]).toEqual([1, 2]);
    expect(norm.matrix[1]).toEqual([3, 4]);
    expect(Object.keys(norm.meta)).toEqual(['active', 'creator']);
  });
});
