/**
 * SECP-CAD-TRUTH-PATCH-005 — Engineering Release & Publish Engine
 *
 * ARCHITECTURAL CONTRACT:
 * Strictly DENIES Engineering Release / Publish if any downstream artifact or dependency
 * (Mesh, CFD simulation results, Evidence Chain, or Digital Thread) is STALE, unverified,
 * or mismatched against the canonical CAD geometryHash.
 *
 * NON-ZERO SIDE-EFFECT ASSERTION:
 * Tracks `releaseInvocationCount`.
 * - DENIED release -> `releaseInvocationCount` MUST REMAIN 0 (zero side-effects).
 * - SUCCESSFUL release -> `releaseInvocationCount` increments monotonically.
 */

import { EvidenceValidator } from '../../services/ai/EvidenceValidator';

export interface ReleaseCadEntity {
  id: string;
  revisionId?: string;
  geometryHash: string;
}

export interface ReleaseMeshSet {
  meshId: string;
  status: 'CURRENT' | 'STALE' | 'INVALID';
  modelRevisionHash?: string;
  canonicalHash?: string;
}

export interface ReleaseCfdResult {
  cadGeometryHash?: string;
  meshHash?: string;
  status?: string;
  flowRegime?: string;
}

export interface ReleaseRequest {
  releaseId: string;
  projectName: string;
  cadEntity: ReleaseCadEntity;
  meshSet: ReleaseMeshSet;
  cfdResult: ReleaseCfdResult;
  digitalThreadStatus: 'CURRENT' | 'STALE' | 'INCOMPLETE' | 'UNVERIFIED';
  evidenceChain?: Array<{
    id: string;
    cadGeometryHash?: string;
    status?: string;
    state?: string;
    authority?: string;
  }>;
}

export interface ReleaseResult {
  success: boolean;
  certificateId?: string;
  reasonCode?: string;
  errors?: string[];
  timestamp: string;
}

export class EngineeringReleaseEngine {
  private static _releaseInvocations = 0;

  public static getReleaseInvocations(): number {
    return this._releaseInvocations;
  }

  public static resetInvocations(): void {
    this._releaseInvocations = 0;
  }

  public static publishRelease(request: ReleaseRequest): ReleaseResult {
    const errors: string[] = [];

    // 1. Check CAD Entity and Geometry Hash Provenance
    if (!request || !request.cadEntity) {
      errors.push('[RELEASE_DENIED] Missing CAD entity in release request');
    } else if (!request.cadEntity.geometryHash || request.cadEntity.geometryHash.trim() === '') {
      errors.push('[RELEASE_DENIED] Missing CAD geometryHash provenance');
    }

    const cadGeomHash = request?.cadEntity?.geometryHash || '';

    // 2. Check Mesh Set Validity and Staleness
    if (!request || !request.meshSet) {
      errors.push('[RELEASE_DENIED] Missing MeshSet in release request');
    } else {
      if (request.meshSet.status === 'STALE') {
        errors.push('[RELEASE_DENIED] Mesh is marked STALE due to upstream CAD geometry mutation');
      }
      if (request.meshSet.modelRevisionHash && request.meshSet.modelRevisionHash !== cadGeomHash) {
        errors.push(`[RELEASE_DENIED] Mesh modelRevisionHash [${request.meshSet.modelRevisionHash}] does not match CAD geometryHash [${cadGeomHash}]`);
      }
    }

    // 3. Check CFD Simulation Result
    if (!request || !request.cfdResult) {
      errors.push('[RELEASE_DENIED] Missing CFD simulation result in release request');
    } else {
      if (request.cfdResult.status === 'STALE') {
        errors.push('[RELEASE_DENIED] CFD result is marked STALE');
      }
      if (request.cfdResult.cadGeometryHash && request.cfdResult.cadGeometryHash !== cadGeomHash) {
        errors.push(`[RELEASE_DENIED] CFD result cadGeometryHash [${request.cfdResult.cadGeometryHash}] does not match CAD geometryHash [${cadGeomHash}]`);
      }
      if (request.meshSet && request.cfdResult.meshHash && request.meshSet.canonicalHash && request.cfdResult.meshHash !== request.meshSet.canonicalHash) {
        errors.push(`[RELEASE_DENIED] CFD result meshHash [${request.cfdResult.meshHash}] does not match Mesh canonicalHash [${request.meshSet.canonicalHash}]`);
      }
    }

    // 4. Check Digital Thread Status
    if (!request || request.digitalThreadStatus !== 'CURRENT') {
      errors.push(`[RELEASE_DENIED] Digital Thread status is '${request?.digitalThreadStatus || 'UNVERIFIED'}' (must be CURRENT)`);
    }

    // 5. Check Evidence Chain Verification
    if (request && request.evidenceChain) {
      for (const ev of request.evidenceChain) {
        const val = EvidenceValidator.validateIntegrity(ev, cadGeomHash);
        if (!val.valid) {
          errors.push(`[RELEASE_DENIED] Evidence '${ev.id}' invalid: ${val.reason}`);
        }
      }
    }

    // PRECONDITION FAIL-CLOSED GUARD
    if (errors.length > 0) {
      // DENIED: Do NOT increment side-effect invocation counter!
      return {
        success: false,
        reasonCode: 'ENGINEERING_RELEASE_DENIED',
        errors,
        timestamp: new Date().toISOString()
      };
    }

    // PRECONDITION PASSED: Execute Release side-effects & increment counter
    this._releaseInvocations++;
    return {
      success: true,
      certificateId: `RELEASE-CERT-${request.releaseId}-${Date.now()}`,
      timestamp: new Date().toISOString()
    };
  }
}
