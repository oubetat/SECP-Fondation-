import { SparseMatrix } from '../sparse/SparseMatrix';
import { DOFManager } from './DOFManager';
import { EquilibriumMetrics, ReactionResult } from './types';

export class ReactionCalculator {
  /**
   * Computes reaction forces on constrained DOFs from R = K*u - F
   */
  static calculateReactions(
    K_full: SparseMatrix,
    u_global: number[],
    F_global: number[],
    dofManager: DOFManager
  ): { reactions: ReactionResult[]; globalReactionVector: number[] } {
    const totalDOFs = K_full.rows;
    const Ku = K_full.spmv(u_global);
    const R_global = new Array<number>(totalDOFs).fill(0);
    const reactions: ReactionResult[] = [];

    for (let i = 0; i < totalDOFs; i++) {
      R_global[i] = Ku[i] - F_global[i];

      const dof = dofManager.globalDOFs[i];
      if (dof.isConstrained) {
        reactions.push({
          nodeId: dof.nodeId,
          dof: dof.dof,
          globalDOFIndex: i,
          reactionForce: R_global[i]
        });
      }
    }

    return { reactions, globalReactionVector: R_global };
  }
}
