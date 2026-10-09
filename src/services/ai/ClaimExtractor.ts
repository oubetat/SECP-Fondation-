import { EngineeringClaim } from '../../engine/engineering_ai/evidence/types';

export class ClaimExtractor {
  public static extractClaimsFromResponse(responseContent: string, domain: string = 'Structural'): EngineeringClaim[] {
    const claims: EngineeringClaim[] = [];

    if (responseContent.toLowerCase().includes('stress')) {
      claims.push({
        claimId: `CLM-${Date.now()}-1`,
        text: 'Stress level within limits',
        claimType: 'SIMULATION_RESULT',
        domain,
        importance: 'HIGH_IMPACT',
        requiredEvidence: ['stress_simulation', 'material_allowable'],
        supportingEvidence: [],
        contradictingEvidence: [],
        status: 'UNKNOWN',
        confidence: 0.9
      });
    }

    if (responseContent.toLowerCase().includes('safe') || responseContent.toLowerCase().includes('approved')) {
      claims.push({
        claimId: `CLM-${Date.now()}-2`,
        text: 'Component safety status',
        claimType: 'VALIDATED_RESULT',
        domain,
        importance: 'CRITICAL',
        requiredEvidence: ['independent_verification', 'material_certificate'],
        supportingEvidence: [],
        contradictingEvidence: [],
        status: 'UNKNOWN',
        confidence: 0.95
      });
    }

    return claims;
  }
}
