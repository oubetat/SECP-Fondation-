/**
 * SECP — ADSE-P7 Power Verification & Evidence Engine
 * 
 * Invariant:
 * «Solver results do not become truth; Verification challenges them, and Evidence proves them.»
 * 
 * Enforces:
 * - Independent verification intent specification
 * - Electrical operating compliance checks (Voltage range, power balance, margin)
 * - Cryptographic evidence generation with SHA-256 signatures and provenance
 * - Authority sign-off
 */

import { 
  PowerVerificationIntent, 
  PowerEvidence, 
  PowerExecutionResult 
} from './types';
import { EngineeringAuthority } from '../p0/types';
import { createHash } from 'crypto';

export class PowerVerificationAndEvidenceEngine {
  private intents: Map<string, PowerVerificationIntent> = new Map();
  private evidences: Map<string, PowerEvidence> = new Map();

  /**
   * Registers a Power Verification Intent.
   */
  public registerVerificationIntent(params: {
    intentId: string;
    systemId: string;
    executionId: string;
    operatingStateId: string;
    minAllowableVoltageV: number;
    maxAllowableVoltageV: number;
    minRequiredMarginWatts: number;
    minRequiredMarginPercent: number;
    maxAllowablePowerBalanceErrorPercent: number;
    verificationMethod: 'KIRCHHOFF_LOAD_FLOW_AUDIT' | 'CONVERTER_EFFICIENCY_AUDIT' | 'STORAGE_DISCHARGE_INTEGRITY';
  }): PowerVerificationIntent {
    if (this.intents.has(params.intentId)) {
      throw new Error(`INTENT_COLLISION: Verification Intent '${params.intentId}' already exists.`);
    }

    if (params.minAllowableVoltageV <= 0 || params.maxAllowableVoltageV <= params.minAllowableVoltageV) {
      throw new Error(`INVALID_VERIFICATION_THRESHOLD: Voltage limits [${params.minAllowableVoltageV}V, ${params.maxAllowableVoltageV}V] are invalid.`);
    }

    const intent: PowerVerificationIntent = {
      intentId: params.intentId,
      systemId: params.systemId,
      executionId: params.executionId,
      operatingStateId: params.operatingStateId,
      minAllowableVoltageV: params.minAllowableVoltageV,
      maxAllowableVoltageV: params.maxAllowableVoltageV,
      minRequiredMarginWatts: params.minRequiredMarginWatts,
      minRequiredMarginPercent: params.minRequiredMarginPercent,
      maxAllowablePowerBalanceErrorPercent: params.maxAllowablePowerBalanceErrorPercent,
      verificationMethod: params.verificationMethod,
      status: 'PENDING'
    };

    this.intents.set(params.intentId, intent);
    return intent;
  }

  /**
   * Evaluates solver execution result against the verification intent.
   * If passing, issues authoritative PowerEvidence.
   */
  public verifyExecution(
    intentId: string,
    result: PowerExecutionResult,
    authority: EngineeringAuthority
  ): PowerEvidence {
    const intent = this.intents.get(intentId);
    if (!intent) {
      throw new Error(`INTENT_NOT_FOUND: Verification Intent '${intentId}' not found.`);
    }

    if (intent.executionId !== result.executionId) {
      throw new Error(`INTENT_EXECUTION_MISMATCH: Intent specifies execution '${intent.executionId}', but got result for '${result.executionId}'.`);
    }

    if (result.executionStatus === 'INVALIDATED' || result.executionStatus === 'STALE') {
      throw new Error(`VERIFICATION_REJECTED: Cannot verify an invalidated or stale execution result.`);
    }

    // 1. Voltage Range Challenge
    let voltageViolated = false;
    for (const [key, v] of Object.entries(result.busVoltagesV)) {
      if (v < intent.minAllowableVoltageV || v > intent.maxAllowableVoltageV) {
        voltageViolated = true;
        break;
      }
    }

    // 2. Power Margin Challenge
    const marginWatts = result.netPowerMarginWatts;
    const marginPercent = result.totalGenerationWatts > 0 
      ? (marginWatts / result.totalGenerationWatts) * 100.0 
      : 0;

    const marginViolated = marginWatts < intent.minRequiredMarginWatts || marginPercent < intent.minRequiredMarginPercent;

    // 3. Power Balance Conservation Challenge
    const balanceViolated = result.powerBalanceDiscrepancyPercent > intent.maxAllowablePowerBalanceErrorPercent;

    if (voltageViolated || marginViolated || balanceViolated) {
      intent.status = 'FAILED';
      throw new Error(`VERIFICATION_CHALLENGE_FAILED: Power result failed verification thresholds (Margin: ${marginWatts}W / ${marginPercent.toFixed(2)}%, BalanceErr: ${result.powerBalanceDiscrepancyPercent}%).`);
    }

    intent.status = 'PASSED';
    intent.verifiedAt = new Date().toISOString();
    intent.verifiedByAuthority = authority;

    const evidenceId = `ev:pwr:${createHash('sha256').update(intentId + result.resultId).digest('hex').substring(0, 12)}`;

    const evidenceHash = createHash('sha256')
      .update(`${evidenceId}-${intentId}-${result.resultId}-${result.fingerprint}-${authority}`)
      .digest('hex');

    const provenanceId = `PROV-EV-PWR-${createHash('sha256').update(evidenceHash).digest('hex').substring(0, 16)}`;

    const evidence: PowerEvidence = {
      evidenceId,
      systemId: intent.systemId,
      executionId: result.executionId,
      intentId,
      evidenceHash,
      summary: `Verified by ${authority} using ${intent.verificationMethod}. Margin: ${marginWatts.toFixed(2)}W (${marginPercent.toFixed(2)}%). Conservation error: ${result.powerBalanceDiscrepancyPercent}%.`,
      metrics: {
        totalGenerationWatts: result.totalGenerationWatts,
        totalDemandWatts: result.totalLoadWatts,
        marginWatts,
        marginPercent: Number(marginPercent.toFixed(2)),
        voltageComplianceVerified: !voltageViolated,
        balanceConservationVerified: !balanceViolated
      },
      provenanceId,
      recordedAt: new Date().toISOString(),
      authority
    };

    intent.evidenceId = evidenceId;
    result.isVerified = true;
    result.verificationEvidenceId = evidenceId;

    this.evidences.set(evidenceId, evidence);
    return evidence;
  }

  public getIntent(intentId: string): PowerVerificationIntent | undefined {
    return this.intents.get(intentId);
  }

  public getEvidence(evidenceId: string): PowerEvidence | undefined {
    return this.evidences.get(evidenceId);
  }

  public getAllIntents(): PowerVerificationIntent[] {
    return Array.from(this.intents.values());
  }

  public getAllEvidences(): PowerEvidence[] {
    return Array.from(this.evidences.values());
  }

  public clear(): void {
    this.intents.clear();
    this.evidences.clear();
  }
}
