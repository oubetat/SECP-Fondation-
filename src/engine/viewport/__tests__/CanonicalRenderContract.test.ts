/**
 * SECP CAD Kernel — Canonical 3D Rendering Contract Test Suite
 * SECP-3D-CANONICAL-CONTRACT-001
 *
 * RIGOROUS AUTOMATED VERIFICATION:
 * - Test A: Canonical identity preservation
 * - Test B: Revision propagation (R1 -> R2)
 * - Test C: Mesh buffer preservation (vertices, normals, indices)
 * - Test D: Topology preservation (faceTriangleMap, edgeVertexMap)
 * - Test E: Determinism across repeated derivations
 * - Test F: Three.js / React / DOM strict architectural isolation
 * - Test G: Prevention of duplicate tessellation
 * - Integration Test: Real End-to-End Pipeline (Document -> Evaluator -> Contract -> BufferGeometry)
 */

import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  createCanonicalRenderData,
  createCanonicalRenderDataFromMesh,
  isRenderDataSynchronized,
  hasTopologicalLineage,
  CanonicalRenderData
} from '../CanonicalRenderContract';
import { convertRenderDataToThreeBufferGeometry } from '../ThreeGeometryConverter';
import { DocumentEvaluator } from '../../cad-kernel/document/DocumentEvaluator';
import { SketchUIIntegration } from '../../cad-kernel/ui-integration/SketchUIIntegration';
import { BRepTessellator, MeshGeometryData } from '../../cad-kernel/tessellation/BRepTessellator';
import { EngineeringDocument } from '../../cad-kernel/document/CADDocument';

describe('SECP-3D-CANONICAL-CONTRACT-001: Canonical 3D Rendering Contract', () => {

  // Test A — Canonical Identity
  it('Test A — preserves canonical documentId in Render Contract', () => {
    const doc = SketchUIIntegration.createPrimitiveDocument('BOX', 'DOC_CYBER_PUMP_01').document;
    const evalResult = DocumentEvaluator.evaluate(doc);
    expect(evalResult.success).toBe(true);

    const renderData = createCanonicalRenderData(evalResult.document);
    expect(renderData.documentId).toBe('DOC_CYBER_PUMP_01');
    expect(renderData.hasGeometry).toBe(true);
  });

  // Test B — Revision Propagation
  it('Test B — strictly propagates revision from EngineeringDocument to Render Contract', () => {
    const doc = SketchUIIntegration.createPrimitiveDocument('BOX', 'DOC_REV_TEST').document;
    doc.revision = 1;
    const evalResult1 = DocumentEvaluator.evaluate(doc);
    const renderData1 = createCanonicalRenderData(evalResult1.document);

    expect(renderData1.revision).toBe(1);
    expect(isRenderDataSynchronized(renderData1, evalResult1.document)).toBe(true);

    // Increment document revision to 2
    const docRev2: EngineeringDocument = {
      ...evalResult1.document,
      revision: 2,
      parameters: evalResult1.document.parameters.map(p => p.name === 'width' ? { ...p, value: 80 } : p)
    };
    const evalResult2 = DocumentEvaluator.evaluate(docRev2);
    const renderData2 = createCanonicalRenderData(evalResult2.document);

    expect(renderData2.revision).toBe(2);
    expect(isRenderDataSynchronized(renderData2, evalResult2.document)).toBe(true);
    // Crucial check: old render data must NOT be considered synchronized with new doc revision
    expect(isRenderDataSynchronized(renderData1, evalResult2.document)).toBe(false);
  });

  // Test C — Mesh Buffer Preservation
  it('Test C — preserves exact vertices, normals, and triangle indices without loss', () => {
    const doc = SketchUIIntegration.createPrimitiveDocument('CYLINDER', 'DOC_CYL_01').document;
    const evalResult = DocumentEvaluator.evaluate(doc);
    expect(evalResult.success).toBe(true);

    const canonicalMesh = evalResult.document.derived.mesh!;
    expect(canonicalMesh).toBeDefined();

    const renderData = createCanonicalRenderData(evalResult.document);
    expect(renderData.vertices.length).toBe(canonicalMesh.vertices.length);
    expect(renderData.normals.length).toBe(canonicalMesh.normals.length);
    expect(renderData.indices.length).toBe(canonicalMesh.indices.length);
    expect(renderData.facesCount).toBe(canonicalMesh.facesCount);

    // Spot-check first few coordinates
    for (let i = 0; i < Math.min(12, canonicalMesh.vertices.length); i++) {
      expect(renderData.vertices[i]).toBe(canonicalMesh.vertices[i]);
    }
  });

  // Test D — Topology Preservation
  it('Test D — preserves topological faceTriangleMap and edgeVertexMap lineage', () => {
    const doc = SketchUIIntegration.createPrimitiveDocument('BOX', 'DOC_BOX_TOPO').document;
    const evalResult = DocumentEvaluator.evaluate(doc);
    expect(evalResult.success).toBe(true);

    const renderData = createCanonicalRenderData(evalResult.document);
    expect(hasTopologicalLineage(renderData)).toBe(true);

    const faceMap = renderData.topologyMap.faceTriangleMap;
    const edgeMap = renderData.topologyMap.edgeVertexMap;
    const originalTopology = evalResult.document.derived.mesh!.topologyMap;

    expect(Object.keys(faceMap).length).toBeGreaterThan(0);
    expect(Object.keys(edgeMap).length).toBeGreaterThan(0);

    // Exact topological face and edge mapping preservation
    expect(Object.keys(faceMap).length).toBe(Object.keys(originalTopology.faceTriangleMap).length);
    expect(Object.keys(edgeMap).length).toBe(Object.keys(originalTopology.edgeVertexMap).length);
    expect(faceMap).toEqual(originalTopology.faceTriangleMap);
    expect(edgeMap).toEqual(originalTopology.edgeVertexMap);
  });

  // Test E — Determinism
  it('Test E — ensures identical canonical document produces identical render data', () => {
    const docA = SketchUIIntegration.createPrimitiveDocument('BOX', 'DOC_DETERMINISTIC').document;
    const docB = SketchUIIntegration.createPrimitiveDocument('BOX', 'DOC_DETERMINISTIC').document;

    const evalA = DocumentEvaluator.evaluate(docA);
    const evalB = DocumentEvaluator.evaluate(docB);

    const renderDataA = createCanonicalRenderData(evalA.document);
    const renderDataB = createCanonicalRenderData(evalB.document);

    expect(renderDataA.brepHash).toBe(renderDataB.brepHash);
    expect(renderDataA.meshHash).toBe(renderDataB.meshHash);
    expect(renderDataA.vertices).toEqual(renderDataB.vertices);
    expect(renderDataA.indices).toEqual(renderDataB.indices);
  });

  // Test F — Three.js / React / DOM Isolation
  it('Test F — proves CanonicalRenderContract has zero dependencies on Three.js, React, or DOM', () => {
    const contractFilePath = path.resolve(__dirname, '../CanonicalRenderContract.ts');
    const sourceCode = fs.readFileSync(contractFilePath, 'utf-8');

    // Forbidden imports in the canonical contract
    expect(sourceCode).not.toMatch(/from\s+['"]three['"]/);
    expect(sourceCode).not.toMatch(/from\s+['"]react['"]/);
    expect(sourceCode).not.toMatch(/from\s+['"]three\//);
    expect(sourceCode).not.toMatch(/document\./);
    expect(sourceCode).not.toMatch(/window\./);
  });

  // Test G — No Duplicate Tessellation
  it('Test G — reuses pre-computed doc.derived.mesh without re-tessellating', () => {
    const doc = SketchUIIntegration.createPrimitiveDocument('BOX', 'DOC_NO_DUP').document;
    const evalResult = DocumentEvaluator.evaluate(doc);
    expect(evalResult.document.derived.mesh).toBeDefined();

    const spy = vi.spyOn(BRepTessellator, 'tessellate');

    // createCanonicalRenderData should read doc.derived.mesh and NOT call BRepTessellator.tessellate again
    const renderData = createCanonicalRenderData(evalResult.document);
    expect(renderData.hasGeometry).toBe(true);
    expect(spy).not.toHaveBeenCalled();

    spy.mockRestore();
  });

  // Integration Test — Real End-to-End Pipeline
  it('Integration Test — converts EngineeringDocument through DocumentEvaluator to RenderContract and Three.js BufferGeometry', () => {
    // 1. Create canonical document with parametric sketch & extrude
    const doc = SketchUIIntegration.createPrimitiveDocument('CYLINDER', 'DOC_E2E_CANONICAL').document;

    // 2. Evaluate with DocumentEvaluator
    const evalResult = DocumentEvaluator.evaluate(doc);
    expect(evalResult.success).toBe(true);

    // 3. Derive CanonicalRenderData
    const renderData = createCanonicalRenderData(evalResult.document);
    expect(renderData.documentId).toBe('DOC_E2E_CANONICAL');
    expect(renderData.hasGeometry).toBe(true);
    expect(renderData.vertices.length).toBeGreaterThan(0);

    // 4. Convert to Three.js BufferGeometry at Presentation Boundary
    const bufferGeo = convertRenderDataToThreeBufferGeometry(renderData, { unitScaleMultiplier: 1000 });
    expect(bufferGeo).toBeDefined();

    const posAttr = bufferGeo.getAttribute('position');
    expect(posAttr).toBeDefined();
    expect(posAttr.count).toBe(renderData.vertices.length / 3);

    // Verify unit scaling (meters * 1000 -> mm)
    const originalFirstZ = renderData.vertices[2];
    const scaledFirstZ = posAttr.getZ(0);
    expect(scaledFirstZ).toBeCloseTo(originalFirstZ * 1000, 4);

    // Verify userData provenance attachment
    expect(bufferGeo.userData.documentId).toBe('DOC_E2E_CANONICAL');
    expect(bufferGeo.userData.brepHash).toBe(renderData.brepHash);
    expect(bufferGeo.userData.meshHash).toBe(renderData.meshHash);
  });
});
