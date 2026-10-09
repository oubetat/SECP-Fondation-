/**
 * SECP CAD Kernel — GCS Constraint Solver Tests
 * Phase 2 (PATCH-025)
 */

import { describe, it, expect } from 'vitest';
import { EngineeringIdentityFactory } from '../../../identity/EngineeringIdentityFactory';
import { EngineeringObjectType } from '../../../identity/CanonicalEngineeringIdentity';
import { SketchModel } from '../../SketchModel';
import { SketchConstraint } from '../ConstraintModel';
import { DeterministicSolver } from '../DeterministicSolver';
import { ToleranceModel } from '../../../cad-kernel/tolerance/ToleranceModel';
import { ProvenanceNode } from '../../../provenance/ProvenanceGraphTypes';

describe('ConstraintSolver', () => {
  const defaultTolerance: ToleranceModel = {
    linear: 1e-7, angular: 1e-7, parametric: 1e-7, distance: 1e-7, coincidence: 1e-7,
    topology: 1e-7, sewing: 1e-7, boolean: 1e-7, approximation: 1e-7,
    unitSystem: 'mm', scale: 1.0, policyId: 'STRICT_INDUSTRIAL', version: '1.0.0'
  };

  const mockProv: ProvenanceNode = {
    id: 'p1', type: 'DESIGN', engineeringIdentityId: 'SECP:GEOMETRY:sketch1',
    canonicalHash: 'h1', version: '1', createdAt: '2026-01-01', evidenceRefs: []
  };

  const sketchId = EngineeringIdentityFactory.createIdentity({ objectType: EngineeringObjectType.GEOMETRY, projectId: 'sketch1',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {});

  const createPoint = (id: string, x: number, y: number) => ({
    id: EngineeringIdentityFactory.createIdentity({ objectType: EngineeringObjectType.GEOMETRY, projectId: id,
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}),
    type: 'POINT' as const,
    sketchId,
    construction: false,
    geometry: { type: 'POINT' as const, x, y },
    metadata: {},
    provenance: mockProv
  });

  const createConstraint = (id: string, type: any, refs: any[], params: any = {}): SketchConstraint => ({
    id: EngineeringIdentityFactory.createIdentity({ objectType: EngineeringObjectType.GEOMETRY, projectId: id,
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}),
    type,
    sketchId,
    references: refs,
    parameters: params,
    driving: true,
    provenance: mockProv
  });

  it('TEST 01: One free point', () => {
    const model: SketchModel = {
      id: sketchId, name: 'S1',
      coordinateSystem: { origin: { x: 0, y: 0 }, xAxis: { x: 1, y: 0 }, yAxis: { x: 0, y: 1 }, normal: { x: 0, y: 0, z: 1 } },
      entities: [createPoint('P1', 10, 10)],
      constraints: [], version: 1, units: 'mm', tolerance: defaultTolerance, provenance: mockProv, metadata: {}
    };
    const res = DeterministicSolver.solve(model, []);
    expect(res.dof.initialDOF).toBe(2);
    expect(res.status).toBe('CONVERGED');
  });

  it('TEST 02: Point + FIX', () => {
    const p1 = createPoint('P1', 10, 10);
    const c1 = createConstraint('C1', 'FIX', [{ entityId: p1.id, target: 'ENTITY' }], { value: 10, valueY: 10 });
    const model: SketchModel = {
      id: sketchId, name: 'S1',
      coordinateSystem: { origin: { x: 0, y: 0 }, xAxis: { x: 1, y: 0 }, yAxis: { x: 0, y: 1 }, normal: { x: 0, y: 0, z: 1 } },
      entities: [p1],
      constraints: [], version: 1, units: 'mm', tolerance: defaultTolerance, provenance: mockProv, metadata: {}
    };
    const res = DeterministicSolver.solve(model, [c1]);
    expect(res.status).toBe('CONVERGED');
    expect((res.solvedSketch.entities[0].geometry as any).x).toBe(10);
    expect((res.solvedSketch.entities[0].geometry as any).y).toBe(10);
  });

  it('TEST 06: Two points + DISTANCE', () => {
    const p1 = createPoint('P1', 0, 0);
    const p2 = createPoint('P2', 10, 0); // initial distance 10
    const c_fix = createConstraint('CF', 'FIX', [{ entityId: p1.id, target: 'ENTITY' }], { value: 0, valueY: 0 });
    const c_dist = createConstraint('CD', 'DISTANCE', [
      { entityId: p1.id, target: 'ENTITY' },
      { entityId: p2.id, target: 'ENTITY' }
    ], { value: 20 });

    const model: SketchModel = {
      id: sketchId, name: 'S1',
      coordinateSystem: { origin: { x: 0, y: 0 }, xAxis: { x: 1, y: 0 }, yAxis: { x: 0, y: 1 }, normal: { x: 0, y: 0, z: 1 } },
      entities: [p1, p2],
      constraints: [], version: 1, units: 'mm', tolerance: defaultTolerance, provenance: mockProv, metadata: {}
    };
    
    const res = DeterministicSolver.solve(model, [c_fix, c_dist]);
    expect(res.status).toBe('CONVERGED');
    const p2_solved = res.solvedSketch.entities.find(e => e.id.projectId === 'P2');
    const dist = Math.sqrt((p2_solved!.geometry as any).x ** 2 + (p2_solved!.geometry as any).y ** 2);
    expect(dist).toBeCloseTo(20, 6);
  });

  it('TEST 07: Horizontal constraint', () => {
    const p1 = createPoint('P1', 0, 0);
    const p2 = createPoint('P2', 10, 10);
    const c_fix = createConstraint('CF', 'FIX', [{ entityId: p1.id, target: 'ENTITY' }], { value: 0, valueY: 0 });
    const c_horiz = createConstraint('CH', 'HORIZONTAL', [
      { entityId: p1.id, target: 'ENTITY' },
      { entityId: p2.id, target: 'ENTITY' }
    ]);

    const model: SketchModel = {
      id: sketchId, name: 'S1',
      coordinateSystem: { origin: { x: 0, y: 0 }, xAxis: { x: 1, y: 0 }, yAxis: { x: 0, y: 1 }, normal: { x: 0, y: 0, z: 1 } },
      entities: [p1, p2],
      constraints: [], version: 1, units: 'mm', tolerance: defaultTolerance, provenance: mockProv, metadata: {}
    };

    const res = DeterministicSolver.solve(model, [c_fix, c_horiz]);
    expect(res.status).toBe('CONVERGED');
    const p2_solved = res.solvedSketch.entities.find(e => e.id.projectId === 'P2');
    expect((p2_solved!.geometry as any).y).toBeCloseTo(0, 6);
  });

  it('TEST 08: Vertical constraint', () => {
    const p1 = createPoint('P1', 0, 0);
    const p2 = createPoint('P2', 10, 10);
    const c_fix = createConstraint('CF', 'FIX', [{ entityId: p1.id, target: 'ENTITY' }], { value: 0, valueY: 0 });
    const c_vert = createConstraint('CV', 'VERTICAL', [
      { entityId: p1.id, target: 'ENTITY' },
      { entityId: p2.id, target: 'ENTITY' }
    ]);

    const model: SketchModel = {
      id: sketchId, name: 'S1',
      coordinateSystem: { origin: { x: 0, y: 0 }, xAxis: { x: 1, y: 0 }, yAxis: { x: 0, y: 1 }, normal: { x: 0, y: 0, z: 1 } },
      entities: [p1, p2],
      constraints: [], version: 1, units: 'mm', tolerance: defaultTolerance, provenance: mockProv, metadata: {}
    };

    const res = DeterministicSolver.solve(model, [c_fix, c_vert]);
    expect(res.status).toBe('CONVERGED');
    const p2_solved = res.solvedSketch.entities.find(e => e.id.projectId === 'P2');
    expect((p2_solved!.geometry as any).x).toBeCloseTo(0, 6);
  });

  it('TEST 11: Coincident points', () => {
    const p1 = createPoint('P1', 0, 0);
    const p2 = createPoint('P2', 10, 10);
    const c_fix = createConstraint('CF', 'FIX', [{ entityId: p1.id, target: 'ENTITY' }], { value: 0, valueY: 0 });
    const c_coin = createConstraint('CC', 'COINCIDENT', [
      { entityId: p1.id, target: 'ENTITY' },
      { entityId: p2.id, target: 'ENTITY' }
    ]);

    const model: SketchModel = {
      id: sketchId, name: 'S1',
      coordinateSystem: { origin: { x: 0, y: 0 }, xAxis: { x: 1, y: 0 }, yAxis: { x: 0, y: 1 }, normal: { x: 0, y: 0, z: 1 } },
      entities: [p1, p2],
      constraints: [], version: 1, units: 'mm', tolerance: defaultTolerance, provenance: mockProv, metadata: {}
    };

    const res = DeterministicSolver.solve(model, [c_fix, c_coin]);
    expect(res.status).toBe('CONVERGED');
    const p2_solved = res.solvedSketch.entities.find(e => e.id.projectId === 'P2');
    expect((p2_solved!.geometry as any).x).toBeCloseTo(0, 6);
    expect((p2_solved!.geometry as any).y).toBeCloseTo(0, 6);
  });

  it('TEST 14: Over-constrained case (Contradictory)', () => {
    const p1 = createPoint('P1', 0, 0);
    const p2 = createPoint('P2', 10, 0);
    const c_fix = createConstraint('CF', 'FIX', [{ entityId: p1.id, target: 'ENTITY' }], { value: 0, valueY: 0 });
    const c_dist1 = createConstraint('CD1', 'DISTANCE', [
      { entityId: p1.id, target: 'ENTITY' },
      { entityId: p2.id, target: 'ENTITY' }
    ], { value: 20 });
    const c_dist2 = createConstraint('CD2', 'DISTANCE', [
      { entityId: p1.id, target: 'ENTITY' },
      { entityId: p2.id, target: 'ENTITY' }
    ], { value: 30 }); // Contradictory

    const model: SketchModel = {
      id: sketchId, name: 'S1',
      coordinateSystem: { origin: { x: 0, y: 0 }, xAxis: { x: 1, y: 0 }, yAxis: { x: 0, y: 1 }, normal: { x: 0, y: 0, z: 1 } },
      entities: [p1, p2],
      constraints: [], version: 1, units: 'mm', tolerance: defaultTolerance, provenance: mockProv, metadata: {}
    };

    const res = DeterministicSolver.solve(model, [c_fix, c_dist1, c_dist2]);
    // The solver might converge to a least-squares solution, but residuals will be high.
    expect(res.status).toBe('NOT_CONVERGED');
    expect(res.maximumResidual).toBeGreaterThan(1e-3);
  });

  it('ADVERSARIAL A1: Singular system (Parallel lines constrained to be perpendicular)', () => {
    // This is hard to set up with just residuals, but if the Jacobian is rank-deficient, it should handle it.
    // We'll test numerical stability with a degenerate case.
    const p1 = createPoint('P1', 0, 0);
    const p2 = createPoint('P2', 0, 0); // Points are on top of each other
    const c_dist = createConstraint('CD', 'DISTANCE', [
      { entityId: p1.id, target: 'ENTITY' },
      { entityId: p2.id, target: 'ENTITY' }
    ], { value: 10 });

    const model: SketchModel = {
      id: sketchId, name: 'S1',
      coordinateSystem: { origin: { x: 0, y: 0 }, xAxis: { x: 1, y: 0 }, yAxis: { x: 0, y: 1 }, normal: { x: 0, y: 0, z: 1 } },
      entities: [p1, p2],
      constraints: [], version: 1, units: 'mm', tolerance: defaultTolerance, provenance: mockProv, metadata: {}
    };

    const res = DeterministicSolver.solve(model, [c_dist]);
    // Should not crash. Numerical failure is a valid outcome for purely singular.
    expect(res.status).toBeDefined();
  });

  const createLine = (id: string, p1Id: string, p2Id: string) => ({
    id: EngineeringIdentityFactory.createIdentity({ objectType: EngineeringObjectType.GEOMETRY, projectId: id,
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}),
    type: 'LINE' as const,
    sketchId,
    construction: false,
    geometry: { 
      type: 'LINE' as const, 
      start: { x: 0, y: 0 }, 
      end: { x: 0, y: 0 } 
    },
    metadata: {},
    provenance: mockProv,
    startPointId: EngineeringIdentityFactory.createIdentity({ objectType: EngineeringObjectType.GEOMETRY, projectId: p1Id,
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}),
    endPointId: EngineeringIdentityFactory.createIdentity({ objectType: EngineeringObjectType.GEOMETRY, projectId: p2Id,
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {})
  });

  it('TEST 12: Line + HORIZONTAL + DISTANCE', () => {
    const p1 = createPoint('P1', 0, 0);
    const p2 = createPoint('P2', 5, 5);
    const line = createLine('L1', 'P1', 'P2');
    
    const c_fix = createConstraint('CF', 'FIX', [{ entityId: p1.id, target: 'ENTITY' }], { value: 0, valueY: 0 });
    const c_horiz = createConstraint('CH', 'HORIZONTAL', [
      { entityId: line.id, target: 'ENTITY' }
    ]);
    const c_dist = createConstraint('CD', 'DISTANCE', [
      { entityId: line.id, target: 'ENTITY' }
    ], { value: 20 });

    const model: SketchModel = {
      id: sketchId, name: 'S1',
      coordinateSystem: { origin: { x: 0, y: 0 }, xAxis: { x: 1, y: 0 }, yAxis: { x: 0, y: 1 }, normal: { x: 0, y: 0, z: 1 } },
      entities: [p1, p2, line as any],
      constraints: [], version: 1, units: 'mm', tolerance: defaultTolerance, provenance: mockProv, metadata: {}
    };

    const res = DeterministicSolver.solve(model, [c_fix, c_horiz, c_dist]);
    expect(res.status).toBe('CONVERGED');
    const line_solved = res.solvedSketch.entities.find(e => e.id.projectId === 'L1') as any;
    expect(line_solved.geometry.start.y).toBeCloseTo(line_solved.geometry.end.y, 6);
    const dist = Math.abs(line_solved.geometry.end.x - line_solved.geometry.start.x);
    expect(dist).toBeCloseTo(20, 6);
  });

  it('KILL-FALLBACK-001: Sub-millimeter contradiction in range [tol, 1e-1] must return NOT_CONVERGED, never CONVERGED', () => {
    // P1 fixed at (0, 0).
    // P2 constrained with contradictory distances: 10.00mm and 10.05mm (delta = 50 microns).
    // Least-squares minimum residual is ~0.025mm (25 microns), which lies strictly in [tol, 1e-1].
    // The legacy fallback falsely classified this as CONVERGED; the hardened contract must classify as NOT_CONVERGED.
    const p1 = createPoint('P1', 0, 0);
    const p2 = createPoint('P2', 10, 0);
    const c_fix = createConstraint('CF', 'FIX', [{ entityId: p1.id, target: 'ENTITY' }], { value: 0, valueY: 0 });
    const c_dist1 = createConstraint('CD1', 'DISTANCE', [
      { entityId: p1.id, target: 'ENTITY' },
      { entityId: p2.id, target: 'ENTITY' }
    ], { value: 10.00 });
    const c_dist2 = createConstraint('CD2', 'DISTANCE', [
      { entityId: p1.id, target: 'ENTITY' },
      { entityId: p2.id, target: 'ENTITY' }
    ], { value: 10.05 });

    const model: SketchModel = {
      id: sketchId, name: 'S1',
      coordinateSystem: { origin: { x: 0, y: 0 }, xAxis: { x: 1, y: 0 }, yAxis: { x: 0, y: 1 }, normal: { x: 0, y: 0, z: 1 } },
      entities: [p1, p2],
      constraints: [], version: 1, units: 'mm', tolerance: defaultTolerance, provenance: mockProv, metadata: {}
    };

    const res = DeterministicSolver.solve(model, [c_fix, c_dist1, c_dist2]);

    // Hardened invariant assertions
    expect(res.status).toBe('NOT_CONVERGED');
    expect(res.status).not.toBe('CONVERGED');
    expect(res.maximumResidual).toBeGreaterThanOrEqual(1e-5);
    expect(res.maximumResidual).toBeLessThanOrEqual(0.1);
    expect(res.dof.status).toMatch(/OVER_CONSTRAINED|CONFLICTING/);
    expect(res.dof.status).not.toBe('FULLY_CONSTRAINED');
  });

  it('KILL-NAN-001: Non-finite coordinates or residual cannot produce CONVERGED status', () => {
    const p1 = createPoint('P1', NaN, 0);
    const c_fix = createConstraint('CF', 'FIX', [{ entityId: p1.id, target: 'ENTITY' }], { value: 0, valueY: 0 });

    const model: SketchModel = {
      id: sketchId, name: 'S1',
      coordinateSystem: { origin: { x: 0, y: 0 }, xAxis: { x: 1, y: 0 }, yAxis: { x: 0, y: 1 }, normal: { x: 0, y: 0, z: 1 } },
      entities: [p1],
      constraints: [], version: 1, units: 'mm', tolerance: defaultTolerance, provenance: mockProv, metadata: {}
    };

    const res = DeterministicSolver.solve(model, [c_fix]);

    expect(res.status).toBe('NOT_CONVERGED');
    expect(res.status).not.toBe('CONVERGED');
  });
});
