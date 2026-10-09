/**
 * SECP — PATCH-043 Qualification Battery
 * DRAWING CANONICALIZATION
 */

import { describe, it, expect } from 'vitest';
import { asM } from '../../../engine/cad-kernel/core/Units';
import { DrawingEngine, DrawingVerifier } from '../../../engine/cad/drawing/DrawingEngine';
import { DrawingDefinition, DrawingViewDefinition, DrawingDimension } from '../../../engine/cad/drawing/DrawingTypes';
import { DrawingTruthAcceptanceGate } from '../../../engine/cad/drawing/DrawingTruthAcceptanceGate';
import { EngineeringDocument } from '../../../engine/cad-kernel/document/CADDocument';

describe('PATCH-043 Drawing Canonicalization Truth Battery', () => {

  const mockDoc: EngineeringDocument = {
    documentId: 'DOC-123',
    revision: 5,
    type: 'PART',
    units: { length: 'mm', angle: 'deg', mass: 'kg', system: 'SI', force: 'N', pressure: 'Pa' },
    sketches: [],
    constraints: [],
    features: [],
    parameters: [],
    topologyMap: {},
    derived: {},
    evidence: []
  } as any;

  // TEST 01 — BASIC DRAWING LINK
  it('should verify Drawing View derives from the Canonical Model and Revision', () => {
    const drawing = DrawingEngine.createDrawing(mockDoc);
    
    expect(drawing.sourceDocumentId).toBe(mockDoc.documentId);
    expect(drawing.sourceModelRevision).toBe(mockDoc.revision);
    expect(drawing.sheets.length).toBe(1);
  });

  // TEST 02 — ORTHOGRAPHIC PROJECTION
  it('should project B-Rep edges to canonical DrawingLines', () => {
    const view: DrawingViewDefinition = {
      viewId: 'V1',
      sourceDocumentId: mockDoc.documentId,
      sourceModelRevision: mockDoc.revision,
      viewType: 'FRONT',
      projectionDirection: { x: asM(0), y: asM(0), z: asM(-1) },
      upDirection: { x: asM(0), y: asM(1), z: asM(0) },
      origin: { x: 0, y: 0 },
      scale: 1,
      lineage: 'INIT'
    };

    const mockEdges = [
      { id: 'E1', p0: { x: 0, y: 0, z: 0 }, p1: { x: 50, y: 0, z: 0 } },
      { id: 'E2', p0: { x: 50, y: 0, z: 0 }, p1: { x: 50, y: 30, z: 0 } }
    ];

    const projected = DrawingEngine.projectView(view, mockEdges);
    
    expect(projected.length).toBe(2);
    expect(projected[0].sourceGeometryId).toBe('E1');
    expect(projected[0].classification).toBe('VISIBLE');
    expect(projected[0].end.x).toBe(50);
  });

  // TEST 08 — ASSOCIATIVE DIMENSION
  it('should verify Dimension value is calculated from canonical geometry references', () => {
    const dim: DrawingDimension = {
      id: 'D1',
      type: 'LINEAR',
      sourceEntityIds: ['EDGE_WIDTH'],
      value: DrawingEngine.calculateDimensionValue(mockDoc, ['EDGE_WIDTH']),
      placement: { x: 25, y: -10 },
      precision: 3
    };

    expect(dim.value).toBe(50.0);
    expect(DrawingVerifier.verifyDimensionAssociativity(dim, mockDoc)).toBe(true);
  });

  // TEST 15 — MODEL REVISION / STALE DETECTION
  it('should detect stale drawing when model revision increments', () => {
    const drawing = DrawingEngine.createDrawing(mockDoc);
    
    // Add a view to track
    const initialView: DrawingViewDefinition = {
      viewId: 'V1',
      sourceDocumentId: mockDoc.documentId,
      sourceModelRevision: mockDoc.revision,
      viewType: 'FRONT',
      projectionDirection: { x: asM(0), y: asM(0), z: asM(-1) },
      upDirection: { x: asM(0), y: asM(1), z: asM(0) },
      origin: { x: 0, y: 0 },
      scale: 1,
      lineage: 'INIT'
    };
    drawing.sheets[0].views.push(initialView);

    expect(DrawingEngine.isStale(drawing, mockDoc.revision)).toBe(false);
    
    // Model changes
    const updatedDoc = { ...mockDoc, revision: 6 };
    expect(DrawingEngine.isStale(drawing, updatedDoc.revision)).toBe(true);

    // Regenerate
    const updatedView = DrawingEngine.regenerateView(drawing.sheets[0].views[0], updatedDoc);
    expect(updatedView).toBeDefined();
    expect(updatedView.sourceModelRevision).toBe(6);
  });

  // ACCEPTANCE GATE AUDIT
  it('should pass Acceptance Gate Audit with full canonical evidence', () => {
    const drawing = DrawingEngine.createDrawing(mockDoc);
    
    // Add a view and dimension to make audit meaningful
    drawing.sheets[0].views.push({
      viewId: 'V1',
      sourceDocumentId: mockDoc.documentId,
      sourceModelRevision: mockDoc.revision,
      viewType: 'FRONT',
      projectionDirection: { x: asM(0), y: asM(0), z: asM(-1) },
      upDirection: { x: asM(0), y: asM(1), z: asM(0) },
      origin: { x: 0, y: 0 },
      scale: 1,
      lineage: 'INIT'
    });
    drawing.sheets[0].dimensions.push({
      id: 'D1',
      type: 'LINEAR',
      sourceEntityIds: ['EDGE_WIDTH'],
      value: 50,
      placement: { x: 0, y: 0 },
      precision: 2
    });

    const verdicts = DrawingTruthAcceptanceGate.runAudit(mockDoc, drawing);
    expect(verdicts.length).toBeGreaterThan(0);
    verdicts.forEach(v => {
      expect(v.verdict).toBe('PASS');
    });

    const evidence = DrawingTruthAcceptanceGate.generateEvidence(mockDoc, drawing);
    expect(evidence.verdict).toBe('PASS');
    expect(evidence.payload.modelRevision).toBe(mockDoc.revision);
  });

  // NEGATIVE PROOFS
  it('should FAIL verifyDimensionAssociativity if entity references are empty', () => {
    const fakeDim: DrawingDimension = {
      id: 'D1',
      type: 'LINEAR',
      sourceEntityIds: [],
      value: 0,
      placement: { x: 0, y: 0 },
      precision: 2
    };

    expect(DrawingVerifier.verifyDimensionAssociativity(fakeDim, mockDoc)).toBe(false);
  });

});
