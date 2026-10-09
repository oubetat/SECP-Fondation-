/**
 * SECP Industrial OS — Engineering Truth Platform
 * PATCH-241 — Hard Acceptance Gate
 */

import { CfdMesh, CfdMeshMetrics } from './CfdMesh';
import { CfdNode, CfdFace, CfdCell, CfdBoundaryPatch, CfdBoundaryType, CfdCellType } from './CfdGeneralMeshTypes';
import { CfdConnectivity } from './CfdConnectivity';
import { CfdMeshQualityValidator } from './CfdMeshQuality';
import { CfdMeshHasher } from './CfdMeshProvenance';

export interface GateResult241 {
  overallVerdict: 'PASS' | 'FAIL';
  testReports: any[];
  timestamp: string;
}

/**
 * HardAcceptanceGate241: Verifies the General Mesh Interface.
 */
export class HardAcceptanceGate241 {
  public static runSuite(): GateResult241 {
    const testReports: any[] = [];

    // Test 01: Tetrahedral Cube
    testReports.push(this.testTetraCube());

    // Test 02: Multi-Cell Cube (Adjacency discovery)
    testReports.push(this.testMultiCellCube());

    // Test 03: Boundary Classification
    testReports.push(this.testBoundaryClassification());

    // Test 04: Invalid Mesh (Negative Volume)
    testReports.push(this.testNegativeVolume());

    // Test 05: Hash Determinism
    testReports.push(this.testHashDeterminism());

    const overallVerdict = testReports.every(r => r.success) ? 'PASS' : 'FAIL';

    return {
      overallVerdict,
      testReports,
      timestamp: new Date().toISOString()
    };
  }

  private static testTetraCube() {
    const mesh = new CfdMesh('TETRA_CUBE');
    // Define 8 nodes of a unit cube
    const nodes = [
      new CfdNode('n0', 0, 0, 0), new CfdNode('n1', 1, 0, 0),
      new CfdNode('n2', 1, 1, 0), new CfdNode('n3', 0, 1, 0),
      new CfdNode('n4', 0, 0, 1), new CfdNode('n5', 1, 0, 1),
      new CfdNode('n6', 1, 1, 1), new CfdNode('n7', 0, 1, 1)
    ];
    nodes.forEach(n => mesh.addNode(n));

    // Simple single tetrahedron using 4 nodes
    const cell = new CfdCell('c1', ['n0', 'n1', 'n2', 'n4'], CfdCellType.TETRAHEDRON);
    mesh.addCell(cell);

    // Add faces for this tet
    mesh.addFace(new CfdFace('f1', ['n0', 'n1', 'n2']));
    mesh.addFace(new CfdFace('f2', ['n0', 'n1', 'n4']));
    mesh.addFace(new CfdFace('f3', ['n1', 'n2', 'n4']));
    mesh.addFace(new CfdFace('f4', ['n0', 'n2', 'n4']));

    CfdConnectivity.build(mesh);
    CfdMeshMetrics.calculate(mesh);
    const quality = CfdMeshQualityValidator.validate(mesh);

    return {
      name: 'Tetrahedral Cube Integrity',
      success: quality.valid && mesh.cells.get('c1')!.volume > 0,
      details: quality
    };
  }

  private static testMultiCellCube() {
    const mesh = new CfdMesh('MULTI_CELL_CUBE');
    // 12 nodes for two stacked cubes
    for (let i = 0; i < 12; i++) mesh.addNode(new CfdNode(`n${i}`, i % 2, Math.floor(i/2) % 2, Math.floor(i/4)));
    
    // Two cells
    mesh.addCell(new CfdCell('c1', ['n0', 'n1', 'n2', 'n4'], CfdCellType.TETRAHEDRON));
    mesh.addCell(new CfdCell('c2', ['n1', 'n2', 'n4', 'n5'], CfdCellType.TETRAHEDRON));

    // Shared internal face
    const internalFace = new CfdFace('f_internal', ['n1', 'n2', 'n4']);
    mesh.addFace(internalFace);

    CfdConnectivity.build(mesh);
    CfdMeshMetrics.calculate(mesh);
    
    const face = mesh.faces.get('f_internal')!;
    const hasBoth = face.ownerCellId !== '' && face.neighbourCellId !== null;

    return {
      name: 'Adjacency Discovery',
      success: hasBoth,
      details: { owner: face.ownerCellId, neighbour: face.neighbourCellId }
    };
  }

  private static testBoundaryClassification() {
    const mesh = new CfdMesh('BOUNDARY_TEST');
    mesh.addNode(new CfdNode('n0', 0, 0, 0));
    mesh.addNode(new CfdNode('n1', 1, 0, 0));
    mesh.addNode(new CfdNode('n2', 0, 1, 0));
    mesh.addNode(new CfdNode('n3', 0, 0, 1));
    
    mesh.addCell(new CfdCell('c1', ['n0', 'n1', 'n2', 'n3']));
    
    const inletFace = new CfdFace('f_inlet', ['n0', 'n1', 'n2']);
    mesh.addFace(inletFace);
    
    mesh.addPatch({
      id: 'PATCH_INLET',
      name: 'Inlet',
      type: CfdBoundaryType.INLET,
      faceIds: ['f_inlet']
    });

    CfdConnectivity.build(mesh);
    
    return {
      name: 'Boundary Patch System',
      success: mesh.patches.has('PATCH_INLET') && mesh.faces.get('f_inlet')!.isBoundary(),
      details: { patches: mesh.patches.size }
    };
  }

  private static testNegativeVolume() {
    const mesh = new CfdMesh('INVALID_VOL');
    // Nodes for a degenerate tetrahedron (flat)
    mesh.addNode(new CfdNode('n0', 0, 0, 0));
    mesh.addNode(new CfdNode('n1', 1, 0, 0));
    mesh.addNode(new CfdNode('n2', 2, 0, 0)); // Collinear
    mesh.addNode(new CfdNode('n3', 0, 1, 0));
    
    mesh.addCell(new CfdCell('c1', ['n0', 'n1', 'n2', 'n3']));
    mesh.addFace(new CfdFace('f1', ['n0', 'n1', 'n2']));
    
    CfdConnectivity.build(mesh);
    CfdMeshMetrics.calculate(mesh);
    const quality = CfdMeshQualityValidator.validate(mesh);

    return {
      name: 'Negative/Zero Volume Detection',
      success: !quality.valid, // Should be invalid
      details: quality.issues
    };
  }

  private static testHashDeterminism() {
    const m1 = new CfdMesh('M1');
    const m2 = new CfdMesh('M1');
    m1.addNode(new CfdNode('n0', 0, 0, 0));
    m2.addNode(new CfdNode('n0', 0, 0, 0));
    
    const h1 = CfdMeshHasher.generateHash(m1);
    const h2 = CfdMeshHasher.generateHash(m2);

    return {
      name: 'Hash Determinism',
      success: h1 === h2,
      details: { h1, h2 }
    };
  }
}
