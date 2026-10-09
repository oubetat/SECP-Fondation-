/**
 * PHASE 29 — REVERSE ENGINEERING
 * PATCH-316 — Noise Filtering Engine
 * Hard Acceptance Gate 316 — Test Suite & Verification Battery
 * 
 * Verifies all 20 mandatory acceptance criteria for non-destructive point cloud noise filtering,
 * statistical & radius outlier removal algorithms, evidence bus emission, GPU truth rules,
 * parameter validation, conservative filtering, and reproducibility.
 */

import { PointCloudImportService } from '../point_cloud/PointCloudImportService';
import { NativePointCloud, Point3D } from '../point_cloud/PointCloudTypes315';
import { PointCloudFilterEngine } from './PointCloudFilterEngine';
import { EvidenceBus314 } from '../../engineering_ai/copilot/EvidenceBus314';

export interface GateTestResult316 {
  assertionId: number;
  description: string;
  passed: boolean;
  details: string;
}

export class HardAcceptanceGate316 {
  private importService: PointCloudImportService;
  private filterEngine: PointCloudFilterEngine;
  private evidenceBus: EvidenceBus314;

  constructor() {
    this.importService = PointCloudImportService.getInstance();
    this.filterEngine = PointCloudFilterEngine.getInstance();
    this.evidenceBus = EvidenceBus314.getInstance();
  }

  public runAllAssertions(): {
    passed: boolean;
    totalAssertions: number;
    passedCount: number;
    failedCount: number;
    results: GateTestResult316[];
  } {
    const results: GateTestResult316[] = [];

    const test = (id: number, desc: string, condition: boolean, details: string) => {
      results.push({
        assertionId: id,
        description: desc,
        passed: condition,
        details
      });
    };

    this.importService.clearAll();
    this.filterEngine.clearAll();
    this.evidenceBus.clearStore();

    // Setup Test Dataset with Clean Ring + 3 Outlier Noise Points
    const samplePLYWithNoise = `ply
format ascii 1.0
element vertex 12
property float x
property float y
property float z
property float intensity
end_header
0.0 0.0 0.0 100
10.0 0.0 0.0 110
10.0 10.0 0.0 120
0.0 10.0 0.0 130
5.0 0.0 0.0 140
5.0 10.0 0.0 150
0.0 5.0 0.0 160
10.0 5.0 0.0 170
5.0 5.0 0.0 180
100.0 100.0 100.0 10
-50.0 -50.0 -50.0 15
200.0 0.0 0.0 5`;

    const rawCloud = this.importService.importPointCloud(
      samplePLYWithNoise,
      'noisy_housing_scan.ply',
      'PROJ-NOISE-316',
      'REV-316-TEST'
    );

    const initialPointCount = rawCloud.pointCount;

    // 1. Raw Point Cloud Immutability Test (Rule 2 & 3)
    const filterResSOR = this.filterEngine.filter(rawCloud, {
      algorithm: 'STATISTICAL_OUTLIER',
      filterMode: 'APPLY',
      kNeighbors: 4,
      stdDevMultiplier: 1.0,
      conservativeMode: false,
      units: rawCloud.units
    });

    test(1, 'Raw Point Cloud Immutability (Rule 3: Raw data never overwritten)',
      rawCloud.pointCount === initialPointCount && rawCloud.chunks[0].points.length === initialPointCount,
      `Raw cloud point count remains ${rawCloud.pointCount} after filtering.`
    );

    // 2. Derived Dataset Parent Association (Rule 4)
    test(2, 'Derived Dataset Parent Association (Rule 4)',
      filterResSOR.parentDatasetId === rawCloud.pointCloudId && filterResSOR.datasetId.startsWith('FLT-316-'),
      `Derived Dataset ID: ${filterResSOR.datasetId}, Parent ID: ${filterResSOR.parentDatasetId}`
    );

    // 3. Statistical Outlier Removal Functionality
    test(3, 'Statistical Outlier Removal (SOR Algorithm)',
      filterResSOR.removedPointCount >= 2 && filterResSOR.points.length <= 10,
      `SOR removed ${filterResSOR.removedPointCount} noise outliers from ${initialPointCount} raw points.`
    );

    // 4. Radius Outlier Removal Functionality
    const filterResROR = this.filterEngine.filter(rawCloud, {
      algorithm: 'RADIUS_OUTLIER',
      filterMode: 'APPLY',
      searchRadiusMm: 15.0,
      minNeighbors: 3,
      conservativeMode: false,
      units: rawCloud.units
    });

    test(4, 'Radius Outlier Removal (ROR Algorithm)',
      filterResROR.removedPointCount === 3 && filterResROR.points.length === 9,
      `ROR isolated exactly ${filterResROR.removedPointCount} isolated noise points.`
    );

    // 5. Point Count Invariant Equation (Rule 53: Input = Output + Removed)
    test(5, 'Point Count Invariant (Rule 53: Input = Output + Removed)',
      filterResSOR.inputPointCount === (filterResSOR.outputPointCount + filterResSOR.removedPointCount),
      `Input (${filterResSOR.inputPointCount}) = Output (${filterResSOR.outputPointCount}) + Removed (${filterResSOR.removedPointCount})`
    );

    // 6. Explicit Parameter Validation (Rule 43 & 44)
    const valInvalidRadius = this.filterEngine.validate({
      algorithm: 'RADIUS_OUTLIER',
      filterMode: 'APPLY',
      searchRadiusMm: -5.0,
      minNeighbors: 0,
      units: 'mm'
    });

    test(6, 'Explicit Parameter Validation (Rule 43 & 44)',
      !valInvalidRadius.valid && valInvalidRadius.errors.some(e => e.includes('VALIDATION_ERROR')),
      `Caught invalid radius error: ${valInvalidRadius.errors[0]}`
    );

    // 7. Conservative Filtering Mode (Rule 24: Borderline UNCERTAIN points preserved)
    const filterResConservative = this.filterEngine.filter(rawCloud, {
      algorithm: 'STATISTICAL_OUTLIER',
      filterMode: 'APPLY',
      kNeighbors: 4,
      stdDevMultiplier: 1.5,
      conservativeMode: true,
      units: rawCloud.units
    });

    test(7, 'Conservative Filtering Mode (Rule 24)',
      filterResConservative.outputPointCount >= filterResSOR.outputPointCount,
      `Conservative mode retained ${filterResConservative.outputPointCount} points vs aggressive mode ${filterResSOR.outputPointCount}.`
    );

    // 8. Aggressive Filter Warning Trigger (Rule 55 & 56)
    const filterResAggressive = this.filterEngine.filter(rawCloud, {
      algorithm: 'STATISTICAL_OUTLIER',
      filterMode: 'APPLY',
      kNeighbors: 2,
      stdDevMultiplier: 0.1, // Force high removal ratio
      aggressiveThresholdRatio: 0.20,
      units: rawCloud.units
    });

    test(8, 'Aggressive Filter Warning (Rule 55 & 56)',
      filterResAggressive.report.isAggressiveFilter && filterResAggressive.report.warnings.some(w => w.includes('FILTER_AGGRESSIVE')),
      `Generated warning: ${filterResAggressive.report.warnings[0]}`
    );

    // 9. GPU Truth Rule (Rule 35 & 36: Accurately log CPU execution)
    test(9, 'GPU Truth Rule (Rule 35 & 36: No fake GPU execution logged)',
      filterResSOR.provenance.executionBackend === 'CPU_SINGLE_THREAD',
      `Execution backend accurately recorded as: ${filterResSOR.provenance.executionBackend}`
    );

    // 10. Evidence Bus POINT_CLOUD_FILTERED Event Emission (Rule 71 & 72)
    const evidenceList = this.evidenceBus.queryEvidence({ revisionId: 'REV-316-TEST' });
    const filterEv = evidenceList.find(e => e.runId.startsWith('RUN-FLT-'));

    test(10, 'Evidence Bus Event Emission (Rule 71 & 72: POINT_CLOUD_FILTERED)',
      filterEv !== undefined && filterEv.metrics.algorithm === 'STATISTICAL_OUTLIER',
      `Registered Evidence ID: ${filterEv?.evidenceId}`
    );

    // 11. Reproducibility & Determinism (Rule 75)
    const filterResSOR2 = this.filterEngine.filter(rawCloud, {
      algorithm: 'STATISTICAL_OUTLIER',
      filterMode: 'APPLY',
      kNeighbors: 4,
      stdDevMultiplier: 1.0,
      conservativeMode: false,
      units: rawCloud.units
    });

    test(11, 'Reproducibility & Determinism (Rule 75)',
      filterResSOR.outputPointCount === filterResSOR2.outputPointCount &&
      filterResSOR.removedPointCount === filterResSOR2.removedPointCount,
      `Identical output point count (${filterResSOR.outputPointCount}) across independent executions.`
    );

    // 12. Analysis Mode Diagnostics (Rule 39)
    const analysisRes = this.filterEngine.analyze(rawCloud, { algorithm: 'STATISTICAL_OUTLIER' });

    test(12, 'Analysis Mode Diagnostics (Rule 39)',
      analysisRes.estimatedNoiseCount > 0 && analysisRes.globalMeanDistanceMm > 0,
      `Estimated noise count: ${analysisRes.estimatedNoiseCount}, Global Mean Dist: ${analysisRes.globalMeanDistanceMm.toFixed(2)}mm`
    );

    // 13. Outlier Detection API (detect)
    const masks = this.filterEngine.detect(rawCloud, {
      algorithm: 'STATISTICAL_OUTLIER',
      filterMode: 'PREVIEW',
      kNeighbors: 4,
      stdDevMultiplier: 1.0,
      units: rawCloud.units
    });

    test(13, 'Outlier Detection API (detect)',
      masks.length === initialPointCount && masks.some(m => m.noiseScore > 0.5),
      `Generated ${masks.length} point masks with max noise score: ${Math.max(...masks.map(m => m.noiseScore))}`
    );

    // 14. Coordinate Integrity (Rule 47 & 48: Retained points coordinates preserved exactly)
    const firstRetainedPoint = filterResSOR.points[0];
    const matchInRaw = rawCloud.chunks[0].points.find(p => p.x === firstRetainedPoint.x && p.y === firstRetainedPoint.y && p.z === firstRetainedPoint.z);

    test(14, 'Coordinate Integrity (Rule 47: No coordinate smoothing/warp)',
      matchInRaw !== undefined,
      `Retained point (${firstRetainedPoint.x}, ${firstRetainedPoint.y}, ${firstRetainedPoint.z}) exact match found in raw dataset.`
    );

    // 15. Geometry Preservation Metrics (Rule 57)
    test(15, 'Geometry Preservation Metrics (Rule 57)',
      filterResSOR.report.preservationMetrics.spatialBoundsDeltaMm >= 0,
      `Spatial bounds diagonal delta: ${filterResSOR.report.preservationMetrics.spatialBoundsDeltaMm.toFixed(2)}mm`
    );

    // 16. Units Preservation (Rule 45 & 46)
    test(16, 'Units Preservation (Rule 45 & 46)',
      filterResSOR.units === rawCloud.units,
      `Derived dataset units (${filterResSOR.units}) matches raw cloud (${rawCloud.units})`
    );

    // 17. Separated Outlier Audit Array (Rule 25)
    test(17, 'Separated Outlier Audit Array (Rule 25)',
      filterResSOR.removedPoints.length === filterResSOR.removedPointCount,
      `Removed points array contains ${filterResSOR.removedPoints.length} points for visual audit.`
    );

    // 18. Spatial Voxel Downsampling
    const filterResVoxel = this.filterEngine.filter(rawCloud, {
      algorithm: 'SPATIAL_VOXEL',
      filterMode: 'APPLY',
      voxelSizeMm: 10.0,
      units: rawCloud.units
    });

    test(18, 'Spatial Voxel Downsampling Filter',
      filterResVoxel.outputPointCount > 0 && filterResVoxel.outputPointCount < initialPointCount,
      `Voxel downsampled ${initialPointCount} points to ${filterResVoxel.outputPointCount} representative voxel centroids.`
    );

    // 19. Synthetic Ground Truth Outlier Isolation
    const outlierPt = filterResROR.removedPoints.find(p => p.x === 100.0 && p.y === 100.0 && p.z === 100.0);

    test(19, 'Ground Truth Outlier Detection & Isolation',
      outlierPt !== undefined,
      'Synthetic outlier point [100, 100, 100] was correctly identified and isolated in removedPoints.'
    );

    // 20. Multi-Filter Branching (Rule 66 & 67)
    test(20, 'Multi-Filter Branching (Rule 66 & 67)',
      filterResSOR.datasetId !== filterResROR.datasetId &&
      this.importService.getPointCloudById(rawCloud.pointCloudId) !== undefined,
      `Branching created Filter A (${filterResSOR.datasetId}) and Filter B (${filterResROR.datasetId}) from same Raw Cloud (${rawCloud.pointCloudId}).`
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
