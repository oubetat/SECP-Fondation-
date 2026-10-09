import { EngineeringClaim, EvidenceAuthority } from '../../engine/engineering_ai/evidence/types';

export interface DomainPolicy {
  domain: string;
  requiredAuthorities: EvidenceAuthority[];
  requiresIndependentVerification: boolean;
}

export class EvidencePolicyEngine {
  private static domainPolicies: Map<string, DomainPolicy> = new Map([
    ['Structural', { domain: 'Structural', requiredAuthorities: ['PRIMARY_VERIFIED'], requiresIndependentVerification: true }],
    ['Thermal', { domain: 'Thermal', requiredAuthorities: ['PRIMARY_VERIFIED', 'SECONDARY_VALIDATED'], requiresIndependentVerification: false }],
    ['Materials', { domain: 'Materials', requiredAuthorities: ['PRIMARY_VERIFIED'], requiresIndependentVerification: false }],
    ['CFD', { domain: 'CFD', requiredAuthorities: ['PRIMARY_VERIFIED'], requiresIndependentVerification: true }],
    ['CAM', { domain: 'CAM', requiredAuthorities: ['PRIMARY_VERIFIED'], requiresIndependentVerification: false }],
  ]);

  public static getPolicy(domain: string): DomainPolicy {
    return this.domainPolicies.get(domain) || {
      domain,
      requiredAuthorities: ['PRIMARY_VERIFIED'],
      requiresIndependentVerification: false
    };
  }

  public static checkCompliance(claim: EngineeringClaim): boolean {
    const policy = this.getPolicy(claim.domain);
    if (claim.importance === 'CRITICAL' && policy.requiresIndependentVerification) {
      return claim.supportingEvidence.length >= 2;
    }
    return claim.supportingEvidence.length > 0;
  }
}
