/**
 * SECP Industrial OS — Generic Kinematic Jacobian & Singularity Engine
 * Evaluates geometric & numerical spatial Jacobians, condition numbers,
 * Yoshikawa manipulability indexes, and Damped Least Squares normal system solves
 * for arbitrary serial and multi-body kinematic chains.
 */

import { Vector3D } from '../../cadKernel';
import { Matrix4x4 } from '../../assembly/graph/types';
import { TransformMatrix } from '../../assembly/graph/TransformMatrix';
import { KinematicJointDefinition } from './RobotKinematicTypes';
import { RobotKinematicChainManager } from './RobotKinematicChainManager';
import { SingularityDiagnostic } from './RobotInverseKinematicsTypes';

export interface SpatialJacobianResult {
  /** 6 x n (or 3 x n) system Jacobian matrix */
  J: number[][];
  /** 3 x n linear velocity Jacobian [vx, vy, vz]^T / dq */
  Jv: number[][];
  /** 3 x n angular velocity Jacobian [wx, wy, wz]^T / dq */
  Jw: number[][];
  /** Joint identifiers corresponding to each column in J */
  jointIds: string[];
  /** End-effector position at current configuration */
  endEffectorPosition: Vector3D;
  /** End-effector orientation rotation matrix (3x3) */
  endEffectorRotation: number[][];
}

export class RobotKinematicJacobian {
  /**
   * Evaluates the analytical geometric Jacobian J(q) for an arbitrary serial kinematic chain.
   * Linear velocity columns Jv are in mm/rad (REVOLUTE) or mm/mm (PRISMATIC).
   * Angular velocity columns Jw are unit direction vectors in rad/rad (REVOLUTE) or 0 (PRISMATIC).
   */
  public static computeGeometricJacobian(
    joints: KinematicJointDefinition[],
    jointValues: Record<string, number>
  ): SpatialJacobianResult {
    const n = joints.length;
    const jointIds = joints.map((j) => j.jointId);

    // Track joint frame origins and rotation axes in base coordinates
    const jointOrigins: Vector3D[] = [];
    const jointAxesInBase: Vector3D[] = [];

    let T_accum: Matrix4x4 = TransformMatrix.identity();

    for (let i = 0; i < n; i++) {
      const jDef = joints[i];
      const q = jointValues[jDef.jointId] ?? jDef.state.position ?? 0;

      // Transform to joint origin before joint rotation/displacement
      const T_joint_origin = TransformMatrix.multiply(T_accum, jDef.originTransform);

      const p_joint: Vector3D = {
        x: T_joint_origin[0][3],
        y: T_joint_origin[1][3],
        z: T_joint_origin[2][3]
      };
      jointOrigins.push(p_joint);

      // Rotate joint axis into base frame coordinates
      const ax = jDef.axis.x;
      const ay = jDef.axis.y;
      const az = jDef.axis.z;
      const len = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
      const uax = ax / len;
      const uay = ay / len;
      const uaz = az / len;

      const z_base: Vector3D = {
        x: T_joint_origin[0][0] * uax + T_joint_origin[0][1] * uay + T_joint_origin[0][2] * uaz,
        y: T_joint_origin[1][0] * uax + T_joint_origin[1][1] * uay + T_joint_origin[1][2] * uaz,
        z: T_joint_origin[2][0] * uax + T_joint_origin[2][1] * uay + T_joint_origin[2][2] * uaz
      };
      const zLen = Math.sqrt(z_base.x * z_base.x + z_base.y * z_base.y + z_base.z * z_base.z) || 1;
      jointAxesInBase.push({
        x: z_base.x / zLen,
        y: z_base.y / zLen,
        z: z_base.z / zLen
      });

      // Apply joint motion to advance accumulated transform
      let T_local: Matrix4x4;
      if (jDef.jointType === 'REVOLUTE') {
        const rotMat = RobotKinematicChainManager.rotationAroundAxis(jDef.axis, q);
        T_local = TransformMatrix.multiply(jDef.originTransform, rotMat);
      } else if (jDef.jointType === 'PRISMATIC') {
        const transMat = TransformMatrix.translation(uax * q, uay * q, uaz * q);
        T_local = TransformMatrix.multiply(jDef.originTransform, transMat);
      } else {
        T_local = jDef.originTransform;
      }

      T_accum = TransformMatrix.multiply(T_accum, T_local);
    }

    const p_endEffector: Vector3D = {
      x: T_accum[0][3],
      y: T_accum[1][3],
      z: T_accum[2][3]
    };

    const R_endEffector: number[][] = [
      [T_accum[0][0], T_accum[0][1], T_accum[0][2]],
      [T_accum[1][0], T_accum[1][1], T_accum[1][2]],
      [T_accum[2][0], T_accum[2][1], T_accum[2][2]]
    ];

    // Build Jv (3 x n) and Jw (3 x n)
    const Jv: number[][] = [[], [], []];
    const Jw: number[][] = [[], [], []];

    for (let i = 0; i < n; i++) {
      const jDef = joints[i];
      const z = jointAxesInBase[i];
      const p = jointOrigins[i];

      if (jDef.jointType === 'REVOLUTE') {
        // v = z x (p_e - p_i)
        const rx = p_endEffector.x - p.x;
        const ry = p_endEffector.y - p.y;
        const rz = p_endEffector.z - p.z;

        const crossX = z.y * rz - z.z * ry;
        const crossY = z.z * rx - z.x * rz;
        const crossZ = z.x * ry - z.y * rx;

        Jv[0].push(crossX);
        Jv[1].push(crossY);
        Jv[2].push(crossZ);

        Jw[0].push(z.x);
        Jw[1].push(z.y);
        Jw[2].push(z.z);
      } else if (jDef.jointType === 'PRISMATIC') {
        Jv[0].push(z.x);
        Jv[1].push(z.y);
        Jv[2].push(z.z);

        Jw[0].push(0);
        Jw[1].push(0);
        Jw[2].push(0);
      } else {
        Jv[0].push(0);
        Jv[1].push(0);
        Jv[2].push(0);
        Jw[0].push(0);
        Jw[1].push(0);
        Jw[2].push(0);
      }
    }

    const J: number[][] = [
      Jv[0],
      Jv[1],
      Jv[2],
      Jw[0],
      Jw[1],
      Jw[2]
    ];

    return {
      J,
      Jv,
      Jw,
      jointIds,
      endEffectorPosition: p_endEffector,
      endEffectorRotation: R_endEffector
    };
  }

  /**
   * Solves the Damped Least Squares (Levenberg-Marquardt) system:
   * delta_q = J^T * (J * J^T + lambda^2 * I)^(-1) * residual
   */
  public static solveDampedLeastSquares(
    J: number[][],
    residual: number[],
    lambda: number
  ): number[] {
    const m = J.length;    // number of operational task equations (3 or 6)
    const n = J[0].length; // number of joint variables

    // Compute A = J * J^T + (lambda^2) * I (m x m)
    const lambdaSq = lambda * lambda;
    const A: number[][] = Array.from({ length: m }, () => new Array(m).fill(0));

    for (let r = 0; r < m; r++) {
      for (let c = 0; c < m; c++) {
        let sum = 0;
        for (let k = 0; k < n; k++) {
          sum += J[r][k] * J[c][k];
        }
        A[r][c] = sum + (r === c ? lambdaSq : 0);
      }
    }

    // Solve A * y = residual for y (m x 1)
    const y = this.solveLinearSystem(A, residual);

    // Compute delta_q = J^T * y (n x 1)
    const deltaQ = new Array(n).fill(0);
    for (let k = 0; k < n; k++) {
      let sum = 0;
      for (let r = 0; r < m; r++) {
        sum += J[r][k] * y[r];
      }
      deltaQ[k] = sum;
    }

    return deltaQ;
  }

  /**
   * Solves A * x = b via Gaussian elimination with scaled partial pivoting
   */
  public static solveLinearSystem(A: number[][], b: number[]): number[] {
    const n = b.length;
    const M = A.map((row, i) => [...row, b[i]]);

    for (let i = 0; i < n; i++) {
      let maxEl = Math.abs(M[i][i]);
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(M[k][i]) > maxEl) {
          maxEl = Math.abs(M[k][i]);
          maxRow = k;
        }
      }

      if (maxEl < 1e-15) {
        // Singular or degenerate row: regularization fallback
        M[i][i] += 1e-8;
      } else if (maxRow !== i) {
        const temp = M[maxRow];
        M[maxRow] = M[i];
        M[i] = temp;
      }

      const pivot = M[i][i];
      if (Math.abs(pivot) > 1e-15) {
        for (let k = i + 1; k < n; k++) {
          const factor = M[k][i] / pivot;
          for (let j = i; j <= n; j++) {
            M[k][j] -= factor * M[i][j];
          }
        }
      }
    }

    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = M[i][n];
      for (let k = i + 1; k < n; k++) {
        sum -= M[i][k] * x[k];
      }
      const denom = M[i][i];
      x[i] = Math.abs(denom) > 1e-15 ? sum / denom : 0;
    }

    return x;
  }

  /**
   * Evaluates the matrix determinant using LU decomposition
   */
  public static computeDeterminant(mat: number[][]): number {
    const n = mat.length;
    if (n === 0) return 0;
    if (n === 1) return mat[0][0];
    if (n === 2) return mat[0][0] * mat[1][1] - mat[0][1] * mat[1][0];
    if (n === 3) {
      return (
        mat[0][0] * (mat[1][1] * mat[2][2] - mat[1][2] * mat[2][1]) -
        mat[0][1] * (mat[1][0] * mat[2][2] - mat[1][2] * mat[2][0]) +
        mat[0][2] * (mat[1][0] * mat[2][1] - mat[1][1] * mat[2][0])
      );
    }

    // General Gaussian elimination with row swaps
    const A = mat.map((row) => [...row]);
    let det = 1.0;

    for (let i = 0; i < n; i++) {
      let pivot = i;
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(A[j][i]) > Math.abs(A[pivot][i])) {
          pivot = j;
        }
      }

      if (Math.abs(A[pivot][i]) < 1e-14) {
        return 0.0;
      }

      if (pivot !== i) {
        const tmp = A[i];
        A[i] = A[pivot];
        A[pivot] = tmp;
        det = -det;
      }

      det *= A[i][i];

      for (let j = i + 1; j < n; j++) {
        const factor = A[j][i] / A[i][i];
        for (let k = i + 1; k < n; k++) {
          A[j][k] -= factor * A[i][k];
        }
      }
    }

    return det;
  }

  /**
   * Analyzes Jacobian condition number, Yoshikawa manipulability, and singular configurations
   */
  public static analyzeSingularity(
    J: number[][],
    singularityThreshold = 1e-4,
    conditionNumberThreshold = 1e4
  ): SingularityDiagnostic {
    const m = J.length;
    const n = J[0].length;

    // Compute A = J * J^T (m x m)
    const A: number[][] = Array.from({ length: m }, () => new Array(m).fill(0));
    for (let r = 0; r < m; r++) {
      for (let c = 0; c < m; c++) {
        let sum = 0;
        for (let k = 0; k < n; k++) {
          sum += J[r][k] * J[c][k];
        }
        A[r][c] = sum;
      }
    }

    // Determinant of A = det(J * J^T)
    const detA = Math.max(0, this.computeDeterminant(A));
    const manipulabilityIndex = Math.sqrt(detA);

    // Approximate condition number via trace / determinant or Power Iteration
    const { lambdaMax, lambdaMin, rank } = this.estimateEigenvaluesAndRank(A);
    const conditionNumber = lambdaMin > 1e-12 ? Math.sqrt(lambdaMax / lambdaMin) : 1e12;

    const isNearSingular =
      manipulabilityIndex < singularityThreshold ||
      conditionNumber > conditionNumberThreshold ||
      rank < m;

    let statusMessage = 'Configuration is well-conditioned (regular)';
    if (rank < m) {
      statusMessage = `Deficient rank (${rank}/${m}): Robot is in an exact singular kinematic lock.`;
    } else if (isNearSingular) {
      statusMessage = `Near-singular configuration detected (manipulability=${manipulabilityIndex.toExponential(3)}, condition=${conditionNumber.toFixed(1)}).`;
    }

    return {
      isNearSingular,
      manipulabilityIndex,
      conditionNumber,
      rank,
      statusMessage
    };
  }

  /**
   * Estimates extreme eigenvalues (lambda_max, lambda_min) and effective rank of symmetric positive matrix A
   */
  private static estimateEigenvaluesAndRank(A: number[][]): { lambdaMax: number; lambdaMin: number; rank: number } {
    const n = A.length;
    if (n === 0) return { lambdaMax: 0, lambdaMin: 0, rank: 0 };

    // Power iteration for lambdaMax
    let v = new Array(n).fill(1 / Math.sqrt(n));
    let lambdaMax = 0;

    for (let iter = 0; iter < 25; iter++) {
      const Av = new Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          Av[i] += A[i][j] * v[j];
        }
      }
      let norm = 0;
      for (let i = 0; i < n; i++) norm += Av[i] * Av[i];
      norm = Math.sqrt(norm);
      if (norm < 1e-14) {
        lambdaMax = 0;
        break;
      }
      lambdaMax = norm;
      v = Av.map((val) => val / norm);
    }

    // Estimate rank via row echelon elimination
    let rank = 0;
    const M = A.map((r) => [...r]);
    for (let col = 0; col < n && rank < n; col++) {
      let pivot = rank;
      while (pivot < n && Math.abs(M[pivot][col]) < 1e-8) pivot++;
      if (pivot === n) continue;

      const tmp = M[rank];
      M[rank] = M[pivot];
      M[pivot] = tmp;

      for (let r = rank + 1; r < n; r++) {
        const factor = M[r][col] / M[rank][col];
        for (let c = col; c < n; c++) {
          M[r][c] -= factor * M[rank][c];
        }
      }
      rank++;
    }

    // Estimate lambdaMin via shifted inverse or Rayleigh quotient of least dominant direction
    // If matrix is rank-deficient, lambdaMin is 0
    let lambdaMin = 0;
    if (rank === n && lambdaMax > 1e-10) {
      // Trace of A
      let trace = 0;
      for (let i = 0; i < n; i++) trace += A[i][i];
      // Determinant of A
      const detA = Math.max(0, this.computeDeterminant(A));
      // Geometric estimate: det(A) = prod(lambda_i) -> lambdaMin <= detA / (lambdaMax^(n-1))
      lambdaMin = detA > 0 ? detA / Math.pow(Math.max(1e-6, lambdaMax), n - 1) : 0;
      lambdaMin = Math.min(lambdaMin, lambdaMax);
    }

    return { lambdaMax, lambdaMin, rank };
  }
}
