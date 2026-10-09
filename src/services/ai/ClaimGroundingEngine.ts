import { EngineeringClaim, EngineeringEvidence } from '../../engine/engineering_ai/evidence/types';
import { EvidenceValidator } from './EvidenceValidator';

export interface GroundingResult {
  grounded: boolean;
  claim: EngineeringClaim;
  numericalMismatches: string[];
  unitMismatches: string[];
}

export class ClaimGroundingEngine {
  public static verifyGrounding(
    claim: EngineeringClaim,
    evidenceList: EngineeringEvidence[],
    extractedValue?: number,
    extractedUnit?: string
  ): GroundingResult {
    const valid = evidenceList.filter(e => EvidenceValidator.validateIntegrity(e).valid);
    const numericalMismatches: string[] = [];
    const unitMismatches: string[] = [];

    if (extractedValue !== undefined) {
      const matched = valid.find(e => e.measurement !== undefined && Math.abs(e.measurement - extractedValue) < 1e-3);
      if (!matched && valid.some(e => e.measurement !== undefined)) {
        numericalMismatches.push('NUMERICAL_GROUNDING_FAILURE');
      }
    }

    if (extractedUnit !== undefined) {
      const unitMatched = valid.find(e => e.units && e.units.toLowerCase() === extractedUnit.toLowerCase());
      if (!unitMatched && valid.some(e => e.units)) {
        unitMismatches.push('UNIT_GROUNDING_FAILURE');
      }
    }

    const grounded = valid.length > 0 && numericalMismatches.length === 0 && unitMismatches.length === 0;

    return {
      grounded,
      claim,
      numericalMismatches,
      unitMismatches
    };
  }
}
