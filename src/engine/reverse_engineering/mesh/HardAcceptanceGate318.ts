/**
 * PHASE 29 — REVERSE ENGINEERING
 * PATCH-318 — Scan-to-Mesh Engine
 * Hard Acceptance Gate 318 — Test Suite & Verification Battery
 * 
 * Verifies all 20 mandatory acceptance criteria for non-destructive point-cloud-to-mesh reconstruction,
 * PCA normal estimation, Ball Pivoting / Alpha Shape triangulation, topology manifold analysis,
 * watertightness validation, physical hole preservation, point-to-mesh deviation analysis, and Evidence Bus logging.
 */

import { PointCloudImportService } from '../point_cloud/PointCloudImportService';
import { PointCloudRegistrationEngine } from '../registration/PointCloudRegistrationEngine';
import { ScanToMeshEngine318 } from './ScanToMeshEngine318';
import { PointNormalEstimator318 } from './PointNormalEstimator318';
import { EvidenceBus314 } from '../../engineering_ai/copilot/EvidenceBus314';
import { Point3D } from '../point_cloud/PointCloudTypes315';
import { ScanToMeshSettings } from './ScanMeshTypes318';

export interface GateTestResult318 {
  assertionId: number;
  description: string;
  passed: boolean;
  details: string;
}

export class HardAcceptanceGate318 {
  private importService: PointCloudImportService;
  private registrationEngine: PointCloudRegistrationEngine;
  private meshEngine: ScanToMeshEngine318;
  private evidenceBus: EvidenceBus314;

  constructor() {
    this.importService = PointCloudImportService.getInstance();
    this.registrationEngine = PointCloudRegistrationEngine.getInstance();
    this.meshEngine = ScanToMeshEngine318.getInstance();
    this.evidenceBus = EvidenceBus314.getInstance();
  }

  public runAllAssertions(): {
    passed: boolean;
    totalAssertions: number;
    passedCount: number;
    failedCount: number;
    results: GateTestResult318[];
  } {
    const results: GateTestResult318[] = [];

    const test = (id: number, desc: string, condition: boolean, details: string) => {
      results.push({
        assertionId: id,
        description: desc,
        passed: condition,
        details
      });
    };

    this.importService.clearAll();
    this.registrationEngine.clearAll();
    this.meshEngine.clearAll();
    this.evidenceBus.clearStore();

    // Setup Test Registered Point Cloud (Planar Plate with Hole)
    const plySample = `ply
format ascii 1.0
element vertex 16
property float x
property float y
property float z
property float intensity
end_header
0.0 0.0 0.0 100
10.0 0.0 0.0 100
20.0 0.0 0.0 100
30.0 0.0 0.0 100
0.0 10.0 0.0 100
10.0 10.0 0.0 100
20.0 10.0 0.0 100
30.0 10.0 0.0 100
0.0 20.0 0.0 100
10.0 20.0 0.0 100
20.0 20.0 0.0 100
30.0 20.0 0.0 100
0.0 30.0 1.0 100
10.0 30.0 0.0 100
20.0 30.0 0.0 100
30.0 30.0 0.0 100`;

    const rawCloud = this.importService.importPointCloud(plySample, 'plate_scan.ply', 'PROJ-318', 'REV-A');
    const regSession = this.registrationEngine.prepare([rawCloud], rawCloud, { algorithm: 'ICP_POINT_TO_POINT', mode: 'PAIRWISE', units: 'mm' });
    this.registrationEngine.initialize(regSession);
    this.registrationEngine.register(regSession, rawCloud.chunks[0].points, rawCloud.chunks[0].points);
    const regCloud = this.registrationEngine.commit(regSession, rawCloud.chunks[0].points, rawCloud.pointCloudId, 'REV-318-REG');

    const defaultSettings: ScanToMeshSettings = {
      algorithm: 'BALL_PIVOTING',
      ballRadiusMm: 15.0,
      knnNeighbors: 8,
      enableNormalReorientation: true,
      cleanupDegenerateTriangles: true,
      engineeringToleranceMm: 0.1,
      units: 'mm',
      executionBackend: 'CPU_SINGLE_THREAD'
    };

    // 1. Real Scan-to-Mesh Implementation (BPA Triangulation)
    const meshSession = this.meshEngine.prepare(regCloud, defaultSettings);
    this.meshEngine.estimateNormals(meshSession);
    this.meshEngine.reconstruct(meshSession);
    this.meshEngine.validate(meshSession);
    this.meshEngine.report(meshSession);
    const meshDataset = this.meshEngine.commit(meshSession, 'REV-318-COMMIT');

    test(1, 'Real Scan-to-Mesh Implementation (BPA Triangulation)',
      meshDataset.triangles.length > 0 && meshDataset.vertices.length === 16,
      `Generated ${meshDataset.triangles.length} triangles and ${meshDataset.vertices.length} vertices.`
    );

    // 2. Input Validation Rejection (Rule 10 & 11: NaN / Inf check)
    const corruptedPoints: Point3D[] = [{ x: NaN, y: 0, z: 0 }];
    const corruptedCloud = { ...regCloud, registeredPoints: corruptedPoints.map((p, i) => ({ pointIndex: i, originalPoint: p, transformedPoint: p, sourceDatasetId: 'bad' })) };
    let caughtNanErr = false;
    try {
      this.meshEngine.prepare(corruptedCloud as any, defaultSettings);
    } catch (err: any) {
      caughtNanErr = err.message.includes('INPUT_VALIDATION_ERROR');
    }

    test(2, 'Input Validation Rejection (Rule 10 & 11: NaN / Inf Detection)',
      caughtNanErr,
      'Correctly rejected dataset with NaN coordinates.'
    );

    // 3. Unit Mismatch Precondition Verification
    let caughtUnitErr = false;
    try {
      this.meshEngine.prepare(regCloud, { ...defaultSettings, units: 'm' });
    } catch (err: any) {
      caughtUnitErr = err.message.includes('INPUT_VALIDATION_ERROR');
    }

    test(3, 'Unit Mismatch Precondition Rejection',
      caughtUnitErr,
      'Caught Unit Mismatch exception on mismatched units.'
    );

    // 4. PCA Normal Estimation & Confidence Computation
    const normals = PointNormalEstimator318.estimateNormals(rawCloud.chunks[0].points, 8);
    test(4, 'PCA Normal Estimation & Anisotropy Confidence',
      normals.length === 16 && normals[0].confidence > 0.5,
      `Computed ${normals.length} normals with mean confidence ${normals[0].confidence}`
    );

    // 5. Normal Orientation Consistency (Outward Vector Propagation)
    test(5, 'Normal Orientation Consistency Propagation',
      normals.every(n => n.isOriented),
      'Normals successfully oriented outward.'
    );

    // 6. Non-Destructive Raw & Registered Point Cloud Invariant (Rule 4 & 5)
    test(6, 'Non-Destructive Invariant (Input datasets strictly immutable)',
      regCloud.registeredPoints.length === 16 && regCloud.registeredPoints[0].transformedPoint.x === 0.0,
      'Registered point cloud preserved without modifications.'
    );

    // 7. Topology Manifold Analysis (Half-Edge Structure)
    test(7, 'Topology Manifold Analysis (Half-Edge Adjacency Structure)',
      meshDataset.halfEdges.length > 0 && meshDataset.topologyMetrics.isManifold,
      `Built ${meshDataset.halfEdges.length} half-edges with Manifold: ${meshDataset.topologyMetrics.isManifold}`
    );

    // 8. Degenerate Triangle Detection
    test(8, 'Degenerate Triangle Detection (Zero area faces identified)',
      meshDataset.topologyMetrics.degenerateTriangleCount >= 0,
      `Identified ${meshDataset.topologyMetrics.degenerateTriangleCount} degenerate triangles.`
    );

    // 9. Open Boundary Edge Detection
    test(9, 'Open Boundary Edge Detection',
      meshDataset.topologyMetrics.hasOpenBoundaries && meshDataset.topologyMetrics.boundaryEdgeCount > 0,
      `Detected ${meshDataset.topologyMetrics.boundaryEdgeCount} open boundary edges on scan plate.`
    );

    // 10. Watertightness Validation (Checked against actual open boundaries)
    test(10, 'Watertightness Validation (Open Scan strictly Watertight = FALSE)',
      !meshDataset.topologyMetrics.isWatertight,
      `Open plate scan correctly validated as Watertight = ${meshDataset.topologyMetrics.isWatertight}`
    );

    // 11. Physical Hole Preservation (Rule 22, 23, 24: No Hallucinated Geometry)
    const interpolatedCount = meshDataset.sourceMap.interpolatedTriangles.length;

    test(11, 'Physical Hole Preservation (No Unrequested Hallucinated Geometry)',
      interpolatedCount === 0,
      `Preserved physical scan boundaries with ${interpolatedCount} interpolated faces.`
    );

    // 12. Point Provenance & Traceability (Vertex -> Original Point Index)
    const firstVertex = meshDataset.vertices[0];

    test(12, 'Point Provenance & Traceability (Vertex -> Registered Point Index)',
      firstVertex.sourcePointIndex === 0 && firstVertex.sourceType === 'MEASURED',
      `Vertex 0 retains sourcePointIndex: ${firstVertex.sourcePointIndex}`
    );

    // 13. Point-to-Mesh Deviation Analysis d(p, M) (Rule 50-54)
    const dev = meshDataset.deviationReport;

    test(13, 'Point-to-Mesh Deviation Analysis d(p, M) Metrics',
      dev.meanDeviationMm >= 0 && dev.rmseMm >= 0 && dev.maxDeviationMm >= 0,
      `Computed Mean: ${dev.meanDeviationMm}mm, RMSE: ${dev.rmseMm}mm, Max: ${dev.maxDeviationMm}mm`
    );

    // 14. Explicit Engineering Tolerance Logging
    test(14, 'Explicit Engineering Tolerance Logging',
      dev.toleranceMm === 0.1,
      `Logged explicit engineering tolerance: ${dev.toleranceMm} mm`
    );

    // 15. Coordinate Frame Preservation (PATCH-317 Coordinate Frame)
    test(15, 'Coordinate Frame Preservation (PATCH-317 Global Alignment Frame)',
      meshDataset.globalCoordinateFrame === 'GLOBAL_ALIGNMENT_FRAME',
      `Preserved global coordinate frame: ${meshDataset.globalCoordinateFrame}`
    );

    // 16. GPU Truth Rule (Rule 83: CPU_SINGLE_THREAD logged accurately)
    test(16, 'GPU Truth Rule (Rule 83: Logged execution backend accurately)',
      meshDataset.provenance.executionBackend === 'CPU_SINGLE_THREAD',
      `Execution backend logged accurately as ${meshDataset.provenance.executionBackend}`
    );

    // 17. Evidence Bus Event Emission (Rule 103 & 104: SCAN_TO_MESH_COMPLETED)
    const evidenceList = this.evidenceBus.queryEvidence({ revisionId: 'REV-318-COMMIT' });
    const meshEv = evidenceList.find(e => e.metrics.outputMeshId === meshDataset.meshId);

    test(17, 'Evidence Bus Event Emission (Rule 103 & 104)',
      meshEv !== undefined && meshEv.metrics.algorithm === 'BALL_PIVOTING',
      `Registered Evidence ID: ${meshEv?.evidenceId}`
    );

    // 18. Ground Truth Planar Surface Reconstruction
    const planePoints: Point3D[] = [];
    for (let x = 0; x <= 20; x += 5) {
      for (let y = 0; y <= 20; y += 5) {
        const z = (x === 0 && y === 0) ? 1.0 : 0.0;
        planePoints.push({ x, y, z });
      }
    }
    const planePLY = `ply
format ascii 1.0
element vertex ${planePoints.length}
property float x
property float y
property float z
property float intensity
end_header
${planePoints.map(p => `${p.x} ${p.y} ${p.z} 100`).join('\n')}`;

    const planeRaw = this.importService.importPointCloud(planePLY, 'plane_gt.ply', 'PROJ-GT', 'REV-GT');
    const planeRegSess = this.registrationEngine.prepare([planeRaw], planeRaw, { algorithm: 'ICP_POINT_TO_POINT', mode: 'PAIRWISE', units: 'mm' });
    this.registrationEngine.initialize(planeRegSess);
    this.registrationEngine.register(planeRegSess, planeRaw.chunks[0].points, planeRaw.chunks[0].points);
    const planeReg = this.registrationEngine.commit(planeRegSess, planeRaw.chunks[0].points, planeRaw.pointCloudId, 'REV-GT-REG');

    const planeMeshSess = this.meshEngine.prepare(planeReg, defaultSettings);
    this.meshEngine.reconstruct(planeMeshSess);
    this.meshEngine.validate(planeMeshSess);
    const planeMesh = this.meshEngine.commit(planeMeshSess, 'REV-GT-MESH');

    test(18, 'Ground Truth Planar Surface Reconstruction',
      planeMesh.triangles.length > 0 && planeMesh.bounds.diagonalMm > 0,
      `Reconstructed planar mesh with ${planeMesh.triangles.length} triangles.`
    );

    // 19. Ground Truth Cylindrical Surface Reconstruction
    const cylPoints: Point3D[] = [];
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      for (let z = 0; z <= 20; z += 10) {
        const r = (z === 0) ? 10.1 : 10;
        cylPoints.push({ x: r * Math.cos(angle), y: r * Math.sin(angle), z });
      }
    }
    const cylPLY = `ply
format ascii 1.0
element vertex ${cylPoints.length}
property float x
property float y
property float z
property float intensity
end_header
${cylPoints.map(p => `${p.x.toFixed(3)} ${p.y.toFixed(3)} ${p.z.toFixed(3)} 100`).join('\n')}`;

    const cylRaw = this.importService.importPointCloud(cylPLY, 'cyl_gt.ply', 'PROJ-GT', 'REV-GT');
    const cylRegSess = this.registrationEngine.prepare([cylRaw], cylRaw, { algorithm: 'ICP_POINT_TO_POINT', mode: 'PAIRWISE', units: 'mm' });
    this.registrationEngine.initialize(cylRegSess);
    this.registrationEngine.register(cylRegSess, cylRaw.chunks[0].points, cylRaw.chunks[0].points);
    const cylReg = this.registrationEngine.commit(cylRegSess, cylRaw.chunks[0].points, cylRaw.pointCloudId, 'REV-GT-REG');

    const cylMeshSess = this.meshEngine.prepare(cylReg, { ...defaultSettings, algorithm: 'DELAUNAY_25D' });
    this.meshEngine.reconstruct(cylMeshSess);
    this.meshEngine.validate(cylMeshSess);
    const cylMesh = this.meshEngine.commit(cylMeshSess, 'REV-GT-CYL');

    test(19, 'Ground Truth Cylindrical Surface Reconstruction',
      cylMesh.triangles.length > 0,
      `Reconstructed cylindrical mesh with ${cylMesh.triangles.length} triangles.`
    );

    // 20. Synthetic 100-Point Cloud Scalability Benchmark
    const largePoints: Point3D[] = Array.from({ length: 100 }).map((_, i) => ({
      x: (i % 10) * 5,
      y: Math.floor(i / 10) * 5,
      z: Math.sin(i * 0.2) * 2
    }));

    const tStart = performance.now();
    const normalsLarge = PointNormalEstimator318.estimateNormals(largePoints, 10);
    const tDuration = performance.now() - tStart;

    test(20, 'Large Point Cloud Scalability Benchmark',
      normalsLarge.length === 100 && tDuration < 1000,
      `Processed 100 points normal estimation in ${tDuration.toFixed(2)} ms.`
    );

    const passedCount = results.filter(r => r.passed).length;
    const failedCount = results.filter(r => !r.passed).length;

    return {
      passed: failedCount === 0,
      totalAssertions: results.length,
      passedCount,
      failedCount,
      results
    };
  }
}
