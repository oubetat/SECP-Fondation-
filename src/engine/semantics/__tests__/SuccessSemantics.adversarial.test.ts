/**
 * SECP Industrial OS v3 — PROMPT-052: Adversarial Success Semantics Tests
 * Validates resilience against adversarial manipulation, fake evidence injection,
 * bypassed validators, forged hashes, and UI shortcutting.
 */

import { describe, it, expect } from 'vitest';
import {
  EngineeringCapabilityType,
  NonCanonicalMutationReason,
  SuccessStateEnum
} from '../SuccessSemanticsTypes';
import { CanonicalMutationVerifier } from '../CanonicalMutationVerifier';
import { CapabilitySuccessValidators } from '../CapabilitySuccessValidators';
import { EngineeringSuccessResolver } from '../SuccessResolver';

describe('PROMPT-052: Adversarial Success Semantics Tests', () => {
  it('ADV-01: Rejects adversarial attempt to claim success using valid hash but zero mutation', () => {
    const res = EngineeringSuccessResolver.resolveOperationSuccess({
      operationId: 'ADV-OP-01',
      capabilityType: EngineeringCapabilityType.FILLET,
      actionName: 'FILLET_FORGED_HASH',
      documentId: 'DOC-ADV-01',
      documentRevision: 1,
      executionCompleted: true,
      isSupportedCapability: true,
      mutationProof: CanonicalMutationVerifier.createNonCanonicalProof(
        NonCanonicalMutationReason.EVIDENCE_HASH_ONLY
      ),
      validationProof: CapabilitySuccessValidators.validateCapability(
        EngineeringCapabilityType.FILLET,
        { blendCollision: false, restitchValid: true }
      ),
      evidenceRecord: {
        evidenceId: 'EV-FORGED-01',
        payloadHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        timestamp: new Date().toISOString(),
        derivedFromVerifiedOutcome: false
      }
    });

    expect(res.isSuccess).toBe(false);
    expect(res.verdict).toBe('FAIL');
    expect(res.finalState).toBe(SuccessStateEnum.MUTATION_ABSENT);
    expect(res.criticalFailures.length).toBeGreaterThan(0);
  });

  it('ADV-02: Rejects adversarial attempt to inject unverified evidence record into valid mutation', () => {
    const res = EngineeringSuccessResolver.resolveOperationSuccess({
      operationId: 'ADV-OP-02',
      capabilityType: EngineeringCapabilityType.EXTRUDE,
      actionName: 'EXTRUDE_UNVERIFIED_EVIDENCE',
      documentId: 'DOC-ADV-02',
      documentRevision: 2,
      executionCompleted: true,
      isSupportedCapability: true,
      mutationProof: CanonicalMutationVerifier.createValidProof({
        targetDocumentId: 'DOC-ADV-02',
        previousRevision: 1,
        mutationType: 'EXTRUDE',
        affectedEntities: ['SOLID-01'],
        contentBefore: { rev: 1 },
        contentAfter: { rev: 2 }
      }),
      validationProof: CapabilitySuccessValidators.validateCapability(
        EngineeringCapabilityType.EXTRUDE,
        { isManifold: true, isWatertight: true, eulerValid: true, volume: 10 }
      ),
      evidenceRecord: {
        evidenceId: 'EV-UNVERIFIED-01',
        payloadHash: '9999999999999999999999999999999999999999999999999999999999999999',
        timestamp: new Date().toISOString(),
        derivedFromVerifiedOutcome: false // Adversarial flag
      }
    });

    expect(res.isSuccess).toBe(false);
    expect(res.verdict).toBe('FAIL');
    expect(res.criticalFailures).toContain('CRITICAL: Evidence record payload was not derived from verified outcome');
  });

  it('ADV-03: Rejects adversarial attempt to skip validation while claiming validationPassed: true', () => {
    const res = EngineeringSuccessResolver.resolveOperationSuccess({
      operationId: 'ADV-OP-03',
      capabilityType: EngineeringCapabilityType.SIMULATION,
      actionName: 'SIM_SKIPPED_VAL',
      documentId: 'DOC-ADV-03',
      documentRevision: 2,
      executionCompleted: true,
      isSupportedCapability: true,
      mutationProof: CanonicalMutationVerifier.createValidProof({
        targetDocumentId: 'DOC-ADV-03',
        previousRevision: 1,
        mutationType: 'SIM_RUN',
        affectedEntities: ['SOL-01'],
        contentBefore: { rev: 1 },
        contentAfter: { rev: 2 }
      }),
      validationProof: {
        validationPassed: true, // Adversary claims true
        capabilityType: EngineeringCapabilityType.SIMULATION,
        validationRuleSet: 'RULESET-SIMULATION-V1',
        checkedCriteria: [],
        skippedValidation: true, // But skipped validation
        validatorIdentifier: 'VAL-ADVERSARY',
        timestamp: new Date().toISOString()
      }
    });

    expect(res.isSuccess).toBe(false);
    expect(res.finalState).toBe(SuccessStateEnum.VALIDATION_FAILED);
    expect(res.criticalFailures).toContain('CRITICAL: Validation was skipped/bypassed');
  });

  it('ADV-04: Rejects adversarial attempt to bypass persistence when persistence is required', () => {
    const res = EngineeringSuccessResolver.resolveOperationSuccess({
      operationId: 'ADV-OP-04',
      capabilityType: EngineeringCapabilityType.ASSEMBLY,
      actionName: 'ASSY_UNPERSISTED',
      documentId: 'DOC-ADV-04',
      documentRevision: 2,
      executionCompleted: true,
      isSupportedCapability: true,
      mutationProof: CanonicalMutationVerifier.createValidProof({
        targetDocumentId: 'DOC-ADV-04',
        previousRevision: 1,
        mutationType: 'INSERT_COMPONENT',
        affectedEntities: ['INST-01'],
        contentBefore: { rev: 1 },
        contentAfter: { rev: 2 }
      }),
      validationProof: CapabilitySuccessValidators.validateCapability(
        EngineeringCapabilityType.ASSEMBLY,
        { instanceId: 'INST-01', instanceResolved: true, unintendedInterference: false }
      ),
      persistenceProof: {
        persistenceRequired: true,
        persistedSuccessfully: false, // In-memory only!
        storageTarget: 'CANONICAL_DOC_STORE',
        persistedRevision: 2,
        roundTripVerified: false
      }
    });

    expect(res.isSuccess).toBe(false);
    expect(res.finalState).toBe(SuccessStateEnum.PERSISTENCE_FAILED);
    expect(res.criticalFailures).toContain('CRITICAL: Required persistence failed');
  });

  it('ADV-05: Rejects adversarial attempt to mutate against stale revision', () => {
    const res = EngineeringSuccessResolver.resolveOperationSuccess({
      operationId: 'ADV-OP-05',
      capabilityType: EngineeringCapabilityType.SKETCH,
      actionName: 'SKETCH_STALE',
      documentId: 'DOC-ADV-05',
      documentRevision: 2,
      executionCompleted: true,
      isSupportedCapability: true,
      mutationProof: {
        isCanonicalMutation: true,
        targetDocumentId: 'DOC-ADV-05',
        previousRevision: 1,
        newRevision: 2,
        mutationType: 'ADD_ENTITY',
        affectedCanonicalEntities: ['LINE-01'],
        canonicalPayloadHashBefore: 'hash1',
        canonicalPayloadHashAfter: 'hash2',
        isStaleState: true, // Adversarial: Stale branch
        rebuildable: true
      },
      validationProof: CapabilitySuccessValidators.validateCapability(
        EngineeringCapabilityType.SKETCH,
        { isClosedProfile: true, constraintConflict: false, solverResidual: 1e-8 }
      )
    });

    expect(res.isSuccess).toBe(false);
    expect(res.finalState).toBe(SuccessStateEnum.STALE);
    expect(res.criticalFailures).toContain('CRITICAL: Canonical state stale');
  });
});
