import {
  CanonicalCollisionInput,
  CanonicalCollisionResult,
  CollisionStatus
} from '../types';
import {
  CollisionPersistedRecord,
  CollisionReExecutionContract,
  CollisionReExecutionEvidence,
  CollisionReExecutionReport,
  ReExecutionVerdict,
  DivergenceCategory,
  VerificationStatus,
  EngineeringEvent
} from './types';
import { CollisionAuthority } from '../CollisionAuthority';
import { CollisionPersistenceEngine } from './CollisionPersistenceEngine';
import { CollisionTruthThread } from './CollisionTruthThread';
import { CanonicalCollisionResultEquivalence } from './CanonicalCollisionResultEquivalence';

export interface ReExecutionOptions {
  currentInputOverride?: CanonicalCollisionInput;
  currentProviderId?: string;
  currentAlgorithmVersion?: string;
  targetRevisionId?: string;
  skipTruthThreadVerification?: boolean;
}

export class CollisionReExecutionEngine {
  private static reExecutionStore = new Map<string, CollisionReExecutionEvidence>();

  public static buildContract(record: CollisionPersistedRecord): CollisionReExecutionContract {
    const input = record.input;
    const result = record.result;
    const binding = record.revisionBinding || CollisionPersistenceEngine.extractRevisionBinding(input, result);

    const contractId = `CTR_${record.executionId}`;
    const unhashedContract: Omit<CollisionReExecutionContract, 'contractHash'> = {
      contractId,
      executionId: record.executionId,
      documentId: binding.documentId,
      revisionId: binding.revisionId,
      geometryId: binding.geometryId,
      geometryRevision: binding.geometryRevision,
      snapshotId: binding.snapshotId,
      topologyIdentity: binding.topologyIdentity,
      geometryHash: binding.geometryHash,
      transformRevision: binding.transformRevision,
      motionRevision: binding.motionRevision,
      coordinateFrame: input.canonicalGeometry?.coordinateFrame || input.coordinateFrame || 'WCS',
      domain: input.domain || 'CAM_MULTI_AXIS',
      providerId: record.evidence?.providerId || 'EXACT_NARROW_PHASE',
      algorithmVersion: record.evidence?.algorithmVersion || result.provenance?.algorithmVersion || '1.0.0',
      inputHash: record.evidence?.inputHash || CollisionTruthThread.computeInputHash(input),
      resultHash: record.evidence?.resultHash || CollisionTruthThread.computeResultHash(result),
      evidenceHash: record.evidence?.evidenceHash || 'MISSING_EVIDENCE_HASH',
      evidenceId: record.evidenceId || `EVID_${record.executionId}`,
      eventId: record.eventId || `EVT_${record.executionId}`,
      canonicalInput: input,
      canonicalResult: result
    };

    const contractHash = CollisionTruthThread.simpleHash(CollisionTruthThread.canonicalStringify(unhashedContract));
    return Object.freeze({
      ...unhashedContract,
      contractHash
    });
  }

  public static async replay(
    historicalExecutionId: string,
    options?: ReExecutionOptions
  ): Promise<CollisionReExecutionReport> {
    const reExecutionId = `REEXEC_${historicalExecutionId}_${Date.now()}`;
    const divergenceDetails: string[] = [];

    // 1. Recover historical record
    const reloadStatus = await CollisionPersistenceEngine.reload(historicalExecutionId);
    if (!reloadStatus.record) {
      if (reloadStatus.verificationStatus === 'INTEGRITY_FAILURE') {
        return this.createFailureReport(
          reExecutionId,
          historicalExecutionId,
          'REEXECUTION_INTEGRITY_FAILURE',
          'DIVERGENCE_CONTEXT_CORRUPTED',
          ['Historical record failed integrity verification', ...reloadStatus.errors],
          'INTEGRITY_FAILURE'
        );
      }
      return this.createFailureReport(
        reExecutionId,
        historicalExecutionId,
        'REEXECUTION_UNAVAILABLE',
        'DIVERGENCE_UNKNOWN',
        ['Historical authoritative input record does not exist or cannot be found'],
        'NOT_AUTHORITATIVE'
      );
    }

    const record = reloadStatus.record;
    const historicalResult = record.result;
    const historicalInput = record.input;

    // 2. Verify Truth Thread integrity if not explicitly skipped
    if (!options?.skipTruthThreadVerification) {
      const chainVerification = CollisionTruthThread.verifyChain(CollisionTruthThread.getEvents());
      if (!chainVerification.isValid) {
        return this.createFailureReport(
          reExecutionId,
          historicalExecutionId,
          'REEXECUTION_INTEGRITY_FAILURE',
          'DIVERGENCE_CONTEXT_CORRUPTED',
          ['Truth Thread integrity verification failed', ...chainVerification.errors],
          'INTEGRITY_FAILURE',
          historicalResult,
          historicalInput
        );
      }
    }

    // 3. Build contract
    const contract = this.buildContract(record);

    // 4. Check Stale Result / Revision Substitution Protection
    if (options?.targetRevisionId && options.targetRevisionId !== contract.revisionId) {
      divergenceDetails.push(
        `Revision substitution detected: historical revision '${contract.revisionId}' vs target revision '${options.targetRevisionId}'`
      );
      return this.createFailureReport(
        reExecutionId,
        historicalExecutionId,
        'REEXECUTION_CONTEXT_MISMATCH',
        'DIVERGENCE_REVISION_MISMATCH',
        divergenceDetails,
        'STALE_RESULT',
        historicalResult,
        historicalInput,
        contract
      );
    }

    // 5. Check Provider Drift
    let providerIdToUse = contract.providerId;
    let providerDriftDetected = false;
    if (options?.currentProviderId && options.currentProviderId !== contract.providerId) {
      providerDriftDetected = true;
      providerIdToUse = options.currentProviderId;
      divergenceDetails.push(
        `Provider drift detected: historical provider '${contract.providerId}' vs current provider '${options.currentProviderId}'`
      );
    }

    // 6. Check Algorithm Version Drift
    let algorithmDriftDetected = false;
    if (options?.currentAlgorithmVersion && options.currentAlgorithmVersion !== contract.algorithmVersion) {
      algorithmDriftDetected = true;
      divergenceDetails.push(
        `Algorithm version drift detected: historical version '${contract.algorithmVersion}' vs current version '${options.currentAlgorithmVersion}'`
      );
    }

    // 7. Check Input Divergence if input override is provided
    const inputToExecute = options?.currentInputOverride || historicalInput;
    let inputDivergenceCategory: DivergenceCategory | null = null;

    if (options?.currentInputOverride) {
      const curGeom = options.currentInputOverride.canonicalGeometry || options.currentInputOverride.geometry;
      if (curGeom?.geometryHash && curGeom.geometryHash !== contract.geometryHash) {
        inputDivergenceCategory = 'DIVERGENCE_GEOMETRY_MISMATCH';
        divergenceDetails.push(
          `Geometry hash mismatch: historical '${contract.geometryHash}' vs override '${curGeom.geometryHash}'`
        );
      } else if (curGeom?.revisionId && curGeom.revisionId !== contract.revisionId) {
        inputDivergenceCategory = 'DIVERGENCE_REVISION_MISMATCH';
        divergenceDetails.push(
          `Revision ID mismatch: historical '${contract.revisionId}' vs override '${curGeom.revisionId}'`
        );
      } else if (curGeom?.snapshotId && curGeom.snapshotId !== contract.snapshotId) {
        inputDivergenceCategory = 'DIVERGENCE_SNAPSHOT_MISMATCH';
        divergenceDetails.push(
          `Snapshot ID mismatch: historical '${contract.snapshotId}' vs override '${curGeom.snapshotId}'`
        );
      } else if (
        options.currentInputOverride.domain &&
        options.currentInputOverride.domain !== contract.domain
      ) {
        inputDivergenceCategory = 'DIVERGENCE_CONTEXT_CORRUPTED';
        divergenceDetails.push(
          `Domain mismatch: historical '${contract.domain}' vs override '${options.currentInputOverride.domain}'`
        );
      } else if (
        options.currentInputOverride.coordinateFrame &&
        options.currentInputOverride.coordinateFrame !== contract.coordinateFrame
      ) {
        inputDivergenceCategory = 'DIVERGENCE_TRANSFORM_MISMATCH';
        divergenceDetails.push(
          `Coordinate frame mismatch: historical '${contract.coordinateFrame}' vs override '${options.currentInputOverride.coordinateFrame}'`
        );
      } else if (
        options.currentInputOverride.motionSegment &&
        `MOTION_${options.currentInputOverride.motionSegment.motionType}` !== contract.motionRevision
      ) {
        inputDivergenceCategory = 'DIVERGENCE_MOTION_MISMATCH';
        divergenceDetails.push(
          `Motion revision mismatch: historical '${contract.motionRevision}' vs override 'MOTION_${options.currentInputOverride.motionSegment.motionType}'`
        );
      }
    }

    // 8. Execute through the ONLY CollisionAuthority
    let replayResult: CanonicalCollisionResult;
    try {
      replayResult = await CollisionAuthority.evaluate(inputToExecute, providerIdToUse);
    } catch (e: any) {
      return this.createFailureReport(
        reExecutionId,
        historicalExecutionId,
        'REEXECUTION_EXECUTION_FAILURE',
        'DIVERGENCE_UNKNOWN',
        [`Authoritative re-execution failed: ${e?.message || e}`],
        'INTEGRITY_FAILURE',
        historicalResult,
        historicalInput,
        contract
      );
    }

    // 9. Canonical Comparison
    const equivalence = CanonicalCollisionResultEquivalence.evaluate(historicalResult, replayResult);
    const historicalEngHash = CollisionTruthThread.computeCanonicalEngineeringResultHash(historicalResult);
    const replayEngHash = CollisionTruthThread.computeCanonicalEngineeringResultHash(replayResult);
    const historicalResultHash = CollisionTruthThread.computeResultHash(historicalResult);
    const replayResultHash = CollisionTruthThread.computeResultHash(replayResult);

    let verdict: ReExecutionVerdict;
    let divergenceCategory: DivergenceCategory;

    if (inputDivergenceCategory) {
      verdict = 'REEXECUTION_CONTEXT_MISMATCH';
      divergenceCategory = inputDivergenceCategory;
    } else if (providerDriftDetected) {
      verdict = 'REEXECUTION_CONTEXT_MISMATCH';
      divergenceCategory = 'DIVERGENCE_PROVIDER_DRIFT';
    } else if (algorithmDriftDetected) {
      verdict = 'REEXECUTION_CONTEXT_MISMATCH';
      divergenceCategory = 'DIVERGENCE_ALGORITHM_DRIFT';
    } else if (replayResult.failureState?.isFailed && !historicalResult.failureState?.isFailed) {
      verdict = 'REEXECUTION_EXECUTION_FAILURE';
      divergenceCategory = 'DIVERGENCE_UNKNOWN';
      divergenceDetails.push(replayResult.failureState.failureReason || 'Re-execution failed unexpectedly');
    } else if (historicalEngHash === replayEngHash && equivalence.isEquivalent) {
      verdict = 'REEXECUTION_MATCH';
      divergenceCategory = 'DIVERGENCE_NONE';
    } else {
      verdict = 'REEXECUTION_DIVERGED';
      if (historicalResult.status !== replayResult.status) {
        divergenceCategory = 'DIVERGENCE_RESULT_STATUS_MISMATCH';
      } else if (
        !CanonicalCollisionResultEquivalence.areNumbersEquivalent(
          historicalResult.metrics?.minClearanceMm,
          replayResult.metrics?.minClearanceMm
        ) ||
        !CanonicalCollisionResultEquivalence.areNumbersEquivalent(
          historicalResult.metrics?.maxPenetrationDepthMm,
          replayResult.metrics?.maxPenetrationDepthMm
        )
      ) {
        divergenceCategory = 'DIVERGENCE_RESULT_METRICS_MISMATCH';
      } else if ((historicalResult.contactManifold || []).length !== (replayResult.contactManifold || []).length) {
        divergenceCategory = 'DIVERGENCE_MANIFOLD_MISMATCH';
      } else {
        divergenceCategory = 'DIVERGENCE_UNKNOWN';
      }
      divergenceDetails.push(...equivalence.mismatches);
    }

    // 10. Record Truth Thread Event
    const truthEvent = CollisionTruthThread.recordEvent({
      eventType: 'COLLISION_REEXECUTED',
      executionId: reExecutionId,
      resultId: `RES_${reExecutionId}`,
      evidenceId: `EVID_${reExecutionId}`,
      input: inputToExecute,
      result: replayResult,
      revisionBinding: contract,
      evidenceHash: contract.evidenceHash,
      providerId: providerIdToUse,
      algorithmVersion: contract.algorithmVersion
    });

    // 11. Create Evidence
    const evidencePackage: CollisionReExecutionEvidence = Object.freeze({
      evidenceId: `EVID_${reExecutionId}`,
      reExecutionId,
      historicalExecutionId,
      historicalResultHash,
      replayResultHash,
      historicalEngineeringHash: historicalEngHash,
      replayEngineeringHash: replayEngHash,
      historicalInputHash: contract.inputHash,
      replayInputHash: CollisionTruthThread.computeInputHash(inputToExecute),
      verdict,
      divergenceCategory,
      divergenceDetails,
      contextIdentity: contract.snapshotId,
      truthThreadEventId: truthEvent.eventId,
      providerId: providerIdToUse,
      algorithmVersion: contract.algorithmVersion,
      timestampIso: new Date().toISOString(),
      evidenceHash: CollisionTruthThread.simpleHash(
        CollisionTruthThread.canonicalStringify({
          reExecutionId,
          historicalExecutionId,
          historicalEngHash,
          replayEngHash,
          verdict,
          divergenceCategory,
          divergenceDetails
        })
      )
    });

    this.reExecutionStore.set(reExecutionId, evidencePackage);

    // Persist Replay Evidence to filesystem if in Node environment (without mutating historical record)
    this.persistReExecutionRecord(evidencePackage);

    const verificationStatus: VerificationStatus = verdict === 'REEXECUTION_MATCH' ? 'AUTHORITATIVE' : 'NOT_AUTHORITATIVE';

    return {
      reExecutionId,
      historicalExecutionId,
      verdict,
      divergenceCategory,
      divergenceDetails,
      isMatch: verdict === 'REEXECUTION_MATCH',
      historicalResult,
      replayResult,
      historicalInput,
      contract,
      equivalence,
      evidence: evidencePackage,
      truthThreadEvent: truthEvent,
      verificationStatus
    };
  }

  public static async reExecuteDeterministic(
    input: CanonicalCollisionInput,
    iterations: number,
    providerId?: string
  ): Promise<{
    isDeterministic: boolean;
    hashes: string[];
    results: CanonicalCollisionResult[];
    mismatches: string[];
  }> {
    const hashes: string[] = [];
    const results: CanonicalCollisionResult[] = [];
    const mismatches: string[] = [];

    let baselineResult: CanonicalCollisionResult | null = null;
    let baselineHash = '';

    for (let i = 0; i < iterations; i++) {
      const res = await CollisionAuthority.evaluate(input, providerId);
      const hash = CollisionTruthThread.computeCanonicalEngineeringResultHash(res);
      hashes.push(hash);
      results.push(res);

      if (i === 0) {
        baselineResult = res;
        baselineHash = hash;
      } else {
        if (hash !== baselineHash) {
          mismatches.push(`Iteration ${i} hash mismatch: '${hash}' vs baseline '${baselineHash}'`);
        }
        if (baselineResult) {
          const eq = CanonicalCollisionResultEquivalence.evaluate(baselineResult, res);
          if (!eq.isEquivalent) {
            mismatches.push(`Iteration ${i} equivalence failure: ${eq.mismatches.join('; ')}`);
          }
        }
      }
    }

    return {
      isDeterministic: mismatches.length === 0,
      hashes,
      results,
      mismatches
    };
  }

  public static async verifyImmutability(
    historicalExecutionId: string,
    action: () => Promise<void>
  ): Promise<{
    beforeHash: string;
    afterHash: string;
    isImmutable: boolean;
  }> {
    const reload1 = await CollisionPersistenceEngine.reload(historicalExecutionId);
    if (!reload1.record) {
      throw new Error(`Cannot verify immutability: record '${historicalExecutionId}' not found`);
    }
    const beforeHash = CollisionTruthThread.computeResultHash(reload1.record.result);

    await action();

    const reload2 = await CollisionPersistenceEngine.reload(historicalExecutionId);
    if (!reload2.record) {
      throw new Error(`Record '${historicalExecutionId}' disappeared after action`);
    }
    const afterHash = CollisionTruthThread.computeResultHash(reload2.record.result);

    return {
      beforeHash,
      afterHash,
      isImmutable: beforeHash === afterHash
    };
  }

  private static createFailureReport(
    reExecutionId: string,
    historicalExecutionId: string,
    verdict: ReExecutionVerdict,
    divergenceCategory: DivergenceCategory,
    divergenceDetails: string[],
    verificationStatus: VerificationStatus,
    historicalResult: CanonicalCollisionResult | null = null,
    historicalInput: CanonicalCollisionInput | null = null,
    contract: CollisionReExecutionContract | null = null
  ): CollisionReExecutionReport {
    return {
      reExecutionId,
      historicalExecutionId,
      verdict,
      divergenceCategory,
      divergenceDetails,
      isMatch: false,
      historicalResult,
      replayResult: null,
      historicalInput,
      contract,
      equivalence: null,
      evidence: null,
      truthThreadEvent: null,
      verificationStatus
    };
  }

  private static persistReExecutionRecord(evidence: CollisionReExecutionEvidence): void {
    const fsNode = typeof process !== 'undefined' && process.versions?.node && typeof require === 'function' ? require('fs') : null;
    if (fsNode && fsNode.existsSync && fsNode.writeFileSync) {
      try {
        const dir = CollisionPersistenceEngine.getStorageDir();
        if (dir && fsNode.existsSync(dir)) {
          const filePath = `${dir}/reexec_${evidence.reExecutionId}.json`.replace(/\/+/g, '/');
          fsNode.writeFileSync(filePath, CollisionPersistenceEngine.serializeRecord(evidence), 'utf8');
        }
      } catch {
        // Fallback
      }
    }
  }
}
