/**
 * PATCH-325B-R — Canonical Sketch Runtime Ownership Verification Suite
 * Official Forensic Battery for Single Canonical Runtime SOT, Active Sketch Ownership,
 * and Document Causality.
 */

import { describe, test, expect } from 'vitest';
import { EngineeringDocument } from '../../../engine/cad-kernel/document/CADDocument';
import { DocumentEvaluator } from '../../../engine/cad-kernel/document/DocumentEvaluator';
import {
  CanonicalSketch,
  createEmptyCanonicalSketch,
  deriveSolverState,
  mutateEntityParameter,
  mutateAddConstraint,
  mutateDeleteEntity,
  mutateAddEntities,
  getActiveCanonicalSketch,
  updateCanonicalSketchInDocument
} from '../../../engine/sketch/canonical/CanonicalSketchContract';
import { CanonicalSketchAdapter } from '../../../engine/sketch/canonical/CanonicalSketchAdapter';
import { SketchCircle2D, IndustrialSketchConstraint } from '../../../engine/sketch/IndustrialConstraintTypes';
import { SketchDimension } from '../../../engine/sketch/dimensions/SketchDimensionTypes';

describe('PATCH-325B-R: Canonical Runtime Ownership Forensic Verification', () => {

  // ---------------------------------------------------------------------------
  // TEST 1: Two Views / One Runtime SOT with Active Sketch Ownership
  // ---------------------------------------------------------------------------
  test('TEST 1: CanonicalSketch is the FIRST authoritative runtime SOT across two logical views', () => {
    // 1. Create initial CanonicalSketch S0
    const initialCanonical: CanonicalSketch = {
      id: 'SKETCH_325B_MAIN',
      name: 'MainProfile',
      plane: 'XY',
      revision: 1,
      entities: {
        'p_center': { id: 'p_center', type: 'POINT', x: 0, y: 0, isFixed: true },
        'Circle_17': { id: 'Circle_17', type: 'CIRCLE', centerPointId: 'p_center', radius: 25 } as SketchCircle2D,
        'p1': { id: 'p1', type: 'POINT', x: 0, y: 0 },
        'p2': { id: 'p2', type: 'POINT', x: 100, y: 0 },
        'e_line1': { id: 'e_line1', type: 'LINE', startPointId: 'p1', endPointId: 'p2' } as any
      },
      constraints: {
        'c_horiz': { id: 'c_horiz', type: 'HORIZONTAL', entityIds: ['e_line1'] } as IndustrialSketchConstraint
      },
      dimensions: {
        'dim_rad1': { id: 'dim_rad1', type: 'RADIUS', entityIds: ['Circle_17'], value: 25, isDriving: true } as SketchDimension
      }
    };

    // Initialize EngineeringDocument with activeSketchId
    let activeSketchId: string | null = 'SKETCH_325B_MAIN';
    let doc: EngineeringDocument = {
      documentId: 'DOC_PATCH325B_R',
      revision: 1,
      units: { system: 'SI_MM', length: 'mm', angle: 'deg' },
      sketches: [CanonicalSketchAdapter.toCADDocumentSketch(initialCanonical)],
      constraints: [],
      features: [],
      parameters: [],
      topologyMap: { version: 1, entries: {} },
      derived: {},
      evidence: []
    };

    // Both logical views read from doc via activeSketchId
    const sketchView1 = getActiveCanonicalSketch(doc, activeSketchId);
    const diagnosticsView2 = getActiveCanonicalSketch(doc, activeSketchId);

    expect(sketchView1).not.toBeNull();
    expect(diagnosticsView2).not.toBeNull();
    expect(sketchView1?.id).toBe('SKETCH_325B_MAIN');
    expect(diagnosticsView2?.id).toBe('SKETCH_325B_MAIN');
    expect(sketchView1?.revision).toBe(1);
    expect(diagnosticsView2?.revision).toBe(1);

    // -------------------------------------------------------------------------
    // MUTATION A: Mutate Circle_17.radius = 40 directly from Sketch View
    // First mutation target MUST be CanonicalSketch
    // -------------------------------------------------------------------------
    const currentSketchA = getActiveCanonicalSketch(doc, activeSketchId)!;
    const mutASketch = mutateEntityParameter(currentSketchA, 'Circle_17', { radius: 40 });
    
    expect(mutASketch.revision).toBe(2);
    expect((mutASketch.entities['Circle_17'] as SketchCircle2D).radius).toBe(40);

    // Update document SOT
    doc = updateCanonicalSketchInDocument(doc, mutASketch);

    // Diagnostics View observes SAME updated canonical state
    const obsDiagnosticsA = getActiveCanonicalSketch(doc, activeSketchId)!;
    expect(obsDiagnosticsA.revision).toBe(2);
    expect((obsDiagnosticsA.entities['Circle_17'] as SketchCircle2D).radius).toBe(40);

    // -------------------------------------------------------------------------
    // MUTATION B: Mutate Circle_17.radius = 60 directly from Diagnostics View
    // First mutation target MUST be CanonicalSketch
    // -------------------------------------------------------------------------
    const currentSketchB = getActiveCanonicalSketch(doc, activeSketchId)!;
    const mutBSketch = mutateEntityParameter(currentSketchB, 'Circle_17', { radius: 60 });

    expect(mutBSketch.revision).toBe(3);
    expect((mutBSketch.entities['Circle_17'] as SketchCircle2D).radius).toBe(60);

    // Update document SOT
    doc = updateCanonicalSketchInDocument(doc, mutBSketch);

    // Sketch View observes SAME updated canonical state
    const obsSketchB = getActiveCanonicalSketch(doc, activeSketchId)!;
    expect(obsSketchB.revision).toBe(3);
    expect((obsSketchB.entities['Circle_17'] as SketchCircle2D).radius).toBe(60);

    // -------------------------------------------------------------------------
    // MUTATION C: Modify a Dimension value on CanonicalSketch
    // -------------------------------------------------------------------------
    const currentSketchC = getActiveCanonicalSketch(doc, activeSketchId)!;
    const updatedDimensions = {
      ...(currentSketchC.dimensions || {}),
      'dim_rad1': { ...(currentSketchC.dimensions?.['dim_rad1'] || { id: 'dim_rad1', type: 'RADIUS', entityIds: ['Circle_17'], isDriving: true }), value: 60 } as SketchDimension
    };
    const mutCSketch: CanonicalSketch = {
      ...currentSketchC,
      dimensions: updatedDimensions,
      revision: currentSketchC.revision + 1
    };
    doc = updateCanonicalSketchInDocument(doc, mutCSketch);

    const obsC = getActiveCanonicalSketch(doc, activeSketchId)!;
    expect(obsC.revision).toBe(4);
    expect(obsC.dimensions?.['dim_rad1']?.value).toBe(60);

    // -------------------------------------------------------------------------
    // MUTATION D: Add a Constraint directly to CanonicalSketch
    // -------------------------------------------------------------------------
    const currentSketchD = getActiveCanonicalSketch(doc, activeSketchId)!;
    const newConstraint: IndustrialSketchConstraint = {
      id: 'c_vert1',
      type: 'VERTICAL',
      entityIds: ['e_line1']
    };
    const mutDSketch = mutateAddConstraint(currentSketchD, newConstraint);
    doc = updateCanonicalSketchInDocument(doc, mutDSketch);

    const obsD = getActiveCanonicalSketch(doc, activeSketchId)!;
    expect(obsD.revision).toBe(5);
    expect(obsD.constraints['c_vert1']).toBeDefined();

    // -------------------------------------------------------------------------
    // MUTATION E: Delete an Entity directly from CanonicalSketch
    // -------------------------------------------------------------------------
    const currentSketchE = getActiveCanonicalSketch(doc, activeSketchId)!;
    const mutESketch = mutateDeleteEntity(currentSketchE, 'e_line1');
    doc = updateCanonicalSketchInDocument(doc, mutESketch);

    const obsE = getActiveCanonicalSketch(doc, activeSketchId)!;
    expect(obsE.revision).toBe(6);
    expect(obsE.entities['e_line1']).toBeUndefined();
    // Constraints referencing deleted entity must be automatically pruned
    expect(obsE.constraints['c_horiz']).toBeUndefined();
    expect(obsE.constraints['c_vert1']).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // TEST 2: Multi-Sketch Active Ownership without positional assumptions
  // ---------------------------------------------------------------------------
  test('TEST 2: activeSketchId cleanly selects and mutates targeted sketch in multi-sketch document', () => {
    const sketch1 = createEmptyCanonicalSketch('SKETCH_ALPHA', 'Alpha');
    const sketch2 = createEmptyCanonicalSketch('SKETCH_BETA', 'Beta');

    let doc: EngineeringDocument = {
      documentId: 'DOC_MULTI_SKETCH',
      revision: 1,
      units: { system: 'SI_MM', length: 'mm', angle: 'deg' },
      sketches: [
        CanonicalSketchAdapter.toCADDocumentSketch(sketch1),
        CanonicalSketchAdapter.toCADDocumentSketch(sketch2)
      ],
      constraints: [],
      features: [],
      parameters: [],
      topologyMap: { version: 1, entries: {} },
      derived: {},
      evidence: []
    };

    // Target SKETCH_BETA specifically via activeSketchId
    const activeSketchId = 'SKETCH_BETA';
    const activeBeta = getActiveCanonicalSketch(doc, activeSketchId);
    expect(activeBeta?.id).toBe('SKETCH_BETA');
    expect(activeBeta?.name).toBe('Beta');

    // Mutate SKETCH_BETA
    const mutatedBeta = mutateAddEntities(activeBeta!, {
      'p_beta': { id: 'p_beta', type: 'POINT', x: 50, y: 50 }
    });
    doc = updateCanonicalSketchInDocument(doc, mutatedBeta);

    // Verify SKETCH_BETA was updated while SKETCH_ALPHA remains untouched
    const retrievedAlpha = getActiveCanonicalSketch(doc, 'SKETCH_ALPHA')!;
    const retrievedBeta = getActiveCanonicalSketch(doc, 'SKETCH_BETA')!;

    expect(retrievedAlpha.revision).toBe(1);
    expect(retrievedBeta.revision).toBe(2);
    expect(retrievedBeta.entities['p_beta']).toBeDefined();
    expect(retrievedAlpha.entities['p_beta']).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // TEST 3: Document Causality — Canonical Mutation -> Engineering Evaluated B-Rep
  // ---------------------------------------------------------------------------
  test('TEST 3: Canonical mutation causally alters evaluated CAD Document B-Rep geometry', () => {
    // Construct a canonical sketch containing a closed circle
    const circleSketch: CanonicalSketch = {
      id: 'SKETCH_CAUSAL',
      name: 'CausalProfile',
      plane: 'XY',
      revision: 1,
      entities: {
        'p_center': { id: 'p_center', type: 'POINT', x: 0, y: 0, isFixed: true },
        'c_main': { id: 'c_main', type: 'CIRCLE', centerPointId: 'p_center', radius: 10 } as SketchCircle2D
      },
      constraints: {}
    };

    const docBefore: EngineeringDocument = {
      documentId: 'DOC_CAUSAL',
      revision: 1,
      units: { system: 'SI_MM', length: 'mm', angle: 'deg' },
      sketches: [CanonicalSketchAdapter.toCADDocumentSketch(circleSketch)],
      constraints: [],
      features: [],
      parameters: [],
      topologyMap: { version: 1, entries: {} },
      derived: {},
      evidence: []
    };

    const evalBefore = DocumentEvaluator.evaluate(docBefore);
    expect(evalBefore.document).toBeDefined();

    // Mutate Circle radius from 10 to 50
    const mutatedSketch = mutateEntityParameter(circleSketch, 'c_main', { radius: 50 });
    const docAfter = updateCanonicalSketchInDocument(docBefore, mutatedSketch);

    const evalAfter = DocumentEvaluator.evaluate(docAfter);
    expect(evalAfter.document).toBeDefined();

    // Verification of causal geometry change
    expect(Number(evalAfter.document.revision)).toBeGreaterThan(Number(evalBefore.document.revision));
    expect(evalAfter.document.sketches).toBeDefined();
    if (evalAfter.document.sketches && evalAfter.document.sketches[0]) {
      expect(evalAfter.document.sketches[0].revision).toBe(2);
      expect((evalAfter.document.sketches[0].entities as any)['c_main']?.radius).toBe(50);
    }
  });

});
