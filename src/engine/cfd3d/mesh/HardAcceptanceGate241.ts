/**
 * SECP Industrial OS — Engineering Truth Platform
 * PATCH-241 — Hard Acceptance Gate (Forensically Upgraded)
 */

import { CfdMesh, CfdMeshMetrics } from './CfdMesh';
import { CfdNode, CfdFace, CfdCell, CfdBoundaryPatch, CfdBoundaryType, CfdCellType } from './CfdGeneralMeshTypes';
import { CfdConnectivity } from './CfdConnectivity';
import { CfdMeshQualityValidator } from './CfdMeshQuality';
import { CfdMeshHasher } from './CfdMeshProvenance';

export interface GateTestReport241 {
  name: string;
  success: boolean;
  details: Record<string, any>;
  assertionsPassed?: number;
  assertionsTotal?: number;
}

export interface GateResult241 {
  gateId: 'HardAcceptanceGate241';
  overallVerdict: 'PASS' | 'FAIL';
  testsPassed: number;
  testsTotal: number;
  testReports: GateTestReport241[];
  timestamp: string;
}

/**
 * HardAcceptanceGate241: Verifies the General Mesh Interface with physical,
 * topological, and mathematical rigor.
 */
export class HardAcceptanceGate241 {
  public static runSuite(): GateResult241 {
    const testReports: GateTestReport241[] = [];

    // Test 01: Tetrahedral Mesh Topological & Geometric Integrity (Gauss Divergence Closure)
    testReports.push(this.testTetraCube());

    // Test 02: Multi-Cell Cube Adjacency & Reciprocal Connectivity
    testReports.push(this.testMultiCellCube());

    // Test 03: Boundary Classification & Patch Bidirectional Binding
    testReports.push(this.testBoundaryClassification());

    // Test 04: Invalid Mesh Detection (Negative & Degenerate Volume)
    testReports.push(this.testNegativeVolume());

    // Test 05: Cryptographic Hash Determinism & Geometric Sensitivity (3 Independent Cases)
    testReports.push(this.testHashDeterminism());

    const testsPassed = testReports.filter(r => r.success).length;
    const testsTotal = testReports.length;
    const overallVerdict = testsPassed === testsTotal ? 'PASS' : 'FAIL';

    return {
      gateId: 'HardAcceptanceGate241',
      overallVerdict,
      testsPassed,
      testsTotal,
      testReports,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Test 01: Validates a 3D tetrahedral cell:
   * - 4 faces wired reciprocally to cell c1
   * - Exact volume matches analytical value: V = 1/6
   * - Closed surface normal vector flux sums to zero (Gauss Divergence Theorem: sum(n_f * A_f) = 0)
   */
  private static testTetraCube(): GateTestReport241 {
    const mesh = new CfdMesh('TETRA_CUBE');
    const nodes = [
      new CfdNode('n0', 0, 0, 0), new CfdNode('n1', 1, 0, 0),
      new CfdNode('n2', 1, 1, 0), new CfdNode('n3', 0, 1, 0),
      new CfdNode('n4', 0, 0, 1), new CfdNode('n5', 1, 0, 1),
      new CfdNode('n6', 1, 1, 1), new CfdNode('n7', 0, 1, 1)
    ];
    nodes.forEach(n => mesh.addNode(n));

    // Tetrahedron with right-handed positive orientation vertices n0, n2, n1, n4
    const cell = new CfdCell('c1', ['n0', 'n2', 'n1', 'n4'], CfdCellType.TETRAHEDRON);
    mesh.addCell(cell);

    // 4 boundary faces of this tetrahedron
    mesh.addFace(new CfdFace('f1', ['n0', 'n1', 'n2']));
    mesh.addFace(new CfdFace('f2', ['n0', 'n1', 'n4']));
    mesh.addFace(new CfdFace('f3', ['n1', 'n2', 'n4']));
    mesh.addFace(new CfdFace('f4', ['n0', 'n2', 'n4']));

    CfdConnectivity.build(mesh);
    CfdMeshMetrics.calculate(mesh);
    const quality = CfdMeshQualityValidator.validate(mesh);

    const c1 = mesh.cells.get('c1')!;
    const f1 = mesh.faces.get('f1')!;
    const f2 = mesh.faces.get('f2')!;
    const f3 = mesh.faces.get('f3')!;
    const f4 = mesh.faces.get('f4')!;

    // 1. Reciprocal face wiring
    const has4Faces = c1.faceIds.length === 4;
    const allFacesPointToCell = [f1, f2, f3, f4].every(f => f.ownerCellId === 'c1' || f.neighbourCellId === 'c1');

    // 2. Analytical volume: V = 1/6 for right tet with orthogonal unit edges
    const analyticalVolume = 1.0 / 6.0;
    const volumeMatchesAnalytical = Math.abs(c1.volume - analyticalVolume) < 1e-6;

    // 3. Gauss Divergence theorem on closed cell: sum of outward normal area vectors = 0
    let sumAx = 0, sumAy = 0, sumAz = 0;
    [f1, f2, f3, f4].forEach(f => {
      // Outward orientation relative to cell center
      const dx = f.center.x - c1.center.x;
      const dy = f.center.y - c1.center.y;
      const dz = f.center.z - c1.center.z;
      const dot = dx * f.normal.x + dy * f.normal.y + dz * f.normal.z;
      const sign = dot >= 0 ? 1 : -1;
      sumAx += sign * f.normal.x * f.area;
      sumAy += sign * f.normal.y * f.area;
      sumAz += sign * f.normal.z * f.area;
    });
    const areaClosureResidual = Math.sqrt(sumAx * sumAx + sumAy * sumAy + sumAz * sumAz);
    const areaClosed = areaClosureResidual < 1e-5;

    const success = quality.valid && has4Faces && allFacesPointToCell && volumeMatchesAnalytical && areaClosed;

    return {
      name: 'Tetrahedral Mesh Topological & Geometric Integrity',
      success,
      assertionsPassed: (quality.valid ? 1 : 0) + (has4Faces ? 1 : 0) + (allFacesPointToCell ? 1 : 0) + (volumeMatchesAnalytical ? 1 : 0) + (areaClosed ? 1 : 0),
      assertionsTotal: 5,
      details: {
        volume: c1.volume,
        analyticalVolume,
        faceCount: c1.faceIds.length,
        areaClosureResidual,
        quality
      }
    };
  }

  /**
   * Test 02: Validates multi-cell shared face adjacency and mutual reciprocity:
   * - Face owner/neighbour match the exact pair {c1, c2}
   * - c1.faceIds contains f_internal AND c2.faceIds contains f_internal
   * - Face is internal (isBoundary() === false)
   */
  private static testMultiCellCube(): GateTestReport241 {
    const mesh = new CfdMesh('MULTI_CELL_CUBE');
    for (let i = 0; i < 12; i++) mesh.addNode(new CfdNode(`n${i}`, i % 2, Math.floor(i/2) % 2, Math.floor(i/4)));
    
    // Two cells sharing nodes n1, n2, n4
    mesh.addCell(new CfdCell('c1', ['n0', 'n1', 'n2', 'n4'], CfdCellType.TETRAHEDRON));
    mesh.addCell(new CfdCell('c2', ['n1', 'n2', 'n4', 'n5'], CfdCellType.TETRAHEDRON));

    // Shared internal face
    const internalFace = new CfdFace('f_internal', ['n1', 'n2', 'n4']);
    mesh.addFace(internalFace);

    CfdConnectivity.build(mesh);
    CfdMeshMetrics.calculate(mesh);
    
    const face = mesh.faces.get('f_internal')!;
    const c1 = mesh.cells.get('c1')!;
    const c2 = mesh.cells.get('c2')!;

    // 1. Both owner and neighbour exist and are distinct
    const hasBothCells = face.ownerCellId !== '' && face.neighbourCellId !== null;
    const cellPair = new Set([face.ownerCellId, face.neighbourCellId]);
    const correctCellPair = cellPair.has('c1') && cellPair.has('c2');

    // 2. Mutual reciprocal wiring
    const c1ContainsFace = c1.faceIds.includes('f_internal');
    const c2ContainsFace = c2.faceIds.includes('f_internal');
    const reciprocalWiring = c1ContainsFace && c2ContainsFace;

    // 3. Topology: internal face is not a boundary face
    const notBoundary = !face.isBoundary();

    const success = hasBothCells && correctCellPair && reciprocalWiring && notBoundary;

    return {
      name: 'Multi-Cell Adjacency & Reciprocal Connectivity',
      success,
      assertionsPassed: (hasBothCells ? 1 : 0) + (correctCellPair ? 1 : 0) + (reciprocalWiring ? 1 : 0) + (notBoundary ? 1 : 0),
      assertionsTotal: 4,
      details: {
        owner: face.ownerCellId,
        neighbour: face.neighbourCellId,
        c1FaceCount: c1.faceIds.length,
        c2FaceCount: c2.faceIds.length,
        isBoundary: face.isBoundary()
      }
    };
  }

  /**
   * Test 03: Validates boundary classification and patch bidirectional binding:
   * - Patch PATCH_INLET exists
   * - f_inlet.isBoundary() === true (neighbourCellId === null)
   * - f_inlet.boundaryPatchId === 'PATCH_INLET' (face points to patch)
   * - patch.faceIds.includes('f_inlet') === true (patch points to face)
   * - patch.type === CfdBoundaryType.INLET
   */
  private static testBoundaryClassification(): GateTestReport241 {
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
    CfdMeshMetrics.calculate(mesh);

    const patch = mesh.patches.get('PATCH_INLET');
    const face = mesh.faces.get('f_inlet')!;

    const patchExists = mesh.patches.has('PATCH_INLET');
    const isBoundary = face.isBoundary();
    const facePointsToPatch = face.boundaryPatchId === 'PATCH_INLET';
    const patchPointsToFace = patch !== undefined && patch.faceIds.includes('f_inlet');
    const correctType = patch?.type === CfdBoundaryType.INLET;

    const success = patchExists && isBoundary && facePointsToPatch && patchPointsToFace && correctType;

    return {
      name: 'Boundary Classification & Patch Bidirectional Binding',
      success,
      assertionsPassed: (patchExists ? 1 : 0) + (isBoundary ? 1 : 0) + (facePointsToPatch ? 1 : 0) + (patchPointsToFace ? 1 : 0) + (correctType ? 1 : 0),
      assertionsTotal: 5,
      details: {
        patchId: face.boundaryPatchId,
        isBoundary: face.isBoundary(),
        patchType: patch?.type,
        patchFaceCount: patch?.faceIds.length
      }
    };
  }

  /**
   * Test 04: Validates negative and zero volume detection with dual independent cases:
   * Case A: Inverted tetrahedron with left-handed orientation -> volume < 0 (true negative volume)
   * Case B: Coplanar flat tetrahedron -> volume = 0 (true degenerate volume)
   */
  private static testNegativeVolume(): GateTestReport241 {
    // Case A: Inverted tetrahedron (true negative volume)
    // Vertices: n0(0,0,0), n1(0,1,0), n2(1,0,0), n3(0,0,-1) -> stp/6 = -1/6
    const meshNegative = new CfdMesh('NEGATIVE_VOL');
    meshNegative.addNode(new CfdNode('n0', 0, 0, 0));
    meshNegative.addNode(new CfdNode('n1', 0, 1, 0));
    meshNegative.addNode(new CfdNode('n2', 1, 0, 0));
    meshNegative.addNode(new CfdNode('n3', 0, 0, -1));
    meshNegative.addCell(new CfdCell('c_neg', ['n0', 'n1', 'n2', 'n3'], CfdCellType.TETRAHEDRON));
    meshNegative.addFace(new CfdFace('f_neg', ['n0', 'n1', 'n2']));

    CfdConnectivity.build(meshNegative);
    CfdMeshMetrics.calculate(meshNegative);
    const qualityNegative = CfdMeshQualityValidator.validate(meshNegative);
    const cellNeg = meshNegative.cells.get('c_neg')!;

    const detectedNegativeVolume = cellNeg.volume < -1e-6 && !qualityNegative.valid && qualityNegative.negativeVolumeCount > 0;

    // Case B: Degenerate coplanar tetrahedron (zero volume)
    // Vertices all on z=0 plane
    const meshDegenerate = new CfdMesh('ZERO_VOL');
    meshDegenerate.addNode(new CfdNode('n0', 0, 0, 0));
    meshDegenerate.addNode(new CfdNode('n1', 1, 0, 0));
    meshDegenerate.addNode(new CfdNode('n2', 2, 0, 0)); // Collinear
    meshDegenerate.addNode(new CfdNode('n3', 0, 1, 0));
    meshDegenerate.addCell(new CfdCell('c_zero', ['n0', 'n1', 'n2', 'n3'], CfdCellType.TETRAHEDRON));
    meshDegenerate.addFace(new CfdFace('f_zero', ['n0', 'n1', 'n2']));

    CfdConnectivity.build(meshDegenerate);
    CfdMeshMetrics.calculate(meshDegenerate);
    const qualityDegenerate = CfdMeshQualityValidator.validate(meshDegenerate);
    const cellZero = meshDegenerate.cells.get('c_zero')!;

    const detectedZeroVolume = Math.abs(cellZero.volume) < 1e-12 && !qualityDegenerate.valid && qualityDegenerate.zeroVolumeCount > 0;

    const success = detectedNegativeVolume && detectedZeroVolume;

    return {
      name: 'Negative & Zero Volume Dual Detection',
      success,
      assertionsPassed: (detectedNegativeVolume ? 1 : 0) + (detectedZeroVolume ? 1 : 0),
      assertionsTotal: 2,
      details: {
        invertedVolume: cellNeg.volume,
        degenerateVolume: cellZero.volume,
        negativeIssues: qualityNegative.issues,
        degenerateIssues: qualityDegenerate.issues
      }
    };
  }

  /**
   * Test 05: Validates deterministic hash integrity with 3 independent test cases:
   * 1. Permutation Invariance: Same nodes in reversed insertion order -> identical hash
   * 2. Coordinate Sensitivity: Perturbation of a single node coordinate (1e-4) -> distinct hash
   * 3. Topological Distinctness: Different mesh topology -> distinct hash
   */
  private static testHashDeterminism(): GateTestReport241 {
    // 1. Base mesh M1
    const m1 = new CfdMesh('M_BASE');
    m1.addNode(new CfdNode('n0', 0, 0, 0));
    m1.addNode(new CfdNode('n1', 1, 0, 0));
    m1.addNode(new CfdNode('n2', 0, 1, 0));
    m1.addCell(new CfdCell('c0', ['n0', 'n1', 'n2'], CfdCellType.TETRAHEDRON));

    // 2. Permuted mesh M2 (nodes added in reverse order)
    const m2 = new CfdMesh('M_BASE');
    m2.addNode(new CfdNode('n2', 0, 1, 0));
    m2.addNode(new CfdNode('n1', 1, 0, 0));
    m2.addNode(new CfdNode('n0', 0, 0, 0));
    m2.addCell(new CfdCell('c0', ['n0', 'n1', 'n2'], CfdCellType.TETRAHEDRON));

    // 3. Perturbed mesh M3 (single coordinate perturbed by 1e-4)
    const m3 = new CfdMesh('M_BASE');
    m3.addNode(new CfdNode('n0', 0, 0, 0));
    m3.addNode(new CfdNode('n1', 1.0001, 0, 0)); // Perturbation
    m3.addNode(new CfdNode('n2', 0, 1, 0));
    m3.addCell(new CfdCell('c0', ['n0', 'n1', 'n2'], CfdCellType.TETRAHEDRON));

    // 4. Distinct topology M4
    const m4 = new CfdMesh('M_DISTINCT');
    m4.addNode(new CfdNode('n0', 0, 0, 0));
    m4.addNode(new CfdNode('n1', 1, 0, 0));
    m4.addNode(new CfdNode('n2', 0, 1, 0));
    m4.addNode(new CfdNode('n3', 0, 0, 1));
    m4.addCell(new CfdCell('c0', ['n0', 'n1', 'n2', 'n3'], CfdCellType.TETRAHEDRON));

    const h1 = CfdMeshHasher.generateHash(m1);
    const h2 = CfdMeshHasher.generateHash(m2);
    const h3 = CfdMeshHasher.generateHash(m3);
    const h4 = CfdMeshHasher.generateHash(m4);

    const isPermutationInvariant = (h1 === h2);
    const isPerturbationSensitive = (h1 !== h3);
    const isTopologyDistinct = (h1 !== h4);

    const success = isPermutationInvariant && isPerturbationSensitive && isTopologyDistinct;

    return {
      name: 'Cryptographic Hash Determinism & Sensitivity (3 Cases)',
      success,
      assertionsPassed: (isPermutationInvariant ? 1 : 0) + (isPerturbationSensitive ? 1 : 0) + (isTopologyDistinct ? 1 : 0),
      assertionsTotal: 3,
      details: {
        h1_base: h1,
        h2_permuted: h2,
        h3_perturbed: h3,
        h4_distinct: h4,
        isPermutationInvariant,
        isPerturbationSensitive,
        isTopologyDistinct
      }
    };
  }
}
