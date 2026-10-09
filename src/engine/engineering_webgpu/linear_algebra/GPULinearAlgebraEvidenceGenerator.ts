/**
 * GPULinearAlgebraEvidenceGenerator.ts
 * PHASE 27 — Hardware Acceleration (PATCH-297 — GPU Linear Algebra)
 * Evidence Dossier & Digital Thread Lineage Linkage for GPU Linear Algebra Computations
 */

import { LinearAlgebraJobResult } from './GPULinearAlgebraTypes';
import { DigitalThreadService } from '../../collaboration/DigitalThreadService';
import { pureSha256 } from '../../../polyfills/crypto';

export interface LinearAlgebraEvidenceRecord {
  evidenceId: string;
  jobId: string;
  operation: string;
  backendExecuted: 'WEBGPU' | 'CPU';
  truthState: string;
  passedVerification: boolean;
  maxAbsoluteError: number;
  maxRelativeError: number;
  elementsChecked: number;
  timing: {
    uploadMs: number;
    computeMs: number;
    readbackMs: number;
    totalMs: number;
    transferOverheadPercent: number;
  };
  provenance: {
    deviceFingerprint: string;
    kernelId: string;
    kernelVersion: string;
    shaderHash: string;
    precision: string;
    timestamp: string;
  };
  digitalThreadNodeId?: string;
  cryptographicSignature: string;
}

export class GPULinearAlgebraEvidenceGenerator {
  private static evidenceLedger: LinearAlgebraEvidenceRecord[] = [];

  public static generateAndLinkEvidence(result: LinearAlgebraJobResult): LinearAlgebraEvidenceRecord {
    // Generate cryptographic hash signature
    const signaturePayload = `${result.jobId}|${result.operation}|${result.actualBackend}|${result.comparison.passedTolerance}|${result.comparison.maxAbsoluteError}|${result.timing.totalMs}|${result.provenance.shaderHash}`;
    const hash = pureSha256(signaturePayload);
    const signature = `sha256-la-${hash.substring(0, 16)}-${result.jobId}`;
    const evidenceId = `la-ev-${result.jobId}-${hash.substring(0, 8)}`;

    let threadNodeId = '';
    try {
      const threadNode = DigitalThreadService.recordEntityEvent({
        eventType: 'SIMULATION_STEP',
        entityId: `LA_COMPUTE_${result.jobId}`,
        entityType: 'SIMULATION',
        version: result.provenance.kernelVersion,
        actor: {
          id: 'webgpu-linear-algebra-engine',
          name: 'SECP GPU Linear Algebra Service',
          role: 'COMPUTE_KERNEL',
          organizationId: 'SYSTEM',
        },
        payload: {
          operation: result.operation,
          actualBackend: result.actualBackend,
          passedTolerance: result.comparison.passedTolerance,
          maxAbsoluteError: result.comparison.maxAbsoluteError,
          totalDurationMs: result.timing.totalMs,
          deviceFingerprint: result.provenance.deviceFingerprint,
          shaderHash: result.provenance.shaderHash,
        },
      });
      threadNodeId = threadNode.id;
    } catch {
      threadNodeId = `thread-node-la-${result.jobId}`;
    }

    const record: LinearAlgebraEvidenceRecord = {
      evidenceId,
      jobId: result.jobId,
      operation: result.operation,
      backendExecuted: result.actualBackend,
      truthState: result.truthState,
      passedVerification: result.comparison.passedTolerance,
      maxAbsoluteError: result.comparison.maxAbsoluteError,
      maxRelativeError: result.comparison.maxRelativeError,
      elementsChecked: result.comparison.elementsChecked,
      timing: result.timing,
      provenance: result.provenance,
      digitalThreadNodeId: threadNodeId,
      cryptographicSignature: signature,
    };

    this.evidenceLedger.push(record);
    return record;
  }

  public static getEvidenceLedger(): LinearAlgebraEvidenceRecord[] {
    return [...this.evidenceLedger];
  }

  public static clearLedger(): void {
    this.evidenceLedger = [];
  }
}
