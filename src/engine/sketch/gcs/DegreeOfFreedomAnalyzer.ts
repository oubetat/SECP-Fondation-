/**
 * SECP CAD Kernel — GCS Degree of Freedom Analyzer
 * Phase 2 (PATCH-025)
 */
import { SketchModel } from '../SketchModel';
import { SketchEntity } from '../SketchEntity';
import { SketchConstraint } from './ConstraintModel';
import { ConstraintSystem } from './ConstraintSystem';
import { ConstraintEvaluator } from './ConstraintEvaluator';

export type DOFStatus =
  | 'UNDER_CONSTRAINED'
  | 'FULLY_CONSTRAINED'
  | 'OVER_CONSTRAINED'
  | 'CONFLICTING'
  | 'REDUNDANT'
  | 'UNKNOWN';

export interface DOFReport {
  readonly initialDOF: number;
  readonly constraintCount: number;
  readonly estimatedRemainingDOF: number;
  readonly independentConstraintRank?: number;
  readonly redundantConstraintCount: number;
  readonly redundantConstraintIds: string[];
  readonly conflictingConstraintIds: string[];
  readonly status: DOFStatus;
}

export class DegreeOfFreedomAnalyzer {
  public static analyze(
    model: SketchModel, 
    constraints: readonly SketchConstraint[],
    finalResidual: number = 0,
    tol: number = 1e-5
  ): DOFReport {
    let initialDOF = 0;
    for (const entity of model.entities) {
      initialDOF += this.getEntityDOF(entity);
    }
    
    // Evaluate Jacobian to find mathematical rank
    const system = new ConstraintSystem(model);
    const vector = system.getVector();
    const n = system.getDimension(); // Initial DOF from system's perspective
    
    if (n === 0) {
      return {
        initialDOF,
        constraintCount: constraints.length,
        estimatedRemainingDOF: 0,
        independentConstraintRank: 0,
        redundantConstraintCount: constraints.length,
        redundantConstraintIds: constraints.map(c => c.id.projectId),
        conflictingConstraintIds: [],
        status: constraints.length > 0 ? 'REDUNDANT' : 'FULLY_CONSTRAINED',
      };
    }

    const { m, jacobian, constraintIds } = this.computeJacobian(system, constraints, vector);
    const { rank, redundantIndices } = this.computeRank(jacobian, 1e-7);
    
    const remainingDOF = Math.max(0, n - rank);
    const redundantCount = Math.max(0, m - rank);
    const redundantConstraintIds = redundantIndices.map(i => constraintIds[i]);
    const conflictingConstraintIds: string[] = [];

    let status: DOFStatus = 'UNKNOWN';

    if (!Number.isFinite(finalResidual) || finalResidual > tol) {
      // The solver failed to satisfy all constraints.
      // We will mark all constraints as conflicting for simplicity, or we could just use the rank.
      conflictingConstraintIds.push(...constraintIds);
      if (rank === n) {
        status = 'OVER_CONSTRAINED';
      } else {
        status = 'CONFLICTING';
      }
    } else {
      if (redundantCount > 0) {
        status = 'REDUNDANT';
      } else if (remainingDOF === 0) {
        status = 'FULLY_CONSTRAINED';
      } else {
        status = 'UNDER_CONSTRAINED';
      }
    }

    return {
      initialDOF: n,
      constraintCount: m,
      estimatedRemainingDOF: remainingDOF,
      independentConstraintRank: rank,
      redundantConstraintCount: redundantCount,
      redundantConstraintIds,
      conflictingConstraintIds,
      status,
    };
  }

  public static computeJacobian(system: ConstraintSystem, constraints: readonly SketchConstraint[], vector: number[]): { m: number, jacobian: number[][], constraintIds: string[] } {
    const n = vector.length;
    system.updateFromVector(vector);
    
    // Evaluate base residuals independently per constraint to track IDs
    const jacobian: number[][] = [];
    const constraintIds: string[] = [];
    
    const baseResiduals = ConstraintEvaluator.evaluate(system, constraints);
    // Since evaluate returns a flat array of residuals, we need to map them back to constraints.
    // However, it's easier to just assume evaluate returns 1 residual per scalar equation.
    // For now, let's just use the evaluate function.
    let eqIndex = 0;
    
    // We can evaluate each constraint one by one to find out how many equations it produces
    for (const c of constraints) {
        const cRes = ConstraintEvaluator.evaluate(system, [c]);
        for (let i = 0; i < cRes.length; i++) {
            jacobian.push(Array(n).fill(0));
            constraintIds.push(c.id.projectId); // Store which constraint produced this row
        }
    }
    
    const m = jacobian.length;
    if (m === 0) return { m, jacobian, constraintIds };

    const h = 1e-7;
    for (let j = 0; j < n; j++) {
      const forwardVector = [...vector];
      forwardVector[j] += h;
      system.updateFromVector(forwardVector);
      let rowIdx = 0;
      for (const c of constraints) {
          const cRes = ConstraintEvaluator.evaluate(system, [c]);
          for (const res of cRes) {
              jacobian[rowIdx][j] = res;
              rowIdx++;
          }
      }

      const backwardVector = [...vector];
      backwardVector[j] -= h;
      system.updateFromVector(backwardVector);
      rowIdx = 0;
      for (const c of constraints) {
          const cRes = ConstraintEvaluator.evaluate(system, [c]);
          for (const res of cRes) {
              jacobian[rowIdx][j] = (jacobian[rowIdx][j] - res) / (2 * h);
              rowIdx++;
          }
      }
    }
    
    system.updateFromVector(vector);
    return { m, jacobian, constraintIds };
  }

  private static computeRank(matrix: number[][], tol = 1e-7): { rank: number, redundantIndices: number[] } {
    const m = matrix.length;
    if (m === 0) return { rank: 0, redundantIndices: [] };
    const n = matrix[0].length;
    
    // Track original indices for redundancy mapping
    const mat = matrix.map((row, i) => ({ row: [...row], origIdx: i }));
    let rank = 0;

    for (let col = 0; col < n; col++) {
      let pivotRow = rank;
      let maxVal = 0;
      for (let row = rank; row < m; row++) {
        if (Math.abs(mat[row].row[col]) > maxVal) {
          maxVal = Math.abs(mat[row].row[col]);
          pivotRow = row;
        }
      }

      if (maxVal > tol) {
        const temp = mat[rank];
        mat[rank] = mat[pivotRow];
        mat[pivotRow] = temp;

        for (let row = rank + 1; row < m; row++) {
          const factor = mat[row].row[col] / mat[rank].row[col];
          for (let k = col; k < n; k++) {
            mat[row].row[k] -= factor * mat[rank].row[k];
          }
        }
        rank++;
        if (rank === m) break;
      }
    }
    
    // Any rows from `rank` to `m` are linearly dependent (redundant)
    const redundantIndices = [];
    for (let i = rank; i < m; i++) {
        redundantIndices.push(mat[i].origIdx);
    }
    
    return { rank, redundantIndices };
  }

  private static getEntityDOF(entity: SketchEntity): number {
    switch (entity.type) {
      case 'POINT': return 2;
      case 'LINE': return 4;
      case 'CIRCLE': return 3;
      case 'ARC': return 5;
      case 'ELLIPSE': return 5;
      case 'POLYLINE': return entity.geometry.type === 'POLYLINE' ? entity.geometry.points.length * 2 : 0;
      case 'SPLINE': return entity.geometry.type === 'SPLINE' ? entity.geometry.controlPoints.length * 2 : 0;
      default: return 0;
    }
  }
}
