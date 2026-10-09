import { ContactParameters, EnforcementMethod } from "./types";

export interface ContactConstraintResult {
  normalPressure: number;
  penetration: number;
  isConstraintActive: boolean;
  complementarityViolation: number;
  potentialEnergy: number;
}

export class ContactConstraint {
  static evaluateNormalConstraint(
    gap: number,
    parameters: ContactParameters,
    enforcement: EnforcementMethod = 'PENALTY',
    previousMultiplier: number = 0.0
  ): ContactConstraintResult {
    const kp = parameters.penaltyStiffness;

    if (gap >= 0.0) {
      // OPEN: No penetration, zero pressure
      return {
        normalPressure: 0.0,
        penetration: 0.0,
        isConstraintActive: false,
        complementarityViolation: gap * previousMultiplier,
        potentialEnergy: 0.0
      };
    }

    // PENETRATION (gap < 0)
    const penetration = -gap;

    if (enforcement === 'PENALTY') {
      const normalPressure = kp * penetration;
      const complementarityViolation = Math.abs(gap * normalPressure);
      const potentialEnergy = 0.5 * kp * penetration * penetration;

      return {
        normalPressure,
        penetration,
        isConstraintActive: true,
        complementarityViolation,
        potentialEnergy
      };
    } else if (enforcement === 'AUGMENTED_LAGRANGIAN') {
      const augmentedPressure = Math.max(0.0, previousMultiplier + kp * penetration);
      const complementarityViolation = Math.abs(gap * augmentedPressure);
      const potentialEnergy = previousMultiplier * penetration + 0.5 * kp * penetration * penetration;

      return {
        normalPressure: augmentedPressure,
        penetration,
        isConstraintActive: true,
        complementarityViolation,
        potentialEnergy
      };
    } else if (enforcement === 'LAGRANGE_MULTIPLIER') {
      // Direct exact enforcement where pressure satisfies lambda = max(0, prev + kp*penetration)
      const exactPressure = Math.max(0.0, previousMultiplier + kp * penetration);
      const complementarityViolation = Math.abs(gap * exactPressure);

      return {
        normalPressure: exactPressure,
        penetration,
        isConstraintActive: true,
        complementarityViolation,
        potentialEnergy: exactPressure * penetration
      };
    }

    // Default fallback
    const fallbackPressure = kp * penetration;
    return {
      normalPressure: fallbackPressure,
      penetration,
      isConstraintActive: true,
      complementarityViolation: Math.abs(gap * fallbackPressure),
      potentialEnergy: 0.5 * kp * penetration * penetration
    };
  }

  /**
   * Updates Lagrange Multiplier for Augmented Lagrangian iterations.
   * lambda_{n, new} = max(0, lambda_n + rho * penetration)
   */
  static updateAugmentedLagrangianMultiplier(
    currentMultiplier: number,
    gap: number,
    penaltyStiffness: number
  ): number {
    if (gap >= 0.0) return 0.0;
    const penetration = -gap;
    return Math.max(0.0, currentMultiplier + penaltyStiffness * penetration);
  }
}
