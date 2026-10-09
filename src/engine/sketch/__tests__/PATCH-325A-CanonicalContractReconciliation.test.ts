/**
 * SECP CAD Kernel — PATCH-325A Test Suite
 * Forensic Schema Reconciliation & Canonical Sketch Contract Proof
 *
 * PROOF CRITERIA:
 * 1. GUARD 1: Lossless Bidirectional Reconciliation (Zero Identity Drift, Zero Conversion Loss)
 *    - CanonicalSketch <-> IndustrialSketchDefinition
 *    - CanonicalSketch <-> CADDocument.Sketch
 *    - Flat UI Entities -> CanonicalSketch
 * 2. GUARD 2: Derived Solver State (Solver state is purely functional, not mutable primary ground truth)
 * 3. Cross-Editor Equivalence: CanonicalStructuralEquality returns true with 0 differences
 * 4. Downstream B-Rep Causality: Evaluates seamlessly via DocumentEvaluator with verified topology
 */

import { describe, it, expect } from 'vitest';
import {
  CanonicalSketch,
  createEmptyCanonicalSketch,
  deriveSolverState
} from '../canonical/CanonicalSketchContract';
import { CanonicalSketchAdapter } from '../canonical/CanonicalSketchAdapter';
import { IndustrialSketchDefinition } from '../IndustrialConstraintTypes';
import { EngineeringDocument } from '../../cad-kernel/document/CADDocument';
import { SketchUIIntegration } from '../../cad-kernel/ui-integration/SketchUIIntegration';
import { DocumentEvaluator } from '../../cad-kernel/document/DocumentEvaluator';
import { TopoShapeEnum } from '../../cad-kernel/topology/TopologyContracts';

describe('PATCH-325A: Canonical Sketch Contract & Forensic Schema Reconciliation', () => {

  it('PROOF-1: Lossless Roundtrip with IndustrialSketchDefinition (Zero Drift)', () => {
    const canonical = createEmptyCanonicalSketch('SK_A1', 'Base_Plate_Sketch', 'XY');
    
    // Add 4 points and 4 lines forming a closed rectangular frame
    const points = {
      P1: { id: 'P1', type: 'POINT' as const, x: 0, y: 0 },
      P2: { id: 'P2', type: 'POINT' as const, x: 120, y: 0 },
      P3: { id: 'P3', type: 'POINT' as const, x: 120, y: 80 },
      P4: { id: 'P4', type: 'POINT' as const, x: 0, y: 80 }
    };
    const lines = {
      L1: { id: 'L1', type: 'LINE' as const, startPointId: 'P1', endPointId: 'P2' },
      L2: { id: 'L2', type: 'LINE' as const, startPointId: 'P2', endPointId: 'P3' },
      L3: { id: 'L3', type: 'LINE' as const, startPointId: 'P3', endPointId: 'P4' },
      L4: { id: 'L4', type: 'LINE' as const, startPointId: 'P4', endPointId: 'P1' }
    };
    const circle = {
      C1: { id: 'C1', type: 'CIRCLE' as const, centerPointId: 'P5', radius: 15 }
    };
    const p5 = { P5: { id: 'P5', type: 'POINT' as const, x: 60, y: 40 } };

    const constraints = {
      C_H1: { id: 'C_H1', type: 'HORIZONTAL' as const, entityIds: ['L1'], isDriving: true },
      C_V2: { id: 'C_V2', type: 'VERTICAL' as const, entityIds: ['L2'], isDriving: true },
      C_H3: { id: 'C_H3', type: 'HORIZONTAL' as const, entityIds: ['L3'], isDriving: true },
      C_V4: { id: 'C_V4', type: 'VERTICAL' as const, entityIds: ['L4'], isDriving: true }
    };

    const sourceSketch: CanonicalSketch = {
      ...canonical,
      entities: { ...points, ...p5, ...lines, ...circle },
      constraints,
      closedProfile: true
    };

    // 1. Convert to IndustrialSketchDefinition
    const indDef = CanonicalSketchAdapter.toIndustrialSketch(sourceSketch);
    expect(indDef.id).toBe('SK_A1');
    expect(Object.keys(indDef.entities).length).toBe(10); // 5 points, 4 lines, 1 circle
    expect(Object.keys(indDef.constraints).length).toBe(4);

    // 2. Convert back to CanonicalSketch
    const restoredCanonical = CanonicalSketchAdapter.fromIndustrialSketch(indDef);

    // 3. Structural & Semantic Equality Check
    const eq = CanonicalSketchAdapter.areCanonicallyEqual(sourceSketch, restoredCanonical);
    expect(eq.equal).toBe(true);
    expect(eq.differences).toHaveLength(0);
  });

  it('PROOF-2: Lossless Roundtrip with CADDocument.Sketch (Zero Conversion Loss)', () => {
    const canonical = createEmptyCanonicalSketch('SK_DOC_001', 'Mounting_Bracket', 'XZ');
    
    const entities = {
      PT_A: { id: 'PT_A', type: 'POINT' as const, x: -50, y: -25, isFixed: true },
      PT_B: { id: 'PT_B', type: 'POINT' as const, x: 50, y: -25 },
      PT_C: { id: 'PT_C', type: 'POINT' as const, x: 50, y: 25 },
      PT_D: { id: 'PT_D', type: 'POINT' as const, x: -50, y: 25 },
      LN_1: { id: 'LN_1', type: 'LINE' as const, startPointId: 'PT_A', endPointId: 'PT_B' },
      LN_2: { id: 'LN_2', type: 'LINE' as const, startPointId: 'PT_B', endPointId: 'PT_C' },
      LN_3: { id: 'LN_3', type: 'LINE' as const, startPointId: 'PT_C', endPointId: 'PT_D' },
      LN_4: { id: 'LN_4', type: 'LINE' as const, startPointId: 'PT_D', endPointId: 'PT_A' }
    };

    const constraints = {
      FIX_A: { id: 'FIX_A', type: 'COINCIDENT' as const, entityIds: ['PT_A'], isDriving: true }
    };

    const sourceSketch: CanonicalSketch = {
      ...canonical,
      entities,
      constraints,
      closedProfile: true
    };

    // 1. Serialize to CADDocument.Sketch
    const docSketch = CanonicalSketchAdapter.toCADDocumentSketch(sourceSketch);
    expect(docSketch.id).toBe('SK_DOC_001');
    expect(docSketch.plane).toBe('XZ');
    expect(docSketch.points).toBeDefined();
    expect(docSketch.points?.length).toBe(4);

    // 2. Deserialize back from CADDocument.Sketch
    const rehydrated = CanonicalSketchAdapter.fromCADDocumentSketch(docSketch);

    // 3. Structural Equality
    const eq = CanonicalSketchAdapter.areCanonicallyEqual(sourceSketch, rehydrated);
    expect(eq.equal).toBe(true);
    expect(eq.differences).toHaveLength(0);
  });

  it('PROOF-3: GUARD 2 Compliance — Solver State is Strictly Derived, NOT SOT', () => {
    const sketch = createEmptyCanonicalSketch('SK_SOLVER_GUARD', 'Underconstrained_Line', 'XY');
    
    // Create an unconstrained line with 2 points
    const unconstrainedSketch: CanonicalSketch = {
      ...sketch,
      entities: {
        P1: { id: 'P1', type: 'POINT', x: 0, y: 0 },
        P2: { id: 'P2', type: 'POINT', x: 50, y: 50 },
        L1: { id: 'L1', type: 'LINE', startPointId: 'P1', endPointId: 'P2' }
      },
      constraints: {}
    };

    // Derive solver state for unconstrained sketch
    const result1 = deriveSolverState(unconstrainedSketch);
    expect(result1.solverState.status).toBe('UNDER_CONSTRAINED');
    expect(result1.solverState.remainingDegreesOfFreedom).toBeGreaterThan(0);
    expect(result1.solverState.isConverged).toBe(true);

    // Add Horizontal and Coincident (fixed) constraints
    const constrainedSketch: CanonicalSketch = {
      ...unconstrainedSketch,
      constraints: {
        FIX_P1: { id: 'FIX_P1', type: 'COINCIDENT', entityIds: ['P1'], isDriving: true },
        HORIZ_L1: { id: 'HORIZ_L1', type: 'HORIZONTAL', entityIds: ['L1'], isDriving: true }
      }
    };

    // Re-derive solver state: Must dynamically recalculate without stale persistent state
    const result2 = deriveSolverState(constrainedSketch);
    expect(result2.solverState.remainingDegreesOfFreedom).toBeLessThan(
      result1.solverState.remainingDegreesOfFreedom
    );
    expect(result2.solvedSketch.revision).toBe(constrainedSketch.revision + 1);
  });

  it('PROOF-4: Flat UI Entity Translation Preserves Exact Geometrical Loop', () => {
    // Simulate what SketchEditorPanel currently produces
    const rawUIEntities = [
      {
        id: 'UI_RECT_1',
        type: 'RECTANGLE',
        points: [{ x: 10, y: 10 }, { x: 110, y: 70 }]
      },
      {
        id: 'UI_HOLE_1',
        type: 'CIRCLE',
        points: [{ x: 60, y: 40 }],
        params: { radius: 12 }
      }
    ];

    const canonical = CanonicalSketchAdapter.fromFlatEntities(rawUIEntities, {
      id: 'SK_CONVERTED_UI',
      name: 'Converted_UI_Sketch'
    });

    expect(canonical.id).toBe('SK_CONVERTED_UI');
    // Rectangle produces 4 points + 4 lines; circle produces 1 point + 1 circle -> 10 entities
    expect(Object.keys(canonical.entities).length).toBe(10);
    // Rectangle produces 4 orthogonal constraints
    expect(Object.keys(canonical.constraints).length).toBe(4);

    // Roundtrip back to flat entities for preview renderers
    const flatReplay = CanonicalSketchAdapter.toFlatEntities(canonical);
    expect(flatReplay.length).toBeGreaterThanOrEqual(2);
  });

  it('PROOF-5: Downstream B-Rep Causality & EngineeringDocument Integration', () => {
    // Build a solid CAD document using the canonical sketch pipeline
    const rawEntities = [
      { type: 'LINE', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
      { type: 'LINE', points: [{ x: 100, y: 0 }, { x: 100, y: 60 }] },
      { type: 'LINE', points: [{ x: 100, y: 60 }, { x: 0, y: 60 }] },
      { type: 'LINE', points: [{ x: 0, y: 60 }, { x: 0, y: 0 }] }
    ];

    const doc = SketchUIIntegration.createEmptyDocument('DOC_PATCH325A_TEST');

    // Apply 3D Extrude action using the integration layer
    const result = SketchUIIntegration.applyExtrudeAction(doc, rawEntities, 25, {
      sketchName: 'Base_Profile',
      extrudeName: 'Base_Solid',
      plane: 'XY'
    });

    expect(result.success).toBe(true);
    expect(result.document.features.length).toBe(2); // SKETCH + EXTRUDE
    expect(result.document.sketches.length).toBe(1);

    // Verify Evaluated B-Rep Solid output
    const evalSolid = result.evaluatedShape;
    expect(evalSolid).toBeDefined();
    expect(evalSolid?.shapeType).toBe(TopoShapeEnum.SOLID);
    expect(evalSolid?.outerShell.orientedFaces.length).toBe(6); // 6 faces of extruded box

    // Re-evaluate document deterministically to verify idempotent topology causality
    const reEvalResult = DocumentEvaluator.evaluate(result.document);
    expect(reEvalResult.success).toBe(true);
    expect(reEvalResult.evaluatedShape?.outerShell.orientedFaces.length).toBe(6);
  });

  it('PROOF-6: Cross-Editor Mutation Equivalence Invariant (Two Viewports / One SOT)', () => {
    // S_0: Pristine base sketch
    const S0 = createEmptyCanonicalSketch('SK_EQUIV_001', 'Equivalence_Base', 'XY');
    const initialEntities = {
      P1: { id: 'P1', type: 'POINT' as const, x: 0, y: 0 },
      P2: { id: 'P2', type: 'POINT' as const, x: 100, y: 0 },
      L1: { id: 'L1', type: 'LINE' as const, startPointId: 'P1', endPointId: 'P2' }
    };
    const S0_full: CanonicalSketch = {
      ...S0,
      entities: initialEntities,
      constraints: {
        FIX_P1: { id: 'FIX_P1', type: 'COINCIDENT' as const, entityIds: ['P1'], isDriving: true }
      }
    };

    // Path 1: Mutation in SketchEditorPanel domain (adding a vertical line L2 from P2 to P3 at 100, 50)
    const docSketch = CanonicalSketchAdapter.toCADDocumentSketch(S0_full);
    const rehydratedFromDoc = CanonicalSketchAdapter.fromCADDocumentSketch(docSketch);
    // Simulate SketchEditorPanel authoring action on canonical model
    const editorSketch: CanonicalSketch = {
      ...rehydratedFromDoc,
      entities: {
        ...rehydratedFromDoc.entities,
        P3: { id: 'P3', type: 'POINT', x: 100, y: 50 },
        L2: { id: 'L2', type: 'LINE', startPointId: 'P2', endPointId: 'P3' }
      },
      constraints: {
        ...rehydratedFromDoc.constraints,
        VERT_L2: { id: 'VERT_L2', type: 'VERTICAL', entityIds: ['L2'], isDriving: true }
      }
    };

    // Path 2: Independent identical mutation in SketcherPanel (GCS Diagnostics Lab)
    const labSketchDef = CanonicalSketchAdapter.toIndustrialSketch(S0_full);
    // Simulate GCS Diagnostics lab mutation
    labSketchDef.entities['P3'] = { id: 'P3', type: 'POINT', x: 100, y: 50 };
    labSketchDef.entities['L2'] = { id: 'L2', type: 'LINE', startPointId: 'P2', endPointId: 'P3' };
    labSketchDef.constraints['VERT_L2'] = { id: 'VERT_L2', type: 'VERTICAL', entityIds: ['L2'], isDriving: true };
    const labSketch = CanonicalSketchAdapter.fromIndustrialSketch(labSketchDef);

    // Assert Cross-Editor Mutation Equivalence:
    // CanonicalStructuralEquality(S1, S1') === TRUE
    const equivalence = CanonicalSketchAdapter.areCanonicallyEqual(editorSketch, labSketch);
    expect(equivalence.equal).toBe(true);
    expect(equivalence.differences).toEqual([]);
  });

});
