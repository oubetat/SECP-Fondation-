/**
 * SECP CAD Kernel — GCS 3D Degree of Freedom Analyzer
 * Phase 2 (PATCH-026)
 */

import { Model3D, Geometry3DEntity } from './Constraint3DTypes';
import { Constraint3D } from './Constraint3DModel';

export type DOF3DStatus =
  | 'UNDER_CONSTRAINED'
  | 'FULLY_CONSTRAINED'
  | 'OVER_CONSTRAINED'
  | 'UNKNOWN';

export interface DOF3DReport {
  readonly initialDOF: number;
  readonly constraintCount: number;
  readonly estimatedRemainingDOF: number;
  readonly independentConstraintRank: number;
  readonly redundantConstraintCount: number;
  readonly status: DOF3DStatus;
}

export class DegreeOfFreedom3DAnalyzer {
  public static analyze(
    model: Model3D,
    constraints: readonly Constraint3D[],
    jacobian?: number[][]
  ): DOF3DReport {
    let initialDOF = 0;

    for (const entity of model.entities) {
      initialDOF += this.getEntityTheoreticalDOF(entity.type);
    }

    const constraintCount = constraints.length;
    let totalRemovedDOF = 0;
    for (const constraint of constraints) {
      totalRemovedDOF += this.getConstraintDOFRemoved(constraint.type);
    }

    // Compute independent constraint rank if Jacobian is supplied
    let independentConstraintRank = 0;
    let redundantConstraintCount = 0;

    if (jacobian && jacobian.length > 0) {
      independentConstraintRank = this.computeMatrixRank(jacobian);
      redundantConstraintCount = Math.max(0, jacobian.length - independentConstraintRank);
    } else {
      // Fallback estimate if no Jacobian is calculated yet
      independentConstraintRank = totalRemovedDOF;
      redundantConstraintCount = 0;
    }

    const estimatedRemainingDOF = Math.max(0, initialDOF - independentConstraintRank);

    let status: DOF3DStatus = 'UNDER_CONSTRAINED';
    if (estimatedRemainingDOF === 0 && redundantConstraintCount === 0) {
      status = 'FULLY_CONSTRAINED';
    } else if (redundantConstraintCount > 0) {
      status = 'OVER_CONSTRAINED';
    }

    return {
      initialDOF,
      constraintCount,
      estimatedRemainingDOF,
      independentConstraintRank,
      redundantConstraintCount,
      status,
    };
  }

  public static getEntityTheoreticalDOF(type: string): number {
    switch (type) {
      case 'POINT_3D':
        return 3; // 3 translational DOFs
      case 'LINE_3D':
        return 5; // 3 translational + 2 rotational/orientation DOFs
      case 'PLANE':
        return 5; // 3 translational + 2 orientation DOFs
      case 'AXIS_3D':
        return 5; // 3 translational + 2 orientation DOFs
      case 'CIRCLE_3D':
        return 6; // 3 translation + 2 orientation + 1 radius
      case 'CYLINDER_AXIS':
        return 6; // 3 translation + 2 orientation + 1 radius
      case 'SPHERE':
        return 4; // 3 center translation + 1 radius
      default:
        return 0;
    }
  }

  public static getConstraintDOFRemoved(type: string): number {
    switch (type) {
      case 'COINCIDENT_3D':
        return 3;
      case 'POINT_ON_LINE_3D':
        return 2;
      case 'POINT_ON_PLANE_3D':
        return 1;
      case 'POINT_ON_CIRCLE_3D':
        return 2;
      case 'DISTANCE_3D':
        return 1;
      case 'DISTANCE_X_3D':
        return 1;
      case 'DISTANCE_Y_3D':
        return 1;
      case 'DISTANCE_Z_3D':
        return 1;
      case 'ANGLE_3D':
        return 1;
      case 'PARALLEL_3D':
        return 2;
      case 'PERPENDICULAR_3D':
        return 1;
      case 'COLLINEAR_3D':
        return 4;
      case 'COPLANAR_3D':
        return 1;
      case 'CONCENTRIC_3D':
        return 3;
      case 'COAXIAL_3D':
        return 4;
      case 'TANGENT_3D':
        return 1;
      case 'FIX_3D':
        return 3;
      case 'RADIUS_3D':
        return 1;
      case 'DIAMETER_3D':
        return 1;
      default:
        return 0;
    }
  }

  /**
   * Computes rank of a matrix using Gaussian elimination.
   */
  public static computeMatrixRank(matrix: number[][], tolerance: number = 1e-9): number {
    if (matrix.length === 0 || matrix[0].length === 0) return 0;
    const m = matrix.length;
    const n = matrix[0].length;
    const temp = matrix.map(row => [...row]);

    let rank = 0;
    let rowIdx = 0;

    for (let col = 0; col < n; col++) {
      let pivotRow = rowIdx;
      while (pivotRow < m && Math.abs(temp[pivotRow][col]) < tolerance) {
        pivotRow++;
      }

      if (pivotRow < m) {
        // Swap rows
        [temp[rowIdx], temp[pivotRow]] = [temp[pivotRow], temp[rowIdx]];

        // Eliminate column entries below pivot
        for (let r = rowIdx + 1; r < m; r++) {
          const factor = temp[r][col] / temp[rowIdx][col];
          for (let c = col; c < n; c++) {
            temp[r][c] -= factor * temp[rowIdx][c];
          }
        }
        rank++;
        rowIdx++;
        if (rowIdx >= m) break;
      }
    }
    return rank;
  }
}
