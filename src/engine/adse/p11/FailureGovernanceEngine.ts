import { FailureRegistry } from './FailureRegistry';
import { FailureMode, FailureGovernanceState } from './types';

export class FailureGovernanceEngine {
  private registry: FailureRegistry;

  constructor(registry: FailureRegistry) {
    this.registry = registry;
  }

  /**
   * Promotes the state of a Failure Mode under strict human authority constraints.
   */
  public transitionState(
    failureModeId: string,
    targetState: FailureGovernanceState,
    actorRole: string,
    actorId: string
  ): void {
    const fm = this.registry.getFailureMode(failureModeId);
    if (!fm) {
      throw new Error(`FAILURE_MODE_NOT_FOUND: Failure mode '${failureModeId}' does not exist.`);
    }

    // AI/Synthetic Actor Rejection Boundary
    const isSyntheticActor = actorId.startsWith('ai:') || actorId.includes('synthetic') || actorRole === 'ai:copilot';

    if (targetState === FailureGovernanceState.VERIFIED) {
      if (isSyntheticActor) {
        throw new Error(`AI_GOVERNANCE_VIOLATION: Autonomous AI agents cannot transition Failure Modes to VERIFIED.`);
      }
      if (actorRole !== 'CHIEF_RELIABILITY_ENGINEER') {
        throw new Error(`UNAUTHORIZED_ACTOR: Only CHIEF_RELIABILITY_ENGINEER can verify failure modes.`);
      }
      if (!fm.evidenceRefs || fm.evidenceRefs.length === 0) {
        throw new Error(`MISSING_EVIDENCE: Failure mode cannot be VERIFIED without empirical evidence references.`);
      }
    }

    if (targetState === FailureGovernanceState.INVALIDATED && isSyntheticActor) {
      throw new Error(`AI_GOVERNANCE_VIOLATION: Autonomous AI agents cannot invalidate human-certified risk analysis.`);
    }

    // Direct assignment
    fm.status = targetState;
    fm.provenance.updatedAt = new Date().toISOString();
  }

  /**
   * Updates risk parameters (Severity, Occurrence, Detectability) under human governance.
   */
  public updateRiskParameters(
    failureModeId: string,
    params: { severity?: number; occurrence?: number; detectability?: number },
    actorRole: string,
    actorId: string
  ): void {
    const fm = this.registry.getFailureMode(failureModeId);
    if (!fm) {
      throw new Error(`FAILURE_MODE_NOT_FOUND: Failure mode '${failureModeId}' does not exist.`);
    }

    const isSyntheticActor = actorId.startsWith('ai:') || actorId.includes('synthetic') || actorRole === 'ai:copilot';

    // AI is prevented from overriding or downgrading high-severity risks directly
    if (isSyntheticActor && params.severity !== undefined && params.severity < fm.severity && fm.severity >= 8) {
      throw new Error(`AI_GOVERNANCE_VIOLATION: AI is prohibited from directly downgrading critical severity thresholds (>=8) without human approval.`);
    }

    if (params.severity !== undefined) {
      if (params.severity < 1 || params.severity > 10) throw new Error(`INVALID_RPN_BOUNDS`);
      fm.severity = params.severity;
    }
    if (params.occurrence !== undefined) {
      if (params.occurrence < 1 || params.occurrence > 10) throw new Error(`INVALID_RPN_BOUNDS`);
      fm.occurrence = params.occurrence;
    }
    if (params.detectability !== undefined) {
      if (params.detectability < 1 || params.detectability > 10) throw new Error(`INVALID_RPN_BOUNDS`);
      fm.detectability = params.detectability;
    }

    fm.criticality = fm.severity * fm.occurrence;
    fm.provenance.updatedAt = new Date().toISOString();
  }

  /**
   * P11.4: Processes the invalidation of an underlying sensor reading or calibration event.
   * If any FailureMode's evidence is invalidated, its status is cascadingly downgraded to REASSESSMENT_REQUIRED.
   */
  public handleEvidenceInvalidation(invalidatedEvidenceId: string): number {
    let cascadedCount = 0;
    const fms = this.registry.getAllFailureModes();

    for (const fm of fms) {
      if (fm.evidenceRefs.includes(invalidatedEvidenceId)) {
        if (fm.status === FailureGovernanceState.VERIFIED || fm.status === FailureGovernanceState.ANALYZED) {
          fm.status = FailureGovernanceState.REASSESSMENT_REQUIRED;
          fm.provenance.updatedAt = new Date().toISOString();
          cascadedCount++;
        }
      }
    }

    return cascadedCount;
  }
}
