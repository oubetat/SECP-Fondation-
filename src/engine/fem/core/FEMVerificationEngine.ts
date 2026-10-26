/**
 * SECP Industrial OS — FEM Core Numerical Upgrade (SECP-FEM-UPGRADE-001)
 * FEMVerificationEngine.ts
 * 
 * Verifies global static equilibrium (sum F_ext + sum R = 0) and strain energy conservation.
 * Compatible with both SparseMatrix and dense Matrix architectures.
 */

import { Matrix } from "./MathUtils";
import { SparseMatrix } from "./SparseMatrix";
import { FEMDOFManager } from "./FEMDOFManager";
import { DOFComponent, FEMModel } from "./FEMTypes";

export class FEMVerificationEngine {
  /**
   * Verifies static equilibrium: sum F_external + sum Reactions = 0 for each translational DOF.
   */
  public verifyEquilibrium(
    F_external: number[] | Float64Array,
    Reactions: number[] | Float64Array,
    dofManager: FEMDOFManager,
    tolerance = 1e-5
  ): { ok: boolean; sumFx: number; sumFy: number; sumFz: number; residualNorm: number; error?: string } {
    let sumFx = 0;
    let sumFy = 0;
    let sumFz = 0;

    const allDOFs = dofManager.getAllDOFs();

    for (const dof of allDOFs) {
      const globalId = dof.globalId;
      const totalForce = (F_external[globalId] || 0) + (Reactions[globalId] || 0);

      if (dof.component === DOFComponent.UX) sumFx += totalForce;
      else if (dof.component === DOFComponent.UY) sumFy += totalForce;
      else if (dof.component === DOFComponent.UZ) sumFz += totalForce;
    }

    const residualNorm = Math.sqrt(sumFx * sumFx + sumFy * sumFy + sumFz * sumFz);

    if (Math.abs(sumFx) > tolerance || Math.abs(sumFy) > tolerance || Math.abs(sumFz) > tolerance) {
      return {
        ok: false,
        sumFx,
        sumFy,
        sumFz,
        residualNorm,
        error: `Equilibrium failure: SumFx=${sumFx.toExponential(4)}, SumFy=${sumFy.toExponential(4)}, SumFz=${sumFz.toExponential(4)}, norm=${residualNorm.toExponential(4)}`
      };
    }

    return { ok: true, sumFx, sumFy, sumFz, residualNorm };
  }

  /**
   * Verifies energy conservation: Strain Energy (0.5 * U^T * K * U) equals External Work (0.5 * U^T * F_eff).
   */
  public verifyEnergy(
    K: Matrix | SparseMatrix,
    U: number[] | Float64Array,
    F_external: number[] | Float64Array,
    Reactions: number[] | Float64Array,
    tolerance = 1e-5
  ): { ok: boolean; strainEnergy: number; externalWork: number; diff: number } {
    let KU: Float64Array | number[];

    if (K instanceof SparseMatrix) {
      KU = K.multiplyVector(U);
    } else {
      const uVec = Array.isArray(U) ? U : Array.from(U);
      KU = K.multiplyVector(uVec);
    }

    let strainEnergy = 0;
    for (let i = 0; i < U.length; i++) {
      strainEnergy += 0.5 * U[i] * KU[i];
    }

    let externalWork = 0;
    for (let i = 0; i < U.length; i++) {
      externalWork += 0.5 * U[i] * ((F_external[i] || 0) + (Reactions[i] || 0));
    }

    const diff = Math.abs(strainEnergy - externalWork);
    const maxVal = Math.max(Math.abs(strainEnergy), Math.abs(externalWork), 1.0);
    const relDiff = diff / maxVal;

    if (relDiff > tolerance) {
      return { ok: false, strainEnergy, externalWork, diff };
    }

    return { ok: true, strainEnergy, externalWork, diff };
  }

  /**
   * Phase D: Independent Moment Equilibrium Verification about a reference origin:
   * sum M_z = sum ( (x_i - x_0) * (F_y + R_y) - (y_i - y_0) * (F_x + R_x) ) = 0
   */
  public verifyMomentEquilibrium(
    model: FEMModel,
    F_external: number[] | Float64Array,
    Reactions: number[] | Float64Array,
    dofManager: FEMDOFManager,
    tolerance = 1e-4,
    refPoint = { x: 0, y: 0 }
  ): { ok: boolean; sumMz: number; error?: string } {
    let sumMz = 0;

    for (const [nodeId, node] of model.nodes.entries()) {
      const dofX = dofManager.getDOF(nodeId, DOFComponent.UX);
      const dofY = dofManager.getDOF(nodeId, DOFComponent.UY);
      const dofRZ = dofManager.getDOF(nodeId, DOFComponent.RZ);

      const fx = dofX ? (F_external[dofX.globalId] || 0) + (Reactions[dofX.globalId] || 0) : 0;
      const fy = dofY ? (F_external[dofY.globalId] || 0) + (Reactions[dofY.globalId] || 0) : 0;
      const mz = dofRZ ? (F_external[dofRZ.globalId] || 0) + (Reactions[dofRZ.globalId] || 0) : 0;

      const rx = node.x - refPoint.x;
      const ry = node.y - refPoint.y;

      // M_z = r_x * F_y - r_y * F_x + M_nodal
      sumMz += (rx * fy - ry * fx) + mz;
    }

    if (Math.abs(sumMz) > tolerance) {
      return {
        ok: false,
        sumMz,
        error: `Moment equilibrium failure: SumMz=${sumMz.toExponential(4)} N*mm exceeds tolerance ${tolerance}`
      };
    }

    return { ok: true, sumMz };
  }
}
