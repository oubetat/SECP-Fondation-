import { CanonicalCollisionInput, CanonicalCollisionResult } from '../types';
import { CollisionAuthority } from '../CollisionAuthority';
import { CollisionPersistenceEngine } from './CollisionPersistenceEngine';
import { CanonicalCollisionResultEquivalence } from './CanonicalCollisionResultEquivalence';
import { ReconstructionParityResult, VerificationStatus } from './types';

export class CollisionReconstructionEngine {
  public static async executeFullReconstructionLoop(
    input: CanonicalCollisionInput,
    providerIdOverride?: string
  ): Promise<ReconstructionParityResult> {
    const R0 = await CollisionAuthority.evaluate(input, providerIdOverride);

    const persistedRecord = await CollisionPersistenceEngine.persist(
      input,
      R0,
      providerIdOverride,
      R0.provenance.algorithmVersion
    );

    const reloadStatus = await CollisionPersistenceEngine.reload(R0.executionId);
    if (!reloadStatus.record || reloadStatus.verificationStatus !== 'AUTHORITATIVE') {
      throw new Error(`[P7_RECONSTRUCTION_FAILED] Reload failed with status '${reloadStatus.verificationStatus}': ${reloadStatus.errors.join(', ')}`);
    }
    const R1 = reloadStatus.record.result;

    const R2: CanonicalCollisionResult = Object.freeze({
      executionId: reloadStatus.record.executionId,
      timestampIso: reloadStatus.record.result.timestampIso,
      status: reloadStatus.record.result.status,
      severity: reloadStatus.record.result.severity,
      exactness: reloadStatus.record.result.exactness,
      metrics: reloadStatus.record.result.metrics,
      contactManifold: reloadStatus.record.result.contactManifold,
      temporalInfo: reloadStatus.record.result.temporalInfo,
      failureState: reloadStatus.record.result.failureState,
      provenance: reloadStatus.record.result.provenance,
      diagnostics: reloadStatus.record.result.diagnostics,
      provenSafe: reloadStatus.record.result.provenSafe
    });

    const R3 = R2;

    const R4 = await CollisionAuthority.evaluate(input, providerIdOverride);

    const R0_vs_R1 = CanonicalCollisionResultEquivalence.evaluateExactParity(R0, R1);
    const R1_vs_R2 = CanonicalCollisionResultEquivalence.evaluateExactParity(R1, R2);
    const R2_vs_R3 = CanonicalCollisionResultEquivalence.evaluateExactParity(R2, R3);
    const R0_vs_R4 = CanonicalCollisionResultEquivalence.evaluate(R0, R4);

    const isParityVerified = R0_vs_R1.isEquivalent &&
      R1_vs_R2.isEquivalent &&
      R2_vs_R3.isEquivalent &&
      R0_vs_R4.isEquivalent;

    const verificationStatus: VerificationStatus = isParityVerified ? 'AUTHORITATIVE' : 'INTEGRITY_FAILURE';

    return {
      originalResult: R0,
      persistedResult: R1,
      reloadedResult: R1,
      reconstructedResult: R2,
      reexecutedResult: R4,
      R0_vs_R1,
      R1_vs_R2,
      R2_vs_R3,
      R0_vs_R4,
      isParityVerified,
      verificationStatus
    };
  }
}
