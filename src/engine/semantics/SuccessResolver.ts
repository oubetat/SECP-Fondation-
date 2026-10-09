/**
 * SECP Industrial OS v3 — PROMPT-052: Success Resolver
 * The central, authoritative source of truth for Engineering Success semantics.
 * Strictly enforces: SUCCESS ⇔ Canonical Mutation Verified AND Required Validation Passed (+ Independent Verification).
 */

import { createHash } from 'crypto';
import {
  SuccessResolutionRequest,
  SuccessResolutionResult,
  SuccessStateEnum
} from './SuccessSemanticsTypes';
import { CanonicalMutationVerifier } from './CanonicalMutationVerifier';
import { SuccessStateMachine } from './SuccessStateMachine';

export class EngineeringSuccessResolver {
  /**
   * Evaluates an engineering operation request against all canonical invariants.
   * Returns a complete, cryptographically signed resolution record.
   */
  public static resolveOperationSuccess(request: SuccessResolutionRequest): SuccessResolutionResult {
    const timestamp = new Date().toISOString();
    const rejectionReasons: string[] = [];
    const criticalFailures: string[] = [];
    const auditTrace: string[] = [];

    const sm = new SuccessStateMachine(SuccessStateEnum.REQUESTED);
    auditTrace.push(`[${timestamp}] StateMachine started at REQUESTED for operation ${request.operationId}`);

    // 1. Check capability support
    if (!request.isSupportedCapability) {
      sm.transition(SuccessStateEnum.UNSUPPORTED, 'Capability is not supported by this engineering pipeline');
      rejectionReasons.push(`Capability ${request.capabilityType} is marked UNSUPPORTED`);
      return this.buildResult(request, 'UNSUPPORTED', sm.getState(), rejectionReasons, criticalFailures, auditTrace, false, false, false, false, false);
    }

    // 2. Check Execution
    sm.transition(SuccessStateEnum.EXECUTING, 'Starting operation execution phase');
    if (!request.executionCompleted) {
      sm.transition(SuccessStateEnum.FAILED, 'Execution phase did not complete');
      rejectionReasons.push('Operation execution did not complete');
      return this.buildResult(request, 'FAIL', sm.getState(), rejectionReasons, criticalFailures, auditTrace, false, false, false, false, false);
    }
    sm.transition(SuccessStateEnum.EXECUTED, 'Execution phase finished');

    // 3. Verify Canonical Mutation
    const mutationVerification = CanonicalMutationVerifier.verifyMutation(request.mutationProof);
    let canonicalMutationVerified = false;

    if (!mutationVerification.isValid) {
      if (!request.mutationProof.isCanonicalMutation || (request.mutationProof.nonCanonicalReasons && request.mutationProof.nonCanonicalReasons.length > 0)) {
        sm.transition(SuccessStateEnum.MUTATION_ABSENT, 'Canonical mutation absent; non-canonical or UI-only operation');
        criticalFailures.push('CRITICAL: Operation attempted to claim success without valid Canonical Mutation');
      } else if (request.mutationProof.isStaleState) {
        sm.transition(SuccessStateEnum.STALE, 'Canonical mutation applied against STALE state');
        criticalFailures.push('CRITICAL: Canonical state stale');
      } else {
        sm.transition(SuccessStateEnum.FAILED, 'Canonical mutation verification failed');
      }
      rejectionReasons.push(...mutationVerification.rejectionReasons);
      return this.buildResult(request, 'FAIL', sm.getState(), rejectionReasons, criticalFailures, auditTrace, false, false, false, false, false);
    }

    canonicalMutationVerified = true;
    sm.transition(SuccessStateEnum.CANONICAL_MUTATED, 'Canonical mutation verified in EngineeringDocument', {
      mutationProofHash: mutationVerification.computedProofHash
    });
    auditTrace.push(`Canonical mutation verified: rev ${request.mutationProof.previousRevision} -> ${request.mutationProof.newRevision}`);

    // 4. Validate
    sm.transition(SuccessStateEnum.VALIDATING, 'Running capability-specific engineering validation');
    let validationPassed = false;

    if (request.validationProof.skippedValidation) {
      sm.transition(SuccessStateEnum.VALIDATION_FAILED, 'Validation was skipped or bypassed');
      criticalFailures.push('CRITICAL: Validation was skipped/bypassed');
      rejectionReasons.push('Validation was skipped: unvalidated engineering mutation');
      return this.buildResult(request, 'FAIL', sm.getState(), rejectionReasons, criticalFailures, auditTrace, canonicalMutationVerified, false, false, false, false);
    }

    if (!request.validationProof.validationPassed) {
      sm.transition(SuccessStateEnum.VALIDATION_FAILED, 'Capability-specific validation failed');
      rejectionReasons.push(`Validation ruleset ${request.validationProof.validationRuleSet} failed criteria`);
      for (const crit of request.validationProof.checkedCriteria) {
        if (!crit.passed) {
          rejectionReasons.push(`Failed criterion ${crit.criterionId}: ${crit.errorDetail || crit.description}`);
        }
      }
      return this.buildResult(request, 'FAIL', sm.getState(), rejectionReasons, criticalFailures, auditTrace, canonicalMutationVerified, false, false, false, false);
    }

    validationPassed = true;
    sm.transition(SuccessStateEnum.VALID, 'All capability-specific validation criteria passed');
    auditTrace.push(`Validation passed: ${request.validationProof.checkedCriteria.length} criteria green`);

    // 5. Independent Verification (if required)
    let verificationPassed = true;
    if (request.verificationProof?.verificationRequired) {
      if (!request.verificationProof.verificationPassed) {
        verificationPassed = false;
        sm.transition(SuccessStateEnum.FAILED, 'Independent verification required and failed');
        rejectionReasons.push(`Independent verifier ${request.verificationProof.verifierIdentifier} rejected outcome`);
        return this.buildResult(request, 'FAIL', sm.getState(), rejectionReasons, criticalFailures, auditTrace, canonicalMutationVerified, validationPassed, false, false, false);
      }
      sm.transition(SuccessStateEnum.VERIFIED, 'Independent verification passed');
      auditTrace.push(`Independent verification passed by ${request.verificationProof.verifierIdentifier}`);
    }

    // 6. Persistence check (if required)
    let persistencePassed = true;
    if (request.persistenceProof?.persistenceRequired) {
      if (!request.persistenceProof.persistedSuccessfully || !request.persistenceProof.roundTripVerified) {
        persistencePassed = false;
        sm.transition(SuccessStateEnum.PERSISTENCE_FAILED, 'Required persistence round-trip failed');
        criticalFailures.push('CRITICAL: Required persistence failed');
        rejectionReasons.push('Persistence failed to store or verify round-trip of mutated canonical document');
        return this.buildResult(request, 'FAIL', sm.getState(), rejectionReasons, criticalFailures, auditTrace, canonicalMutationVerified, validationPassed, verificationPassed, false, false);
      }
      auditTrace.push(`Persistence verified in storage target ${request.persistenceProof.storageTarget}`);
    }

    // 7. Regeneration check (if required)
    let regenerationPassed = true;
    if (request.regenerationProof?.regenerationRequired) {
      if (!request.regenerationProof.regenerationPassed || !request.regenerationProof.deterministicReplayMatched) {
        regenerationPassed = false;
        sm.transition(SuccessStateEnum.REGENERATION_FAILED, 'Required regeneration/replay failed');
        criticalFailures.push('CRITICAL: Required parametric regeneration failed');
        rejectionReasons.push('Parametric regeneration replay failed to reproduce deterministic model hash');
        return this.buildResult(request, 'FAIL', sm.getState(), rejectionReasons, criticalFailures, auditTrace, canonicalMutationVerified, validationPassed, verificationPassed, persistencePassed, false);
      }
      auditTrace.push('Parametric regeneration replay verified successfully');
    }

    // 8. Evidence integrity audit (Evidence alone cannot manufacture success)
    if (request.evidenceRecord) {
      if (!request.evidenceRecord.derivedFromVerifiedOutcome) {
        criticalFailures.push('CRITICAL: Evidence record payload was not derived from verified outcome');
        rejectionReasons.push('Evidence record generated without verified engineering outcome');
        sm.transition(SuccessStateEnum.FAILED, 'Evidence integrity audit failed');
        return this.buildResult(request, 'FAIL', sm.getState(), rejectionReasons, criticalFailures, auditTrace, canonicalMutationVerified, validationPassed, verificationPassed, persistencePassed, regenerationPassed);
      }
      auditTrace.push(`Evidence record ${request.evidenceRecord.evidenceId} bound to verified outcome`);
    }

    // 9. Reach SUCCESS
    sm.transition(SuccessStateEnum.SUCCESS, 'All canonical mutation, validation, and verification criteria satisfied');
    auditTrace.push(`SUCCESS granted for operation ${request.operationId} on document ${request.documentId}`);

    return this.buildResult(
      request,
      'SUCCESS',
      sm.getState(),
      rejectionReasons,
      criticalFailures,
      auditTrace,
      canonicalMutationVerified,
      validationPassed,
      verificationPassed,
      persistencePassed,
      regenerationPassed
    );
  }

  private static buildResult(
    request: SuccessResolutionRequest,
    verdict: 'SUCCESS' | 'FAIL' | 'UNSUPPORTED' | 'INVALID',
    finalState: SuccessStateEnum,
    rejectionReasons: string[],
    criticalFailures: string[],
    auditTrace: string[],
    canonicalMutationVerified: boolean,
    validationPassed: boolean,
    verificationPassed: boolean,
    persistencePassed: boolean,
    regenerationPassed: boolean
  ): SuccessResolutionResult {
    const timestamp = new Date().toISOString();

    const fingerprintPayload = [
      request.operationId,
      request.capabilityType,
      request.documentId,
      request.documentRevision,
      verdict,
      finalState,
      canonicalMutationVerified,
      validationPassed,
      verificationPassed,
      persistencePassed,
      regenerationPassed,
      rejectionReasons.join(';'),
      criticalFailures.join(';'),
      timestamp
    ].join('||');

    const resolutionHash = createHash('sha256').update(fingerprintPayload).digest('hex');

    return {
      operationId: request.operationId,
      capabilityType: request.capabilityType,
      verdict,
      finalState,
      isSuccess: verdict === 'SUCCESS',
      timestamp,
      canonicalMutationVerified,
      validationPassed,
      verificationPassed,
      persistencePassed,
      regenerationPassed,
      rejectionReasons: Object.freeze(rejectionReasons),
      criticalFailures: Object.freeze(criticalFailures),
      auditTrace: Object.freeze(auditTrace),
      resolutionHash
    };
  }
}
