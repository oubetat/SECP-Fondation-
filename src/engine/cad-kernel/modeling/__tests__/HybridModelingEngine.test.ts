/**
 * SECP CAD Kernel — Hybrid Modeling Engine Integration Tests
 * Phase 2 (PATCH-029)
 */

import { describe, it, expect } from 'vitest';
import { HybridModelingEngine } from '../HybridModelingEngine';
import { ModelingMode } from '../ModelingMode';
import { ModelingOperation } from '../ModelingOperation';
import { BoxFactory } from '../../boolean/BoxFactory';

describe('PATCH-029 — Hybrid Modeling Engine Integration Tests (15 Core Tests)', () => {
  it('TEST 01 — Create parametric feature → regenerate → verify geometry', () => {
    const engine = new HybridModelingEngine('HM_TEST_01', ModelingMode.PARAMETRIC);

    const op: ModelingOperation = {
      operationId: 'OP_CREATE_BOX',
      type: 'PARAMETRIC',
      parametricEdit: {
        id: 'PE_01',
        operation: 'CREATE_FEATURE',
        featureId: 'FEAT_BOX_1',
        featureType: 'EXTRUDE',
        parameterChanges: { minX: -5, minY: -5, minZ: -5, width: 10, length: 10, height: 10 },
        dependencies: [],
        affectedEntities: [],
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    const res = engine.executeOperation(op);

    expect(res.status).toBe('SUCCESS');
    expect(res.revision).toBeDefined();
    expect(res.revision?.geometryHashBefore).not.toBe(res.revision?.geometryHashAfter);
  });

  it('TEST 02 — Direct face modification updates actual B-Rep', () => {
    const initialShape = BoxFactory.createBox('BOX_DIRECT_02', -10, -10, -10, 10, 10, 10);
    const engine = new HybridModelingEngine('HM_TEST_02', ModelingMode.DIRECT, initialShape);

    const faceId = initialShape.outerShell.orientedFaces[0].face.id;

    const op: ModelingOperation = {
      operationId: 'OP_MOVE_FACE',
      type: 'DIRECT',
      directEdit: {
        id: 'DE_01',
        operation: 'MOVE_FACE',
        targetEntityIds: [faceId],
        parameters: { dx: 10, dy: 0, dz: 0 },
        beforeGeometryHash: '',
        afterGeometryHash: '',
        affectedTopologyIds: [],
        tolerance: 1e-7,
        timestamp: new Date().toISOString(),
        parentRevision: ''
      },
      timestamp: new Date().toISOString()
    };

    const res = engine.executeOperation(op);

    expect(res.status).toBe('SUCCESS');
    expect(res.revision?.geometryHashBefore).not.toBe(res.revision?.geometryHashAfter);
  });

  it('TEST 03 — Direct edit of parametric geometry detects dependency impact', () => {
    const engine = new HybridModelingEngine('HM_TEST_03', ModelingMode.PARAMETRIC);

    // Create initial parametric feature
    engine.executeOperation({
      operationId: 'OP_INIT_FEAT',
      type: 'PARAMETRIC',
      parametricEdit: {
        id: 'PE_INIT',
        operation: 'CREATE_FEATURE',
        featureId: 'FEAT_BASE',
        featureType: 'EXTRUDE',
        parameterChanges: { minX: 0, minY: 0, minZ: 0, width: 20, length: 20, height: 20 },
        dependencies: [],
        affectedEntities: [],
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });

    const activeShape = engine.getActiveShape();
    const faceId = activeShape.outerShell.orientedFaces[0].face.id;

    // Apply direct edit targeting parametric entity
    const res = engine.executeOperation({
      operationId: 'OP_DIRECT_ON_PARAM',
      type: 'DIRECT',
      directEdit: {
        id: 'DE_IMPACT',
        operation: 'MOVE_FACE',
        targetEntityIds: [faceId],
        parameters: { dx: 5, dy: 5, dz: 5 },
        beforeGeometryHash: '',
        afterGeometryHash: '',
        affectedTopologyIds: [],
        tolerance: 1e-7,
        timestamp: new Date().toISOString(),
        parentRevision: ''
      },
      timestamp: new Date().toISOString()
    });

    expect(res.status).toBe('SUCCESS');
    expect(res.revision?.dependencyImpact.length).toBeGreaterThan(0);
  });

  it('TEST 04 — Compatible direct edit preserves parametric history as parameter change', () => {
    const engine = new HybridModelingEngine('HM_TEST_04', ModelingMode.PARAMETRIC);

    engine.executeOperation({
      operationId: 'OP_BOX_04',
      type: 'PARAMETRIC',
      parametricEdit: {
        id: 'PE_04',
        operation: 'CREATE_FEATURE',
        featureId: 'FEAT_BOX_04',
        featureType: 'EXTRUDE',
        parameterChanges: { minX: 0, minY: 0, minZ: 0, maxX: 10, maxY: 10, maxZ: 10 },
        dependencies: [],
        affectedEntities: [],
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });

    const activeShape = engine.getActiveShape();
    const targetFaceId = activeShape.outerShell.orientedFaces[0].face.id;

    const res = engine.executeOperation({
      operationId: 'OP_OFFSET_COMPAT',
      type: 'DIRECT',
      directEdit: {
        id: 'DE_OFFSET',
        operation: 'OFFSET_FACE',
        targetEntityIds: [targetFaceId, 'FEAT_BOX_04'],
        parameters: { distance: 15 },
        beforeGeometryHash: '',
        afterGeometryHash: '',
        affectedTopologyIds: [],
        tolerance: 1e-7,
        timestamp: new Date().toISOString(),
        parentRevision: ''
      },
      timestamp: new Date().toISOString()
    });

    expect(res.status).toBe('SUCCESS');
    expect(res.classification).toBe('DIRECT_COMPATIBLE');
  });

  it('TEST 05 — Incompatible direct edit explicitly invalidates feature history', () => {
    const engine = new HybridModelingEngine('HM_TEST_05', ModelingMode.PARAMETRIC);

    engine.executeOperation({
      operationId: 'OP_BOX_05',
      type: 'PARAMETRIC',
      parametricEdit: {
        id: 'PE_05',
        operation: 'CREATE_FEATURE',
        featureId: 'FEAT_COMPLEX_05',
        featureType: 'EXTRUDE',
        parameterChanges: { minX: 0, minY: 0, minZ: 0, width: 10 },
        dependencies: [],
        affectedEntities: [],
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });

    const activeShape = engine.getActiveShape();
    const vId = activeShape.outerShell.orientedFaces[0].face.outerLoop.orientedEdges[0].edge.startVertex.id;

    const res = engine.executeOperation({
      operationId: 'OP_INCOMPAT_VERTEX',
      type: 'DIRECT',
      directEdit: {
        id: 'DE_VERTEX',
        operation: 'MOVE_VERTEX',
        targetEntityIds: [vId, 'FEAT_COMPLEX_05'],
        parameters: { dx: 3.1415, dy: 2.718, dz: 1.414 },
        beforeGeometryHash: '',
        afterGeometryHash: '',
        affectedTopologyIds: [],
        tolerance: 1e-7,
        timestamp: new Date().toISOString(),
        parentRevision: ''
      },
      timestamp: new Date().toISOString()
    });

    expect(res.status).toBe('SUCCESS');
    expect(res.classification).toBe('PARAMETRIC_INVALIDATED');
    expect(engine.getInvalidatedFeatureIds()).toContain('FEAT_COMPLEX_05');
  });

  it('TEST 08 — Parametric → Direct conversion preserves geometry equivalence', () => {
    const engine = new HybridModelingEngine('HM_TEST_08', ModelingMode.PARAMETRIC);

    engine.executeOperation({
      operationId: 'OP_PARAM_SETUP',
      type: 'PARAMETRIC',
      parametricEdit: {
        id: 'PE_P2D',
        operation: 'CREATE_FEATURE',
        featureId: 'FEAT_P2D',
        featureType: 'EXTRUDE',
        parameterChanges: { minX: 0, minY: 0, minZ: 0, width: 30, length: 30, height: 30 },
        dependencies: [],
        affectedEntities: [],
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });

    const beforeHash = engine.getLatestRevision()?.geometryHashAfter;

    const p2dRes = engine.parametricToDirect();

    expect(p2dRes.status).toBe('SUCCESS');
    expect(p2dRes.mode).toBe(ModelingMode.DIRECT);
    expect(p2dRes.revision?.geometryHashAfter).toBe(beforeHash);
  });

  it('TEST 09 — Direct → Parametric conversion for a deterministic supported case', () => {
    const simpleBox = BoxFactory.createBox('BOX_D2P', 0, 0, 0, 20, 20, 20);
    const engine = new HybridModelingEngine('HM_TEST_09', ModelingMode.DIRECT, simpleBox);

    const d2pRes = engine.directToParametric();

    expect(d2pRes.status).toBe('SUCCESS');
    expect(d2pRes.mode).toBe(ModelingMode.PARAMETRIC);
    expect(engine.getFeatureHistory().getAllFeatures().length).toBe(1);
  });

  it('TEST 10 — Unsupported direct → parametric conversion returns UNSUPPORTED', () => {
    const complexBox = BoxFactory.createBox('BOX_COMPLEX', 0, 0, 0, 20, 20, 20);
    // Artificially double vertex count to simulate high complexity
    complexBox.outerShell.orientedFaces.forEach(of => {
      of.face.innerLoops = [{ id: 'LOOP_HOLE_1', shapeType: 'LOOP' as any, orientedEdges: [] }];
    });

    const engine = new HybridModelingEngine('HM_TEST_10', ModelingMode.DIRECT, complexBox);

    const d2pRes = engine.directToParametric();

    expect(d2pRes.status).toBe('UNSUPPORTED');
  });

  it('TEST 14 — Topology corruption is detected after adversarial modification', () => {
    const corruptedBox = BoxFactory.createBox('BOX_CORRUPT', 0, 0, 0, 10, 10, 10);
    // Break topology reference
    corruptedBox.outerShell.orientedFaces[0].face.outerLoop.orientedEdges[0].edge.startVertex = null as any;

    const engine = new HybridModelingEngine('HM_TEST_14', ModelingMode.DIRECT, corruptedBox);

    const op: ModelingOperation = {
      operationId: 'OP_CORRUPT_TEST',
      type: 'DIRECT',
      directEdit: {
        id: 'DE_CORRUPT',
        operation: 'MOVE_FACE',
        targetEntityIds: [corruptedBox.outerShell.orientedFaces[0].face.id],
        parameters: { dx: 1 },
        beforeGeometryHash: '',
        afterGeometryHash: '',
        affectedTopologyIds: [],
        tolerance: 1e-7,
        timestamp: new Date().toISOString(),
        parentRevision: ''
      },
      timestamp: new Date().toISOString()
    };

    const res = engine.executeOperation(op);

    expect(res.status).toBe('FAILED');
    expect(res.diagnostics.length).toBeGreaterThan(0);
  });

  it('TEST 15 — Provenance graph contains the modeling operation', () => {
    const engine = new HybridModelingEngine('HM_TEST_15', ModelingMode.PARAMETRIC);

    engine.executeOperation({
      operationId: 'OP_PROVENANCE_15',
      type: 'PARAMETRIC',
      parametricEdit: {
        id: 'PE_15',
        operation: 'CREATE_FEATURE',
        featureId: 'FEAT_PROV_15',
        featureType: 'EXTRUDE',
        parameterChanges: { minX: 0, minY: 0, minZ: 0, width: 10 },
        dependencies: [],
        affectedEntities: [],
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });

    const provGraph = engine.getProvenanceGraph();
    expect(provGraph).toBeDefined();
    expect(provGraph.getNodes().length).toBeGreaterThan(0);
  });
});
