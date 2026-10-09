import { DOFManager } from './DOFManager';
import { EquilibriumMetrics, ReactionResult } from './types';

export class IndependentReactionAudit {
  /**
   * Independent verification of global force equilibrium: sum(F_external) + sum(Reactions) = 0
   */
  static auditEquilibrium(
    F_global: number[],
    reactions: ReactionResult[],
    dofManager: DOFManager,
    tolerance: number = 1e-6
  ): EquilibriumMetrics {
    let fx = 0, fy = 0, fz = 0;
    let rx = 0, ry = 0, rz = 0;

    // Sum applied external forces
    for (let i = 0; i < dofManager.totalDOFs; i++) {
      const dof = dofManager.globalDOFs[i];
      if (!dof.isConstrained) {
        if (dof.dof === 'UX') fx += F_global[i];
        if (dof.dof === 'UY') fy += F_global[i];
        if (dof.dof === 'UZ') fz += F_global[i];
      }
    }

    // Sum reactions on constrained DOFs
    for (const r of reactions) {
      if (r.dof === 'UX') rx += r.reactionForce;
      if (r.dof === 'UY') ry += r.reactionForce;
      if (r.dof === 'UZ') rz += r.reactionForce;
    }

    const netX = fx + rx;
    const netY = fy + ry;
    const netZ = fz + rz;

    const residualNorm = Math.sqrt(netX * netX + netY * netY + netZ * netZ);
    const totalAppliedNorm = Math.sqrt(fx * fx + fy * fy + fz * fz) + 1.0;

    const relRes = residualNorm / totalAppliedNorm;
    const forceBalancePassed = relRes <= tolerance || residualNorm <= tolerance;

    return {
      sumExternalForces: { fx, fy, fz },
      sumReactions: { rx, ry, rz },
      netResidualForces: { x: netX, y: netY, z: netZ },
      residualForceNorm: residualNorm,
      forceBalancePassed
    };
  }
}
