import { createHash } from 'crypto';
import { Hazard, HazardSeverity, HazardLikelihood, RiskLevel, SafetyGovernanceState } from './types';
import { FailureMode } from '../p11/types';

export class SafetyCausalityEngine {
  /**
   * Computes risk level based on Military / Aerospace Standard Risk Matrix (MIL-STD-882E equivalent)
   */
  public computeRiskLevel(severity: HazardSeverity, likelihood: HazardLikelihood): RiskLevel {
    const sevScore: Record<HazardSeverity, number> = {
      CATASTROPHIC: 4,
      CRITICAL: 3,
      MAJOR: 2,
      MINOR: 1
    };

    const likeScore: Record<HazardLikelihood, number> = {
      FREQUENT: 5,
      PROBABLE: 4,
      OCCASIONAL: 3,
      REMOTE: 2,
      IMPROBABLE: 1
    };

    const s = sevScore[severity];
    const l = likeScore[likelihood];
    const score = s * l;

    // Catastrophic severity + high/moderate likelihood is non-negotiably UNACCEPTABLE
    if (severity === 'CATASTROPHIC' && (likelihood === 'FREQUENT' || likelihood === 'PROBABLE' || likelihood === 'OCCASIONAL')) {
      return 'UNACCEPTABLE';
    }

    if (score >= 12) return 'UNACCEPTABLE';
    if (score >= 8) return 'HIGH';
    if (score >= 4) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Derives a Hazard directly from a P11 FailureMode with complete provenance and risk evaluation.
   */
  public deriveHazardFromFailureMode(
    fm: FailureMode,
    hazardInput: {
      hazardId: string;
      initiatingConditions: string[];
      hazardousCondition: string;
      consequences: string[];
      severity: HazardSeverity;
      likelihood: HazardLikelihood;
    },
    actorRole: string,
    actorId: string
  ): Hazard {
    const riskLevel = this.computeRiskLevel(hazardInput.severity, hazardInput.likelihood);

    const provenance = {
      originHash: createHash('sha256')
        .update(`${hazardInput.hazardId}:${fm.failureModeId}:${hazardInput.severity}:${hazardInput.likelihood}`)
        .digest('hex'),
      createdBy: `${actorRole}:${actorId}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return {
      hazardId: hazardInput.hazardId,
      initiatingConditions: hazardInput.initiatingConditions,
      hazardousCondition: hazardInput.hazardousCondition,
      consequences: hazardInput.consequences,
      severity: hazardInput.severity,
      likelihood: hazardInput.likelihood,
      riskLevel,
      failureModeRef: fm.failureModeId,
      status: SafetyGovernanceState.PROPOSED,
      provenance,
      revisionId: fm.revisionId,
      configurationId: fm.configurationId
    };
  }
}
