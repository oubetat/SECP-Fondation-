import { DOFManager } from './DOFManager';
import { StructuralModel } from './StructuralModel';
import { ReactionResult } from './types';

export class EquilibriumChecker {
  static checkEquilibrium(
    model: StructuralModel,
    dofManager: DOFManager,
    F_global: number[],
    R_global: number[],
    tolerance: number = 1e-6
  ): { passes: boolean; forceResidualNorm: number; maxMomentResidual: number } {
    let sumFx = 0, sumFy = 0, sumFz = 0;
    let sumMx = 0, sumMy = 0, sumMz = 0;

    for (let i = 0; i < dofManager.totalDOFs; i++) {
      const dof = dofManager.globalDOFs[i];
      const totalForce_i = F_global[i] + R_global[i];

      const node = model.getNode(dof.nodeId);
      const x = node?.coordinates[0] ?? 0;
      const y = node?.coordinates[1] ?? 0;
      const z = node?.coordinates[2] ?? 0;

      if (dof.dof === 'UX') {
        sumFx += totalForce_i;
        sumMy += z * totalForce_i;
        sumMz -= y * totalForce_i;
      } else if (dof.dof === 'UY') {
        sumFy += totalForce_i;
        sumMx -= z * totalForce_i;
        sumMz += x * totalForce_i;
      } else if (dof.dof === 'UZ') {
        sumFz += totalForce_i;
        sumMx += y * totalForce_i;
        sumMy -= x * totalForce_i;
      }
    }

    const forceResidualNorm = Math.sqrt(sumFx * sumFx + sumFy * sumFy + sumFz * sumFz);
    const maxMomentResidual = Math.max(Math.abs(sumMx), Math.abs(sumMy), Math.abs(sumMz));

    const totalForceApplied = F_global.reduce((acc, v) => acc + Math.abs(v), 0) + 1.0;
    const relForceRes = forceResidualNorm / totalForceApplied;

    const passes = relForceRes <= tolerance || forceResidualNorm <= tolerance;

    return { passes, forceResidualNorm, maxMomentResidual };
  }
}
