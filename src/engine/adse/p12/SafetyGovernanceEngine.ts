import { SafetyRegistry } from './SafetyRegistry';
import { SafetyGovernanceState, Hazard, SafetyControl, SafetyClaim, SafetyCase } from './types';

const AUTHORIZED_SAFETY_ROLES = new Set([
  'CHIEF_SAFETY_ENGINEER',
  'SAFETY_AUTHORITY',
  'SYSTEMS_CHIEF',
  'CHIEF_SYSTEMS_ENGINEER'
]);

export class SafetyGovernanceEngine {
  private registry: SafetyRegistry;

  constructor(registry: SafetyRegistry) {
    this.registry = registry;
  }

  /**
   * Validates actor authorization for safety verification and risk override operations.
   * STRICT ENFORCEMENT: Synthetic/AI actors CANNOT authorize safety decisions or override risks.
   */
  public assertHumanSafetyAuthority(actorRole: string, actorId: string): void {
    const isAi =
      actorRole.toUpperCase().startsWith('AI_') ||
      actorRole.toUpperCase().includes('SYNTHETIC') ||
      actorRole.toUpperCase().includes('LLM') ||
      actorId.toLowerCase().startsWith('ai:') ||
      actorId.toLowerCase().includes('synthetic') ||
      actorId.toLowerCase().includes('agent');

    if (isAi) {
      throw new Error(
        `AI_SAFETY_AUTHORIZATION_PROHIBITED: Synthetic or AI entity (${actorRole}:${actorId}) cannot sign off on safety verifications or risk overrides.`
      );
    }

    if (!AUTHORIZED_SAFETY_ROLES.has(actorRole.toUpperCase())) {
      throw new Error(
        `UNAUTHORIZED_SAFETY_ROLE: Role '${actorRole}' is not authorized for safety sign-off. Required: CHIEF_SAFETY_ENGINEER or SAFETY_AUTHORITY.`
      );
    }
  }

  /**
   * Transitions a Safety Claim to a new state with strict role enforcement.
   */
  public transitionClaimState(
    claimId: string,
    targetState: SafetyGovernanceState,
    actorRole: string,
    actorId: string
  ): SafetyClaim {
    const claim = this.registry.getSafetyClaim(claimId);
    if (!claim) {
      throw new Error(`SAFETY_CLAIM_NOT_FOUND: ${claimId}`);
    }

    if (targetState === SafetyGovernanceState.VERIFIED) {
      this.assertHumanSafetyAuthority(actorRole, actorId);
    }

    claim.status = targetState;
    this.registry.updateSafetyClaim(claim);
    return claim;
  }

  /**
   * Transitions a Hazard to a new state with strict role enforcement.
   */
  public transitionHazardState(
    hazardId: string,
    targetState: SafetyGovernanceState,
    actorRole: string,
    actorId: string
  ): Hazard {
    const hazard = this.registry.getHazard(hazardId);
    if (!hazard) {
      throw new Error(`HAZARD_NOT_FOUND: ${hazardId}`);
    }

    if (targetState === SafetyGovernanceState.VERIFIED) {
      this.assertHumanSafetyAuthority(actorRole, actorId);
    }

    hazard.status = targetState;
    this.registry.updateHazard(hazard);
    return hazard;
  }

  /**
   * Cascades evidence invalidation down through Safety Controls, Claims, and Cases.
   * If an underlying measurement/evidence is invalidated or mutated, all dependent
   * safety artifacts are transitioned to REASSESSMENT_REQUIRED.
   */
  public handleEvidenceInvalidation(invalidatedEvidenceId: string): {
    impactedControlsCount: number;
    impactedClaimsCount: number;
    impactedCasesCount: number;
  } {
    let impactedControlsCount = 0;
    let impactedClaimsCount = 0;
    let impactedCasesCount = 0;

    // 1. Invalidate Safety Controls
    const controls = this.registry.getAllSafetyControls();
    for (const ctrl of controls) {
      if (ctrl.evidenceRefs && ctrl.evidenceRefs.includes(invalidatedEvidenceId)) {
        if (ctrl.status !== SafetyGovernanceState.REASSESSMENT_REQUIRED && ctrl.status !== SafetyGovernanceState.INVALIDATED) {
          ctrl.status = SafetyGovernanceState.REASSESSMENT_REQUIRED;
          this.registry.updateSafetyControl(ctrl);
          impactedControlsCount++;
        }
      }
    }

    // 2. Invalidate Safety Claims
    const claims = this.registry.getAllSafetyClaims();
    for (const claim of claims) {
      if (claim.evidenceRefs && claim.evidenceRefs.includes(invalidatedEvidenceId)) {
        if (claim.status !== SafetyGovernanceState.REASSESSMENT_REQUIRED && claim.status !== SafetyGovernanceState.INVALIDATED) {
          claim.status = SafetyGovernanceState.REASSESSMENT_REQUIRED;
          this.registry.updateSafetyClaim(claim);
          impactedClaimsCount++;
        }
      }
    }

    // 3. Invalidate Safety Cases
    const cases = this.registry.getAllSafetyCases();
    for (const sCase of cases) {
      const directRef = sCase.evidenceRefs && sCase.evidenceRefs.includes(invalidatedEvidenceId);
      const claimRef = sCase.claims && sCase.claims.some(c => c.evidenceRefs && c.evidenceRefs.includes(invalidatedEvidenceId));

      if (directRef || claimRef) {
        if (sCase.status !== SafetyGovernanceState.REASSESSMENT_REQUIRED && sCase.status !== SafetyGovernanceState.INVALIDATED) {
          sCase.status = SafetyGovernanceState.REASSESSMENT_REQUIRED;
          this.registry.updateSafetyCase(sCase);
          impactedCasesCount++;
        }
      }
    }

    return {
      impactedControlsCount,
      impactedClaimsCount,
      impactedCasesCount
    };
  }
}
