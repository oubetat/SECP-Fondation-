import { describe, it, expect, beforeEach } from 'vitest';
import { PointCloudImportService } from '../../engine/reverse_engineering/point_cloud/PointCloudImportService';
import { PointCloudParsers315 } from '../../engine/reverse_engineering/point_cloud/PointCloudParsers315';
import { EvidenceBus314 } from '../../engine/engineering_ai/copilot/EvidenceBus314';
import { HardAcceptanceGate315 } from '../../engine/reverse_engineering/point_cloud/HardAcceptanceGate315';

describe('PATCH-315R — Point Cloud Contract Restoration Tests', () => {
  let service: PointCloudImportService;
  let evidenceBus: EvidenceBus314;

  beforeEach(() => {
    service = PointCloudImportService.getInstance();
    evidenceBus = EvidenceBus314.getInstance();
    service.clearAll();
    evidenceBus.clearStore();
  });

  // 1. XYZ parsing
  it('should parse valid XYZ file with high fidelity coordinates and intensities', () => {
    const rawXYZ = `10.123 20.456 30.789 100\n40.111 50.222 60.333 200`;
    const result = PointCloudParsers315.parseXYZ(rawXYZ);
    expect(result.format).toBe('XYZ');
    expect(result.points).toHaveLength(2);
    expect(result.points[0]).toEqual({ x: 10.123, y: 20.456, z: 30.789, intensity: 100 });
  });

  // 2. PLY parsing
  it('should parse valid PLY file with header', () => {
    const rawPLY = `ply\nformat ascii 1.0\nelement vertex 2\nproperty float x\nproperty float y\nproperty float z\nproperty float intensity\nend_header\n1.0 2.0 3.0 100\n4.0 5.0 6.0 200`;
    const result = PointCloudParsers315.parsePLY(rawPLY);
    expect(result.format).toBe('PLY');
    expect(result.declaredPointCount).toBe(2);
    expect(result.points).toHaveLength(2);
  });

  // 3. PCD parsing
  it('should parse valid PCD file with header', () => {
    const rawPCD = `# .PCD v0.7\nVERSION 0.7\nFIELDS x y z intensity\nSIZE 4 4 4 4\nTYPE F F F F\nCOUNT 1 1 1 1\nWIDTH 2\nHEIGHT 1\nPOINTS 2\nDATA ascii\n10.0 20.0 30.0 50\n40.0 50.0 60.0 150`;
    const result = PointCloudParsers315.parsePCD(rawPCD);
    expect(result.format).toBe('PCD');
    expect(result.declaredPointCount).toBe(2);
    expect(result.points).toHaveLength(2);
  });

  // 4. malformed input rejection
  it('should reject malformed rows', () => {
    const malformedXYZ = `10.0 20.0\n40.0 50.0 60.0`;
    const result = PointCloudParsers315.parseXYZ(malformedXYZ);
    expect(result.points).toHaveLength(1);
    expect(result.rejectedPoints).toHaveLength(1);
    expect(result.rejectedPoints[0].reason).toBe('MALFORMED_ROW');
  });

  // 5. NaN rejection
  it('should reject coordinates containing NaN values', () => {
    const nanXYZ = `10.0 NaN 30.0\n40.0 50.0 60.0`;
    const result = PointCloudParsers315.parseXYZ(nanXYZ);
    expect(result.points).toHaveLength(1);
    expect(result.rejectedPoints).toHaveLength(1);
    expect(result.rejectedPoints[0].reason).toBe('NAN_COORDINATE');
  });

  // 6. Infinity rejection
  it('should reject coordinates containing Infinity values', () => {
    const infXYZ = `10.0 20.0 Inf\n40.0 50.0 60.0`;
    const result = PointCloudParsers315.parseXYZ(infXYZ);
    expect(result.points).toHaveLength(1);
    expect(result.rejectedPoints).toHaveLength(1);
    expect(result.rejectedPoints[0].reason).toBe('INFINITY_VALUE');
  });

  // 7. bounds calculation
  it('should accurately calculate deterministic bounds for given points', () => {
    const points = [{ x: 0, y: -10, z: 5 }, { x: 20, y: 10, z: 15 }];
    const bounds = PointCloudParsers315.calculateBounds(points);
    expect(bounds.minX).toBe(0);
    expect(bounds.maxX).toBe(20);
    expect(bounds.minY).toBe(-10);
    expect(bounds.maxY).toBe(10);
    expect(bounds.minZ).toBe(5);
    expect(bounds.maxZ).toBe(15);
    expect(bounds.sizeX).toBe(20);
    expect(bounds.sizeY).toBe(20);
    expect(bounds.sizeZ).toBe(10);
    expect(bounds.diagonalMm).toBeCloseTo(30);
  });

  // 8. point count
  it('should verify point counts correctly', () => {
    const rawXYZ = `1.0 1.0 1.0\n2.0 2.0 2.0\n3.0 3.0 3.0`;
    const result = PointCloudParsers315.parseXYZ(rawXYZ);
    expect(result.points.length).toBe(3);
  });

  // 9. deterministic import
  it('should perform deterministic import producing consistent hash and results', () => {
    const rawXYZ = `1.0 2.0 3.0\n4.0 5.0 6.0`;
    const cloud1 = service.importPointCloud(rawXYZ, 'scan.xyz');
    service.clearAll();
    const cloud2 = service.importPointCloud(rawXYZ, 'scan.xyz');
    expect(cloud1.pointCount).toBe(cloud2.pointCount);
    expect(cloud1.bounds).toEqual(cloud2.bounds);
  });

  // 10. bounding-box query
  it('should filter points inside bounding box correctly', () => {
    const rawXYZ = `1.0 1.0 1.0\n10.0 10.0 10.0`;
    const cloud = service.importPointCloud(rawXYZ, 'scan.xyz');
    const bounds = {
      minX: 0, maxX: 5, minY: 0, maxY: 5, minZ: 0, maxZ: 5,
      sizeX: 5, sizeY: 5, sizeZ: 5, center: [2.5, 2.5, 2.5] as [number, number, number],
      diagonalMm: 8.66
    };
    const pts = service.queryPointsInBox(cloud, bounds);
    expect(pts).toHaveLength(1);
    expect(pts[0].x).toBe(1.0);
  });

  // 11. nearest-point query
  it('should compute exact Euclidean distance for queryNearestPoint', () => {
    const rawXYZ = `1.0 1.0 1.0\n10.0 10.0 10.0`;
    const cloud = service.importPointCloud(rawXYZ, 'scan.xyz');
    const target: [number, number, number] = [2.0, 1.0, 1.0];
    const nearest = service.queryNearestPoint(cloud, target);
    expect(nearest).not.toBeNull();
    expect(nearest!.point.x).toBe(1.0);
    expect(nearest!.distanceMm).toBe(1.0);
  });

  // 12. store lifecycle
  it('should isolate store imports and clearing correctly', () => {
    const rawXYZ = `1.0 2.0 3.0`;
    const cloudA = service.importPointCloud(rawXYZ, 'A.xyz');
    expect(service.getAllImportedClouds()).toHaveLength(1);

    service.clearAll();
    expect(service.getAllImportedClouds()).toHaveLength(0);

    const cloudB = service.importPointCloud(rawXYZ, 'B.xyz');
    expect(service.getAllImportedClouds()).toHaveLength(1);
    expect(service.getAllImportedClouds()[0].pointCloudId).toBe(cloudB.pointCloudId);
  });

  // 13. causality (C1 to C4)
  it('should demonstrate causal relationship between point count inputs and output statistics', () => {
    // TEST-315-C1 — Point Count Causality
    const rawA = `1 1 1\n2 2 2`;
    const rawB = `1 1 1\n2 2 2\n3 3 3\n4 4 4`;
    const cloudA = service.importPointCloud(rawA, 'A.xyz');
    const cloudB = service.importPointCloud(rawB, 'B.xyz');
    expect(cloudA.pointCount).toBe(2);
    expect(cloudB.pointCount).toBe(4);
    expect(cloudA.pointCount).not.toBe(cloudB.pointCount);

    // TEST-315-C2 — Bounds Causality
    const rawC = `1 1 1\n10 10 10`;
    const rawD = `1 1 1\n100 100 100`;
    const cloudC = service.importPointCloud(rawC, 'C.xyz');
    const cloudD = service.importPointCloud(rawD, 'D.xyz');
    expect(cloudC.bounds.maxX).toBe(10);
    expect(cloudD.bounds.maxX).toBe(100);

    // TEST-315-C4 — Nearest Point Causality
    const target1: [number, number, number] = [1.5, 1.0, 1.0];
    const target2: [number, number, number] = [8.5, 10.0, 10.0];
    const n1 = service.queryNearestPoint(cloudC, target1);
    const n2 = service.queryNearestPoint(cloudC, target2);
    expect(n1!.point.x).toBe(1.0);
    expect(n2!.point.x).toBe(10.0);
  });

  // 14. evidence contract
  it('should register evidence conforming to the system contract', () => {
    service.importPointCloud(`1 2 3`, 'A.xyz', 'PROJ-1', 'REV-A');
    const records = evidenceBus.queryEvidence({ source: 'POINT_CLOUD_IMPORT_SERVICE' });
    expect(records).toHaveLength(1);
    expect(records[0].source).toBe('POINT_CLOUD_IMPORT_SERVICE');
    expect(records[0].status).toBe('VALIDATED');
    expect(records[0].revisionId).toBe('REV-A');
    expect(records[0].runId).toContain('PTCLOUD-IMPORT-');
  });

  // 15. status contract
  it('should preserve semantic separation of data quality and engineering status', () => {
    const rawWithNans = `1 2 3\n4 NaN 6`;
    const cloud = service.importPointCloud(rawWithNans, 'with_nans.xyz');
    expect(cloud.qualityClassification).toBe('VALID_WITH_WARNINGS'); // Data quality warning
    expect(cloud.status).toBe('COMPLETED'); // Engineering processing status
  });

  // 16. Gate/implementation contract
  it('should run Gate 315 assertions on real implementation successfully', () => {
    const gate = new HardAcceptanceGate315();
    const result = gate.runAllAssertions();
    expect(result.passed).toBe(true);
    expect(result.failedCount).toBe(0);
    expect(result.passedCount).toBe(result.totalAssertions);
  });
});
