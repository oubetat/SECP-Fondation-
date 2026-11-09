/**
 * SECP Human Factors & Ergonomics Engine (HFEE) — TASK 003
 * Human Inverse Kinematics (IK) & Branched Posture Solver Engine
 * 
 * Multi-effector, multi-objective Damped Least Squares (DLS) numerical solver
 * with anatomical joint-limit projection and posture regularization.
 */

import { Vector3D } from '../../assembly/graph/types';
import { SkeletalTopology, AnatomicalRegion } from '../types/SkeletalTopologyTypes';
import {
  HumanPoseState,
  IKEffectorTarget,
  HumanIKOptions,
  HumanIKResult,
  IKConvergenceStatus
} from './types';
import { HumanForwardKinematicsEngine } from './HumanForwardKinematicsEngine';
import { HumanJointConstraintSolver } from './HumanJointConstraintSolver';

export class HumanInverseKinematicsEngine {
  public static readonly VERSION = '1.0.0-PROD';

  /**
   * Solves Inverse Kinematics for single or multiple branched effector targets
   */
  public static solveIK(
    skeleton: SkeletalTopology,
    initialPose: HumanPoseState,
    targets: IKEffectorTarget[],
    options: HumanIKOptions = {}
  ): HumanIKResult {
    const diagnostics: string[] = [];

    if (!skeleton || !skeleton.isValid) {
      return this.failResult(initialPose, 'Invalid or null SkeletalTopology provided.', 'FAILED');
    }

    if (!targets || targets.length === 0) {
      return this.failResult(initialPose, 'No IK effector targets provided.', 'FAILED');
    }

    // Validate targets for finite coordinates
    for (const tgt of targets) {
      if (
        !tgt.targetPositionMm ||
        !isFinite(tgt.targetPositionMm.x) ||
        !isFinite(tgt.targetPositionMm.y) ||
        !isFinite(tgt.targetPositionMm.z)
      ) {
        return this.failResult(initialPose, `Target for '${tgt.effectorRegion}' contains non-finite coordinates.`, 'FAILED');
      }
    }

    const maxIter = options.maxIterations ?? 120;
    const damping = options.dampingFactor ?? 0.05;
    const stepSize = options.stepSize ?? 0.4;
    const enforceLimits = options.enforceJointLimits ?? true;
    const regWeight = options.postureRegularizationWeight ?? 0.01;
    const globalTol = options.positionToleranceMm ?? 1.0;

    // Deep clone pose state to iterate
    let currentPose: HumanPoseState = JSON.parse(JSON.stringify(initialPose));

    // Identify active joints affecting the requested targets
    const activeJoints = this.getControllingJointsForTargets(targets);

    let finalFK = HumanForwardKinematicsEngine.computeFK(skeleton, currentPose, enforceLimits);
    let iterations = 0;
    let isSingular = false;
    let converged = false;

    // Optimization loop using Damped Least Squares (DLS)
    for (iterations = 0; iterations < maxIter; iterations++) {
      finalFK = HumanForwardKinematicsEngine.computeFK(skeleton, currentPose, enforceLimits);

      // 1. Calculate Error Vector E
      const { errorVec, totalResidual, residualsMap } = this.computeErrorVector(finalFK, targets);

      // Check convergence
      if (totalResidual < globalTol * targets.length) {
        converged = true;
        break;
      }

      // 2. Compute Jacobian Matrix J numerically via finite differences
      const { J, singularDetected } = this.computeJacobian(
        skeleton,
        currentPose,
        targets,
        activeJoints,
        enforceLimits
      );

      if (singularDetected) {
        isSingular = true;
      }

      // 3. Solve DLS system: deltaTheta = J^T * (J * J^T + lambda^2 * I)^-1 * E
      const deltaTheta = this.solveDampedSystem(J, errorVec, damping);

      // 4. Update joint angles with step size and posture regularization
      this.applyJointDelta(currentPose, activeJoints, deltaTheta, stepSize, regWeight, enforceLimits);
    }

    // Final FK evaluation
    finalFK = HumanForwardKinematicsEngine.computeFK(skeleton, currentPose, enforceLimits);
    const { residualsMap, isUnreachable } = this.evaluateFinalResiduals(finalFK, targets);

    // Determine convergence status
    let status: IKConvergenceStatus = 'CONVERGED';

    if (converged) {
      status = 'CONVERGED';
    } else if (isUnreachable) {
      status = 'TARGET_UNREACHABLE';
      diagnostics.push('Target position exceeds maximum reachability envelope of skeletal branch.');
    } else if (isSingular) {
      status = 'SINGULAR_CONFIGURATION';
      diagnostics.push('Solver encountered near-singular Jacobian configuration during optimization.');
    } else {
      status = 'PARTIAL_CONVERGENCE';
      diagnostics.push(`Solver reached max iterations (${maxIter}) with partial residual error.`);
    }

    // Inspect joint saturation
    const saturations = HumanJointConstraintSolver.inspectPoseSaturations(currentPose.jointAngles);

    return {
      success: converged || status === 'PARTIAL_CONVERGENCE' || status === 'TARGET_UNREACHABLE',
      convergenceStatus: status,
      solvedPose: currentPose,
      fkResult: finalFK,
      iterations,
      positionResidualsMm: residualsMap,
      jointLimitSaturations: saturations,
      diagnostics
    };
  }

  /**
   * Helper to identify list of joints to optimize for given targets
   */
  private static getControllingJointsForTargets(targets: IKEffectorTarget[]): { jointId: string; dof: string }[] {
    const jointSet = new Set<string>();

    for (const tgt of targets) {
      const reg = tgt.effectorRegion;

      if (reg === AnatomicalRegion.LEFT_HAND || reg === AnatomicalRegion.LEFT_FOREARM) {
        jointSet.add('J_LEFT_SHOULDER');
        jointSet.add('J_LEFT_ELBOW');
        jointSet.add('J_LEFT_WRIST');
        jointSet.add('J_LUMBAR');
      } else if (reg === AnatomicalRegion.RIGHT_HAND || reg === AnatomicalRegion.RIGHT_FOREARM) {
        jointSet.add('J_RIGHT_SHOULDER');
        jointSet.add('J_RIGHT_ELBOW');
        jointSet.add('J_RIGHT_WRIST');
        jointSet.add('J_LUMBAR');
      } else if (reg === AnatomicalRegion.LEFT_FOOT || reg === AnatomicalRegion.LEFT_LOWER_LEG) {
        jointSet.add('J_LEFT_HIP');
        jointSet.add('J_LEFT_KNEE');
        jointSet.add('J_LEFT_ANKLE');
      } else if (reg === AnatomicalRegion.RIGHT_FOOT || reg === AnatomicalRegion.RIGHT_LOWER_LEG) {
        jointSet.add('J_RIGHT_HIP');
        jointSet.add('J_RIGHT_KNEE');
        jointSet.add('J_RIGHT_ANKLE');
      } else if (reg === AnatomicalRegion.HEAD || reg === AnatomicalRegion.NECK) {
        jointSet.add('J_NECK');
        jointSet.add('J_LUMBAR');
      }
    }

    const result: { jointId: string; dof: string }[] = [];
    for (const jId of Array.from(jointSet)) {
      result.push({ jointId: jId, dof: 'flexionExtension' });
      if (jId.includes('SHOULDER') || jId.includes('HIP') || jId.includes('NECK') || jId.includes('WRIST') || jId.includes('ANKLE') || jId.includes('LUMBAR')) {
        result.push({ jointId: jId, dof: 'abductionAdduction' });
      }
      if (jId.includes('SHOULDER') || jId.includes('HIP') || jId.includes('NECK') || jId.includes('LUMBAR')) {
        result.push({ jointId: jId, dof: 'internalExternalRotation' });
      }
    }

    return result;
  }

  /**
   * Calculates error vector E = [dx1, dy1, dz1, dx2, dy2, dz2, ...]
   */
  private static computeErrorVector(
    fk: any,
    targets: IKEffectorTarget[]
  ): { errorVec: number[]; totalResidual: number; residualsMap: Record<string, number> } {
    const errorVec: number[] = [];
    const residualsMap: Record<string, number> = {};
    let totalResidual = 0;

    for (const tgt of targets) {
      const effectorKey = tgt.effectorRegion.toString();
      const currentEff = fk.endEffectors[effectorKey];
      const curPos = currentEff ? currentEff.positionMm : { x: 0, y: 0, z: 0 };
      const tgtPos = tgt.targetPositionMm;
      const weight = tgt.weight ?? 1.0;

      const dx = (tgtPos.x - curPos.x) * weight;
      const dy = (tgtPos.y - curPos.y) * weight;
      const dz = (tgtPos.z - curPos.z) * weight;

      errorVec.push(dx, dy, dz);

      const res = Math.sqrt(dx * dx + dy * dy + dz * dz);
      residualsMap[effectorKey] = Number(res.toFixed(3));
      totalResidual += res;
    }

    return { errorVec, totalResidual, residualsMap };
  }

  /**
   * Computes numerical Jacobian matrix J via finite differences
   */
  private static computeJacobian(
    skeleton: SkeletalTopology,
    currentPose: HumanPoseState,
    targets: IKEffectorTarget[],
    activeJoints: { jointId: string; dof: string }[],
    enforceLimits: boolean
  ): { J: number[][]; singularDetected: boolean } {
    const deltaDeg = 0.5; // Finite difference perturbation step
    const numRows = targets.length * 3;
    const numCols = activeJoints.length;

    const J: number[][] = Array.from({ length: numRows }, () => Array(numCols).fill(0));

    const baselineFK = HumanForwardKinematicsEngine.computeFK(skeleton, currentPose, enforceLimits);

    for (let c = 0; c < numCols; c++) {
      const { jointId, dof } = activeJoints[c];

      // Perturb joint angle
      const perturbedPose: HumanPoseState = JSON.parse(JSON.stringify(currentPose));
      if (!perturbedPose.jointAngles[jointId]) {
        perturbedPose.jointAngles[jointId] = { flexionExtension: 0 };
      }
      (perturbedPose.jointAngles[jointId] as any)[dof] = ((perturbedPose.jointAngles[jointId] as any)[dof] || 0) + deltaDeg;

      const perturbedFK = HumanForwardKinematicsEngine.computeFK(skeleton, perturbedPose, enforceLimits);

      for (let t = 0; t < targets.length; t++) {
        const effKey = targets[t].effectorRegion.toString();
        const baseP = baselineFK.endEffectors[effKey]?.positionMm || { x: 0, y: 0, z: 0 };
        const pertP = perturbedFK.endEffectors[effKey]?.positionMm || { x: 0, y: 0, z: 0 };

        const rIdx = t * 3;
        J[rIdx + 0][c] = (pertP.x - baseP.x) / deltaDeg;
        J[rIdx + 1][c] = (pertP.y - baseP.y) / deltaDeg;
        J[rIdx + 2][c] = (pertP.z - baseP.z) / deltaDeg;
      }
    }

    // Singularity detection: check if JJ^T has very low magnitude
    let normSum = 0;
    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        normSum += J[r][c] * J[r][c];
      }
    }
    const singularDetected = normSum < 1e-6;

    return { J, singularDetected };
  }

  /**
   * Solves DLS linear equation: deltaTheta = J^T * (J * J^T + lambda^2 * I)^-1 * E
   */
  private static solveDampedSystem(J: number[][], E: number[], damping: number): number[] {
    const numRows = J.length;
    if (numRows === 0) return [];
    const numCols = J[0].length;

    // Compute JJ^T (numRows x numRows)
    const JJT: number[][] = Array.from({ length: numRows }, () => Array(numRows).fill(0));
    for (let r1 = 0; r1 < numRows; r1++) {
      for (let r2 = 0; r2 < numRows; r2++) {
        let sum = 0;
        for (let c = 0; c < numCols; c++) {
          sum += J[r1][c] * J[r2][c];
        }
        JJT[r1][r2] = sum;
      }
      // Add damping term to diagonal
      JJT[r1][r1] += damping * damping;
    }

    // Invert JJT (for 3x3 or 6x6 system)
    const invJJT = this.invertMatrix(JJT);

    // Temp = invJJT * E
    const temp: number[] = Array(numRows).fill(0);
    for (let r = 0; r < numRows; r++) {
      let sum = 0;
      for (let k = 0; k < numRows; k++) {
        sum += invJJT[r][k] * E[k];
      }
      temp[r] = sum;
    }

    // deltaTheta = J^T * temp
    const deltaTheta: number[] = Array(numCols).fill(0);
    for (let c = 0; c < numCols; c++) {
      let sum = 0;
      for (let r = 0; r < numRows; r++) {
        sum += J[r][c] * temp[r];
      }
      deltaTheta[c] = sum;
    }

    return deltaTheta;
  }

  /**
   * Applies joint updates with posture regularization and hard ROM clamping
   */
  private static applyJointDelta(
    pose: HumanPoseState,
    activeJoints: { jointId: string; dof: string }[],
    deltaTheta: number[],
    stepSize: number,
    regWeight: number,
    enforceLimits: boolean
  ): void {
    for (let i = 0; i < activeJoints.length; i++) {
      const { jointId, dof } = activeJoints[i];

      if (!pose.jointAngles[jointId]) {
        pose.jointAngles[jointId] = { flexionExtension: 0 };
      }

      const curVal = (pose.jointAngles[jointId] as any)[dof] || 0;
      const delta = deltaTheta[i] || 0;

      // Posture regularization term pulling toward 0 (neutral position)
      const regTerm = -regWeight * curVal;

      let newVal = curVal + stepSize * delta + regTerm;

      if (enforceLimits) {
        const tempAngles = { ...pose.jointAngles[jointId], [dof]: newVal };
        const valRes = HumanJointConstraintSolver.projectAndValidateJoint(jointId, tempAngles);
        newVal = (valRes.clampedAngles as any)[dof];
      }

      (pose.jointAngles[jointId] as any)[dof] = Number(newVal.toFixed(4));
    }
  }

  /**
   * Evaluates final residuals and detects unreachable targets
   */
  private static evaluateFinalResiduals(
    fk: any,
    targets: IKEffectorTarget[]
  ): { residualsMap: Record<string, number>; isUnreachable: boolean } {
    const residualsMap: Record<string, number> = {};
    let isUnreachable = false;

    for (const tgt of targets) {
      const effKey = tgt.effectorRegion.toString();
      const curPos = fk.endEffectors[effKey]?.positionMm || { x: 0, y: 0, z: 0 };
      const tgtPos = tgt.targetPositionMm;

      const dx = tgtPos.x - curPos.x;
      const dy = tgtPos.y - curPos.y;
      const dz = tgtPos.z - curPos.z;

      const res = Math.sqrt(dx * dx + dy * dy + dz * dz);
      residualsMap[effKey] = Number(res.toFixed(3));

      if (res > 250) { // If residual is greater than 250mm, target is far outside reach envelope
        isUnreachable = true;
      }
    }

    return { residualsMap, isUnreachable };
  }

  /**
   * Gaussian elimination matrix inversion
   */
  private static invertMatrix(m: number[][]): number[][] {
    const n = m.length;
    const A = m.map((row) => [...row]);
    const I = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
    );

    for (let i = 0; i < n; i++) {
      let pivot = A[i][i];
      if (Math.abs(pivot) < 1e-12) {
        pivot = 1e-6; // Damping safeguard
      }

      for (let j = 0; j < n; j++) {
        A[i][j] /= pivot;
        I[i][j] /= pivot;
      }

      for (let k = 0; k < n; k++) {
        if (k !== i) {
          const factor = A[k][i];
          for (let j = 0; j < n; j++) {
            A[k][j] -= factor * A[i][j];
            I[k][j] -= factor * I[i][j];
          }
        }
      }
    }

    return I;
  }

  private static failResult(
    pose: HumanPoseState,
    msg: string,
    status: IKConvergenceStatus
  ): HumanIKResult {
    return {
      success: false,
      convergenceStatus: status,
      solvedPose: pose,
      fkResult: {
        success: false,
        segmentStates: {} as any,
        endEffectors: {},
        diagnostics: [msg]
      },
      iterations: 0,
      positionResidualsMm: {},
      jointLimitSaturations: {},
      diagnostics: [msg]
    };
  }
}
