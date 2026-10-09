/**
 * SECP Industrial OS — EPC-045: Generic Inverse Kinematics Engine
 * Implements a true non-linear Damped Least Squares (Levenberg-Marquardt) numerical
 * optimization solver for arbitrary serial kinematic chains and target poses.
 * Reuses SECP core infrastructure:
 *  - TransformMatrix & Vector3D
 *  - RobotKinematicJacobian (geometric spatial Jacobian & condition analyzer)
 *  - RobotKinematicChainManager & RobotJointDesignEngine
 *  - RobotForwardKinematicsEngine (EPC-044) for round-trip verification & closure
 *  - Multi-start alternative solution finding & criterion selection
 *  - Strict joint limit enforcement & singularity diagnostics
 */

import { Vector3D } from '../../cadKernel';
import { Matrix4x4 } from '../../assembly/graph/types';
import { TransformMatrix } from '../../assembly/graph/TransformMatrix';
import { KinematicJointDefinition } from './RobotKinematicTypes';
import { RobotKinematicChainManager } from './RobotKinematicChainManager';
import { RobotForwardKinematicsEngine } from './RobotForwardKinematicsEngine';
import { ForwardKinematicsResult } from './RobotForwardKinematicsTypes';
import { RobotKinematicJacobian } from './RobotKinematicJacobian';
import {
  InverseKinematicsInput,
  InverseKinematicsResult,
  InverseKinematicsSolverConfig,
  InverseKinematicsIterationRecord,
  InverseKinematicsTargetPose,
  CandidateJointSolution,
  ForwardKinematicsClosureVerification,
  SingularityDiagnostic,
  InverseKinematicsConvergenceStatus
} from './RobotInverseKinematicsTypes';

export class RobotInverseKinematicsEngine {
  public static readonly DEFAULT_POSITION_TOLERANCE_MM = 1e-3;
  public static readonly DEFAULT_ORIENTATION_TOLERANCE_DEG = 1e-3;

  private chainManager: RobotKinematicChainManager;
  private fkEngine: RobotForwardKinematicsEngine;

  constructor(chainManager?: RobotKinematicChainManager) {
    this.chainManager = chainManager || new RobotKinematicChainManager();
    this.fkEngine = new RobotForwardKinematicsEngine(this.chainManager);
  }

  /**
   * Helper: Normalize quaternion
   */
  public static normalizeQuaternion(q: { w: number; x: number; y: number; z: number }): {
    w: number;
    x: number;
    y: number;
    z: number;
  } {
    const len = Math.sqrt(q.w * q.w + q.x * q.x + q.y * q.y + q.z * q.z);
    if (len < 1e-12 || isNaN(len) || !isFinite(len)) {
      throw new Error('Invalid quaternion: zero norm or non-finite components');
    }
    return {
      w: q.w / len,
      x: q.x / len,
      y: q.y / len,
      z: q.z / len
    };
  }

  /**
   * Helper: Convert quaternion to 3x3 rotation matrix
   */
  public static quaternionToMatrix(q: { w: number; x: number; y: number; z: number }): number[][] {
    const { w, x, y, z } = this.normalizeQuaternion(q);
    return [
      [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
      [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
      [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]
    ];
  }

  /**
   * Validates target pose input against NaNs, infinities, and geometric degeneracy
   */
  public static validateTargetPose(target: InverseKinematicsTargetPose): { valid: boolean; error?: string } {
    if (!target || !target.position) {
      return { valid: false, error: 'Target position is missing or undefined' };
    }
    const { x, y, z } = target.position;
    if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') {
      return { valid: false, error: 'Target position coordinates must be numeric values' };
    }
    if (isNaN(x) || isNaN(y) || isNaN(z) || !isFinite(x) || !isFinite(y) || !isFinite(z)) {
      return { valid: false, error: 'Target position contains NaN or Infinite coordinates' };
    }

    if (target.quaternion) {
      const q = target.quaternion;
      if (isNaN(q.w) || isNaN(q.x) || isNaN(q.y) || isNaN(q.z) || !isFinite(q.w)) {
        return { valid: false, error: 'Target quaternion contains NaN or Infinite components' };
      }
      const len = Math.sqrt(q.w * q.w + q.x * q.x + q.y * q.y + q.z * q.z);
      if (len < 1e-6) {
        return { valid: false, error: 'Target quaternion has zero norm (degenerate rotation)' };
      }
    }

    if (target.rotationMatrix) {
      const R = target.rotationMatrix;
      if (R.length !== 3 || R[0].length !== 3 || R[1].length !== 3 || R[2].length !== 3) {
        return { valid: false, error: 'Target rotation matrix must be 3x3' };
      }
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          if (isNaN(R[r][c]) || !isFinite(R[r][c])) {
            return { valid: false, error: 'Target rotation matrix contains non-finite entries' };
          }
        }
      }
      const det = RobotKinematicJacobian.computeDeterminant(R);
      if (Math.abs(det - 1.0) > 0.05) {
        return { valid: false, error: `Target rotation matrix is not a proper rotation (det = ${det.toFixed(4)} != 1)` };
      }
    }

    return { valid: true };
  }

  /**
   * Computes orientation error vector (in radians) and scalar angle error (in degrees)
   */
  public static computeOrientationError(
    R_target: number[][],
    R_current: number[][]
  ): { errorVectorRad: Vector3D; errorAngleDeg: number } {
    // R_err = R_target * R_current^T
    const R_err: number[][] = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ];

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        let sum = 0;
        for (let k = 0; k < 3; k++) {
          sum += R_target[i][k] * R_current[j][k]; // R_current^T[k][j] == R_current[j][k]
        }
        R_err[i][j] = sum;
      }
    }

    // Trace of R_err = 1 + 2*cos(theta)
    const trace = R_err[0][0] + R_err[1][1] + R_err[2][2];
    const cosTheta = Math.max(-1.0, Math.min(1.0, (trace - 1.0) / 2.0));
    const thetaRad = Math.acos(cosTheta);
    const errorAngleDeg = (thetaRad * 180) / Math.PI;

    // Vector s = 0.5 * [R_err[2][1] - R_err[1][2], R_err[0][2] - R_err[2][0], R_err[1][0] - R_err[0][1]]
    const sx = 0.5 * (R_err[2][1] - R_err[1][2]);
    const sy = 0.5 * (R_err[0][2] - R_err[2][0]);
    const sz = 0.5 * (R_err[1][0] - R_err[0][1]);
    const sinTheta = Math.sqrt(sx * sx + sy * sy + sz * sz);

    let errorVectorRad: Vector3D;
    if (sinTheta > 1e-6) {
      const factor = thetaRad / sinTheta;
      errorVectorRad = {
        x: sx * factor,
        y: sy * factor,
        z: sz * factor
      };
    } else if (thetaRad < 1e-4) {
      errorVectorRad = { x: sx, y: sy, z: sz };
    } else {
      // theta ~ pi: extract axis from diagonal of R_err + I
      const ax = Math.sqrt(Math.max(0, (R_err[0][0] + 1) / 2));
      const ay = Math.sqrt(Math.max(0, (R_err[1][1] + 1) / 2)) * (R_err[0][1] >= 0 ? 1 : -1);
      const az = Math.sqrt(Math.max(0, (R_err[2][2] + 1) / 2)) * (R_err[0][2] >= 0 ? 1 : -1);
      errorVectorRad = {
        x: ax * thetaRad,
        y: ay * thetaRad,
        z: az * thetaRad
      };
    }

    return { errorVectorRad, errorAngleDeg };
  }

  /**
   * Resolves target orientation into canonical 3x3 rotation matrix and unit quaternion
   */
  public static extractCanonicalTargetOrientation(target: InverseKinematicsTargetPose): {
    rotationMatrix: number[][];
    quaternion: { w: number; x: number; y: number; z: number };
  } {
    if (target.rotationMatrix) {
      const R = target.rotationMatrix;
      const q = RobotForwardKinematicsEngine.matrixToQuaternion(R);
      return { rotationMatrix: R, quaternion: q };
    }

    if (target.quaternion) {
      const q = this.normalizeQuaternion(target.quaternion);
      const R = this.quaternionToMatrix(q);
      return { rotationMatrix: R, quaternion: q };
    }

    if (target.eulerXYZDeg) {
      const T = TransformMatrix.fromEulerDegrees(target.eulerXYZDeg.x, target.eulerXYZDeg.y, target.eulerXYZDeg.z);
      const R = [
        [T[0][0], T[0][1], T[0][2]],
        [T[1][0], T[1][1], T[1][2]],
        [T[2][0], T[2][1], T[2][2]]
      ];
      const q = RobotForwardKinematicsEngine.matrixToQuaternion(R);
      return { rotationMatrix: R, quaternion: q };
    }

    if (target.transformMatrix) {
      const T = target.transformMatrix;
      const R = [
        [T[0][0], T[0][1], T[0][2]],
        [T[1][0], T[1][1], T[1][2]],
        [T[2][0], T[2][1], T[2][2]]
      ];
      const q = RobotForwardKinematicsEngine.matrixToQuaternion(R);
      return { rotationMatrix: R, quaternion: q };
    }

    // Default identity orientation
    const R = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ];
    return { rotationMatrix: R, quaternion: { w: 1, x: 0, y: 0, z: 0 } };
  }

  /**
   * Primary Inverse Kinematics Solver (Single Initial Guess)
   */
  public solve(input: InverseKinematicsInput): InverseKinematicsResult {
    const startTime = performance.now();

    // 1. Static Validation
    const validation = RobotInverseKinematicsEngine.validateTargetPose(input.targetPose);
    const joints = input.jointDefinitions || this.chainManager.getJoints();

    const positionTolerance = input.positionTolerance ?? RobotInverseKinematicsEngine.DEFAULT_POSITION_TOLERANCE_MM;
    const orientationTolerance = input.orientationTolerance ?? RobotInverseKinematicsEngine.DEFAULT_ORIENTATION_TOLERANCE_DEG;

    const config: InverseKinematicsSolverConfig = {
      maxIterations: input.solverConfiguration?.maxIterations ?? 150,
      initialDamping: input.solverConfiguration?.initialDamping ?? 1e-2,
      minimumDamping: input.solverConfiguration?.minimumDamping ?? 1e-6,
      maximumDamping: input.solverConfiguration?.maximumDamping ?? 1e4,
      positionWeight: input.solverConfiguration?.positionWeight ?? 1.0,
      orientationWeight: input.solverConfiguration?.orientationWeight ?? 1.0,
      stepSize: input.solverConfiguration?.stepSize ?? 1.0,
      singularityThreshold: input.solverConfiguration?.singularityThreshold ?? 1e-4,
      conditionNumberThreshold: input.solverConfiguration?.conditionNumberThreshold ?? 1e4,
      enforceJointLimits: input.solverConfiguration?.enforceJointLimits ?? true,
      solutionCriterion: input.solverConfiguration?.solutionCriterion ?? 'MINIMUM_DISPLACEMENT'
    };

    if (!validation.valid || joints.length === 0) {
      const emptyPose = this.fkEngine.computeFromChainManager();
      return this.buildResult({
        input,
        joints,
        config,
        initialJoints: input.initialJointConfiguration ?? {},
        finalJoints: input.initialJointConfiguration ?? {},
        finalPose: emptyPose,
        posError: Infinity,
        orientError: Infinity,
        status: 'INVALID_INPUT',
        constraintStatus: 'VIOLATED',
        singularity: {
          isNearSingular: true,
          manipulabilityIndex: 0,
          conditionNumber: Infinity,
          rank: 0,
          statusMessage: validation.error || 'Invalid solver inputs'
        },
        iterations: 0,
        history: [],
        startTime,
        alternatives: []
      });
    }

    // 2. Target Pose Geometry
    const isPositionOnly = !!input.targetPose.positionOnly;
    const targetPos = input.targetPose.position;
    const targetOrient = RobotInverseKinematicsEngine.extractCanonicalTargetOrientation(input.targetPose);

    // 3. Initialize Joint Configuration
    const jointLimits: Record<string, { min: number; max: number }> = {};
    const currentQ: Record<string, number> = {};
    const initialQ: Record<string, number> = {};

    for (const j of joints) {
      const min = input.jointLimits?.[j.jointId]?.min ?? j.limits.minimumPosition;
      const max = input.jointLimits?.[j.jointId]?.max ?? j.limits.maximumPosition;
      jointLimits[j.jointId] = { min, max };

      let val = input.initialJointConfiguration?.[j.jointId];
      if (val === undefined || isNaN(val)) {
        // Safe default: mid-point of limits or joint default state
        val = j.state.position ?? (min + max) / 2;
      }
      // Initial clamp if limits are enforced
      if (config.enforceJointLimits) {
        val = Math.max(min, Math.min(max, val));
      }
      currentQ[j.jointId] = val;
      initialQ[j.jointId] = val;
    }

    // 4. Numerical Iterative Loop (Damped Least Squares Levenberg-Marquardt)
    let iter = 0;
    let converged = false;
    let lambda = config.initialDamping;
    const history: InverseKinematicsIterationRecord[] = [];

    let currentPosError = Infinity;
    let currentOrientError = Infinity;
    let totalError = Infinity;
    let lastSingularity: SingularityDiagnostic = {
      isNearSingular: false,
      manipulabilityIndex: 1.0,
      conditionNumber: 1.0,
      rank: joints.length,
      statusMessage: 'Initialized'
    };

    while (iter < config.maxIterations) {
      iter++;

      // A. Evaluate geometric Jacobian and end-effector pose
      const jacResult = RobotKinematicJacobian.computeGeometricJacobian(joints, currentQ);
      const p_curr = jacResult.endEffectorPosition;
      const R_curr = jacResult.endEffectorRotation;

      // B. Compute Position Error vector (in mm)
      const ep: Vector3D = {
        x: targetPos.x - p_curr.x,
        y: targetPos.y - p_curr.y,
        z: targetPos.z - p_curr.z
      };
      currentPosError = Math.sqrt(ep.x * ep.x + ep.y * ep.y + ep.z * ep.z);

      // C. Compute Orientation Error vector (in radians) and scalar angle (in degrees)
      const { errorVectorRad, errorAngleDeg } = RobotInverseKinematicsEngine.computeOrientationError(
        targetOrient.rotationMatrix,
        R_curr
      );
      currentOrientError = isPositionOnly ? 0 : errorAngleDeg;

      // D. Combined total error
      totalError = config.positionWeight * currentPosError + (isPositionOnly ? 0 : config.orientationWeight * currentOrientError);

      // E. Check Singularity Diagnostics
      lastSingularity = RobotKinematicJacobian.analyzeSingularity(
        isPositionOnly ? jacResult.Jv : jacResult.J,
        config.singularityThreshold,
        config.conditionNumberThreshold
      );

      // F. Check Convergence
      const posSatisfied = currentPosError <= positionTolerance;
      const orientSatisfied = isPositionOnly || currentOrientError <= orientationTolerance;
      const limitsSatisfied = this.checkJointLimits(currentQ, jointLimits);

      // Record iteration state
      history.push({
        iteration: iter,
        jointConfiguration: { ...currentQ },
        positionError: currentPosError,
        orientationError: currentOrientError,
        totalError,
        stepSize: config.stepSize,
        dampingFactor: lambda,
        constraintStatus: limitsSatisfied ? 'SATISFIED' : 'LIMIT_BOUNDED'
      });

      if (posSatisfied && orientSatisfied && limitsSatisfied) {
        converged = true;
        break;
      }

      // G. Assemble task residual vector and Jacobian for DLS
      let J_task: number[][];
      let residual: number[];

      if (isPositionOnly) {
        // 3-DOF task: position only
        J_task = jacResult.Jv;
        residual = [ep.x * config.positionWeight, ep.y * config.positionWeight, ep.z * config.positionWeight];
      } else {
        // 6-DOF task: position (mm) + orientation (rad)
        J_task = [
          jacResult.Jv[0].map((v) => v * config.positionWeight),
          jacResult.Jv[1].map((v) => v * config.positionWeight),
          jacResult.Jv[2].map((v) => v * config.positionWeight),
          jacResult.Jw[0].map((v) => v * config.orientationWeight),
          jacResult.Jw[1].map((v) => v * config.orientationWeight),
          jacResult.Jw[2].map((v) => v * config.orientationWeight)
        ];
        residual = [
          ep.x * config.positionWeight,
          ep.y * config.positionWeight,
          ep.z * config.positionWeight,
          errorVectorRad.x * config.orientationWeight,
          errorVectorRad.y * config.orientationWeight,
          errorVectorRad.z * config.orientationWeight
        ];
      }

      // If robot is near singularity, increase damping dynamically to prevent velocity blow-up
      const effectiveDamping = lastSingularity.isNearSingular ? Math.max(lambda, 0.1) : lambda;

      // H. Solve Damped Least Squares step: delta_q = J^T * (J * J^T + lambda^2 * I)^(-1) * residual
      const deltaQ = RobotKinematicJacobian.solveDampedLeastSquares(J_task, residual, effectiveDamping);

      // I. Line search with trial step evaluation
      let stepAccepted = false;
      let alpha = config.stepSize;

      for (let trial = 0; trial < 4; trial++) {
        const candidateQ: Record<string, number> = {};

        for (let i = 0; i < joints.length; i++) {
          const jDef = joints[i];
          const id = jDef.jointId;
          // deltaQ is in radians for revolute joints, so convert to degrees for chain manager
          const dq = jDef.jointType === 'REVOLUTE' ? (deltaQ[i] * 180) / Math.PI : deltaQ[i];
          let nextVal = currentQ[id] + alpha * dq;

          if (config.enforceJointLimits) {
            const lim = jointLimits[id];
            nextVal = Math.max(lim.min, Math.min(lim.max, nextVal));
          }
          candidateQ[id] = nextVal;
        }

        // Test trial candidate forward kinematics
        const trialJac = RobotKinematicJacobian.computeGeometricJacobian(joints, candidateQ);
        const trialEp = Math.sqrt(
          Math.pow(targetPos.x - trialJac.endEffectorPosition.x, 2) +
          Math.pow(targetPos.y - trialJac.endEffectorPosition.y, 2) +
          Math.pow(targetPos.z - trialJac.endEffectorPosition.z, 2)
        );
        const trialEo = isPositionOnly
          ? 0
          : RobotInverseKinematicsEngine.computeOrientationError(
              targetOrient.rotationMatrix,
              trialJac.endEffectorRotation
            ).errorAngleDeg;

        const trialTotalError = config.positionWeight * trialEp + (isPositionOnly ? 0 : config.orientationWeight * trialEo);

        if (trialTotalError < totalError || (posSatisfied && orientSatisfied)) {
          // Descent step successful
          for (const [key, val] of Object.entries(candidateQ)) {
            currentQ[key] = val;
          }
          lambda = Math.max(config.minimumDamping, lambda * 0.7);
          stepAccepted = true;
          break;
        }

        // Reduce step size
        alpha *= 0.5;
      }

      if (!stepAccepted) {
        // Increase damping factor if step failed to reduce error
        lambda = Math.min(config.maximumDamping, lambda * 2.5);
      }
    }

    // 5. Final Evaluation & Forward Kinematics Closure
    const finalPose = this.fkEngine.computeFromChainManager(currentQ);
    const finalEp = Math.sqrt(
      Math.pow(targetPos.x - finalPose.endEffectorPosition.x, 2) +
      Math.pow(targetPos.y - finalPose.endEffectorPosition.y, 2) +
      Math.pow(targetPos.z - finalPose.endEffectorPosition.z, 2)
    );
    const { errorAngleDeg: finalEo } = RobotInverseKinematicsEngine.computeOrientationError(
      targetOrient.rotationMatrix,
      finalPose.endEffectorOrientation.rotationMatrix
    );

    const limitsSatisfied = this.checkJointLimits(currentQ, jointLimits);
    const posPass = finalEp <= positionTolerance;
    const orientPass = isPositionOnly || finalEo <= orientationTolerance;

    let status: InverseKinematicsConvergenceStatus = 'NOT_CONVERGED';

    if (posPass && orientPass && limitsSatisfied) {
      status = 'CONVERGED';
    } else if (!limitsSatisfied) {
      status = 'INVALID_LIMITS';
    } else {
      // Check if target is completely out of reach (e.g. reach > sum of link lengths)
      const maxReach = this.estimateMaxReach(joints);
      const targetDist = Math.sqrt(targetPos.x * targetPos.x + targetPos.y * targetPos.y + targetPos.z * targetPos.z);
      if (targetDist > maxReach + 50 || finalEp > 100) {
        status = 'UNREACHABLE';
      } else if (lastSingularity.isNearSingular && lastSingularity.rank < (isPositionOnly ? 3 : 6)) {
        status = 'SINGULARITY';
      }
    }

    const constraintStatus = limitsSatisfied ? 'SATISFIED' : 'VIOLATED';

    return this.buildResult({
      input,
      joints,
      config,
      initialJoints: initialQ,
      finalJoints: currentQ,
      finalPose,
      posError: finalEp,
      orientError: isPositionOnly ? 0 : finalEo,
      status,
      constraintStatus,
      singularity: lastSingularity,
      iterations: iter,
      history,
      startTime,
      alternatives: []
    });
  }

  /**
   * Multi-Start Inverse Kinematics Solver:
   * Explores multiple initial joint configurations (elbow-up, elbow-down, wrist-flipped)
   * to discover alternative valid kinematic solutions and selects the optimal solution
   * based on the specified selection criterion.
   */
  public solveWithMultiStart(
    input: InverseKinematicsInput,
    additionalSeeds?: Record<string, number>[]
  ): InverseKinematicsResult {
    const joints = input.jointDefinitions || this.chainManager.getJoints();

    // Generate systematic seed configurations
    const seeds: Record<string, number>[] = [];

    // Seed 1: User-specified initial configuration (or default)
    seeds.push(input.initialJointConfiguration ?? {});

    // Additional user seeds
    if (additionalSeeds) {
      for (const s of additionalSeeds) seeds.push(s);
    }

    // Heuristic multi-start seeds for industrial 6-DOF arm:
    // Symmetric quadrants / elbow inversion / wrist flip
    seeds.push({ J1_BASE: 0, J2_SHOULDER: 30, J3_ELBOW: -60, J4_WRIST1: 0, J5_WRIST2: 30, J6_WRIST3: 0 });
    seeds.push({ J1_BASE: 0, J2_SHOULDER: -45, J3_ELBOW: 45, J4_WRIST1: 0, J5_WRIST2: -45, J6_WRIST3: 180 });
    seeds.push({ J1_BASE: 45, J2_SHOULDER: 15, J3_ELBOW: -45, J4_WRIST1: 90, J5_WRIST2: 20, J6_WRIST3: -90 });
    seeds.push({ J1_BASE: -45, J2_SHOULDER: 20, J3_ELBOW: -30, J4_WRIST1: -90, J5_WRIST2: -30, J6_WRIST3: 90 });

    const validCandidates: CandidateJointSolution[] = [];
    let bestResult: InverseKinematicsResult | null = null;

    const initialQ = input.initialJointConfiguration ?? {};

    for (let i = 0; i < seeds.length; i++) {
      const seed = seeds[i];
      const runInput: InverseKinematicsInput = {
        ...input,
        initialJointConfiguration: seed,
        solverConfiguration: {
          ...input.solverConfiguration,
          maxIterations: 100
        }
      };

      const result = this.solve(runInput);

      if (result.convergenceStatus === 'CONVERGED') {
        // Compute displacement from user's initial configuration
        let disp = 0;
        for (const j of joints) {
          const qVal = result.finalJointConfiguration[j.jointId] || 0;
          const q0 = initialQ[j.jointId] || 0;
          disp += Math.pow(qVal - q0, 2);
        }
        disp = Math.sqrt(disp);

        // Check uniqueness against existing valid solutions
        const isDuplicate = validCandidates.some((c) => {
          let diff = 0;
          for (const j of joints) {
            diff += Math.abs(c.jointConfiguration[j.jointId] - result.finalJointConfiguration[j.jointId]);
          }
          return diff < 1.0; // within 1 deg difference
        });

        if (!isDuplicate) {
          validCandidates.push({
            solutionId: `SOL-IK-${validCandidates.length + 1}`,
            jointConfiguration: { ...result.finalJointConfiguration },
            forwardKinematicsResult: result.finalPose,
            positionError: result.positionError,
            orientationError: result.orientationError,
            totalError: result.totalError,
            displacementFromInitial: disp,
            manipulabilityIndex: result.singularityStatus.manipulabilityIndex,
            isWithinLimits: result.constraintStatus === 'SATISFIED',
            iterations: result.iterations
          });
        }
      }

      if (!bestResult || (result.convergenceStatus === 'CONVERGED' && bestResult.convergenceStatus !== 'CONVERGED')) {
        bestResult = result;
      }
    }

    if (!bestResult) {
      bestResult = this.solve(input);
    }

    // Select optimal solution among valid candidates according to criterion
    const criterion = input.solverConfiguration?.solutionCriterion ?? 'MINIMUM_DISPLACEMENT';
    if (validCandidates.length > 1) {
      if (criterion === 'MINIMUM_DISPLACEMENT') {
        validCandidates.sort((a, b) => a.displacementFromInitial - b.displacementFromInitial);
      } else if (criterion === 'MAXIMUM_MANIPULABILITY') {
        validCandidates.sort((a, b) => b.manipulabilityIndex - a.manipulabilityIndex);
      } else if (criterion === 'CENTERED_LIMITS') {
        validCandidates.sort((a, b) => a.totalError - b.totalError);
      }

      const optimal = validCandidates[0];
      const optimalPose = this.fkEngine.computeFromChainManager(optimal.jointConfiguration);

      bestResult = {
        ...bestResult,
        finalJointConfiguration: optimal.jointConfiguration,
        finalPose: optimalPose,
        positionError: optimal.positionError,
        orientationError: optimal.orientationError,
        totalError: optimal.totalError,
        alternativeSolutions: validCandidates,
        selectedSolutionCriterion: criterion,
        convergenceStatus: 'CONVERGED',
        constraintStatus: 'SATISFIED'
      };
    } else {
      bestResult.alternativeSolutions = validCandidates;
      bestResult.selectedSolutionCriterion = criterion;
    }

    return bestResult;
  }

  /**
   * Builds the comprehensive InverseKinematicsResult with full Forward Kinematics closure verification
   */
  private buildResult(args: {
    input: InverseKinematicsInput;
    joints: KinematicJointDefinition[];
    config: InverseKinematicsSolverConfig;
    initialJoints: Record<string, number>;
    finalJoints: Record<string, number>;
    finalPose: ForwardKinematicsResult;
    posError: number;
    orientError: number;
    status: InverseKinematicsConvergenceStatus;
    constraintStatus: 'SATISFIED' | 'LIMIT_BOUNDED' | 'VIOLATED';
    singularity: SingularityDiagnostic;
    iterations: number;
    history: InverseKinematicsIterationRecord[];
    startTime: number;
    alternatives: CandidateJointSolution[];
  }): InverseKinematicsResult {
    const { input, joints, config, initialJoints, finalJoints, finalPose, posError, orientError, status, constraintStatus, singularity, iterations, history, startTime, alternatives } = args;

    const positionTolerance = input.positionTolerance ?? RobotInverseKinematicsEngine.DEFAULT_POSITION_TOLERANCE_MM;
    const orientationTolerance = input.orientationTolerance ?? RobotInverseKinematicsEngine.DEFAULT_ORIENTATION_TOLERANCE_DEG;

    const isPositionOnly = !!input.targetPose.positionOnly;
    const posPass = posError <= positionTolerance;
    const orientPass = isPositionOnly || orientError <= orientationTolerance;

    const fkClosure: ForwardKinematicsClosureVerification = {
      evaluatedPose: finalPose,
      targetPosition: input.targetPose.position,
      actualPosition: finalPose.endEffectorPosition,
      positionError: posError,
      orientationError: orientError,
      positionTolerance,
      orientationTolerance,
      positionPassed: posPass,
      orientationPassed: orientPass,
      passed: posPass && orientPass && status === 'CONVERGED'
    };

    return {
      robotId: input.robotId || this.chainManager.robotId,
      configurationId: input.configurationId || 'CONFIG-IK-DEFAULT',
      kinematicChainId: input.kinematicChainId || this.chainManager.chainId,
      robotRevision: input.revision || this.chainManager.revision,
      baseFrame: input.baseFrame || 'FRAME-WORLD',
      endEffectorFrame: input.endEffectorFrame || 'FRAME-END-EFFECTOR',
      targetPose: input.targetPose,
      initialJointConfiguration: initialJoints,
      finalJointConfiguration: finalJoints,
      finalPose,
      positionError: Number(posError.toFixed(6)),
      orientationError: Number(orientError.toFixed(6)),
      totalError: Number((config.positionWeight * posError + (isPositionOnly ? 0 : config.orientationWeight * orientError)).toFixed(6)),
      convergenceStatus: status,
      constraintStatus,
      singularityStatus: singularity,
      iterations,
      executionTimeMs: Number((performance.now() - startTime).toFixed(2)),
      solverMethod: 'DAMPED_LEAST_SQUARES_LEVENBERG_MARQUARDT',
      solverConfiguration: config,
      positionTolerance,
      orientationTolerance,
      alternativeSolutions: alternatives,
      selectedSolutionCriterion: config.solutionCriterion,
      forwardKinematicsVerification: fkClosure,
      iterationHistory: history
    };
  }

  /**
   * Validates if joint values are within bounds
   */
  private checkJointLimits(
    q: Record<string, number>,
    limits: Record<string, { min: number; max: number }>
  ): boolean {
    for (const [jointId, val] of Object.entries(q)) {
      const lim = limits[jointId];
      if (lim && (val < lim.min - 1e-4 || val > lim.max + 1e-4)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Computes approximate maximum spherical reach of the kinematic chain from base origin
   */
  private estimateMaxReach(joints: KinematicJointDefinition[]): number {
    let reach = 0;
    for (const j of joints) {
      const tx = j.originTransform[0][3];
      const ty = j.originTransform[1][3];
      const tz = j.originTransform[2][3];
      reach += Math.sqrt(tx * tx + ty * ty + tz * tz);
    }
    return reach;
  }
}
