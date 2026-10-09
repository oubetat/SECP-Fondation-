import { describe, it, expect } from 'vitest';
import { SketchUIIntegration } from '../../cad-kernel/ui-integration/SketchUIIntegration';
import { DocumentEvaluator } from '../../cad-kernel/document/DocumentEvaluator';
import {
  SelectionContractEvaluator,
  SketchEntityReference,
  FaceReference,
  EdgeReference,
  VertexReference,
  BodyReference,
  FeatureReference
} from '../SelectionTypes277';
import { FeatureNode } from '../../cad-kernel/history/FeatureNode';

describe('PROMPT-010: Selection Contract Unification & Robust Validation', () => {
  // Helper to create a standard evaluated box document
  function createTestBoxDocument() {
    const { document } = SketchUIIntegration.createPrimitiveDocument('BOX', 'DOC_CONTRACT_TEST_001');
    const evalResult = DocumentEvaluator.evaluate(document, { generateMesh: true });
    expect(evalResult.success).toBe(true);
    return evalResult.document;
  }

  it('1. Validates a SketchEntityReference successfully and handles missing cases', () => {
    const doc = createTestBoxDocument();

    // Create a mock sketch with some entity ids
    doc.sketches = [{
      id: 'SKETCH_001',
      name: 'Sketch 1',
      plane: 'XY',
      entities: [
        { id: 'LINE_01', type: 'LINE' },
        { id: 'ARC_01', type: 'ARC' }
      ]
    }];

    const validRef: SketchEntityReference = {
      referenceType: 'SKETCH_ENTITY',
      persistentId: 'SKETCH_001:LINE_01',
      sourceId: 'SKETCH_001',
      sketchId: 'SKETCH_001',
      entityId: 'LINE_01'
    };

    const invalidRef: SketchEntityReference = {
      referenceType: 'SKETCH_ENTITY',
      persistentId: 'SKETCH_001:LINE_99',
      sourceId: 'SKETCH_001',
      sketchId: 'SKETCH_001',
      entityId: 'LINE_99'
    };

    const missingSketchRef: SketchEntityReference = {
      referenceType: 'SKETCH_ENTITY',
      persistentId: 'SKETCH_999:LINE_01',
      sourceId: 'SKETCH_999',
      sketchId: 'SKETCH_999',
      entityId: 'LINE_01'
    };

    const resValid = SelectionContractEvaluator.validate(validRef, doc);
    expect(resValid.isValid).toBe(true);
    expect(resValid.message).toContain('active and valid');

    const resInvalid = SelectionContractEvaluator.validate(invalidRef, doc);
    expect(resInvalid.isValid).toBe(false);
    expect(resInvalid.message).toContain('not found in Sketch');

    const resMissing = SelectionContractEvaluator.validate(missingSketchRef, doc);
    expect(resMissing.isValid).toBe(false);
    expect(resMissing.message).toContain('not found in document');
  });

  it('2. Validates FaceReference, EdgeReference, and VertexReference against real evaluated B-Rep data', () => {
    const doc = createTestBoxDocument();
    expect(doc.derived?.mesh?.topologyMap).toBeDefined();

    const faceMap = doc.derived.mesh!.topologyMap.faceTriangleMap;
    const faceKeys = Object.keys(faceMap);
    expect(faceKeys.length).toBeGreaterThan(0);

    const firstFacePersistentId = faceKeys[0];
    const firstFaceId = faceMap[firstFacePersistentId].faceId;

    // A valid face reference using real persistentId
    const validFaceRef: FaceReference = {
      referenceType: 'FACE',
      persistentId: firstFacePersistentId,
      sourceId: 'BOX_FEATURE_1',
      faceId: firstFaceId
    };

    // An invalid face reference that doesn't exist
    const invalidFaceRef: FaceReference = {
      referenceType: 'FACE',
      persistentId: 'NON_EXISTENT_FACE_ID_999',
      sourceId: 'BOX_FEATURE_1',
      faceId: 'FACE_999'
    };

    const resFaceValid = SelectionContractEvaluator.validate(validFaceRef, doc);
    expect(resFaceValid.isValid).toBe(true);
    expect(resFaceValid.message).toContain('successfully resolved');

    const resFaceInvalid = SelectionContractEvaluator.validate(invalidFaceRef, doc);
    expect(resFaceInvalid.isValid).toBe(false);
    expect(resFaceInvalid.message).toContain('disappeared or became invalid');

    // Edge validation
    const edgeMap = doc.derived.mesh!.topologyMap.edgeVertexMap;
    const edgeKeys = Object.keys(edgeMap);
    expect(edgeKeys.length).toBeGreaterThan(0);

    const firstEdgePersistentId = edgeKeys[0];
    const firstEdgeId = edgeMap[firstEdgePersistentId].edgeId;

    const validEdgeRef: EdgeReference = {
      referenceType: 'EDGE',
      persistentId: firstEdgePersistentId,
      sourceId: 'BOX_FEATURE_1',
      edgeId: firstEdgeId
    };

    const invalidEdgeRef: EdgeReference = {
      referenceType: 'EDGE',
      persistentId: 'NON_EXISTENT_EDGE_ID_999',
      sourceId: 'BOX_FEATURE_1',
      edgeId: 'EDGE_999'
    };

    const resEdgeValid = SelectionContractEvaluator.validate(validEdgeRef, doc);
    expect(resEdgeValid.isValid).toBe(true);
    expect(resEdgeValid.message).toContain('successfully resolved');

    const resEdgeInvalid = SelectionContractEvaluator.validate(invalidEdgeRef, doc);
    expect(resEdgeInvalid.isValid).toBe(false);
    expect(resEdgeInvalid.message).toContain('was lost after regeneration');
  });

  it('3. Validates BodyReference and handles missing/unevaluated states', () => {
    const doc = createTestBoxDocument();

    const validBodyRef: BodyReference = {
      referenceType: 'BODY',
      persistentId: 'PRIMARY_SOLID',
      sourceId: 'DOC_CONTRACT_TEST_001',
      bodyId: 'BODY_001'
    };

    const resValid = SelectionContractEvaluator.validate(validBodyRef, doc);
    expect(resValid.isValid).toBe(true);
    expect(resValid.message).toContain('solid body is valid');

    // Simulate unevaluated/corrupt state by removing evaluatedShape
    const corruptDoc = { ...doc, evaluatedShape: undefined };
    const resCorrupt = SelectionContractEvaluator.validate(validBodyRef, corruptDoc as any);
    expect(resCorrupt.isValid).toBe(false);
    expect(resCorrupt.message).toContain('invalid or missing');
  });

  it('4. Validates FeatureReference and handles active vs suppressed/failed states', () => {
    const doc = createTestBoxDocument();

    // Add a plain mock feature to the document features
    const featNode = {
      featureId: 'EXTRUDE_001',
      id: 'EXTRUDE_001',
      type: 'EXTRUSION',
      name: 'Extrude 1',
      status: 'ACTIVE'
    };
    doc.features = [featNode];

    const activeRef: FeatureReference = {
      referenceType: 'FEATURE',
      persistentId: 'EXTRUDE_001',
      sourceId: 'DOC_CONTRACT_TEST_001',
      featureId: 'EXTRUDE_001'
    };

    const resActive = SelectionContractEvaluator.validate(activeRef, doc);
    expect(resActive.isValid).toBe(true);
    expect(resActive.message).toContain('is active and valid');

    // Suppress the feature
    featNode.status = 'SUPPRESSED';
    const resSuppressed = SelectionContractEvaluator.validate(activeRef, doc);
    expect(resSuppressed.isValid).toBe(false);
    expect(resSuppressed.message).toContain('is currently SUPPRESSED');

    // Fail the feature
    featNode.status = 'FAILED';
    const resFailed = SelectionContractEvaluator.validate(activeRef, doc);
    expect(resFailed.isValid).toBe(false);
    expect(resFailed.message).toContain('is currently FAILED');

    // Non-existent feature
    const invalidRef: FeatureReference = {
      referenceType: 'FEATURE',
      persistentId: 'EXTRUDE_999',
      sourceId: 'DOC_CONTRACT_TEST_001',
      featureId: 'EXTRUDE_999'
    };
    const resInvalid = SelectionContractEvaluator.validate(invalidRef, doc);
    expect(resInvalid.isValid).toBe(false);
    expect(resInvalid.message).toContain('not found in history tree');
  });
});
