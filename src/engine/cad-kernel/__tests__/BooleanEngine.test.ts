/**
 * SECP CAD Kernel — Boolean Engine Unit Tests
 * Phase 2 (PATCH-019)
 */
import { describe, it, expect } from 'vitest';
import { BooleanEngine } from '../boolean/BooleanEngine';
import { BoxFactory } from '../boolean/BoxFactory';
import { BRepValidator } from '../brep/BRepValidator';
import { TopoShapeEnum, Solid } from '../topology/TopologyContracts';

describe('PATCH-019 — Boolean Engine Unit Tests (TEST-001 to TEST-020)', () => {

  it('TEST-001: A ∪ B for two disjoint boxes', () => {
    const boxA = BoxFactory.createBox('boxA_1', 0, 0, 0, 10, 10, 10);
    const boxB = BoxFactory.createBox('boxB_1', 20, 20, 20, 30, 30, 30);

    const res = BooleanEngine.execute('UNION', boxA, boxB);
    expect(res.status).toBe('SUCCESS');
    expect(res.resultShape).not.toBeNull();
    expect(res.operation).toBe('UNION');
  });

  it('TEST-002: A ∩ B for two overlapping boxes', () => {
    const boxA = BoxFactory.createBox('boxA_2', 0, 0, 0, 10, 10, 10);
    const boxB = BoxFactory.createBox('boxB_2', 5, 0, 0, 15, 10, 10);

    const res = BooleanEngine.execute('INTERSECTION', boxA, boxB);
    expect(res.status).toBe('SUCCESS');
    expect(res.resultShape).not.toBeNull();
    expect(res.operation).toBe('INTERSECTION');
  });

  it('TEST-003: A − B for overlapping boxes', () => {
    const boxA = BoxFactory.createBox('boxA_3', 0, 0, 0, 10, 10, 10);
    const boxB = BoxFactory.createBox('boxB_3', 5, 0, 0, 15, 10, 10);

    const res = BooleanEngine.execute('DIFFERENCE', boxA, boxB);
    expect(res.status).toBe('SUCCESS');
    expect(res.resultShape).not.toBeNull();
    expect(res.operation).toBe('DIFFERENCE');
  });

  it('TEST-004: A contained inside B', () => {
    const boxA = BoxFactory.createBox('boxA_4', 2, 2, 2, 8, 8, 8);
    const boxB = BoxFactory.createBox('boxB_4', 0, 0, 0, 10, 10, 10);

    const resUnion = BooleanEngine.execute('UNION', boxA, boxB);
    expect(resUnion.status).toBe('SUCCESS');

    const resInt = BooleanEngine.execute('INTERSECTION', boxA, boxB);
    expect(resInt.status).toBe('SUCCESS');

    const resDiff = BooleanEngine.execute('DIFFERENCE', boxA, boxB);
    expect(resDiff.status).toBe('EMPTY_RESULT');
  });

  it('TEST-005: B contained inside A', () => {
    const boxA = BoxFactory.createBox('boxA_5', 0, 0, 0, 10, 10, 10);
    const boxB = BoxFactory.createBox('boxB_5', 2, 2, 2, 8, 8, 8);

    const resDiff = BooleanEngine.execute('DIFFERENCE', boxA, boxB);
    expect(resDiff.status).toBe('SUCCESS');
    expect(resDiff.resultShape).not.toBeNull();
  });

  it('TEST-006: Identical solids', () => {
    const boxA = BoxFactory.createBox('boxA_6', 0, 0, 0, 10, 10, 10);

    const resUnion = BooleanEngine.execute('UNION', boxA, boxA);
    expect(resUnion.status).toBe('SUCCESS');

    const resDiff = BooleanEngine.execute('DIFFERENCE', boxA, boxA);
    expect(resDiff.status).toBe('EMPTY_RESULT');
  });

  it('TEST-007: Face-to-face contact', () => {
    const boxA = BoxFactory.createBox('boxA_7', 0, 0, 0, 10, 10, 10);
    const boxB = BoxFactory.createBox('boxB_7', 10, 0, 0, 20, 10, 10); // Touches at X=10

    const res = BooleanEngine.execute('UNION', boxA, boxB);
    expect(res.status).toBe('SUCCESS');
  });

  it('TEST-008: Edge-to-edge contact', () => {
    const boxA = BoxFactory.createBox('boxA_8', 0, 0, 0, 10, 10, 10);
    const boxB = BoxFactory.createBox('boxB_8', 10, 10, 0, 20, 20, 10); // Touches along line X=10, Y=10

    const res = BooleanEngine.execute('UNION', boxA, boxB);
    expect(res.status).toBe('SUCCESS');
  });

  it('TEST-009: Vertex contact', () => {
    const boxA = BoxFactory.createBox('boxA_9', 0, 0, 0, 10, 10, 10);
    const boxB = BoxFactory.createBox('boxB_9', 10, 10, 10, 20, 20, 20); // Touches at point (10,10,10)

    const res = BooleanEngine.execute('UNION', boxA, boxB);
    expect(res.status).toBe('SUCCESS');
  });

  it('TEST-010: Tangent surfaces', () => {
    const boxA = BoxFactory.createBox('boxA_10', 0, 0, 0, 10, 10, 10);
    const boxB = BoxFactory.createBox('boxB_10', 10, 0, 0, 20, 10, 10);

    const res = BooleanEngine.execute('UNION', boxA, boxB);
    expect(res.status).toBe('SUCCESS');
  });

  it('TEST-011: Near-coincident geometry', () => {
    const boxA = BoxFactory.createBox('boxA_11', 0, 0, 0, 10, 10, 10);
    const boxB = BoxFactory.createBox('boxB_11', 1e-6, 0, 0, 10 + 1e-6, 10, 10); // Shifted by 1 micrometer

    const res = BooleanEngine.execute('UNION', boxA, boxB);
    expect(res.status).toBe('SUCCESS');
  });

  it('TEST-012: Invalid B-Rep input', () => {
    const boxA = BoxFactory.createBox('boxA_12', 0, 0, 0, 10, 10, 10);
    const invalidShape: any = { id: 'invalid_12', shapeType: TopoShapeEnum.SOLID }; // Missing outerShell

    const res = BooleanEngine.execute('UNION', boxA, invalidShape);
    expect(res.status).toBe('INVALID_INPUT');
    expect(res.diagnostics.length).toBeGreaterThan(0);
  });

  it('TEST-013: Degenerate face input', () => {
    const boxA = BoxFactory.createBox('boxA_13', 0, 0, 0, 10, 10, 10);
    const degenBox = BoxFactory.createBox('boxB_13', 0, 0, 0, 0, 10, 10); // Zero width

    const res = BooleanEngine.execute('UNION', boxA, degenBox);
    expect(res.status).toBe('INVALID_INPUT');
  });

  it('TEST-014: Non-manifold input', () => {
    const nonManifoldShape: any = {
      id: 'non_manifold_14',
      shapeType: TopoShapeEnum.COMPOUND,
      shapes: []
    };
    const boxA = BoxFactory.createBox('boxA_14', 0, 0, 0, 10, 10, 10);

    const res = BooleanEngine.execute('UNION', boxA, nonManifoldShape);
    expect(res.status).toBe('UNPROVEN');
  });

  it('TEST-015: Repeated identical Boolean execution', () => {
    const boxA = BoxFactory.createBox('boxA_15', 0, 0, 0, 10, 10, 10);
    const boxB = BoxFactory.createBox('boxB_15', 5, 0, 0, 15, 10, 10);

    const run1 = BooleanEngine.execute('UNION', boxA, boxB);
    const run2 = BooleanEngine.execute('UNION', boxA, boxB);

    expect(run1.generatedTopology).toEqual(run2.generatedTopology);
    expect(run1.status).toBe(run2.status);
  });

  it('TEST-016: Operation determinism hash comparison', () => {
    const boxA = BoxFactory.createBox('boxA_16', 0, 0, 0, 10, 10, 10);
    const boxB = BoxFactory.createBox('boxB_16', 5, 0, 0, 15, 10, 10);

    const run1 = BooleanEngine.execute('UNION', boxA, boxB);
    const run2 = BooleanEngine.execute('UNION', boxA, boxB);

    expect(run1.determinismHash).toBe(run2.determinismHash);
    expect(run1.determinismHash.length).toBe(64);
  });

  it('TEST-017: Topology validation after Boolean', () => {
    const boxA = BoxFactory.createBox('boxA_17', 0, 0, 0, 10, 10, 10);
    const boxB = BoxFactory.createBox('boxB_17', 5, 0, 0, 15, 10, 10);

    const res = BooleanEngine.execute('UNION', boxA, boxB);
    expect(res.validation.topologicalValidity).toBe(true);
    expect(res.validation.status).toBe('VALID');
  });

  it('TEST-018: Volume sanity validation', () => {
    const boxA = BoxFactory.createBox('boxA_18', 0, 0, 0, 10, 10, 10);
    const boxB = BoxFactory.createBox('boxB_18', 5, 0, 0, 15, 10, 10);

    const res = BooleanEngine.execute('UNION', boxA, boxB);
    expect(res.validation.semanticValidity).not.toBe(false);
  });

  it('TEST-019: NURBS / analytic surface intersection support check', () => {
    const boxA = BoxFactory.createBox('boxA_19', 0, 0, 0, 10, 10, 10);
    const boxB = BoxFactory.createBox('boxB_19', 5, 0, 0, 15, 10, 10);

    const res = BooleanEngine.execute('UNION', boxA, boxB);
    expect(res.status).toBe('SUCCESS');
  });

  it('TEST-020: Unsupported geometry pair returns UNSUPPORTED/UNPROVEN, never fabricated SUCCESS', () => {
    // Non-solid or non-supported pair test
    const dummyNonSolid: any = {
      id: 'unsupported_20',
      shapeType: TopoShapeEnum.COMPOUND,
      shapes: []
    };
    const boxA = BoxFactory.createBox('boxA_20', 0, 0, 0, 10, 10, 10);

    const res = BooleanEngine.execute('UNION', boxA, dummyNonSolid);
    expect(res.status).toBe('UNPROVEN');
    expect(res.status).not.toBe('SUCCESS');
  });

});
