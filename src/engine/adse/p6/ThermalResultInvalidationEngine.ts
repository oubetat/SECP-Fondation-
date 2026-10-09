/**
 * SECP — ADSE-P6 Thermal Result Invalidation Engine
 * 
 * Enforces:
 * «If any authoritative input changes (geometry, material, boundary, load, interface,
 * configuration, revision, or P5 structural coupling), all dependent executions and
 * results must be immediately marked as STALE / INVALIDATED.»
 * 
 * Prevents:
 * Stale result reuse as current engineering truth.
 */

import { ThermalSolverBridge } from './ThermalSolverBridge';
import { ThermalVerificationAndEvidenceEngine } from './ThermalVerificationAndEvidenceEngine';
import { ThermalImpact } from './types';

export class ThermalResultInvalidationEngine {
  private solverBridge: ThermalSolverBridge;
  private verificationEngine: ThermalVerificationAndEvidenceEngine;

  constructor(
    solverBridge: ThermalSolverBridge,
    verificationEngine: ThermalVerificationAndEvidenceEngine
  ) {
    this.solverBridge = solverBridge;
    this.verificationEngine = verificationEngine;
  }

  /**
   * Invalidates all executions and evidence associated with a mutated thermal model or its dependencies.
   */
  public invalidateForModel(thermalId: string, reason: string): ThermalImpact {
    const executions = this.solverBridge.getAllExecutions().filter(e => e.thermalId === thermalId);
    const invalidatedExecutionIds: string[] = [];
    const supersededEvidenceIds: string[] = [];

    for (const exec of executions) {
      if (exec.status !== 'INVALIDATED') {
        this.solverBridge.invalidateExecution(exec.executionId, reason);
        invalidatedExecutionIds.push(exec.executionId);
      }
    }

    const evidences = this.verificationEngine.getAllEvidences().filter(ev => ev.thermalId === thermalId);
    for (const ev of evidences) {
      supersededEvidenceIds.push(ev.evidenceId);
    }

    return {
      affectedModelIds: [thermalId],
      invalidatedExecutionIds,
      supersededEvidenceIds,
      impactedDownstreamArtifacts: [
        `P4_THREAD_NODE_DIRTIED:${thermalId}`,
        `PUBLICATION_BLOCKED:${thermalId}`
      ],
      reason,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Invalidates specific execution if input fingerprint does not match.
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
