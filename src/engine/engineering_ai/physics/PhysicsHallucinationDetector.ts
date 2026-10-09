import {
  PhysicsContext,
  PhysicsReasoningVerdict,
  PhysicsHypothesis,
  PhysicsCausalHypothesis
} from './types';
import { GoverningEquationRegistry } from './GoverningEquationRegistry';
import { PhysicsBoundsEngine } from './PhysicsBoundsEngine';

export interface PhysicsClaimCheckResult {
  verdict: PhysicsReasoningVerdict;
  details: string;
  unsupportedEquations: string[];
  boundViolations: string[];
  assumptionViolations: string[];
}

export class PhysicsHallucinationDetector {
  public static verifyClaimPhysicsGrounding(
    claimText: string,
    equationIds: string[],
    activeAssumptions: string[],
    context: PhysicsContext,
    variableValues?: Record<string, { value: number; unit: string; type: any }>
  ): PhysicsClaimCheckResult {
    const unsupportedEquations: string[] = [];
    const boundViolations: string[] = [];
    const assumptionViolations: string[] = [];

    // 1. Check if all referenced equations exist in GoverningEquationRegistry
    for (const eqId of equationIds) {
      if (!GoverningEquationRegistry.hasEquation(eqId)) {
        unsupportedEquations.push(eqId);
      } else {
        // Validate assumptions for this equation
        const assCheck = GoverningEquationRegistry.validateAssumptions(eqId, activeAssumptions);
        if (!assCheck.valid) {
          assumptionViolations.push(`Equation ${eqId} missing assumptions: [${assCheck.missingAssumptions.join(', ')}]`);
        }
      }
    }

    // 2. Check variable physical bounds if provided
    if (variableValues) {
      for (const [vId, vData] of Object.entries(variableValues)) {
        const boundRec = PhysicsBoundsEngine.verifyPhysicalBounds(
          vId,
          vData.type,
          vData.value,
          vData.unit
        );
        if (boundRec.verdict === 'BOUND_VIOLATION') {
          boundViolations.push(boundRec.reasoning);
        }
      }
    }

    // 3. Special rule checks in claim text
    const lowerClaim = claimText.toLowerCase();

    // Incompressible assumption violation check
    if (lowerClaim.includes('incompressible') && lowerClaim.includes('mach')) {
      const machMatch = claimText.match(/mach\s*=?\s*(\d+(?:\.\d+)?)/i);
      if (machMatch) {
        const machVal = parseFloat(machMatch[1]);
        if (machVal >= 0.3) {
          assumptionViolations.push(`ASSUMPTION_INVALID: Incompressible flow assumption violated at Mach ${machVal} (>= 0.3 requirement).`);
        }
      }
    }

    if (unsupportedEquations.length > 0) {
      return {
        verdict: 'UNSUPPORTED_PHYSICS_CLAIM',
        details: `Claim references unsupported or non-existent governing equation IDs: [${unsupportedEquations.join(', ')}]`,
        unsupportedEquations,
        boundViolations,
        assumptionViolations
      };
    }

    if (boundViolations.length > 0) {
      return {
        verdict: 'PHYSICS_VIOLATION',
        details: `Claim violates physical bounds: [${boundViolations.join('; ')}]`,
        unsupportedEquations,
        boundViolations,
        assumptionViolations
      };
    }

    if (assumptionViolations.length > 0) {
      return {
        verdict: 'ASSUMPTION_INVALID',
        details: `Claim contains invalid physics assumptions: [${assumptionViolations.join('; ')}]`,
        unsupportedEquations,
        boundViolations,
        assumptionViolations
      };
    }

    return {
      verdict: 'VERIFIED',
      details: 'All referenced physical equations, assumptions, and bounds strictly verified.',
      unsupportedEquations: [],
      boundViolations: [],
      assumptionViolations: []
    };
  }

  public static verifyCausalityVsCorrelation(causalHyp: PhysicsCausalHypothesis): {
    valid: boolean;
    reasoning: string;
  } {
    if (!causalHyp.causalityVerified) {
      return {
        valid: false,
        reasoning: 'CAUSALITY_UNVERIFIED: Correlation detected between variables, but causality cannot be asserted without controlled physical solver/experimental mechanism proof.'
      };
    }

    return {
      valid: true,
      reasoning: 'Causality verified through controlled solver / physical experiment.'
    };
  }
}
