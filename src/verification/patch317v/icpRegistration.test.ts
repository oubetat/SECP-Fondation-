import { describe, it, expect, beforeEach } from 'vitest';
import { PointCloudImportService } from '../../engine/reverse_engineering/point_cloud/PointCloudImportService';
import { PointCloudRegistrationEngine } from '../../engine/reverse_engineering/registration/PointCloudRegistrationEngine';
import { RigidTransformSolver317 } from '../../engine/reverse_engineering/registration/RigidTransformSolver317';
import { IterativeClosestPointSolver317 } from '../../engine/reverse_engineering/registration/IterativeClosestPointSolver317';
import { EvidenceBus314 } from '../../engine/engineering_ai/copilot/EvidenceBus314';
import { HardAcceptanceGate317 } from '../../engine/reverse_engineering/registration/HardAcceptanceGate317';
import { Point3D } from '../../engine/reverse_engineering/point_cloud/PointCloudTypes315';

describe('PATCH-317V — ICP Registration Forensic Verification & Restored Contract', () => {
  let importService: PointCloudImportService;
  let registrationEngine: PointCloudRegistrationEngine;
  let evidenceBus: EvidenceBus314;

  beforeEach(() => {
    importService = PointCloudImportService.getInstance();
    registrationEngine = PointCloudRegistrationEngine.getInstance();
    evidenceBus = EvidenceBus314.getInstance();
    importService.clearAll();
    evidenceBus.clearStore();
  });

  // ==========================================
  // 1. INDEPENDENT SVD PROCRUSTES MATH VALIDATION
  // ==========================================
  it('should verify SVD closed-form rigid transformation recovery on exact correspondences', () => {
    const targetPoints: Point3D[] = [
      { x: 0, y: 0, z: 0 },
      { x: 50, y: 0, z: 0 },
      { x: 50, y: 50, z: 0 },
      { x: 0, y: 50, z: 0 },
      { x: 25, y: 25, z: 40 },
      { x: 10, y: 20, z: 15 }
    ];

    // Perfect 90-degree Z-axis rotation and translation: x' = -y + 12, y' = x - 8, z' = z + 25
    const knownR: [number, number, number, number, number, number, number, number, number] = [
      0, -1, 0,
      1,  0, 0,
      0,  0, 1
    ];
    const knownT: [number, number, number] = [12, -8, 25];
    const knownTransform = RigidTransformSolver317.buildTransform(knownR, knownT, 'KNOWN_SRC', 'KNOWN_TGT');

    const sourcePoints = targetPoints.map(p => ({ x: p.x, y: p.y, z: p.z }));

    const correspondences = targetPoints.map((tp, idx) => {
      const transformed = RigidTransformSolver317.transformPoint(sourcePoints[idx], knownTransform);
      return {
        sourcePointIndex: idx,
        targetPointIndex: idx,
        sourcePoint: [sourcePoints[idx].x, sourcePoints[idx].y, sourcePoints[idx].z] as [number, number, number],
        targetPoint: [transformed.x, transformed.y, transformed.z] as [number, number, number],
        distanceMm: 0,
        weight: 1.0,
        confidence: 1.0,
        rejected: false
      };
    });

    const solved = RigidTransformSolver317.solveProcrustesSVD(correspondences);

    expect(solved.degenerate).toBe(false);
    expect(solved.rmseMm).toBeLessThan(1e-6);
    expect(solved.transform.isValidRigid).toBe(true);
    expect(solved.transform.determinantR).toBeCloseTo(1.0, 4);

    // Verify rotation components
    expect(solved.transform.rotationMatrix[0]).toBeCloseTo(0, 4);
    expect(solved.transform.rotationMatrix[1]).toBeCloseTo(-1, 4);
    expect(solved.transform.rotationMatrix[3]).toBeCloseTo(1, 4);
    expect(solved.transform.rotationMatrix[4]).toBeCloseTo(0, 4);
    expect(solved.transform.rotationMatrix[8]).toBeCloseTo(1, 4);

    // Verify translation vector components
    expect(solved.transform.translationVector[0]).toBeCloseTo(12, 4);
    expect(solved.transform.translationVector[1]).toBeCloseTo(-8, 4);
    expect(solved.transform.translationVector[2]).toBeCloseTo(25, 4);
  });

  // ==========================================
  // 2. ICP CONVERGENCE & DETERMINISM
  // ==========================================
  it('should prove deterministic alignment convergence to machine precision under spatial shift', () => {
    const targetPoints: Point3D[] = [
      { x: 0, y: 0, z: 0 },
      { x: 50, y: 0, z: 0 },
      { x: 50, y: 50, z: 0 },
      { x: 0, y: 50, z: 0 },
      { x: 25, y: 25, z: 40 },
      { x: 10, y: 20, z: 15 }
    ];

    const shiftedSource: Point3D[] = targetPoints.map(p => ({
      x: p.x + 2.0,
      y: p.y - 1.5,
      z: p.z + 0.5
    }));

    const result1 = IterativeClosestPointSolver317.executeICP(shiftedSource, targetPoints, {
      algorithm: 'ICP_POINT_TO_POINT',
      mode: 'FINE',
      maxIterations: 30,
      maxCorrespondenceDistanceMm: 15.0,
      residualToleranceMm: 0.001,
      units: 'mm'
    });

    const result2 = IterativeClosestPointSolver317.executeICP(shiftedSource, targetPoints, {
      algorithm: 'ICP_POINT_TO_POINT',
      mode: 'FINE',
      maxIterations: 30,
      maxCorrespondenceDistanceMm: 15.0,
      residualToleranceMm: 0.001,
      units: 'mm'
    });

    // Check convergence and final RMSE
    expect(result1.qualityReport.convergenceStatus).toBe('CONVERGED');
    expect(result1.qualityReport.finalRmseMm).toBeLessThan(1e-4);

    // Verify exact determinism across runs
    expect(result1.qualityReport.finalRmseMm).toBe(result2.qualityReport.finalRmseMm);
    expect(result1.finalTransform.translationVector).toEqual(result2.finalTransform.translationVector);
    expect(result1.finalTransform.rotationMatrix).toEqual(result2.finalTransform.rotationMatrix);
  });

  // ==========================================
  // 3. OUTLIER REJECTION & TRIMMED SVD
  // ==========================================
  it('should isolate and reject outlier noise point to align the true geometries', () => {
    const targetPoints: Point3D[] = [
      { x: 0, y: 0, z: 0 },
      { x: 50, y: 0, z: 0 },
      { x: 50, y: 50, z: 0 },
      { x: 0, y: 50, z: 0 },
      { x: 25, y: 25, z: 40 },
      { x: 10, y: 20, z: 15 }
    ];

    // Add 1 extreme outlier to source points
    const sourcePoints: Point3D[] = targetPoints.map(p => ({ x: p.x, y: p.y, z: p.z }));
    sourcePoints.push({ x: 500, y: 500, z: 500 }); // Outlier

    // Trimmed ICP should reject the 1 outlier (outlierRejectionRatio = 0.15 on 7 points -> 1 point rejected)
    const result = IterativeClosestPointSolver317.executeICP(sourcePoints, targetPoints, {
      algorithm: 'ICP_POINT_TO_POINT',
      mode: 'FINE',
      maxIterations: 30,
      maxCorrespondenceDistanceMm: 1000.0,
      residualToleranceMm: 0.001,
      outlierRejectionRatio: 0.15,
      units: 'mm'
    });

    expect(result.qualityReport.convergenceStatus).toBe('CONVERGED');
    expect(result.qualityReport.finalRmseMm).toBeLessThan(1e-4); // Perfect alignment ignoring outlier!
  });

  // ==========================================
  // 4. DEGENERATE GEOMETRY EXCEPTION HANDLING
  // ==========================================
  it('should correctly fail with INSUFFICIENT_CORRESPONDENCES if scan contains insufficient points', () => {
    const correspondences = [
      {
        sourcePointIndex: 0,
        targetPointIndex: 0,
        sourcePoint: [0, 0, 0] as [number, number, number],
        targetPoint: [0, 0, 0] as [number, number, number],
        distanceMm: 0,
        weight: 1.0,
        confidence: 1.0,
        rejected: false
      },
      {
        sourcePointIndex: 1,
        targetPointIndex: 1,
        sourcePoint: [1, 1, 1] as [number, number, number],
        targetPoint: [1, 1, 1] as [number, number, number],
        distanceMm: 0,
        weight: 1.0,
        confidence: 1.0,
        rejected: false
      }
    ];

    const result = RigidTransformSolver317.solveProcrustesSVD(correspondences);

    expect(result.degenerate).toBe(true);
    expect(result.reason).toContain('INSUFFICIENT_CORRESPONDENCES');
  });

  // ==========================================
  // 5. EVIDENCE BUS & PROVENANCE
  // ==========================================
  it('should emit a valid REGISTRATION_COMPLETED event on EvidenceBus with full digital provenance and signature', () => {
    const plySample = 'ply\nformat ascii 1.0\nelement vertex 6\nproperty float x\nproperty float y\nproperty float z\nproperty float intensity\nend_header\n0.0 0.0 0.0 100\n50.0 0.0 0.0 110\n50.0 50.0 0.0 120\n0.0 50.0 0.0 130\n25.0 25.0 40.0 140\n10.0 20.0 15.0 150';

    const rawA = importService.importPointCloud(plySample, 'scan_A.ply', 'PROJ-REG-317', 'REV-317-COMMIT');
    const rawB = importService.importPointCloud(plySample, 'scan_B.ply', 'PROJ-REG-317', 'REV-317-COMMIT');

    const session = registrationEngine.prepare([rawA], rawB, {
      algorithm: 'ICP_POINT_TO_POINT',
      mode: 'PAIRWISE',
      units: rawA.units
    });

    registrationEngine.initialize(session);
    registrationEngine.register(session, rawA.chunks[0].points, rawB.chunks[0].points);
    registrationEngine.refine(session, rawA.chunks[0].points, rawB.chunks[0].points);
    
    const registeredCloud = registrationEngine.commit(session, rawA.chunks[0].points, rawA.pointCloudId, 'REV-317-COMMIT');

    expect(registeredCloud).toBeDefined();
    expect(session.status).toBe('COMMITTED');

    // Query evidence
    const evidences = evidenceBus.queryEvidence({ revisionId: 'REV-317-COMMIT' });
    const regEv = evidences.find(e => e.metrics && e.metrics.outputDatasetId === registeredCloud.registeredDatasetId);

    expect(regEv).toBeDefined();
    expect(regEv!.status).toBe('VALIDATED');
    expect(regEv!.metrics.algorithm).toBe('ICP_POINT_TO_POINT');
    expect(regEv!.digitalSignature).toContain('SIG-RSA4096-');
  });

  // ==========================================
  // 6. HARD ACCEPTANCE GATE 317 VERIFICATION
  // ==========================================
  it('should achieve a perfect 20/20 PASS on HardAcceptanceGate317', () => {
    const gate = new HardAcceptanceGate317();
    const runResult = gate.runAllAssertions();

    expect(runResult.passed).toBe(true);
    expect(runResult.passedCount).toBe(20);
    expect(runResult.failedCount).toBe(0);
  });
});
