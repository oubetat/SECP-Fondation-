import { describe, it, expect } from 'vitest';
import { PredicateSerializer } from '../predicates/PredicateSerializer';
import { OrientationPredicates } from '../predicates/OrientationPredicates';
import { DistancePredicates } from '../predicates/DistancePredicates';

describe('PATCH-018: Predicate Determinism Suite', () => {
  it('should generate identical results across 100 consecutive iterations', () => {
    const ptA = { x: 1.23456789, y: 9.87654321, z: 0.12345678 };
    const ptB = { x: 2.34567891, y: 8.76543219, z: 1.23456789 };
    const ptC = { x: 3.45678912, y: 7.65432198, z: 2.34567891 };

    const firstRes = OrientationPredicates.areCollinear(ptA, ptB, ptC);
    const firstHash = PredicateSerializer.hashPredicateExecution('areCollinear', { ptA, ptB, ptC }, firstRes);

    for (let i = 0; i < 100; i++) {
      const res = OrientationPredicates.areCollinear(ptA, ptB, ptC);
      const hash = PredicateSerializer.hashPredicateExecution('areCollinear', { ptA, ptB, ptC }, res);
      expect(res.classification).toBe(firstRes.classification);
      expect(res.value).toBe(firstRes.value);
      expect(hash).toBe(firstHash);
    }
  });

  it('should be free of time-dependent components or random state', () => {
    const distRes = DistancePredicates.pointPointDistance({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 });
    const json = PredicateSerializer.serializePredicateExecution('pointPointDistance', {}, distRes);
    expect(json.includes('Date')).toBe(false);
    expect(json.includes('timestamp')).toBe(false);
  });
});
