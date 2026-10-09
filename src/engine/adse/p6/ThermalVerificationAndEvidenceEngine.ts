/**
 * SECP — ADSE-P6 Thermal Verification & Evidence Engine
 * 
 * Invariant:
 * «Solver results do not become truth; Verification challenges them, and Evidence proves them.»
 * 
 * Enforces:
 * - Independent verification intent specification
 * - Physical threshold checking (max temperature, energy conservation error)
 * - Cryptographic evidence generation
 * - Provenance binding and Authority sign-off
 * - Rejection of unverified solver results in engineering conclusions
 */

import { 
  ThermalVerificationIntent, 
  ThermalEvidence, 
  ThermalExecutionResult 
} from './types';
import { EngineeringAuthority } from '../p0/types';
import { createHash } from 'crypto';

export class ThermalVerificationAndEvidenceEngine {
  private intents: Map<string, ThermalVerificationIntent> = new Map();
  private evidences: Map<string, ThermalEvidence> = new Map();

  /**
   * Registers a Thermal Verification Intent.
   */
  public registerVerificationIntent(params: {
    intentId: string;
    thermalId: string;
    executionId: string;
    maxAllowableTemperatureK: number;
    minAllowableTemperatureK?: number;
    maxAllowableEnergyBalanceErrorPercent: number;
    verificationMethod: 'ANALYTICAL_CHECK' | 'ENERGY_CONSERVATION_AUDIT' | 'INDEPENDENT_BENCHMARK';
  }): ThermalVerificationIntent {
    if (this.intents.has(params.intentId)) {
      throw new Error(`INTENT_COLLISION: Verification Intent '${params.intentId}' already exists.`);
    }

    if (params.maxAllowableTemperatureK <= 0) {
      throw new Error(`INVALID_VERIFICATION_THRESHOLD: Max allowable temperature must be > 0 K.`);
    }

    const intent: ThermalVerificationIntent = {
      intentId: params.intentId,
      thermalId: params.thermalId,
      executionId: params.executionId,
      maxAllowableTemperatureK: params.maxAllowableTemperatureK,
      minAllowableTemperatureK: params.minAllowableTemperatureK,
      maxAllowableEnergyBalanceErrorPercent: params.maxAllowableEnergyBalanceErrorPercent,
      verificationMethod: params.verificationMethod,
      status: 'PENDING'
    };

    this.intents.set(params.intentId, intent);
    return intent;
  }

  /**
   * Evaluates solver execution result against the verification intent.
   * If passing, issues authoritative ThermalEvidence.
   */
  public verifyExecution(
    intentId: string,
    result: ThermalExecutionResult,
    authority: EngineeringAuthority
  ): ThermalEvidence {
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

    // 1. Temperature Limit Challenge
    const tempExceeded = result.maxTemperatureK > intent.maxAllowableTemperatureK;
    const tempBelowMin = intent.minAllowableTemperatureK !== undefined && result.minTemperatureK < intent.minAllowableTemperatureK;

    // 2. Energy Balance Error Challenge
    const energyErrorExceeded = Math.abs(result.energyBalanceDiscrepancyPercent) > intent.maxAllowableEnergyBalanceErrorPercent;

    if (tempExceeded || tempBelowMin || energyErrorExceeded) {
      intent.status = 'FAILED';
      throw new Error(`VERIFICATION_CHALLENGE_FAILED: Result failed thresholds (MaxTemp: ${result.maxTemperatureK}K vs limit ${intent.maxAllowableTemperatureK}K, EnergyErr: ${result.energyBalanceDiscrepancyPercent}% vs limit ${intent.maxAllowableEnergyBalanceErrorPercent}%).`);
    }

    intent.status = 'PASSED';
    intent.verifiedAt = new Date().toISOString();
    intent.verifiedByAuthority = authority;

    const evidenceId = `ev:th:${createHash('sha256').update(intentId + result.resultId).digest('hex').substring(0, 12)}`;
    const marginK = intent.maxAllowableTemperatureK - result.maxTemperatureK;

    const evidenceHash = createHash('sha256')
      .update(`${evidenceId}-${intentId}-${result.resultId}-${result.fingerprint}-${authority}`)
      .digest('hex');

    const provenanceId = `PROV-EV-${createHash('sha256').update(evidenceHash).digest('hex').substring(0, 16)}`;

    const evidence: ThermalEvidence = {
      evidenceId,
      thermalId: intent.thermalId,
      executionId: result.executionId,
      intentId,
      evidenceHash,
      summary: `Verified by ${authority} using ${intent.verificationMethod}. Margin: ${marginK.toFixed(2)}K. Energy balance verified.`,
      metrics: {
        maxTempK: result.maxTemperatureK,
        marginK,
        energyConservationSatisfied: !energyErrorExceeded
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

  public getIntent(intentId: string): ThermalVerificationIntent | undefined {
    return this.intents.get(intentId);
  }

  public getEvidence(evidenceId: string): ThermalEvidence | undefined {
    return this.evidences.get(evidenceId);
  }

  public getAllIntents(): ThermalVerificationIntent[] {
    return Array.from(this.intents.values());
  }

  public getAllEvidences(): ThermalEvidence[] {
    return Array.from(this.evidences.values());
  }

  public clear(): void {
    this.intents.clear();
    this.evidences.clear();
  }
}
