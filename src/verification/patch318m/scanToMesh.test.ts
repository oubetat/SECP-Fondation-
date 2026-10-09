import { describe, it, expect, beforeEach } from 'vitest';
import { ScanToMeshEngine318 } from '../../engine/reverse_engineering/mesh/ScanToMeshEngine318';
import { PointCloudImportService } from '../../engine/reverse_engineering/point_cloud/PointCloudImportService';
import { PointCloudRegistrationEngine } from '../../engine/reverse_engineering/registration/PointCloudRegistrationEngine';
import { ScanToMeshSettings } from '../../engine/reverse_engineering/mesh/ScanMeshTypes318';

describe('PATCH-318: Scan-to-Mesh Forensic Verification', () => {
  let meshEngine: ScanToMeshEngine318;
  let importService: PointCloudImportService;
  let registrationEngine: PointCloudRegistrationEngine;

  beforeEach(() => {
    meshEngine = ScanToMeshEngine318.getInstance();
    importService = PointCloudImportService.getInstance();
    registrationEngine = PointCloudRegistrationEngine.getInstance();
    meshEngine.clearAll();
    importService.clearAll();
    registrationEngine.clearAll();
  });

  it('should perform authentic BPA triangulation with manifold topology', () => {
    // 3x3 Grid (9 points)
    const ply = `ply
format ascii 1.0
element vertex 9
property float x
property float y
property float z
property float intensity
end_header
0 0 0 100
10 0 0 100
20 0 0 100
0 10 0 100
10 10 0 100
20 10 0 100
0 20 0 100
10 20 0 100
20 20 0 100`;

    const raw = importService.importPointCloud(ply, 'test.ply', 'P318', 'R1');
    const regSess = registrationEngine.prepare([raw], raw, { algorithm: 'ICP_POINT_TO_POINT', mode: 'PAIRWISE', units: 'mm' });
    registrationEngine.initialize(regSess);
    // Identity registration for manifold test
    const regCloud = { ...raw, registeredPoints: raw.chunks[0].points.map((p, i) => ({ pointIndex: i, originalPoint: p, transformedPoint: p, sourceDatasetId: 'P318' })), units: 'mm', registrationId: 'REG1', registeredDatasetId: 'P318' };

    const settings: ScanToMeshSettings = {
      algorithm: 'BALL_PIVOTING',
      ballRadiusMm: 15.0,
      knnNeighbors: 8,
      enableNormalReorientation: true,
      cleanupDegenerateTriangles: true,
      engineeringToleranceMm: 0.1,
      units: 'mm',
      executionBackend: 'CPU_SINGLE_THREAD'
    };

    const session = meshEngine.prepare(regCloud as any, settings);
    meshEngine.reconstruct(session);
    meshEngine.validate(session);
    const mesh = meshEngine.commit(session);

    expect(mesh.triangles.length).toBeGreaterThan(0);
    expect(mesh.topologyMetrics.isManifold).toBe(true);
    expect(mesh.topologyMetrics.boundaryEdgeCount).toBeGreaterThan(0);
    expect(mesh.deviationReport.rmseMm).toBeLessThan(0.1); // Identity should have near zero RMSE
  });

  it('should reject NaN coordinates per Rule 11', () => {
    const regCloud = {
      registeredDatasetId: 'P318-BAD',
      registrationId: 'REG-BAD',
      units: 'mm',
      registeredPoints: [
        { pointIndex: 0, transformedPoint: { x: NaN, y: 0, z: 0 } }
      ]
    };

    expect(() => {
      meshEngine.prepare(regCloud as any, { algorithm: 'BALL_PIVOTING', units: 'mm' } as any);
    }).toThrow('INPUT_VALIDATION_ERROR');
  });

  it('should enforce unit consistency between registration and mesh settings', () => {
     const regCloud = {
      registeredDatasetId: 'P318-UNIT',
      registrationId: 'REG-UNIT',
      units: 'm',
      registeredPoints: [
        { pointIndex: 0, transformedPoint: { x: 0, y: 0, z: 0 } }
      ]
    };

    expect(() => {
      meshEngine.prepare(regCloud as any, { algorithm: 'BALL_PIVOTING', units: 'mm' } as any);
    }).toThrow('Unit mismatch');
  });
});
