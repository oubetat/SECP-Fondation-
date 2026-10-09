import { VerificationCheckResult, VerificationStatus, VerificationTolerancePolicy } from "./types";

export class EquilibriumVerifier {
  /**
   * Verifies global static force equilibrium: sum(F_applied) = sum(F_reactions).
   */
  public static verifyForceBalance(
    appliedForces: number[][],   // Array of [Fx, Fy, Fz] vectors
    reactions: number[][],       // Array of [Rx, Ry, Rz] vectors
    tolPolicy: VerificationTolerancePolicy
  ): VerificationCheckResult {
    let sumFx = 0, sumFy = 0, sumFz = 0;
    let sumRx = 0, sumRy = 0, sumRz = 0;

    for (const f of appliedForces) {
      sumFx += f[0] || 0;
      sumFy += f[1] || 0;
      sumFz += f[2] || 0;
    }

    for (const r of reactions) {
      sumRx += r[0] || 0;
      sumRy += r[1] || 0;
      sumRz += r[2] || 0;
    }

    const netFx = sumFx + sumRx;
    const netFy = sumFy + sumRy;
    const netFz = sumFz + sumRz;

    const errorNorm = Math.sqrt(netFx * netFx + netFy * netFy + netFz * netFz);
    const appliedNorm = Math.sqrt(sumFx * sumFx + sumFy * sumFy + sumFz * sumFz) || 1.0;
    const relError = errorNorm / appliedNorm;

    const passed = errorNorm <= tolPolicy.forceAbsTol || relError <= tolPolicy.forceRelTol;

    return {
      checkId: "EQUILIBRIUM_FORCE_BALANCE",
      metric: "Global Force Residual Norm (N)",
      measuredValue: errorNorm,
      expectedValue: 0,
      tolerance: tolPolicy.forceAbsTol,
      error: relError,
      status: passed ? VerificationStatus.PASS : VerificationStatus.FAIL,
      details: `Net Force Residual: [${netFx.toExponential(4)}, ${netFy.toExponential(4)}, ${netFz.toExponential(4)}] N (Rel Error: ${(relError * 100).toFixed(4)}%)`
    };
  }

  /**
   * Verifies moment equilibrium: sum(r_i x F_i) + sum(r_j x R_j) + sum(M_applied) - sum(M_reactions) = 0.
   */
  public static verifyMomentBalance(
    forceCoords: number[][],    // [x, y, z] for applied forces
    appliedForces: number[][],  // [Fx, Fy, Fz]
    reactionCoords: number[][], // [x, y, z] for reactions
    reactions: number[][],      // [Rx, Ry, Rz]
    tolPolicy: VerificationTolerancePolicy
  ): VerificationCheckResult {
    let Mx = 0, My = 0, Mz = 0;

    // Applied force moments
    for (let i = 0; i < appliedForces.length; i++) {
      const pos = forceCoords[i] || [0, 0, 0];
      const f = appliedForces[i] || [0, 0, 0];
      Mx += pos[1] * f[2] - pos[2] * f[1];
      My += pos[2] * f[0] - pos[0] * f[2];
      Mz += pos[0] * f[1] - pos[1] * f[0];
    }

    // Reaction moments (reactions balance applied moments)
    for (let j = 0; j < reactions.length; j++) {
      const pos = reactionCoords[j] || [0, 0, 0];
      const r = reactions[j] || [0, 0, 0];
      Mx += pos[1] * r[2] - pos[2] * r[1];
      My += pos[2] * r[0] - pos[0] * r[2];
      Mz += pos[0] * r[1] - pos[1] * r[0];
    }

    const netMomentNorm = Math.sqrt(Mx * Mx + My * My + Mz * Mz);
    const passed = netMomentNorm <= tolPolicy.momentAbsTol;

    return {
      checkId: "EQUILIBRIUM_MOMENT_BALANCE",
      metric: "Global Moment Residual Norm (N·m)",
      measuredValue: netMomentNorm,
      expectedValue: 0,
      tolerance: tolPolicy.momentAbsTol,
      error: netMomentNorm,
      status: passed ? VerificationStatus.PASS : VerificationStatus.FAIL,
      details: `Net Moment Residual: [${Mx.toExponential(4)}, ${My.toExponential(4)}, ${Mz.toExponential(4)}] N·m`
    };
  }

  /**
   * Recomputes linear algebraic residual r = K * u - F.
   */
  public static verifyLinearResidual(
    K: number[][],
    u: number[],
    F: number[],
    tolPolicy: VerificationTolerancePolicy,
    ignoreDofs: number[] = []
  ): VerificationCheckResult {
    const n = u.length;
    let resNormSq = 0;
    let fNormSq = 0;
    const ignoreSet = new Set(ignoreDofs);

    for (let i = 0; i < n; i++) {
      if (ignoreSet.has(i)) continue;

      let Ku_i = 0;
      for (let j = 0; j < n; j++) {
        Ku_i += K[i][j] * u[j];
      }
      const ri = Ku_i - F[i];
      resNormSq += ri * ri;
      fNormSq += F[i] * F[i];
    }

    const resNorm = Math.sqrt(resNormSq);
    const fNorm = Math.sqrt(fNormSq) || 1.0;
    const relRes = resNorm / fNorm;

    const passed = resNorm <= tolPolicy.residualAbsTol || relRes <= 1e-4;

    return {
      checkId: "EQUILIBRIUM_LINEAR_RESIDUAL",
      metric: "Linear System Residual Norm ||Ku - F||",
      measuredValue: resNorm,
      expectedValue: 0,
      tolerance: tolPolicy.residualAbsTol,
      error: relRes,
      status: passed ? VerificationStatus.PASS : VerificationStatus.FAIL,
      details: `Absolute residual: ${resNorm.toExponential(4)}, Relative residual: ${relRes.toExponential(4)}`
    };
  }

  /**
   * Verifies prescribed constraint satisfaction: ||u_constrained - u_prescribed|| = 0.
   */
  public static verifyConstraintResidual(
    constrainedDofs: number[],
    u: number[],
    prescribedValues: number[],
    tolPolicy: VerificationTolerancePolicy
  ): VerificationCheckResult {
    let maxDiff = 0;

    for (let i = 0; i < constrainedDofs.length; i++) {
      const dof = constrainedDofs[i];
      const actualVal = u[dof] || 0;
      const targetVal = prescribedValues[i] || 0;
      const diff = Math.abs(actualVal - targetVal);
      if (diff > maxDiff) maxDiff = diff;
    }

    const passed = maxDiff <= tolPolicy.displacementRelTol;

    return {
      checkId: "EQUILIBRIUM_CONSTRAINT_RESIDUAL",
      metric: "Boundary Constraint Max Violation (m)",
      measuredValue: maxDiff,
      expectedValue: 0,
      tolerance: tolPolicy.displacementRelTol,
      error: maxDiff,
      status: passed ? VerificationStatus.PASS : VerificationStatus.FAIL,
      details: `Max constraint residual across ${constrainedDofs.length} constrained DOFs: ${maxDiff.toExponential(4)} m`
    };
  }
}
