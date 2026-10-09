import { describe, it, expect, beforeEach } from 'vitest';
import { PointCloudImportService } from '../../engine/reverse_engineering/point_cloud/PointCloudImportService';
import { PointCloudFilterEngine } from '../../engine/reverse_engineering/filtering/PointCloudFilterEngine';
import { StatisticalOutlierFilter316 } from '../../engine/reverse_engineering/filtering/StatisticalOutlierFilter316';
import { EvidenceBus314 } from '../../engine/engineering_ai/copilot/EvidenceBus314';
import { HardAcceptanceGate316 } from '../../engine/reverse_engineering/filtering/HardAcceptanceGate316';
import { Point3D } from '../../engine/reverse_engineering/point_cloud/PointCloudTypes315';

describe('PATCH-316R — Statistical Outlier Removal (SOR) Forensic Verification & Causality', () => {
  let importService: PointCloudImportService;
  let filterEngine: PointCloudFilterEngine;
  let evidenceBus: EvidenceBus314;

  beforeEach(() => {
    importService = PointCloudImportService.getInstance();
    filterEngine = PointCloudFilterEngine.getInstance();
    evidenceBus = EvidenceBus314.getInstance();
    importService.clearAll();
    evidenceBus.clearStore();
  });

  // ==========================================
  // 1. INDEPENDENT SOR MATHS VERIFICATION
  // ==========================================
  it('should verify actual SOR mathematics using independent hand-calculated values on a 4-point cloud', () => {
    // 4 points with highly predictable nearest neighbor distances (k=1)
    // Point 0: [0, 0, 0]    -> Nearest to Point 1 (dist = 3.0)
    // Point 1: [3, 0, 0]    -> Nearest to Point 0 (dist = 3.0)
    // Point 2: [0, 4, 0]    -> Nearest to Point 0 (dist = 4.0)
    // Point 3: [100, 100, 100] -> Nearest to Point 2 (dist = sqrt(100^2 + 96^2 + 100^2) = 170.9269)
    const points: Point3D[] = [
      { x: 0, y: 0, z: 0, intensity: 100 },
      { x: 3, y: 0, z: 0, intensity: 100 },
      { x: 0, y: 4, z: 0, intensity: 100 },
      { x: 100, y: 100, z: 100, intensity: 100 }
    ];

    // Independent manual calculation values:
    // Mean neighbor distances (d_i): [3.0, 3.0, 4.0, 170.92688]
    // mu = (3.0 + 3.0 + 4.0 + 170.92688) / 4 = 45.23172
    // sigma^2 = ((3.0 - mu)^2 * 2 + (4.0 - mu)^2 + (170.92688 - mu)^2) / 4 = 5266.641
    // sigma = sqrt(5266.641) = 72.5716
    // Threshold (alpha = 1.0) = mu + 1.0 * sigma = 45.23172 + 72.5716 = 117.8033
    const expectedMean = 45.2317;
    const expectedStdDev = 72.5716;
    const expectedThreshold = 117.8033;

    const result = StatisticalOutlierFilter316.process(points, {
      algorithm: 'STATISTICAL_OUTLIER',
      filterMode: 'APPLY',
      kNeighbors: 1,
      stdDevMultiplier: 1.0,
      conservativeMode: false,
      units: 'mm'
    });

    // Check exact statistical values
    expect(result.globalMeanDistanceMm).toBeCloseTo(expectedMean, 2);
    expect(result.globalStdDevMm).toBeCloseTo(expectedStdDev, 2);

    // Outlier masks check
    expect(result.outlierMasks).toHaveLength(4);
    
    // Point 3 must be flagged as REMOVE because d3 (170.9269) > Threshold (117.8033)
    const mask3 = result.outlierMasks.find(m => m.pointIndex === 3);
    expect(mask3).toBeDefined();
    expect(mask3!.classification).toBe('REMOVE');
    expect(mask3!.metricValue).toBeCloseTo(170.9269, 2);

    // Points 0, 1, 2 must be flagged as KEEP because d_i <= Threshold (113.2361)
    const mask0 = result.outlierMasks.find(m => m.pointIndex === 0);
    const mask1 = result.outlierMasks.find(m => m.pointIndex === 1);
    const mask2 = result.outlierMasks.find(m => m.pointIndex === 2);

    expect(mask0!.classification).toBe('KEEP');
    expect(mask1!.classification).toBe('KEEP');
    expect(mask2!.classification).toBe('KEEP');

    expect(result.removedPoints).toHaveLength(1);
    expect(result.removedPoints[0]).toEqual(points[3]);
  });

  // ==========================================
  // 2. TWO-CLOUD TWIN CAUSALITY VERIFICATION
  // ==========================================
  it('should prove twin causality under varying outlier coordinates and configurations', () => {
    // Shared normal cluster base (4 dense points)
    const clusterXYZ = `0 0 0\n1 0 0\n0 1 0\n1 1 0`;

    // Outlier A at [100, 100, 100]
    const rawCloudA = importService.importPointCloud(
      `${clusterXYZ}\n100 100 100`,
      'cloud_a.xyz',
      'PROJ-CAUSAL',
      'REV-316'
    );

    // Outlier B at [-50, 75, -100] (different coordinates, metrics, noise signatures)
    const rawCloudB = importService.importPointCloud(
      `${clusterXYZ}\n-50 75 -100`,
      'cloud_b.xyz',
      'PROJ-CAUSAL',
      'REV-316'
    );

    const resA = filterEngine.filter(rawCloudA, {
      algorithm: 'STATISTICAL_OUTLIER',
      filterMode: 'APPLY',
      kNeighbors: 2,
      stdDevMultiplier: 1.0,
      conservativeMode: false,
      units: 'mm'
    });

    const resB = filterEngine.filter(rawCloudB, {
      algorithm: 'STATISTICAL_OUTLIER',
      filterMode: 'APPLY',
      kNeighbors: 2,
      stdDevMultiplier: 1.0,
      conservativeMode: false,
      units: 'mm'
    });

    // Check removed identities and coordinates differ between the runs
    expect(resA.removedPoints).toHaveLength(1);
    expect(resB.removedPoints).toHaveLength(1);

    expect(resA.removedPoints[0].x).toBe(100);
    expect(resB.removedPoints[0].x).toBe(-50);

    // Check statistical metrics differ
    expect(resA.report.globalMeanDistanceMm).not.toBe(resB.report.globalMeanDistanceMm);
    expect(resA.report.globalStdDevMm).not.toBe(resB.report.globalStdDevMm);

    // Check noise scores differ for the respective outliers
    const outlierMaskA = resA.outlierMasks.find(m => m.pointIndex === 4);
    const outlierMaskB = resB.outlierMasks.find(m => m.pointIndex === 4);
    expect(outlierMaskA!.noiseScore).not.toBe(outlierMaskB!.noiseScore);

    // Cloud C: Same normal cluster with absolutely no outlier
    const rawCloudC = importService.importPointCloud(
      clusterXYZ,
      'cloud_c.xyz',
      'PROJ-CAUSAL',
      'REV-316'
    );

    const resC = filterEngine.filter(rawCloudC, {
      algorithm: 'STATISTICAL_OUTLIER',
      filterMode: 'APPLY',
      kNeighbors: 2,
      stdDevMultiplier: 1.0,
      conservativeMode: false,
      units: 'mm'
    });

    // In a clean, highly uniform cluster, no points should stand out statistically
    expect(resC.removedPointCount).toBe(0);
  });

  // ==========================================
  // 3. K-NEIGHBORS DENSITY WINDOW BOUNDARIES
  // ==========================================
  it('should bound density window correctly using effectiveK = min(requestedK, N - 1) contract', () => {
    // 12 points raw dataset
    const rawXYZ = `0 0 0\n5 0 0\n10 0 0\n0 5 0\n5 5 0\n10 5 0\n0 10 0\n5 10 0\n10 10 0\n100 100 100\n-50 -50 -50\n200 0 0`;
    const rawCloud = importService.importPointCloud(rawXYZ, 'scan_boundary_k.xyz', 'PROJ-BOUND', 'REV-316');

    // Test cases for requested k:
    const kCases = [1, 5, 11, 20, 50];

    for (const requestedK of kCases) {
      const res = filterEngine.filter(rawCloud, {
        algorithm: 'STATISTICAL_OUTLIER',
        filterMode: 'APPLY',
        kNeighbors: requestedK,
        stdDevMultiplier: 1.0,
        conservativeMode: false,
        units: 'mm'
      });

      // No crash should happen, results should be stable
      expect(res).toBeDefined();
      expect(res.inputPointCount).toBe(12);
      
      // Verification of effectiveK logic:
      // If requestedK is larger than 11, the filter should cap it at 11 and produce identical output to k=11
      if (requestedK >= 11) {
        const res11 = filterEngine.filter(rawCloud, {
          algorithm: 'STATISTICAL_OUTLIER',
          filterMode: 'APPLY',
          kNeighbors: 11,
          stdDevMultiplier: 1.0,
          conservativeMode: false,
          units: 'mm'
        });
        expect(res.outputPointCount).toBe(res11.outputPointCount);
        expect(res.removedPointCount).toBe(res11.removedPointCount);
        expect(res.report.globalMeanDistanceMm).toBe(res11.report.globalMeanDistanceMm);
        expect(res.report.globalStdDevMm).toBe(res11.report.globalStdDevMm);
      }
    }
  });

  // ==========================================
  // 4. DYNAMIC SAFETY WARNING REGRESSION TESTS
  // ==========================================
  it('should verify warning logic: warn only when removal ratio strictly exceeds safety threshold', () => {
    // Create datasets of 100 points
    const basePts = Array.from({ length: 100 }, (_, i) => `${i * 2} 0 0`).join('\n');

    // Case 1: 25% removal ratio (add 33 noise points, remove 25. Removal ratio = 25/133 = 18.7%)
    // Let's control removal ratio directly by constructing inputs of size 100
    // and specifying aggressiveThresholdRatio explicitly:
    const rawCloud = importService.importPointCloud(
      basePts + '\n' + Array.from({ length: 10 }, (_, i) => `${1000 + i * 10} 1000 1000`).join('\n'), // 110 points total
      'warnings_test.xyz',
      'PROJ-WARN',
      'REV-316'
    );

    // Let's test the default safety threshold (30%):
    // 1. If removal ratio is 10/110 = 9% -> 9% < 30% -> NO warning
    const resUnderDefault = filterEngine.filter(rawCloud, {
      algorithm: 'STATISTICAL_OUTLIER',
      filterMode: 'APPLY',
      kNeighbors: 2,
      stdDevMultiplier: 0.1, // Force removal of the 10 noise points
      aggressiveThresholdRatio: 0.30,
      units: 'mm'
    });
    expect(resUnderDefault.report.isAggressiveFilter).toBe(false);
    expect(resUnderDefault.report.warnings.some(w => w.includes('FILTER_AGGRESSIVE'))).toBe(false);

    // 2. If we force aggressiveThresholdRatio to be 0.05 (5%):
    // 9% > 5% -> Should strictly generate a mathematically correct warning message!
    const resOverCustom = filterEngine.filter(rawCloud, {
      algorithm: 'STATISTICAL_OUTLIER',
      filterMode: 'APPLY',
      kNeighbors: 2,
      stdDevMultiplier: 0.1,
      aggressiveThresholdRatio: 0.05,
      units: 'mm'
    });
    expect(resOverCustom.report.isAggressiveFilter).toBe(true);
    expect(resOverCustom.report.warnings.length).toBeGreaterThan(0);
    expect(resOverCustom.report.warnings[0]).toContain('exceeds safety threshold (5%)');
  });

  // ==========================================
  // 5. EVIDENCE METRICS AND CAUSALITY
  // ==========================================
  it('should register evidence conforming to SOR metrics, showing strict causality across different runs', () => {
    const rawCloud1 = importService.importPointCloud(`0 0 0\n1 0 0\n2 0 0\n3 0 0\n100 100 100`, 'scan1.xyz', 'PROJ-EV', 'REV-A1');
    const rawCloud2 = importService.importPointCloud(`0 0 0\n10 0 0\n20 0 0\n30 0 0\n1000 1000 1000`, 'scan2.xyz', 'PROJ-EV', 'REV-A2');

    const res1 = filterEngine.filter(rawCloud1, {
      algorithm: 'STATISTICAL_OUTLIER',
      filterMode: 'APPLY',
      kNeighbors: 1,
      stdDevMultiplier: 1.0,
      units: 'mm'
    });

    const res2 = filterEngine.filter(rawCloud2, {
      algorithm: 'STATISTICAL_OUTLIER',
      filterMode: 'APPLY',
      kNeighbors: 1,
      stdDevMultiplier: 1.0,
      units: 'mm'
    });

    // Query evidence (filter for CAD_KERNEL to avoid import events)
    const ev1 = evidenceBus.queryEvidence({ revisionId: 'REV-A1' }).find(e => e.source === 'CAD_KERNEL');
    const ev2 = evidenceBus.queryEvidence({ revisionId: 'REV-A2' }).find(e => e.source === 'CAD_KERNEL');

    if (!ev1 || !ev2) {
      throw new Error('Required evidence was not found in the evidence bus.');
    }

    expect(ev1).toBeDefined();
    expect(ev2).toBeDefined();

    // Verify statistical values exist and are dynamic (causal)
    expect(ev1.metrics.globalMeanDistanceMm).toBeDefined();
    expect(ev1.metrics.globalStdDevMm).toBeDefined();
    expect(ev1.metrics.thresholdMm).toBeDefined();
    expect(ev1.metrics.kNeighbors).toBe(1);
    expect(ev1.metrics.stdDevMultiplier).toBe(1.0);

    // Dynamic checks
    expect(ev1.metrics.globalMeanDistanceMm).not.toBe(ev2.metrics.globalMeanDistanceMm);
    expect(ev1.metrics.globalStdDevMm).not.toBe(ev2.metrics.globalStdDevMm);
    expect(ev1.metrics.thresholdMm).not.toBe(ev2.metrics.thresholdMm);
  });

  // ==========================================
  // 6. ENTIRE GATE 316 VERIFICATION
  // ==========================================
  it('should successfully pass all 20 checks inside HardAcceptanceGate316', () => {
    const gate = new HardAcceptanceGate316();
    const result = gate.runAllAssertions();
    expect(result.passed).toBe(true);
    expect(result.failedCount).toBe(0);
    expect(result.passedCount).toBe(20);
  });
});
