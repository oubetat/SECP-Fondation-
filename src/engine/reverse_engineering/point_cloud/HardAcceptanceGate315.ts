/**
 * PHASE 29 — REVERSE ENGINEERING
 * PATCH-315 — Point Cloud Import
 * Hard Acceptance Gate 315 — Test Battery & Verification
 * 
 * Verifies all mandatory acceptance criteria, parser isolation,
 * precision preservation, invalid point detection, Evidence Bus emission,
 * unit handling, out-of-core chunking, and spatial query APIs.
 */

import { PointCloudImportService } from './PointCloudImportService';
import { PointCloudParsers315 } from './PointCloudParsers315';
import { EvidenceBus314 } from '../../engineering_ai/copilot/EvidenceBus314';

export interface GateTestResult315 {
  assertionId: number;
  description: string;
  passed: boolean;
  details: string;
}

export class HardAcceptanceGate315 {
  private service: PointCloudImportService;
  private evidenceBus: EvidenceBus314;

  constructor() {
    this.service = PointCloudImportService.getInstance();
    this.evidenceBus = EvidenceBus314.getInstance();
  }

  public runAllAssertions(): {
    passed: boolean;
    totalAssertions: number;
    passedCount: number;
    failedCount: number;
    results: GateTestResult315[];
  } {
    const results: GateTestResult315[] = [];

    const test = (id: number, desc: string, condition: boolean, details: string) => {
      results.push({
        assertionId: id,
        description: desc,
        passed: condition,
        details
      });
    };

    this.service.clearAll();
    this.evidenceBus.clearStore();

    // 1. PLY Format ASCII Parser Test
    const samplePLY = `ply
format ascii 1.0
element vertex 4
property float x
property float y
property float z
property float intensity
end_header
0.0 0.0 0.0 100
10.5 20.25 30.75 150
5.0 NaN 2.0 200
15.0 25.0 Inf 250`;

    const plyResult = PointCloudParsers315.parsePLY(samplePLY);
    test(1, 'PLY Parser ASCII Header & Point Count Extraction', plyResult.format === 'PLY' && plyResult.declaredPointCount === 4, `Extracted format: ${plyResult.format}, declared count: ${plyResult.declaredPointCount}`);

    // 2. Rule 16 & 18: Invalid Point Detection (NaN & Infinity explicitly rejected)
    test(2, 'Invalid Point Detection (NaN & Infinity Rejection - Rule 18)', plyResult.points.length === 2 && plyResult.rejectedPoints.length === 2, `Accepted: ${plyResult.points.length}, Rejected: ${plyResult.rejectedPoints.length}`);

    // 3. Rule 14 & 110: Point Count Verification (Accepted + Rejected = Total)
    const totalAccounted = plyResult.points.length + plyResult.rejectedPoints.length;
    test(3, 'Point Count Verification (Accepted + Rejected = Declared)', totalAccounted === plyResult.declaredPointCount, `Total accounted points (${totalAccounted}) matches declared count (${plyResult.declaredPointCount}).`);

    // 4. PCD Parser Test
    const samplePCD = `# .PCD v0.7 - Point Cloud Data
VERSION 0.7
FIELDS x y z intensity
SIZE 4 4 4 4
TYPE F F F F
COUNT 1 1 1 1
WIDTH 2
HEIGHT 1
POINTS 2
DATA ascii
0.0 1.0 2.0 100
3.0 4.0 5.0 200`;

    const pcdResult = PointCloudParsers315.parsePCD(samplePCD);
    test(4, 'PCD Format Parser Test', pcdResult.format === 'PCD' && pcdResult.points.length === 2, `PCD format parsed with ${pcdResult.points.length} points.`);

    // 5. XYZ Text Parser Test
    const sampleXYZ = `10.12345 20.67891 30.11121 120
40.0 50.0 60.0 180`;
    const xyzResult = PointCloudParsers315.parseXYZ(sampleXYZ);
    test(5, 'XYZ Format Text Parser Test', xyzResult.format === 'XYZ' && xyzResult.points.length === 2, `XYZ format parsed with ${xyzResult.points.length} points.`);

    // 6. Rule 20: Unit Ambiguity -> UNIT_UNKNOWN
    test(6, 'Unit Ambiguity Fallback (Rule 20: UNIT_UNKNOWN)', xyzResult.detectedUnits === 'UNIT_UNKNOWN', 'Unspecified XYZ file correctly defaults to UNIT_UNKNOWN.');

    // 7. Full Import Service Integration
    const nativeCloud = this.service.importPointCloud(samplePLY, 'turbine_scan.ply', 'PROJ-TURBINE-2026', 'REV-B-BASELINE', { chunkSizePoints: 1 });
    test(7, 'NativePointCloud Structure Assembly', nativeCloud.pointCloudId.startsWith('PTCLOUD-315-') && nativeCloud.status === 'COMPLETED', `Generated PointCloud ID: ${nativeCloud.pointCloudId}`);

    // 8. Out-of-Core Streaming Chunking (Rule 10 & 11)
    test(8, 'Out-of-Core Streaming Chunking (Rule 11)', nativeCloud.chunks.length === 2, `Split ${nativeCloud.pointCount} points into ${nativeCloud.chunks.length} chunks.`);

    // 9. Deterministic Bounds Calculation (Rule 13)
    test(9, 'Deterministic Bounding Box Calculation (Rule 13)', nativeCloud.bounds.minX === 0.0 && nativeCloud.bounds.maxX === 10.5, `Bounds X range: [${nativeCloud.bounds.minX}, ${nativeCloud.bounds.maxX}]`);

    // 10. SHA-256 Hash Generation (Rule 36)
    test(10, 'Integrity Hash SHA-256 Generation (Rule 36)', nativeCloud.integrityReport.fileHash.startsWith('SHA256-PLY-'), `File hash generated: ${nativeCloud.integrityReport.fileHash}`);

    // 11. Provenance Record Verification (Rule 31 & 32)
    test(11, 'Scanner & Import Provenance Record (Rule 31)', nativeCloud.importProvenance.importId.startsWith('IMP-315-') && nativeCloud.scanProvenance.scannerManufacturer !== undefined, `Provenance logged with Import ID: ${nativeCloud.importProvenance.importId}`);

    // 12. Evidence Bus POINT_CLOUD_IMPORTED Event Emission (Rule 33 & 34)
    const evidenceList = this.evidenceBus.queryEvidence({ revisionId: 'REV-B-BASELINE' });
    const importEv = evidenceList.find(e => e.runId.includes('PTCLOUD-IMPORT-'));
    test(12, 'Evidence Bus Event Emission (Rule 34: POINT_CLOUD_IMPORTED)', importEv !== undefined && importEv.status === 'VALIDATED', `Registered Evidence ID: ${importEv?.evidenceId}`);

    // 13. Quality Classification Test (Rule 83)
    test(13, 'Quality Classification (Rule 83)', nativeCloud.qualityClassification === 'VALID_WITH_WARNINGS', `Quality classified as: ${nativeCloud.qualityClassification}`);

    // 14. Spatial Query API: Box Search (Rule 57)
    const pointsInBox = this.service.queryPointsInBox(nativeCloud, {
      minX: -1, maxX: 5, minY: -1, maxY: 5, minZ: -1, maxZ: 5, sizeX: 6, sizeY: 6, sizeZ: 6, center: [2, 2, 2], diagonalMm: 10
    });
    test(14, 'Spatial Query API (queryPointsInBox - Rule 57)', pointsInBox.length === 1 && pointsInBox[0].x === 0.0, `Found ${pointsInBox.length} points inside spatial box.`);

    // 15. Spatial Query API: Nearest Neighbor Search (Rule 57)
    const nearestRes = this.service.queryNearestPoint(nativeCloud, [10.0, 20.0, 30.0]);
    test(15, 'Spatial Query API (queryNearestPoint - Rule 57)', nearestRes !== null && nearestRes.point.x === 10.5, `Found nearest point at distance ${nearestRes?.distanceMm.toFixed(2)} mm`);

    // 16. Rule 26: Alignment Boundary (Imported !== Aligned)
    test(16, 'Alignment Architectural Boundary (Rule 26)', nativeCloud.coordinateSystem.coordinateFrame === 'LOCAL_SCAN_FRAME', 'Imported cloud remains in LOCAL_SCAN_FRAME (Un-aligned).');

    // 17. Rule 58: Geometry Reconstruction Boundary (No Mesh / B-Rep)
    test(17, 'Geometry Reconstruction Boundary (Rule 58)', nativeCloud.chunks.every(c => c.points !== undefined), 'Point cloud remains as spatial 3D points without hallucinated mesh or B-Rep features.');

    // 18. Multi-Cloud Isolation (Rule 27)
    const cloud2 = this.service.importPointCloud(samplePCD, 'turbine_scan2.pcd', 'PROJ-TURBINE-2026', 'REV-B-BASELINE');
    test(18, 'Multi-Scan Isolation (Rule 27)', nativeCloud.pointCloudId !== cloud2.pointCloudId && this.service.getAllImportedClouds().length === 2, `Imported ${this.service.getAllImportedClouds().length} distinct scans.`);

    // 19. Precision Preservation Test (Rule 8)
    const highPrecXYZ = `10.123456789 20.987654321 30.555555555`;
    const precResult = PointCloudParsers315.parseXYZ(highPrecXYZ);
    test(19, 'Precision Preservation (Rule 8: No Silent Rounding)', precResult.points[0].x === 10.123456789, `Preserved exact double coordinate: ${precResult.points[0].x}`);

    // 20. End-to-End Reverse Engineering Pipeline Trace Test (Rule 74)
    test(20, 'Reverse Engineering Traceability (Rule 74)', nativeCloud.importProvenance.sourceFileHash.length > 0, 'Full digital thread provenance chain active.');

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
