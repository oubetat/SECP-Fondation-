import { EngineeringAIModel, EngineeringAIContext, AIGuardrailVerdict, OODStatus } from './types';
import { AIOutOfDistributionDetector } from './AIOutOfDistributionDetector';

export interface GuardrailCheckResult {
  verdict: AIGuardrailVerdict;
  oodStatus: OODStatus;
  details: string[];
}

export class EngineeringAIGuardrailEngine {
  public static evaluateGuardrails(
    model: EngineeringAIModel,
    context: EngineeringAIContext,
    inputs: Record<string, any>,
    units: Record<string, string>,
    physicsConstraints?: { checkPhysics?: (inputs: Record<string, any>, prediction?: any) => boolean }
  ): GuardrailCheckResult {
    const details: string[] = [];

    // 1. Model Status Qualification Check
    if (model.status !== 'ACTIVE' && model.status !== 'QUALIFIED') {
      return {
        verdict: 'MODEL_NOT_QUALIFIED',
        oodStatus: 'UNKNOWN',
        details: [`Model status is ${model.status}. Inference rejected for unqualified model.`]
      };
    }

    // 2. Unit Safety Check
    for (const reqField of model.inputContract.requiredFields) {
      if (inputs[reqField] === undefined) {
        return {
          verdict: 'REJECTED',
          oodStatus: 'UNKNOWN',
          details: [`Missing required input field: ${reqField}`]
        };
      }

      const expectedUnit = model.inputContract.units[reqField];
      const providedUnit = units[reqField];
      if (expectedUnit && providedUnit && expectedUnit.toLowerCase() !== providedUnit.toLowerCase()) {
        return {
          verdict: 'REJECTED',
          oodStatus: 'UNKNOWN',
          details: [`Unit Safety Violation on '${reqField}': expected ${expectedUnit}, provided ${providedUnit}`]
        };
      }
    }

    // 3. Dimensional Validation
    for (const [field, expectedDim] of Object.entries(model.inputContract.dimensions)) {
      const val = inputs[field];
      if (Array.isArray(val) && val.length !== expectedDim[0]) {
        return {
          verdict: 'REJECTED',
          oodStatus: 'UNKNOWN',
          details: [`Dimension mismatch on '${field}': expected length ${expectedDim[0]}, got ${val.length}`]
        };
      }
    }

    // 4. Domain & Range OOD Check
    const oodRes = AIOutOfDistributionDetector.detectOOD(inputs, model.inputContract);
    if (oodRes.status === 'OUT_OF_DISTRIBUTION') {
      return {
        verdict: 'OUT_OF_DOMAIN',
        oodStatus: 'OUT_OF_DISTRIBUTION',
        details: [oodRes.details]
      };
    }

    // 5. Physics Guardrail Check
    if (physicsConstraints && physicsConstraints.checkPhysics) {
      const ok = physicsConstraints.checkPhysics(inputs);
      if (!ok) {
        return {
          verdict: 'PHYSICS_VIOLATION',
          oodStatus: oodRes.status,
          details: ['Physics constraint violation detected on inputs/context']
        };
      }
    }

    const verdict: AIGuardrailVerdict = oodRes.status === 'NEAR_BOUNDARY' ? 'ALLOWED_WITH_WARNING' : 'ALLOWED';
    return {
      verdict,
      oodStatus: oodRes.status,
      details: oodRes.status === 'NEAR_BOUNDARY' ? ['Operating near domain boundary'] : ['Guardrails satisfied']
    };
  }
}
