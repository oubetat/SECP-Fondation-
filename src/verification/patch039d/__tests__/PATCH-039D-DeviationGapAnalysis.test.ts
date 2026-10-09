import { describe, it, expect } from 'vitest';
import { DeviationGapEngine } from '../../../engine/cad/surface/DeviationGapEngine';
import { BRepPlane, BRepNURBSSurface } from '../../../engine/cad-kernel/geometry/BRepGeometry';

describe('PATCH-039: Deviation and Gap Analysis (Real Engineering Geometry)', () => {
  it('must evaluate exact point-to-plane deviation', () => {
    const refPlane = new BRepPlane(); // Base plane at Z=0
    
    // Evaluate deviation of point (0.5, 0.5, 3.14) against the plane
    const p1 = { x: 0.5, y: 0.5, z: 3.14 };
    const dev1 = DeviationGapEngine.evaluateDeviation(
      p1, 
      refPlane, 
      { refId: 'plane1', tarId: 'point1', refRev: 1, tarRev: 1, tolerance: 0.1 }
    );
    
    expect(dev1.distance).toBeCloseTo(3.14, 4);
    expect(dev1.status).toBe('OUT_OF_TOLERANCE');
    expect(dev1.signedDeviation).toBeDefined();
    expect(dev1.normal.z).toBe(1); // Standard normal for BRepPlane is +Z
  });

  it('must evaluate surface-to-surface minimum gap and detect coincidence', () => {
    const basePlane = new BRepNURBSSurface(1, 1, [], [], [
        [{x: 0, y: 0, z: 0}, {x: 10, y: 0, z: 0}],
        [{x: 0, y: 10, z: 0}, {x: 10, y: 10, z: 0}]
    ] as any);

    const gap1 = DeviationGapEngine.evaluateGap(
      basePlane, 
      basePlane,
      { geoAId: 'plane1', geoBId: 'plane1', revA: 1, revB: 1, tolerance: 0.001 }
    );

    expect(gap1.distance).toBeCloseTo(0, 5);
    expect(gap1.classification).toBe('COINCIDENT');
  });

  it('must evaluate surface-to-surface gap and detect separation', () => {
    const basePlane = new BRepNURBSSurface(1, 1, [], [], [
      [{x: 0, y: 0, z: 0}, {x: 10, y: 0, z: 0}],
      [{x: 0, y: 10, z: 0}, {x: 10, y: 10, z: 0}]
    ] as any);

    const offsetPlane = new BRepNURBSSurface(1, 1, [], [], [
      [{x: 0, y: 0, z: 42.5}, {x: 10, y: 0, z: 42.5}],
      [{x: 0, y: 10, z: 42.5}, {x: 10, y: 10, z: 42.5}]
    ] as any);

    const gap2 = DeviationGapEngine.evaluateGap(
      basePlane, 
      offsetPlane,
      { geoAId: 'plane1', geoBId: 'plane2', revA: 1, revB: 1, tolerance: 0.1 }
    );

    expect(gap2.distance).toBeCloseTo(42.5, 3);
    expect(gap2.classification).toBe('SEPARATED');
  });

  it('must generate auditable evidence containing canonical geometric truth', () => {
    const refPlane = new BRepPlane();
    const p1 = { x: 0.5, y: 0.5, z: 3.14 };
    
    const dev1 = DeviationGapEngine.evaluateDeviation(
      p1, 
      refPlane, 
      { refId: 'plane1', tarId: 'point1', refRev: 2, tarRev: 1, tolerance: 5.0 } // Tolerance 5.0 > 3.14, so PASS
    );

    const evidence = DeviationGapEngine.recordDeviationEvidence(dev1, 'DOC-42');
    
    expect(evidence.verdict).toBe('PASS');
    expect(evidence.sourceSystem).toBe('SECP_DEVIATION_ENGINE');
    expect(evidence.revision).toBe(2);
    expect(evidence.payload.result.metric).toBe('CLOSEST_POINT');
    expect(evidence.canonicalHash).toBeDefined();
  });
});
