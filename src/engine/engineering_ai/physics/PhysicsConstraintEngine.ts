import {
  PhysicsContext,
  PhysicsPrediction,
  PhysicsReasoningVerdict,
  ConservationResult
} from './types';
import { PhysicsDimensionalAnalyzer } from './PhysicsDimensionalAnalyzer';
import { PhysicsBoundsEngine } from './PhysicsBoundsEngine';
import { PhysicsConservationVerifier } from './PhysicsConservationVerifier';

export class PhysicsConstraintEngine {
  public static evaluatePhysicsConstraints(
    prediction: PhysicsPrediction,
    context: PhysicsContext,
    options?: {
      quantityType?: any;
      equationExpr?: string;
      varQuantities?: Record<string, any>;
      conservationCheck?: { input: number; output: number; source?: number; tolerance?: number };
      solverConverged?: boolean;
    }
  ): {
    admissible: boolean;
    verdict: PhysicsReasoningVerdict;
    details: string;
  } {
    // 1. Check solver convergence if solver check provided
    if (options?.solverConverged === false) {
      return {
        admissible: false,
        verdict: 'NOT_CONVERGED',
        details: 'NOT_CONVERGED: Numerical solver did not converge. AI cannot elevate unconverged solver results to verified truth.'
      };
    }

    // 2. Check Physical Bounds
    if (options?.quantityType) {
      const boundRec = PhysicsBoundsEngine.verifyPhysicalBounds(
        prediction.variable,
        options.quantityType,
        prediction.predictedValue,
        prediction.unit
      );
      if (boundRec.verdict === 'BOUND_VIOLATION') {
        return {
          admissible: false,
          verdict: 'PHYSICS_VIOLATION',
          details: boundRec.reasoning
        };
      }
    }

    // 3. Check Dimensional Analysis
    if (options?.equationExpr && options?.varQuantities) {
      const dimCheck = PhysicsDimensionalAnalyzer.verifyEquationExpression(
        options.equationExpr,
        options.varQuantities
      );
      if (!dimCheck.valid) {
        return {
          admissible: false,
          verdict: 'PHYSICS_VIOLATION',
          details: dimCheck.reason
        };
      }
    }

    // 4. Check Conservation
    if (options?.conservationCheck) {
      const consRes = PhysicsConservationVerifier.verifyConservation(
        'MASS',
        options.conservationCheck.input,
        options.conservationCheck.output,
        options.conservationCheck.source || 0,
        options.conservationCheck.tolerance || 0.001
      );

      if (consRes.verdict === 'CONSERVATION_FAILURE') {
        return {
          admissible: false,
          verdict: 'CONSERVATION_FAILURE',
          details: consRes.details
        };
      }
    }

    return {
      admissible: true,
      verdict: 'VERIFIED',
      details: 'All physical constraints (Dimensional, Physical Bounds, Conservation) satisfied.'
    };
  }
}
