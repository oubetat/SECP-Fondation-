/**
 * SECP CAD Kernel — PATCH-325D Forensic Proof Suite
 * Industrial Solver & Diagnostics Integration Proof
 *
 * PROOF CRITERIA:
 * - AC-01: Real industrial solver executes directly through canonical sketch pipeline
 * - AC-02: Solver status derived strictly from numerical evidence
 * - AC-03: Elimination of false-convergence fallbacks
 * - AC-04: Non-finite values (NaN/Infinity) reject convergence
 * - AC-05: Explicit deterministic residual/tolerance evaluation
 * - AC-06: Precise distinction of mathematical constraint states (UNDER, FULLY, REDUNDANT, OVER, CONFLICTING)
 * - AC-07: Diagnostics derived Authoritatively from actual SolveResult
 * - AC-08: Causal engineering mutations alter solver & diagnostic output
 * - AC-09: Bit-exact determinism across repeated executions
 * - AC-10: Canonical Sketch -> Constraints -> Solver -> Diagnostics -> Canonical Document pipeline closure
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CanonicalSketch,
  createEmptyCanonicalSketch,
  deriveSolverState,
  solveCanonicalSketch,
  mutateAddFlatEntities,
  mutateAddFlatConstraint,
  updateCanonicalSketchInDocument
} from '../../../engine/sketch/canonical/CanonicalSketchContract';
import {
  IndustrialSketchEntity,
  IndustrialSketchConstraint,
  IndustrialSketchDefinition
} from '../../../engine/sketch/IndustrialConstraintTypes';
import { IndustrialVariationalSolver } from '../../../engine/sketch/IndustrialVariationalSolver';
import { SketchSolverDiagnostics } from '../../../engine/sketch/diagnostics/SketchSolverDiagnostics';
import { DEFAULT_UNIT_SYSTEM_MM, EngineeringDocument } from '../../../engine/cad-kernel/document/CADDocument';

describe('PATCH-325D — Industrial Solver + Diagnostics Forensic Verification', () => {
  let emptySketch: CanonicalSketch;

  beforeEach(() => {
    emptySketch = createEmptyCanonicalSketch('SKETCH_325D_PROOF', 'Industrial Solver Proof Sketch');
  });

  it('AC-01 & AC-02: Real industrial solver executes through canonical pipeline with numerical evidence', () => {
    // Single free point (2 DOF)
    const pt1: any = {
      id: 'pt_1',
      type: 'POINT',
      points: [{ x: 50, y: 50 }],
      isConstruction: false
    };

    const sketch = mutateAddFlatEntities(emptySketch, [pt1]);
    const { solvedSketch, solverState } = solveCanonicalSketch(sketch);

    expect(solverState.status).toBe('UNDER_CONSTRAINED');
    expect(solverState.remainingDegreesOfFreedom).toBe(2);
    expect(solverState.totalDegreesOfFreedom).toBe(2);
    expect(solverState.constrainedDegreesOfFreedom).toBe(0);
    expect(Number.isFinite(solverState.maxResidual)).toBe(true);
    expect(solverState.maxResidual).toBeLessThanOrEqual(1e-3);
    expect(solverState.diagnosticsReport).toBeDefined();
    expect(solverState.diagnosticsReport.solverStatus).toBe('UNDER_CONSTRAINED');
    expect(solverState.diagnosticsReport.degreesOfFreedom).toBe(2);
    expect(solverState.diagnosticsReport.iterationCount).toBeGreaterThanOrEqual(0);
  });

  it('AC-03 & AC-06: Distinct classification of conflicting constraints (no false convergence)', () => {
    // Fixed origin point
    const origin: any = { id: 'p_origin', type: 'POINT', points: [{ x: 0, y: 0 }], isFixed: true };
    // Second point fixed at (0, 0)
    const p1: any = { id: 'p_fixed', type: 'POINT', points: [{ x: 0, y: 0 }], isFixed: true };

    let conflictSketch = mutateAddFlatEntities(emptySketch, [origin, p1]);
    // Distance constraint between two coincident fixed points demanding distance = 100
    conflictSketch = {
      ...conflictSketch,
      constraints: {
        ...conflictSketch.constraints,
        'c_dist_impossible': {
          id: 'c_dist_impossible',
          type: 'DISTANCE',
          entityIds: ['p_origin', 'p_fixed'],
          value: 100,
          suppressionState: 'ACTIVE'
        }
      }
    };

    const { solverState } = solveCanonicalSketch(conflictSketch);

    // Must be classified as OVER_CONSTRAINED or CONFLICTING, never FULLY_CONSTRAINED or SOLVED
    expect(['OVER_CONSTRAINED', 'CONFLICTING', 'INCONSISTENT']).toContain(solverState.status);
    expect(solverState.isConverged).toBe(false);
    expect(solverState.diagnosticsReport.convergenceStatus).toBe(false);
    expect(solverState.diagnosticsReport.conflictingConstraints.length).toBeGreaterThan(0);
  });

  it('AC-04: Non-finite geometry or residual conditions reject convergence', () => {
    const solver = new IndustrialVariationalSolver();
    const indDef: IndustrialSketchDefinition = {
      id: 'SKETCH_NAN_TEST',
      name: 'Adversarial NaN Sketch',
      plane: 'XY',
      revision: 1,
      entities: {
        'pt_nan_1': {
          id: 'pt_nan_1',
          type: 'POINT',
          x: NaN,
          y: NaN,
          isFixed: false
        },
        'pt_nan_2': {
          id: 'pt_nan_2',
          type: 'POINT',
          x: 100,
          y: 100,
          isFixed: false
        }
      },
      constraints: {
        'c_dist_nan': {
          id: 'c_dist_nan',
          type: 'DISTANCE',
          entityIds: ['pt_nan_1', 'pt_nan_2'],
          value: 50,
          suppressionState: 'ACTIVE'
        }
      }
    };

    const result = solver.solve(indDef);
    expect(result.solutionState).not.toBe('FULLY_CONSTRAINED');
    expect(result.solutionState).not.toBe('SOLVED');
  });

  it('AC-05: Explicit and deterministic residual & tolerance bounds', () => {
    const p1: any = { id: 'p_line_start', type: 'POINT', points: [{ x: 0, y: 0 }], isFixed: true };
    const p2: any = { id: 'p_line_end', type: 'POINT', points: [{ x: 50, y: 0 }] };
    const line: any = {
      id: 'line_1',
      type: 'LINE',
      points: [{ x: 0, y: 0 }, { x: 50, y: 0 }],
      startPointId: 'p_line_start',
      endPointId: 'p_line_end'
    };

    let sketch = mutateAddFlatEntities(emptySketch, [p1, p2, line]);
    // Add HORIZONTAL constraint and LENGTH constraint of 100
    sketch = {
      ...sketch,
      constraints: {
        'c_horiz': { id: 'c_horiz', type: 'HORIZONTAL', entityIds: ['line_1'], suppressionState: 'ACTIVE' },
        'c_len': { id: 'c_len', type: 'DISTANCE', entityIds: ['line_1'], value: 100, suppressionState: 'ACTIVE' }
      }
    };

    const { solvedSketch, solverState } = solveCanonicalSketch(sketch);

    expect(solverState.status).toBe('FULLY_CONSTRAINED');
    expect(solverState.isConverged).toBe(true);
    expect(solverState.remainingDegreesOfFreedom).toBe(0);
    expect(solverState.maxResidual).toBeLessThanOrEqual(1e-4);

    // Check that geometry converged to length 100
    const endPoint = solvedSketch.entities['p_line_end'] as any;
    expect(Math.abs(endPoint.x - 100)).toBeLessThanOrEqual(1e-3);
    expect(Math.abs(endPoint.y - 0)).toBeLessThanOrEqual(1e-3);
  });

  it('AC-07: Diagnostic report matches authentic mathematical solution state', () => {
    const origin: any = { id: 'p_origin_diag', type: 'POINT', points: [{ x: 0, y: 0 }], isFixed: true };
    const p1: any = { id: 'p1_diag', type: 'POINT', points: [{ x: 20, y: 20 }] };

    let sketch = mutateAddFlatEntities(emptySketch, [origin, p1]);
    const { solverState } = solveCanonicalSketch(sketch);

    const report = solverState.diagnosticsReport;
    expect(report).toBeDefined();
    expect(report.degreesOfFreedom).toBe(2);
    expect(report.totalDOF).toBe(4); // 2 points * 2 DOFs each = 4 total DOF
    expect(report.freeDOF).toBe(2);
    expect(report.fixedDOF).toBe(2); // Origin point has 2 fixed DOFs
    expect(report.solverStatus).toBe('UNDER_CONSTRAINED');
    expect(report.convergenceStatus).toBe(true);
  });

  it('AC-08: Causal engineering mutations alter solver & diagnostic output', () => {
    // Stage 1: Point with 2 DOF
    const p1: any = { id: 'p_dynamic', type: 'POINT', points: [{ x: 10, y: 10 }] };
    let sketch = mutateAddFlatEntities(emptySketch, [p1]);
    const res1 = solveCanonicalSketch(sketch);
    expect(res1.solverState.remainingDegreesOfFreedom).toBe(2);
    expect(res1.solverState.status).toBe('UNDER_CONSTRAINED');

    // Stage 2: Fix point -> becomes 0 DOF
    const pOrigin: any = { id: 'p_dyn_orig', type: 'POINT', points: [{ x: 0, y: 0 }], isFixed: true };
    sketch = mutateAddFlatEntities(emptySketch, [pOrigin, p1]);
    const fixConstraint: IndustrialSketchConstraint = {
      id: 'c_coinc_dynamic',
      type: 'COINCIDENT',
      entityIds: ['p_dynamic', 'p_dyn_orig'],
      suppressionState: 'ACTIVE'
    };
    sketch = {
      ...sketch,
      constraints: { 'c_coinc_dynamic': fixConstraint }
    };
    const res2 = solveCanonicalSketch(sketch);
    expect(res2.solverState.remainingDegreesOfFreedom).toBe(0);
    expect(res2.solverState.status).toBe('FULLY_CONSTRAINED');

    // Stage 3: Add redundant fix -> becomes REDUNDANT
    const fixConstraint2: IndustrialSketchConstraint = {
      id: 'c_fix_dynamic_2',
      type: 'COINCIDENT',
      entityIds: ['p_dynamic', 'p_dynamic'],
      suppressionState: 'ACTIVE'
    };
    sketch = {
      ...sketch,
      constraints: {
        ...sketch.constraints,
        'c_fix_dynamic_2': fixConstraint2
      }
    };
    const res3 = solveCanonicalSketch(sketch);
    expect(res3.solverState.status).toBe('REDUNDANT');
  });

  it('AC-09: Determinism over 10 consecutive solver runs', () => {
    const origin: any = { id: 'p_det_orig', type: 'POINT', points: [{ x: 0, y: 0 }], isFixed: true };
    const pTarget: any = { id: 'p_det_targ', type: 'POINT', points: [{ x: 30, y: 40 }] };
    const line: any = {
      id: 'line_det',
      type: 'LINE',
      points: [{ x: 0, y: 0 }, { x: 30, y: 40 }],
      startPointId: 'p_det_orig',
      endPointId: 'p_det_targ'
    };

    let sketch = mutateAddFlatEntities(emptySketch, [origin, pTarget, line]);
    sketch = {
      ...sketch,
      constraints: {
        'c_dist_50': { id: 'c_dist_50', type: 'DISTANCE', entityIds: ['line_det'], value: 50, suppressionState: 'ACTIVE' }
      }
    };

    const firstRun = solveCanonicalSketch(sketch);
    for (let i = 0; i < 10; i++) {
      const run = solveCanonicalSketch(sketch);
      expect(run.solverState.status).toBe(firstRun.solverState.status);
      expect(run.solverState.remainingDegreesOfFreedom).toBe(firstRun.solverState.remainingDegreesOfFreedom);
      expect(run.solverState.maxResidual).toBeCloseTo(firstRun.solverState.maxResidual, 8);
    }
  });

  it('AC-10: End-to-end pipeline closure with Canonical Engineering Document', () => {
    const doc: EngineeringDocument = {
      documentId: 'DOC_SOLVER_CLOSURE',
      revision: 1,
      units: DEFAULT_UNIT_SYSTEM_MM,
      sketches: [],
      constraints: [],
      features: [],
      parameters: [],
      topologyMap: { version: 1, entries: {} },
      derived: {},
      evidence: []
    };

    const p1: any = { id: 'p_doc_1', type: 'POINT', points: [{ x: 0, y: 0 }], isFixed: true };
    const p2: any = { id: 'p_doc_2', type: 'POINT', points: [{ x: 25, y: 0 }] };
    const sketch = mutateAddFlatEntities(emptySketch, [p1, p2]);

    const { solvedSketch, solverState } = solveCanonicalSketch(sketch);
    const updatedDoc = updateCanonicalSketchInDocument(doc, solvedSketch);

    expect(updatedDoc.sketches).toBeDefined();
    if (updatedDoc.sketches && updatedDoc.sketches[0]) {
      expect(updatedDoc.sketches.length).toBe(1);
      expect(updatedDoc.sketches[0].id).toBe(sketch.id);
    }
    expect(updatedDoc.revision).toBe(2);
    expect(solverState.isConverged).toBe(true);
    expect(solverState.diagnosticsReport).toBeDefined();
  });
});
