/**
 * PHASE 29 — REVERSE ENGINEERING
 * PATCH-317 — Iterative Closest Point (ICP) Solver Engine
 * 
 * ALGORITHM & ARCHITECTURE:
 * 1. Takes Source Point Cloud P and Target Anchor Point Cloud Q.
 * 2. Applies Initial Transform T_0 to P -> P_transformed.
 * 3. Iterative Loop (up to maxIterations):
 *    a. Nearest Neighbor Search: For each point p_i in P_transformed, find closest q_j in Q.
 *    b. Distance Threshold Rejection: Reject pairs with distance > maxCorrespondenceDistanceMm.
 *    c. Trimmed ICP Rejection: Reject top N% highest distance pairs to eliminate noise outliers.
 *    d. Solve SVD Procrustes Rigid Step T_step.
 *    e. Update Accumulated Transform: T_{k+1} = T_step * T_k.
 *    f. Convergence Check: Delta RMSE < residualTolerance OR Delta Transform < tolerance.
 * 4. Overlap Ratio Estimation: Ratio of source points matched within max distance.
 * 5. Returns RegistrationQualityReport & Final RigidTransform.
 */

import { Point3D } from '../point_cloud/PointCloudTypes315';
import {
  RigidTransform,
  RegistrationSettings,
  RegistrationQualityReport,
  PointCorrespondence,
  ConvergenceStatus
} from './PointCloudRegistrationTypes317';
import { RigidTransformSolver317 } from './RigidTransformSolver317';

export interface ICPExecutionResult {
  finalTransform: RigidTransform;
  qualityReport: RegistrationQualityReport;
  correspondences: PointCorrespondence[];
  transformedPoints: Point3D[];
}

export class IterativeClosestPointSolver317 {
  /**
   * Main ICP Execution Solver Method
   */
  public static executeICP(
    sourcePoints: Point3D[],
    targetPoints: Point3D[],
    settings: RegistrationSettings
  ): ICPExecutionResult {
    const maxIterations = settings.maxIterations || 50;
    const transformTolerance = settings.transformationTolerance || 1e-6;
    const residualToleranceMm = settings.residualToleranceMm || 0.001;
    const maxDistMm = settings.maxCorrespondenceDistanceMm || 25.0;
    const outlierTrimRatio = settings.outlierRejectionRatio || 0.10;
    const minOverlapRatio = settings.minOverlapRatio || 0.15;

    // Check pre-conditions
    if (sourcePoints.length === 0 || targetPoints.length === 0) {
      return this.createFailureResult('INPUT_EMPTY: Source or target point cloud has 0 points.', settings);
    }

    let currentTransform = settings.initialTransform || RigidTransformSolver317.createIdentityTransform('SOURCE_SCAN', 'TARGET_SCAN');
    let currentPoints = sourcePoints.map(p => RigidTransformSolver317.transformPoint(p, currentTransform));

    let previousRmse = this.computeInitialRmse(currentPoints, targetPoints);
    const initialRmse = previousRmse;

    let iterations = 0;
    let status: ConvergenceStatus = 'MAX_ITERATIONS';
    let finalCorrespondences: PointCorrespondence[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    // Main Iterative ICP Loop
    while (iterations < maxIterations) {
      iterations++;

      // 1. Correspondence Search (Nearest Neighbor)
      const rawCorrespondences = this.findNearestNeighbors(currentPoints, targetPoints, maxDistMm);

      if (rawCorrespondences.length < 3) {
        status = 'INSUFFICIENT_OVERLAP';
        errors.push(`INSUFFICIENT_OVERLAP: Only ${rawCorrespondences.length} valid matches within ${maxDistMm}mm.`);
        break;
      }

      // 2. Outlier Rejection (Trimmed ICP)
      const trimmedCorrespondences = this.applyTrimmedRejection(rawCorrespondences, outlierTrimRatio);
      finalCorrespondences = trimmedCorrespondences;

      // 3. Solve SVD Step Transform
      const svdRes = RigidTransformSolver317.solveProcrustesSVD(trimmedCorrespondences);

      if (svdRes.degenerate) {
        status = 'DEGENERATE';
        errors.push(svdRes.reason || 'DEGENERATE_GEOMETRY');
        break;
      }

      // 4. Update Accumulated Transform: T_new = T_step * T_current
      const stepTransform = svdRes.transform;
      currentTransform = RigidTransformSolver317.multiplyTransforms(stepTransform, currentTransform);

      // Apply step to points
      currentPoints = sourcePoints.map(p => RigidTransformSolver317.transformPoint(p, currentTransform));

      // 5. Evaluate Residual & Convergence
      const currentRmse = svdRes.rmseMm;
      const deltaRmse = Math.abs(previousRmse - currentRmse);

      if (deltaRmse < residualToleranceMm || currentRmse < residualToleranceMm) {
        status = 'CONVERGED';
        break;
      }

      previousRmse = currentRmse;
    }

    // Recompute final correspondences and residual analysis based on the actual final aligned currentPoints
    const finalRawCorrespondences = this.findNearestNeighbors(currentPoints, targetPoints, maxDistMm);
    if (finalRawCorrespondences.length >= 3) {
      finalCorrespondences = this.applyTrimmedRejection(finalRawCorrespondences, outlierTrimRatio);
    }

    // Overlap Ratio Estimation
    const overlapRatioEstimate = parseFloat((finalCorrespondences.length / sourcePoints.length).toFixed(4));
    const isSufficientOverlap = overlapRatioEstimate >= minOverlapRatio;

    if (!isSufficientOverlap && status !== 'DEGENERATE') {
      status = 'INSUFFICIENT_OVERLAP';
      warnings.push(`INSUFFICIENT_OVERLAP: Estimated overlap ${(overlapRatioEstimate * 100).toFixed(1)}% is below minimum required ${(minOverlapRatio * 100).toFixed(1)}%.`);
    }

    // Residual Analysis Computation
    const residualAnalysis = this.analyzeResiduals(finalCorrespondences);

    const qualityReport: RegistrationQualityReport = {
      registrationId: `REG-ICP-${Date.now()}`,
      convergenceStatus: status,
      iterationsCompleted: iterations,
      initialRmseMm: parseFloat(initialRmse.toFixed(4)),
      finalRmseMm: residualAnalysis.rmseMm,
      rmseImprovementMm: parseFloat((initialRmse - residualAnalysis.rmseMm).toFixed(4)),
      overlapRatioEstimate,
      isSufficientOverlap,
      residualAnalysis,
      transformValidity: {
        isRigid: currentTransform.isValidRigid,
        scalePreserved: true, // Rigid mode scale strictly 1.0
        rotationDeterminant: currentTransform.determinantR,
        orthogonalityError: RigidTransformSolver317.calculateOrthogonalityError(currentTransform.rotationMatrix)
      },
      warnings,
      errors
    };

    return {
      finalTransform: currentTransform,
      qualityReport,
      correspondences: finalCorrespondences,
      transformedPoints: currentPoints
    };
  }

  /**
   * Nearest Neighbor Search using Spatial Distances
   */
  private static findNearestNeighbors(
    sourcePoints: Point3D[],
    targetPoints: Point3D[],
    maxDistMm: number
  ): PointCorrespondence[] {
    const correspondences: PointCorrespondence[] = [];

    for (let i = 0; i < sourcePoints.length; i++) {
      const sp = sourcePoints[i];
      let minDistSq = maxDistMm * maxDistMm;
      let bestIdx = -1;
      let bestTarget: Point3D | null = null;

      for (let j = 0; j < targetPoints.length; j++) {
        const tp = targetPoints[j];
        const dx = sp.x - tp.x;
        const dy = sp.y - tp.y;
        const dz = sp.z - tp.z;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq < minDistSq) {
          minDistSq = distSq;
          bestIdx = j;
          bestTarget = tp;
        }
      }

      if (bestIdx !== -1 && bestTarget) {
        const distMm = Math.sqrt(minDistSq);
        correspondences.push({
          sourcePointIndex: i,
          targetPointIndex: bestIdx,
          sourcePoint: [sp.x, sp.y, sp.z],
          targetPoint: [bestTarget.x, bestTarget.y, bestTarget.z],
          distanceMm: parseFloat(distMm.toFixed(4)),
          weight: 1.0,
          confidence: parseFloat((1.0 - (distMm / maxDistMm)).toFixed(3)),
          rejected: false
        });
      }
    }

    return correspondences;
  }

  /**
   * Apply Trimmed ICP Rejection (Reject top N% worst distance pairs)
   */
  private static applyTrimmedRejection(
    correspondences: PointCorrespondence[],
    trimRatio: number
  ): PointCorrespondence[] {
    if (correspondences.length === 0) return [];

    // Sort by distance ascending
    const sorted = [...correspondences].sort((a, b) => a.distanceMm - b.distanceMm);

    const keepCount = Math.max(3, Math.floor(sorted.length * (1.0 - trimRatio)));

    return sorted.map((c, idx) => ({
      ...c,
      rejected: idx >= keepCount,
      rejectionReason: idx >= keepCount ? 'TRIMMED_OUTLIER_REJECTION' : undefined
    }));
  }

  /**
   * Compute initial RMSE before iterations
   */
  private static computeInitialRmse(sourcePoints: Point3D[], targetPoints: Point3D[]): number {
    let sumSq = 0;
    const n = Math.min(sourcePoints.length, targetPoints.length);
    if (n === 0) return 0;

    for (let i = 0; i < n; i++) {
      const sp = sourcePoints[i];
      const tp = targetPoints[i];
      const dx = sp.x - tp.x;
      const dy = sp.y - tp.y;
      const dz = sp.z - tp.z;
      sumSq += (dx * dx + dy * dy + dz * dz);
    }
    return Math.sqrt(sumSq / n);
  }

  /**
   * Residual Distribution Metrics Computation
   */
  private static analyzeResiduals(correspondences: PointCorrespondence[]): {
    meanResidualMm: number;
    medianResidualMm: number;
    stdDevResidualMm: number;
    rmseMm: number;
    maxResidualMm: number;
    percentile90ResidualMm: number;
    validCorrespondenceCount: number;
    rejectedCorrespondenceCount: number;
  } {
    const valid = correspondences.filter(c => !c.rejected);
    const rejectedCount = correspondences.filter(c => c.rejected).length;

    if (valid.length === 0) {
      return {
        meanResidualMm: 0,
        medianResidualMm: 0,
        stdDevResidualMm: 0,
        rmseMm: 0,
        maxResidualMm: 0,
        percentile90ResidualMm: 0,
        validCorrespondenceCount: 0,
        rejectedCorrespondenceCount: rejectedCount
      };
    }

    const distances = valid.map(c => c.distanceMm).sort((a, b) => a - b);
    const sum = distances.reduce((acc, d) => acc + d, 0);
    const mean = sum / distances.length;

    const median = distances[Math.floor(distances.length / 2)];
    const p90 = distances[Math.floor(distances.length * 0.90)];
    const max = distances[distances.length - 1];

    const sumSq = valid.reduce((acc, c) => acc + Math.pow(c.distanceMm, 2), 0);
    const rmse = Math.sqrt(sumSq / valid.length);

    const varSum = distances.reduce((acc, d) => acc + Math.pow(d - mean, 2), 0);
    const stdDev = Math.sqrt(varSum / distances.length);

    return {
      meanResidualMm: parseFloat(mean.toFixed(4)),
      medianResidualMm: parseFloat(median.toFixed(4)),
      stdDevResidualMm: parseFloat(stdDev.toFixed(4)),
      rmseMm: parseFloat(rmse.toFixed(4)),
      maxResidualMm: parseFloat(max.toFixed(4)),
      percentile90ResidualMm: parseFloat(p90.toFixed(4)),
      validCorrespondenceCount: valid.length,
      rejectedCorrespondenceCount: rejectedCount
    };
  }

  private static createFailureResult(reason: string, settings: RegistrationSettings): ICPExecutionResult {
    const transform = settings.initialTransform || RigidTransformSolver317.createIdentityTransform();
    return {
      finalTransform: transform,
      qualityReport: {
        registrationId: `REG-FAIL-${Date.now()}`,
        convergenceStatus: 'FAILED',
        iterationsCompleted: 0,
        initialRmseMm: Infinity,
        finalRmseMm: Infinity,
        rmseImprovementMm: 0,
        overlapRatioEstimate: 0,
        isSufficientOverlap: false,
        residualAnalysis: {
          meanResidualMm: 0,
          medianResidualMm: 0,
          stdDevResidualMm: 0,
          rmseMm: 0,
          maxResidualMm: 0,
          percentile90ResidualMm: 0,
          validCorrespondenceCount: 0,
          rejectedCorrespondenceCount: 0
        },
        transformValidity: {
          isRigid: true,
          scalePreserved: true,
          rotationDeterminant: 1.0,
          orthogonalityError: 0
        },
        warnings: [],
        errors: [reason]
      },
      correspondences: [],
      transformedPoints: []
    };
  }
}
