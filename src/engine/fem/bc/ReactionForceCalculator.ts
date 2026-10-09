/**
 * SECP CAD/CAE Platform - Reaction Force & Equilibrium Verification Engine
 * PATCH-235 — Boundary Condition Engine
 *
 * Computes nodal reaction forces R = K_orig * u - F_applied at constrained DOFs
 * post-solve and audits global force equilibrium sum(F_ext) + sum(R) ≈ 0.
 */

import { CSRStorage } from '../sparse/CSRStorage';
import { DOFManager } from '../assembly/DOFManager';
import { ReactionForceResult, SystemEquilibriumAudit, Vector3D } from './BoundaryConditionTypes';

export class ReactionForceCalculator {
  /**
   * Calculates nodal reaction forces and verifies global static equilibrium.
   */
  public static calculateReactions(
    csrK_unmodified: CSRStorage,
    u_solution: number[],
    F_applied: number[],
    dofManager: DOFManager
  ): { reactions: ReactionForceResult[]; audit: SystemEquilibriumAudit } {
    const totalDOFs = csrK_unmodified.rows;

    // 1. Multiply K_unmodified * u_solution = Ku
    const Ku = new Array<number>(totalDOFs).fill(0.0);
    for (let r = 0; r < totalDOFs; r++) {
      const start = csrK_unmodified.rowPointers[r];
      const end = csrK_unmodified.rowPointers[r + 1];
      let sum = 0.0;
      for (let idx = start; idx < end; idx++) {
        sum += csrK_unmodified.values[idx] * u_solution[csrK_unmodified.columnIndices[idx]];
      }
      Ku[r] = sum;
    }

    // 2. Compute residual reaction vector: R_raw = Ku - F_applied
    const R_raw = new Array<number>(totalDOFs).fill(0.0);
    for (let i = 0; i < totalDOFs; i++) {
      R_raw[i] = Ku[i] - F_applied[i];
    }

    // 3. Extract reaction forces for prescribed DOFs
    const nodeReactionMap = new Map<string, { Rx: number; Ry: number; Rz: number }>();
    const prescribedIndices = dofManager.getPrescribedIndices();

    for (const pIdx of prescribedIndices) {
      const desc = dofManager.getDescriptor(pIdx);
      const nid = desc.nodeId;

      if (!nodeReactionMap.has(nid)) {
        nodeReactionMap.set(nid, { Rx: 0.0, Ry: 0.0, Rz: 0.0 });
      }

      const entry = nodeReactionMap.get(nid)!;
      if (desc.field === 'UX') entry.Rx += R_raw[pIdx];
      if (desc.field === 'UY') entry.Ry += R_raw[pIdx];
      if (desc.field === 'UZ') entry.Rz += R_raw[pIdx];
    }

    const reactions: ReactionForceResult[] = [];
    let totalRx = 0.0;
    let totalRy = 0.0;
    let totalRz = 0.0;

    for (const [nid, rVal] of nodeReactionMap.entries()) {
      const mag = Math.sqrt(rVal.Rx * rVal.Rx + rVal.Ry * rVal.Ry + rVal.Rz * rVal.Rz);
      totalRx += rVal.Rx;
      totalRy += rVal.Ry;
      totalRz += rVal.Rz;

      reactions.push({
        nodeId: nid,
        globalNodeIndex: dofManager.getGlobalDOFIndex(nid, 'UX') || 0,
        Rx: rVal.Rx,
        Ry: rVal.Ry,
        Rz: rVal.Rz,
        R_magnitude: mag
      });
    }

    // 4. Calculate total applied external force sum
    let totalFxExt = 0.0;
    let totalFyExt = 0.0;
    let totalFzExt = 0.0;

    for (let i = 0; i < totalDOFs; i++) {
      const desc = dofManager.getDescriptor(i);
      if (desc.status === 'FREE') {
        if (desc.field === 'UX') totalFxExt += F_applied[i];
        if (desc.field === 'UY') totalFyExt += F_applied[i];
        if (desc.field === 'UZ') totalFzExt += F_applied[i];
      }
    }

    const totalExternalForce: Vector3D = { x: totalFxExt, y: totalFyExt, z: totalFzExt };
    const totalReactionForce: Vector3D = { x: totalRx, y: totalRy, z: totalRz };

    const residualForce: Vector3D = {
      x: totalExternalForce.x + totalReactionForce.x,
      y: totalExternalForce.y + totalReactionForce.y,
      z: totalExternalForce.z + totalReactionForce.z
    };

    const residualNorm = Math.sqrt(
      residualForce.x * residualForce.x +
        residualForce.y * residualForce.y +
        residualForce.z * residualForce.z
    );

    const extNorm = Math.sqrt(
      totalExternalForce.x * totalExternalForce.x +
        totalExternalForce.y * totalExternalForce.y +
        totalExternalForce.z * totalExternalForce.z
    );

    const relativeError = residualNorm / (extNorm > 1e-6 ? extNorm : 1.0);
    const tolerance = 1e-3;
    const isEquilibriumSatisfied = relativeError <= tolerance;

    const audit: SystemEquilibriumAudit = {
      totalExternalForce,
      totalReactionForce,
      residualForce,
      residualNorm,
      relativeError,
      isEquilibriumSatisfied,
      tolerance
    };

    return { reactions, audit };
  }
}
