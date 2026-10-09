/**
 * SECP — ADSE-P7 Power Result Invalidation Engine
 * 
 * Enforces:
 * «If any authoritative power parameter changes (source rating, load demand, bus voltage,
 * topology, converter efficiency, storage capacity, operating state, revision, configuration),
 * all dependent executions and results must be immediately marked as STALE / INVALIDATED.»
 * 
 * Prevents:
 * Stale power result reuse as current engineering truth.
 */

import { PowerSolverBridge } from './PowerSolverBridge';
import { PowerVerificationAndEvidenceEngine } from './PowerVerificationAndEvidenceEngine';
import { PowerImpact } from './types';

export class PowerResultInvalidationEngine {
  constructor(
    private solverBridge: PowerSolverBridge,
    private verificationEngine: PowerVerificationAndEvidenceEngine
  ) {}

  /**
   * Invalidates all executions and evidence associated with a mutated power system or its components.
   */
  public invalidateForSystem(systemId: string, reason: string): PowerImpact {
    const executions = this.solverBridge.getAllExecutions().filter(e => e.systemId === systemId);
    const invalidatedExecutionIds: string[] = [];
    const supersededEvidenceIds: string[] = [];

    for (const exec of executions) {
      if (exec.status !== 'INVALIDATED') {
        this.solverBridge.invalidateExecution(exec.executionId, reason);
        invalidatedExecutionIds.push(exec.executionId);
      }
    }

    const evidences = this.verificationEngine.getAllEvidences().filter(ev => ev.systemId === systemId);
    for (const ev of evidences) {
      supersededEvidenceIds.push(ev.evidenceId);
    }

    return {
      affectedSystemIds: [systemId],
      invalidatedExecutionIds,
      supersededEvidenceIds,
      impactedThermalModelIds: [`P6_THERMAL_IMPACT_FROM:${systemId}`],
      impactedDownstreamArtifacts: [
        `P4_THREAD_NODE_DIRTIED:${systemId}`,
        `POWER_PUBLICATION_BLOCKED:${systemId}`
      ],
      reason,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Checks if current input fingerprint differs and invalidates if mismatched.
   */
  public verifyAndInvalidateFingerprintMismatch(
    executionId: string,
    currentCombinedFingerprint: string
  ): boolean {
    const exec = this.solverBridge.getExecution(executionId);
    if (!exec) return false;

    if (exec.fingerprints.combinedFingerprint !== currentCombinedFingerprint) {
      this.solverBridge.invalidateExecution(
        executionId,
        `Fingerprint mismatch: expected ${exec.fingerprints.combinedFingerprint}, got ${currentCombinedFingerprint}`
      );
      return true;
    }
    return false;
  }
}
