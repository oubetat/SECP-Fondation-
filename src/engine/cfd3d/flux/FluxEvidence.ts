/**
 * SECP Industrial OS v2 — Flux Evidence Generation & Verification
 * PATCH-053: Flux Framework
 */

import { ConservativeState, PhysicsModel, FluxResult, Vector3 } from './FluxTypes';
import { FluxVerificationReport } from './FluxVerificationPrimitives';
import * as crypto from 'crypto';

export interface FluxEvidenceRecord {
  evidenceId: string;
  patchId: 'PATCH-053';
  caseId: string;
  schemeId: string;
  schemeVersion: string;
  physicsModel: {
    modelType: string;
    gamma: number;
    gasConstant: number;
  };
  inputHashes: {
    leftStateHash: string;
    rightStateHash: string;
    normalHash: string;
    physicsModelHash: string;
  };
  outputFluxHash: string;
  tolerancePolicy: {
    tolerance: number;
  };
  diagnostics: string[];
  verdict: 'PASS' | 'FAIL' | 'UNPROVEN' | 'INVALID';
  timestamp: string;
  provenance: {
    source: 'SECP_FLUX_FRAMEWORK';
    revision: '1.0.0';
  };
}

export class FluxEvidenceEngine {

  public static hashObject(obj: any): string {
    const jsonStr = JSON.stringify(obj);
    return crypto.createHash('sha256').update(jsonStr).digest('hex');
  }

  public static createEvidenceRecord(
    caseId: string,
    schemeId: string,
    schemeVersion: string,
    physicsModel: PhysicsModel,
    left: ConservativeState,
    right: ConservativeState,
    normal: Vector3,
    fluxResult: FluxResult,
    reports: FluxVerificationReport[],
    timestamp: string = new Date().toISOString()
  ): FluxEvidenceRecord {
    const leftStateHash = this.hashObject(left);
    const rightStateHash = this.hashObject(right);
    const normalHash = this.hashObject(normal);
    const physicsModelHash = this.hashObject(physicsModel);
    const outputFluxHash = this.hashObject(fluxResult.flux);

    const allPassed = fluxResult.validity && reports.every(r => r.passed);
    const verdict = allPassed ? 'PASS' : (fluxResult.validity ? 'FAIL' : 'INVALID');

    const diagnostics = [
      ...fluxResult.diagnostics,
      ...reports.flatMap(r => r.diagnostics)
    ];

    return {
      evidenceId: `EVID-FLUX-${caseId}-${schemeId}`,
      patchId: 'PATCH-053',
      caseId,
      schemeId,
      schemeVersion,
      physicsModel: {
        modelType: physicsModel.modelType,
        gamma: physicsModel.gamma,
        gasConstant: physicsModel.gasConstant
      },
      inputHashes: {
        leftStateHash,
        rightStateHash,
        normalHash,
        physicsModelHash
      },
      outputFluxHash,
      tolerancePolicy: {
        tolerance: reports[0]?.tolerance ?? 1e-10
      },
      diagnostics,
      verdict,
      timestamp,
      provenance: {
        source: 'SECP_FLUX_FRAMEWORK',
        revision: '1.0.0'
      }
    };
  }

  public static verifyEvidenceIntegrity(record: FluxEvidenceRecord): boolean {
    if (!record) return false;
    if (record.patchId !== 'PATCH-053') return false;
    if (!record.evidenceId.startsWith('EVID-FLUX-')) return false;
    if (!record.inputHashes || !record.outputFluxHash) return false;
    return true;
  }
}
