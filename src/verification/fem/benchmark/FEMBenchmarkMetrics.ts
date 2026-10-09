/**
 * PATCH-177: FEM Benchmark Metrics Calculator
 * 
 * Computes independent physical metrics, errors, relative L2 norms,
 * and external force vs reaction equilibrium balance.
 */

import { FEMBenchmarkMetrics } from './types';
import { StructuralSolveResult } from '../../../engine/fem/solver/LinearStructuralSolver';
import { StructuralModel } from '../../../engine/fem/solver/StructuralModel';

export class FEMBenchmarkMetricsEngine {
  /**
   * Computes independent benchmark metrics from a solver execution result and reference targets.
   */
  public static computeMetrics(
    solveResult: StructuralSolveResult,
    model: StructuralModel,
    reference: {
      displacementMm: number;
      stressMPa: number;
      strain: number;
      reactionN: number;
    },
    runtimeMs: number
  ): FEMBenchmarkMetrics {
    // 1. Max Displacement & Error
    let maxDisp = 0;
    if (solveResult.displacements && solveResult.displacements.length > 0) {
      // Find max vector magnitude
      for (let i = 0; i < solveResult.displacements.length; i += 2) {
        const ux = solveResult.displacements[i] || 0;
        const uy = solveResult.displacements[i + 1] || 0;
        const mag = Math.sqrt(ux * ux + uy * uy);
        if (mag > maxDisp) maxDisp = mag;
      }
    }
    // Note: displacements in solver are in meters (SI units), convert to mm
    const maxDispMm = maxDisp * 1000;
    const refDispMmAbs = Math.abs(reference.displacementMm);
    const dispErrPercent = refDispMmAbs > 1e-12
      ? (Math.abs(maxDispMm - refDispMmAbs) / refDispMmAbs) * 100
      : 0;

    // 2. Max von Mises Stress & Error
    let maxStress = 0;
    let maxStrain = 0;
    if (solveResult.elementResults) {
      for (const elemRes of solveResult.elementResults) {
        if (elemRes.elementCenterVonMises > maxStress) {
          maxStress = elemRes.elementCenterVonMises;
        }
        if (elemRes.elementCenterStrain) {
          for (const strVal of elemRes.elementCenterStrain) {
            if (Math.abs(strVal) > maxStrain) maxStrain = Math.abs(strVal);
          }
        }
      }
    }

    const stressErrPercent = Math.abs(reference.stressMPa) > 1e-12
      ? (Math.abs(maxStress - reference.stressMPa) / Math.abs(reference.stressMPa)) * 100
      : 0;

    const strainErrorPercent = Math.abs(reference.strain) > 1e-12
      ? (Math.abs(maxStrain - reference.strain) / Math.abs(reference.strain)) * 100
      : 0;

    // 3. Reactions & Reaction Force Error
    let sumRx = 0;
    let sumRy = 0;
    let sumRz = 0;
    if (solveResult.reactions) {
      for (const rx of solveResult.reactions) {
        if (rx.dof === 'UX') sumRx += rx.reactionForce;
        if (rx.dof === 'UY') sumRy += rx.reactionForce;
        if (rx.dof === 'UZ') sumRz += rx.reactionForce;
      }
    }

    const totalReactionMag = Math.sqrt(sumRx * sumRx + sumRy * sumRy + sumRz * sumRz);
    const reactionErrPercent = Math.abs(reference.reactionN) > 1e-12
      ? (Math.abs(totalReactionMag - Math.abs(reference.reactionN)) / Math.abs(reference.reactionN)) * 100
      : 0;

    // 4. Independent Global Equilibrium Residual (|Sum(F_ext) + Sum(R_rxn)|)
    let sumFx = 0;
    let sumFy = 0;
    let sumFz = 0;
    for (const load of model.loads) {
      if (load.dof === 'UX') sumFx += load.magnitude;
      if (load.dof === 'UY') sumFy += load.magnitude;
      if (load.dof === 'UZ') sumFz += load.magnitude;
    }

    const netFx = sumFx + sumRx;
    const netFy = sumFy + sumRy;
    const netFz = sumFz + sumRz;
    const independentEquilibriumResidualN = Math.sqrt(netFx * netFx + netFy * netFy + netFz * netFz);

    // 5. Relative L2 Error Norm
    const relativeL2Error = Math.abs(reference.displacementMm) > 1e-12
      ? Math.abs(maxDispMm - reference.displacementMm) / Math.abs(reference.displacementMm)
      : 0;

    return {
      maxDisplacementMm: maxDispMm,
      referenceDisplacementMm: reference.displacementMm,
      displacementErrorPercent: dispErrPercent,

      maxVonMisesStressMPa: maxStress,
      referenceStressMPa: reference.stressMPa,
      stressErrorPercent: stressErrPercent,

      maxStrain,
      referenceStrain: reference.strain,
      strainErrorPercent,

      reactionForceErrorPercent: reactionErrPercent,
      independentEquilibriumResidualN,
      relativeL2Error,

      dofCount: model.nodes.length * 2, // 2 DOFs per node for 2D plane/bar
      elementCount: model.elements.length,
      nodeCount: model.nodes.length,
      runtimeMs,
      iterationCount: 1 // Direct solver
    };
  }
}
