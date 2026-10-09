/**
 * PATCH-SECP-073: Structural Design Intent Engine
 * Provides design feedback to the CAD Kernel (SECP-071), optimizing geometric profiles.
 */

import { StructuralAnalysisResults, DesignFeedback } from './StructuralPhysicsTypes';

export class StructuralDesignIntentEngine {
  public static generateDesignFeedback(
    results: StructuralAnalysisResults,
    currentArea: number
  ): DesignFeedback {
    // Determine minimum safety factor across nodes
    let minSafety = 15.0;
    results.nodes.forEach(n => {
      if (n.safetyFactor < minSafety) minSafety = n.safetyFactor;
    });

    if (results.yieldExceeded || minSafety < 1.5) {
      return {
        recommendation: 'THICKEN_SECTION',
        suggestedMultiplier: 1.5,
        explanation: `Yield margin exceeded or safety factor of ${minSafety.toFixed(2)} is below the engineering safety threshold (1.5). Section enlargement of cross-sectional area is required.`
      };
    }

    if (minSafety > 5.0) {
      return {
        recommendation: 'REDUCE_WEIGHT',
        suggestedMultiplier: 0.8,
        explanation: `Structural safety factor of ${minSafety.toFixed(2)} is high (over 5.0). Optimal section weight reduction is suggested to conserve resources.`
      };
    }

    return {
      recommendation: 'PRESERVE',
      suggestedMultiplier: 1.0,
      explanation: 'Structural design parameters are optimized and compliant with the stress profiles.'
    };
  }
}
