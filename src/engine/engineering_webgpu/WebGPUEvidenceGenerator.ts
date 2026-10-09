/**
 * WebGPUEvidenceGenerator.ts
 * Cryptographic Evidence Generation & Digital Thread (PATCH-295) Integration
 */

import { ComputeJobResult } from './WebGPUComputeTypes';
import { DigitalThreadService } from '../collaboration/DigitalThreadService';
import { pureSha256 } from '../../polyfills/crypto';

export interface WebGPUEvidenceDossier {
  evidenceId: string;
  jobId: string;
  kernelId: string;
  kernelVersion: string;
  shaderHash: string;
  actualBackend: 'WEBGPU' | 'CPU';
  truthState: string;
  deviceFingerprint: string;
  inputHash: string;
  outputHash: string;
  executionTimestamp: string;
  timing: {
    uploadMs: number;
    computeMs: number;
    readbackMs: number;
    totalMs: number;
    transferOverheadPercent: number;
  };
  numericalVerification: {
    passed: boolean;
    maxAbsError: number;
    maxRelError: number;
    elementsChecked: number;
  };
  provenanceHash: string;
  digitalThreadNodeId?: string;
}

export class WebGPUEvidenceGenerator {
  /**
   * Computes SHA-256 provenance hash for the execution record
   */
  public static generateProvenanceHash(result: ComputeJobResult): string {
    const raw = `${result.jobId}::${result.kernelId}::${result.kernelVersion}::${result.actualBackend}::${result.inputHash}::${result.outputHash}::${result.provenance.shaderHash}::${result.provenance.deviceFingerprint}`;
    const hash = pureSha256(raw);
    return `ev-webgpu-${hash.substring(0, 16)}-${result.actualBackend.toLowerCase()}`;
  }

  /**
   * Generates a complete Evidence Dossier from a ComputeJobResult
   */
  public static createEvidenceDossier(
    result: ComputeJobResult,
    attachToDigitalThread: boolean = true
  ): WebGPUEvidenceDossier {
    const provenanceHash = this.generateProvenanceHash(result);
    const evidenceId = `EVID-GPU-${provenanceHash.substring(10, 20).toUpperCase()}`;

    let digitalThreadNodeId: string | undefined = undefined;

    if (attachToDigitalThread) {
      try {
        const dtService = DigitalThreadService.getInstance();
        const runNode = dtService.addNode({
          category: 'SIMULATION_RUN',
          name: `GPU Compute Execution [${result.kernelId}]`,
          description: `Hardware acceleration compute job ${result.jobId} executed on ${result.actualBackend} (${result.provenance.adapterName})`,
          metadata: {
            jobId: result.jobId,
            kernelId: result.kernelId,
            kernelVersion: result.kernelVersion,
            backend: result.actualBackend,
            truthState: result.truthState,
            device: result.provenance.deviceFingerprint,
            shaderHash: result.provenance.shaderHash,
            timingMs: result.timing.totalMs,
            maxAbsDiff: result.verification.maxAbsoluteError,
            passedTolerance: result.verification.passedTolerance,
            inputHash: result.inputHash,
            outputHash: result.outputHash,
            evidenceHash: provenanceHash,
          },
        });

        // Link to existing digital thread simulation result or part if available
        const allNodes = dtService.getAllNodes();
        const targetSim = allNodes.find((n) => n.category === 'SIMULATION_RUN' || n.category === 'PART');
        if (targetSim && targetSim.id !== runNode.id) {
          dtService.addEdge({
            sourceId: runNode.id,
            targetId: targetSim.id,
            type: 'BASED_ON',
            classification: 'PHYSICAL',
            description: `Hardware execution ${result.jobId} mathematically computes physical fields for ${targetSim.name}`,
            metadata: { solverBackend: result.actualBackend },
          });
        }

        digitalThreadNodeId = runNode.id;
      } catch (err) {
        console.warn('[WebGPUEvidenceGenerator] Could not attach to Digital Thread:', err);
      }
    }

    return {
      evidenceId,
      jobId: result.jobId,
      kernelId: result.kernelId,
      kernelVersion: result.kernelVersion,
      shaderHash: result.provenance.shaderHash,
      actualBackend: result.actualBackend,
      truthState: result.truthState,
      deviceFingerprint: result.provenance.deviceFingerprint,
      inputHash: result.inputHash,
      outputHash: result.outputHash,
      executionTimestamp: result.provenance.executionTimestamp,
      timing: {
        uploadMs: result.timing.uploadMs,
        computeMs: result.timing.computeMs,
        readbackMs: result.timing.readbackMs,
        totalMs: result.timing.totalMs,
        transferOverheadPercent: result.timing.transferOverheadPercent,
      },
      numericalVerification: {
        passed: result.verification.passedTolerance,
        maxAbsError: result.verification.maxAbsoluteError,
        maxRelError: result.verification.maxRelativeError,
        elementsChecked: result.verification.elementsChecked,
      },
      provenanceHash,
      digitalThreadNodeId,
    };
  }
}
