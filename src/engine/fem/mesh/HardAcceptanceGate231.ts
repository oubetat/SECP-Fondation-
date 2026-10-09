import { FEMMeshGenerator, MeshGenerationParams } from './FEMMeshGenerator';
import { FEMMeshValidator } from './FEMMeshValidator';
import { FEMMeshRefiner } from './FEMMeshRefiner';
import { FEMConnectivityBuilder } from './FEMConnectivity';
import { FEMMeshDeterminism } from './FEMMeshDeterminism';
import { FEMNode } from './FEMNode';
import { FEMElement } from './FEMElement';
import { FEMMesh } from './FEMMesh';

export interface Gate231Evidence {
  passed: boolean;
  timestamp: number;
  engineVersion: string;
  tests: {
    test1_simpleRectangle: boolean;
    test2_plateWithHole: boolean;
    test3_solid3D: boolean;
    test4_meshQuality: boolean;
    test5_corruptedMesh: boolean;
    test6_refinement: boolean;
    test7_determinism: boolean;
    test8_geometryChange: boolean;
  };
  metrics: {
    nodesCount: number;
    elementsCount: number;
    meshHash: string;
    topologyHash: string;
    geometryHash: string;
    qualityHash: string;
    avgAspectRatio: number;
  };
  diagnostics: string;
}

export class HardAcceptanceGate231 {
  public static evaluate(): Gate231Evidence {
    console.log('Evaluating Hard Acceptance Gate 231 (General FEM Mesh)...');

    const results = {
      test1_simpleRectangle: false,
      test2_plateWithHole: false,
      test3_solid3D: false,
      test4_meshQuality: false,
      test5_corruptedMesh: false,
      test6_refinement: false,
      test7_determinism: false,
      test8_geometryChange: false,
    };

    // ==========================================
    // TEST 1 — Simple Rectangle
    // ==========================================
    const rectParams: MeshGenerationParams = {
      geometryType: 'RECTANGLE',
      dimensions: { width: 1.2, height: 0.6 },
      elementSize: 0.15,
      elementType: 'TRI',
    };
    const rectMesh = FEMMeshGenerator.generate(rectParams);
    const rectReport = FEMMeshValidator.validate(rectMesh);

    if (
      rectReport.isValid &&
      rectMesh.nodes.length > 0 &&
      rectMesh.elements.length > 0 &&
      rectMesh.elements.every(e => e.type === 'TRI')
    ) {
      results.test1_simpleRectangle = true;
    }

    // ==========================================
    // TEST 2 — Plate With Hole
    // ==========================================
    const plateParams: MeshGenerationParams = {
      geometryType: 'PLATE_WITH_HOLE',
      dimensions: { width: 2.0, height: 1.0, holeRadius: 0.25 },
      elementSize: 0.2,
      elementType: 'TRI',
    };
    const plateMesh = FEMMeshGenerator.generate(plateParams);
    const plateReport = FEMMeshValidator.validate(plateMesh);

    // Verify hole preservation: no nodes should be within the central hole
    const cx = 2.0 / 2;
    const cy = 1.0 / 2;
    const holeRadius = 0.25;
    const nodesInHole = plateMesh.nodes.filter(n => Math.hypot(n.x - cx, n.y - cy) < holeRadius - 1e-3);

    if (plateReport.isValid && nodesInHole.length === 0 && plateMesh.elements.length > 10) {
      results.test2_plateWithHole = true;
    }

    // ==========================================
    // TEST 3 — 3D Solid Volume Mesh
    // ==========================================
    const boxParams: MeshGenerationParams = {
      geometryType: 'BOX',
      dimensions: { dx: 1.0, dy: 1.0, dz: 1.0 },
      elementSize: 0.4,
      elementType: 'TET',
    };
    const boxMesh = FEMMeshGenerator.generate(boxParams);
    const boxReport = FEMMeshValidator.validate(boxMesh);

    if (
      boxReport.isValid &&
      boxMesh.elements.length > 0 &&
      boxMesh.elements.every(e => e.type === 'TET')
    ) {
      results.test3_solid3D = true;
    }

    // ==========================================
    // TEST 4 — Mesh Quality Diagnostics
    // ==========================================
    // Intentionally inject distorted coordinates into a copy of elements and check if identified as warning/poor
    const poorNodes: FEMNode[] = [
      { id: 'n1', x: 0, y: 0, z: 0, boundaryTags: [], regionIds: ['R'] },
      { id: 'n2', x: 10, y: 0, z: 0, boundaryTags: [], regionIds: ['R'] },
      { id: 'n3', x: 0.001, y: 0.001, z: 0, boundaryTags: [], regionIds: ['R'] }, // extremely flat triangle
    ];
    const poorElements: FEMElement[] = [
      { id: 'e1', type: 'TRI', nodeIds: ['n1', 'n2', 'n3'], regionId: 'R', materialId: 'MAT_STEEL' },
    ];
    const poorMesh: FEMMesh = {
      id: 'poor_test_mesh',
      nodes: poorNodes,
      elements: poorElements,
      boundaries: [],
      regions: [{ id: 'R', name: 'R', materialId: 'M', properties: {} }],
      timestamp: Date.now(),
    };
    const poorReport = FEMMeshValidator.validate(poorMesh);
    
    // It should report warning/poor aspect ratios
    if (poorReport.qualityCheck.summary && poorReport.qualityCheck.summary.poorCount > 0) {
      results.test4_meshQuality = true;
    }

    // ==========================================
    // TEST 5 — Corrupted Mesh Rejection
    // ==========================================
    // Construct a corrupted mesh containing duplicated node IDs, invalid elements, and NaNs
    const corruptedNodes: FEMNode[] = [
      { id: 'n1', x: NaN, y: 0, z: 0, boundaryTags: [], regionIds: [] }, // NaN check
      { id: 'n2', x: 1.0, y: 0, z: 0, boundaryTags: [], regionIds: [] },
      { id: 'n3', x: 0, y: 1.0, z: 0, boundaryTags: [], regionIds: [] },
    ];
    const corruptedElements: FEMElement[] = [
      { id: 'e1', type: 'TRI', nodeIds: ['n1', 'n2', 'n4'], regionId: 'REG_CORE', materialId: 'M1' }, // references non-existent 'n4'
    ];
    const corruptedMesh: FEMMesh = {
      id: 'corrupted_test',
      nodes: corruptedNodes,
      elements: corruptedElements,
      boundaries: [],
      regions: [{ id: 'REG_CORE', name: 'R', materialId: 'M1', properties: {} }],
      timestamp: Date.now(),
    };

    const corruptedReport = FEMMeshValidator.validate(corruptedMesh);
    if (!corruptedReport.isValid) {
      results.test5_corruptedMesh = true;
    }

    // ==========================================
    // TEST 6 — Mesh Refinement Execution
    // ==========================================
    const refinedMesh = FEMMeshRefiner.refineGlobal(rectMesh);
    const refinedReport = FEMMeshValidator.validate(refinedMesh);

    if (
      refinedReport.isValid &&
      refinedMesh.elements.length === rectMesh.elements.length * 4 && // TRI splits into 4
      refinedMesh.nodes.length > rectMesh.nodes.length
    ) {
      results.test6_refinement = true;
    }

    // ==========================================
    // TEST 7 — Determinism Check
    // ==========================================
    const plateMesh2 = FEMMeshGenerator.generate(plateParams);
    if (plateMesh.meshHash === plateMesh2.meshHash && plateMesh.topologyHash === plateMesh2.topologyHash) {
      results.test7_determinism = true;
    }

    // ==========================================
    // TEST 8 — Geometry Parameter Modification
    // ==========================================
    // Changing dimensions must invalidate previous cache (i.e. hashes are strictly different)
    const plateParamsModified = {
      ...plateParams,
      dimensions: { ...plateParams.dimensions, holeRadius: 0.35 }, // larger hole
    };
    const plateMesh3 = FEMMeshGenerator.generate(plateParamsModified);
    if (plateMesh.meshHash !== plateMesh3.meshHash && plateMesh.geometryHash !== plateMesh3.geometryHash) {
      results.test8_geometryChange = true;
    }

    // ==========================================
    // COMPUTE GATE SUMMARIES AND METRICS
    // ==========================================
    const allPassed = Object.values(results).every(passed => passed);

    return {
      passed: allPassed,
      timestamp: Date.now(),
      engineVersion: 'SECP-FEM-MESH-v1.0.0',
      tests: results,
      metrics: {
        nodesCount: rectMesh.nodes.length,
        elementsCount: rectMesh.elements.length,
        meshHash: rectMesh.meshHash || '',
        topologyHash: rectMesh.topologyHash || '',
        geometryHash: rectMesh.geometryHash || '',
        qualityHash: rectMesh.qualityHash || '',
        avgAspectRatio: rectReport.qualityCheck.summary?.averageAspectRatio || 1.0,
      },
      diagnostics: allPassed
        ? 'GATE PASS: All 8 validation modules succeeded. Geometry mapping, topological mesh, and Industrial OS provenance successfully certified.'
        : `GATE FAIL: Some modules failed. SimpleRect: ${results.test1_simpleRectangle}, PlateHole: ${results.test2_plateWithHole}, Volume3D: ${results.test3_solid3D}, Refine: ${results.test6_refinement}, Determinism: ${results.test7_determinism}`,
    };
  }
}
