import { describe, it, expect } from 'vitest';
import { IntersectionPredicates } from '../predicates/IntersectionPredicates';
import { Segment2D, Segment3D } from '../predicates/PredicateContracts';

describe('PATCH-018: IntersectionPredicates', () => {
  it('should classify 2D segment relations accurately', () => {
    const s1: Segment2D = { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } };
    const sCross: Segment2D = { start: { x: 0, y: 10 }, end: { x: 10, y: 0 } };
    const sTouch: Segment2D = { start: { x: 10, y: 10 }, end: { x: 20, y: 10 } };
    const sDisjoint: Segment2D = { start: { x: 20, y: 0 }, end: { x: 20, y: 10 } };
    const sOverlap: Segment2D = { start: { x: 5, y: 5 }, end: { x: 15, y: 15 } };
    const sCollinearDisjoint: Segment2D = { start: { x: 20, y: 20 }, end: { x: 30, y: 30 } };

    expect(IntersectionPredicates.segmentSegmentRelation2D(s1, sCross).classification).toBe('PROPER_INTERSECTION');
    expect(IntersectionPredicates.segmentSegmentRelation2D(s1, sTouch).classification).toBe('TOUCHING');
    expect(IntersectionPredicates.segmentSegmentRelation2D(s1, sDisjoint).classification).toBe('DISJOINT');
    expect(IntersectionPredicates.segmentSegmentRelation2D(s1, sOverlap).classification).toBe('OVERLAPPING');
    expect(IntersectionPredicates.segmentSegmentRelation2D(s1, sCollinearDisjoint).classification).toBe('COLLINEAR_DISJOINT');
  });

  it('should classify 3D segment relations', () => {
    const s1: Segment3D = { start: { x: 0, y: 0, z: 0 }, end: { x: 10, y: 0, z: 0 } };
    const s2Intersect: Segment3D = { start: { x: 5, y: -5, z: 0 }, end: { x: 5, y: 5, z: 0 } };
    const s2Skew: Segment3D = { start: { x: 5, y: -5, z: 2 }, end: { x: 5, y: 5, z: 2 } };
    const s2Disjoint: Segment3D = { start: { x: 0, y: 5, z: 0 }, end: { x: 10, y: 5, z: 0 } };

    expect(IntersectionPredicates.segmentSegmentRelation3D(s1, s2Intersect).classification).toBe('INTERSECTING');
    expect(IntersectionPredicates.segmentSegmentRelation3D(s1, s2Skew).classification).toBe('SKEW');
    expect(IntersectionPredicates.segmentSegmentRelation3D(s1, s2Disjoint).classification).toBe('DISJOINT');
  });
});
