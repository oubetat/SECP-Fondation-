import { ContactConvergenceResult, ContactParameters, ContactPointState } from "./types";

export class ContactConvergenceChecker {
  /**
   * Evaluates comprehensive contact convergence criteria.
   */
  static evaluateConvergence(
    pointStates: ContactPointState[],
    parameters: ContactParameters,
    tolerances: {
      gapTolerance?: number;
      forceTolerance?: number;
      complementarityTolerance?: number;
      frictionTolerance?: number;
    } = {}
  ): ContactConvergenceResult {
    const gapTol = tolerances.gapTolerance ?? parameters.penetrationTolerance ?? 1e-4;
    const forceTol = tolerances.forceTolerance ?? 1e-3;
    const compTol = tolerances.complementarityTolerance ?? 1e-4;
    const fricTol = tolerances.frictionTolerance ?? 1e-3;

    let maxPenetration = 0.0;
    let maxComplementarity = 0.0;
    let maxFrictionViolation = 0.0;
    let totalForceNormSq = 0.0;

    const violations: string[] = [];

    for (const state of pointStates) {
      if (state.status === 'OPEN') continue;

      // 1. Penetration gap residual
      if (state.penetration > maxPenetration) {
        maxPenetration = state.penetration;
      }

      // 2. Complementarity residual |g_n * lambda_n|
      const compVal = Math.abs(state.gap * state.contactPressure);
      if (compVal > maxComplementarity) {
        maxComplementarity = compVal;
      }

      // 3. Contact force norm
      totalForceNormSq += state.contactPressure * state.contactPressure;

      // 4. Coulomb friction residual check
      if (parameters.frictionCoefficient && parameters.frictionCoefficient > 0) {
        const ftNorm = Math.hypot(
          state.tangentialTraction[0] || 0,
          state.tangentialTraction[1] || 0
        );
        const limit = parameters.frictionCoefficient * state.contactPressure;
        if (ftNorm > limit + fricTol) {
          const viol = ftNorm - limit;
          if (viol > maxFrictionViolation) maxFrictionViolation = viol;
        }
      }
    }

    const forceResidual = Math.sqrt(totalForceNormSq);

    if (maxPenetration > gapTol) {
      violations.push(`Max penetration (${maxPenetration.toExponential(3)}) exceeds gap tolerance (${gapTol.toExponential(3)})`);
    }

    if (maxComplementarity > compTol) {
      violations.push(`Complementarity violation (${maxComplementarity.toExponential(3)}) exceeds tolerance (${compTol.toExponential(3)})`);
    }

    if (maxFrictionViolation > fricTol) {
      violations.push(`Friction Coulomb violation (${maxFrictionViolation.toExponential(3)}) exceeds friction tolerance (${fricTol.toExponential(3)})`);
    }

    const converged = violations.length === 0;

    return {
      converged,
      gapResidual: maxPenetration,
      forceResidual,
      complementarityResidual: maxComplementarity,
      frictionResidual: maxFrictionViolation,
      maxPenetration,
      violations
    };
  }
}
