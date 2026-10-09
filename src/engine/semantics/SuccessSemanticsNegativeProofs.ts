/**
 * SECP Industrial OS v3 — PROMPT-052: Negative Proofs Suite
 * Formally executes and validates all 18 mandatory negative proof test cases (SUS-NEG-001 to SUS-NEG-018).
 * Guarantees that no fake, premature, or non-canonical conditions can ever grant SUCCESS.
 */

import {
  EngineeringCapabilityType,
  NonCanonicalMutationReason,
  SuccessStateEnum
} from './SuccessSemanticsTypes';
import { CanonicalMutationVerifier } from './CanonicalMutationVerifier';
import { CapabilitySuccessValidators } from './CapabilitySuccessValidators';
import { EngineeringSuccessResolver } from './SuccessResolver';

export interface NegativeProofResult {
  proofId: string;
  name: string;
  passed: boolean;
  expectedState: SuccessStateEnum | 'NOT_SUCCESS';
  actualState: SuccessStateEnum;
  isSuccess: boolean;
  description: string;
  rejectionReason: string;
}

export class SuccessSemanticsNegativeProofs {
  /**
   * Executes all 18 negative proofs and confirms that in 100% of cases,
   * isSuccess is strictly FALSE.
   */
  public static executeAllNegativeProofs(): {
    results: NegativeProofResult[];
    allPassed: boolean;
    passCount: number;
    totalCount: number;
  } {
    const results: NegativeProofResult[] = [];

    // Base valid validation for comparison
    const validValidation = CapabilitySuccessValidators.validateCapability(
      EngineeringCapabilityType.EXTRUDE,
      { isManifold: true, isWatertight: true, eulerValid: true, volume: 10.0 }
    );

    // SUS-NEG-001: UI state changed -> SUCCESS must remain false
    const neg1 = EngineeringSuccessResolver.resolveOperationSuccess({
      operationId: 'OP-NEG-001',
      capabilityType: EngineeringCapabilityType.EXTRUDE,
      actionName: 'EXTRUDE_UI_ONLY',
      documentId: 'DOC-01',
      documentRevision: 1,
      executionCompleted: true,
      isSupportedCapability: true,
      mutationProof: CanonicalMutationVerifier.createNonCanonicalProof(
        NonCanonicalMutationReason.UI_STATE_ONLY,
        'React state changed without canonical mutation'
      ),
      validationProof: validValidation,
      uiStateChanges: { activeTab: 'features', selectedId: 'ext-01' }
    });
    results.push({
      proofId: 'SUS-NEG-001',
      name: 'UI state changed',
      passed: !neg1.isSuccess && neg1.finalState === SuccessStateEnum.MUTATION_ABSENT,
      expectedState: SuccessStateEnum.MUTATION_ABSENT,
      actualState: neg1.finalState,
      isSuccess: neg1.isSuccess,
      description: 'UI state change without canonical mutation must remain false',
      rejectionReason: neg1.rejectionReasons.join('; ')
    });

    // SUS-NEG-002: Toast displayed -> SUCCESS must remain false
    const neg2 = EngineeringSuccessResolver.resolveOperationSuccess({
      operationId: 'OP-NEG-002',
      capabilityType: EngineeringCapabilityType.FILLET,
      actionName: 'FILLET_TOAST_ONLY',
      documentId: 'DOC-01',
      documentRevision: 1,
      executionCompleted: true,
      isSupportedCapability: true,
      mutationProof: CanonicalMutationVerifier.createNonCanonicalProof(
        NonCanonicalMutationReason.NOTIFICATION_OR_TOAST,
        'Toast notification displayed'
      ),
      validationProof: validValidation,
      toastNotificationSent: true
    });
    results.push({
      proofId: 'SUS-NEG-002',
      name: 'Toast displayed',
      passed: !neg2.isSuccess && neg2.finalState === SuccessStateEnum.MUTATION_ABSENT,
      expectedState: SuccessStateEnum.MUTATION_ABSENT,
      actualState: neg2.finalState,
      isSuccess: neg2.isSuccess,
      description: 'Toast notification display must not grant success',
      rejectionReason: neg2.rejectionReasons.join('; ')
    });

    // SUS-NEG-003: Promise resolved -> SUCCESS must remain false
    const neg3 = EngineeringSuccessResolver.resolveOperationSuccess({
      operationId: 'OP-NEG-003',
      capabilityType: EngineeringCapabilityType.REVOLVE,
      actionName: 'REVOLVE_PROMISE_RESOLVED',
      documentId: 'DOC-01',
      documentRevision: 1,
      executionCompleted: true,
      isSupportedCapability: true,
      mutationProof: CanonicalMutationVerifier.createNonCanonicalProof(
        NonCanonicalMutationReason.PROMISE_RESOLUTION_ONLY,
        'Async promise resolved without mutation'
      ),
      validationProof: validValidation,
      promiseResolved: true
    });
    results.push({
      proofId: 'SUS-NEG-003',
      name: 'Promise resolved',
      passed: !neg3.isSuccess && neg3.finalState === SuccessStateEnum.MUTATION_ABSENT,
      expectedState: SuccessStateEnum.MUTATION_ABSENT,
      actualState: neg3.finalState,
      isSuccess: neg3.isSuccess,
      description: 'Promise resolution alone must not grant success',
      rejectionReason: neg3.rejectionReasons.join('; ')
    });

    // SUS-NEG-004: Object exists -> SUCCESS must remain false
    const neg4 = EngineeringSuccessResolver.resolveOperationSuccess({
      operationId: 'OP-NEG-004',
      capabilityType: EngineeringCapabilityType.HOLE,
      actionName: 'HOLE_OBJECT_EXISTS',
      documentId: 'DOC-01',
      documentRevision: 1,
      executionCompleted: true,
      isSupportedCapability: true,
      mutationProof: CanonicalMutationVerifier.createNonCanonicalProof(
        NonCanonicalMutationReason.OBJECT_CREATED_WITHOUT_INSERTION,
        'Hole object instantiated in memory but not inserted in document'
      ),
      validationProof: validValidation
    });
    results.push({
      proofId: 'SUS-NEG-004',
      name: 'Object exists without canonical insertion',
      passed: !neg4.isSuccess && neg4.finalState === SuccessStateEnum.MUTATION_ABSENT,
      expectedState: SuccessStateEnum.MUTATION_ABSENT,
      actualState: neg4.finalState,
      isSuccess: neg4.isSuccess,
      description: 'Object in-memory instantiation without document insertion must fail',
      rejectionReason: neg4.rejectionReasons.join('; ')
    });

    // SUS-NEG-005: Feature ID exists -> SUCCESS must remain false
    const neg5 = EngineeringSuccessResolver.resolveOperationSuccess({
      operationId: 'OP-NEG-005',
      capabilityType: EngineeringCapabilityType.CHAMFER,
      actionName: 'CHAMFER_ID_ONLY',
      documentId: 'DOC-01',
      documentRevision: 1,
      executionCompleted: true,
      isSupportedCapability: true,
      mutationProof: CanonicalMutationVerifier.createNonCanonicalProof(
        NonCanonicalMutationReason.TEMPORARY_OBJECT,
        'Generated feature UUID CHAMFER-001 without canonical mutation'
      ),
      validationProof: validValidation
    });
    results.push({
      proofId: 'SUS-NEG-005',
      name: 'Feature ID exists only',
      passed: !neg5.isSuccess && neg5.finalState === SuccessStateEnum.MUTATION_ABSENT,
      expectedState: SuccessStateEnum.MUTATION_ABSENT,
      actualState: neg5.finalState,
      isSuccess: neg5.isSuccess,
      description: 'Temporary feature ID presence cannot grant success',
      rejectionReason: neg5.rejectionReasons.join('; ')
    });

    // SUS-NEG-006: Metadata changed only -> SUCCESS must remain false
    const neg6 = EngineeringSuccessResolver.resolveOperationSuccess({
      operationId: 'OP-NEG-006',
      capabilityType: EngineeringCapabilityType.DIRECT_MODELING,
      actionName: 'DIRECT_METADATA_ONLY',
      documentId: 'DOC-01',
      documentRevision: 1,
      executionCompleted: true,
      isSupportedCapability: true,
      mutationProof: CanonicalMutationVerifier.createNonCanonicalProof(
        NonCanonicalMutationReason.METADATA_ONLY_CHANGE,
        'Modified view angle metadata only without B-Rep mutation'
      ),
      validationProof: validValidation
    });
    results.push({
      proofId: 'SUS-NEG-006',
      name: 'Metadata changed only',
      passed: !neg6.isSuccess && neg6.finalState === SuccessStateEnum.MUTATION_ABSENT,
      expectedState: SuccessStateEnum.MUTATION_ABSENT,
      actualState: neg6.finalState,
      isSuccess: neg6.isSuccess,
      description: 'Metadata-only modification without geometric/canonical change must fail',
      rejectionReason: neg6.rejectionReasons.join('; ')
    });

    // SUS-NEG-007: Preview generated -> SUCCESS must remain false
    const neg7 = EngineeringSuccessResolver.resolveOperationSuccess({
      operationId: 'OP-NEG-007',
      capabilityType: EngineeringCapabilityType.LOFT,
      actionName: 'LOFT_PREVIEW_ONLY',
      documentId: 'DOC-01',
      documentRevision: 1,
      executionCompleted: true,
      isSupportedCapability: true,
      mutationProof: CanonicalMutationVerifier.createNonCanonicalProof(
        NonCanonicalMutationReason.PREVIEW_OR_RENDER_ONLY,
        'Generated visual preview wireframe only'
      ),
      validationProof: validValidation
    });
    results.push({
      proofId: 'SUS-NEG-007',
      name: 'Preview generated only',
      passed: !neg7.isSuccess && neg7.finalState === SuccessStateEnum.MUTATION_ABSENT,
      expectedState: SuccessStateEnum.MUTATION_ABSENT,
      actualState: neg7.finalState,
      isSuccess: neg7.isSuccess,
      description: 'Preview generation without canonical commit must fail',
      rejectionReason: neg7.rejectionReasons.join('; ')
    });

    // SUS-NEG-008: Mesh generated without canonical mutation -> SUCCESS must remain false
    const neg8 = EngineeringSuccessResolver.resolveOperationSuccess({
      operationId: 'OP-NEG-008',
      capabilityType: EngineeringCapabilityType.SWEEP,
      actionName: 'SWEEP_MESH_ONLY',
      documentId: 'DOC-01',
      documentRevision: 1,
      executionCompleted: true,
      isSupportedCapability: true,
      mutationProof: CanonicalMutationVerifier.createNonCanonicalProof(
        NonCanonicalMutationReason.MESH_ONLY_PREVIEW,
        'Ephemeral Three.js mesh built for viewport'
      ),
      validationProof: validValidation,
      previewMeshCreated: true
    });
    results.push({
      proofId: 'SUS-NEG-008',
      name: 'Mesh generated without canonical mutation',
      passed: !neg8.isSuccess && neg8.finalState === SuccessStateEnum.MUTATION_ABSENT,
      expectedState: SuccessStateEnum.MUTATION_ABSENT,
      actualState: neg8.finalState,
      isSuccess: neg8.isSuccess,
      description: 'Tessellated mesh creation without canonical B-Rep change must fail',
      rejectionReason: neg8.rejectionReasons.join('; ')
    });

    // SUS-NEG-009: Evidence generated without validation -> SUCCESS must remain false
    const neg9 = EngineeringSuccessResolver.resolveOperationSuccess({
      operationId: 'OP-NEG-009',
      capabilityType: EngineeringCapabilityType.ASSEMBLY,
      actionName: 'ASSY_UNVALIDATED_EVIDENCE',
      documentId: 'DOC-01',
      documentRevision: 2,
      executionCompleted: true,
      isSupportedCapability: true,
      mutationProof: CanonicalMutationVerifier.createValidProof({
        targetDocumentId: 'DOC-01',
        previousRevision: 1,
        mutationType: 'INSERT_COMPONENT',
        affectedEntities: ['INST-01'],
        contentBefore: { rev: 1 },
        contentAfter: { rev: 2 }
      }),
      validationProof: CapabilitySuccessValidators.validateCapability(
        EngineeringCapabilityType.ASSEMBLY,
        { instanceId: '' } // Fails validation because instanceId is empty
      ),
      evidenceRecord: {
        evidenceId: 'EV-FAKE-01',
        payloadHash: '1234567890abcdef',
        timestamp: new Date().toISOString(),
        derivedFromVerifiedOutcome: false // Unverified
      }
    });
    results.push({
      proofId: 'SUS-NEG-009',
      name: 'Evidence generated without validation',
      passed: !neg9.isSuccess && neg9.finalState === SuccessStateEnum.VALIDATION_FAILED,
      expectedState: SuccessStateEnum.VALIDATION_FAILED,
      actualState: neg9.finalState,
      isSuccess: neg9.isSuccess,
      description: 'Evidence cannot manufacture success when validation fails',
      rejectionReason: neg9.rejectionReasons.join('; ')
    });

    // SUS-NEG-010: Hash generated -> SUCCESS must remain false
    const neg10 = EngineeringSuccessResolver.resolveOperationSuccess({
      operationId: 'OP-NEG-010',
      capabilityType: EngineeringCapabilityType.MATE,
      actionName: 'MATE_HASH_ONLY',
      documentId: 'DOC-01',
      documentRevision: 1,
      executionCompleted: true,
      isSupportedCapability: true,
      mutationProof: CanonicalMutationVerifier.createNonCanonicalProof(
        NonCanonicalMutationReason.EVIDENCE_HASH_ONLY,
        'SHA-256 hash generated for uncommitted payload'
      ),
      validationProof: validValidation
    });
    results.push({
      proofId: 'SUS-NEG-010',
      name: 'Hash generated only',
      passed: !neg10.isSuccess && neg10.finalState === SuccessStateEnum.MUTATION_ABSENT,
      expectedState: SuccessStateEnum.MUTATION_ABSENT,
      actualState: neg10.finalState,
      isSuccess: neg10.isSuccess,
      description: 'Cryptographic hash alone cannot manufacture success',
      rejectionReason: neg10.rejectionReasons.join('; ')
    });

    // SUS-NEG-011: Validation failed -> SUCCESS must be false
    const neg11 = EngineeringSuccessResolver.resolveOperationSuccess({
      operationId: 'OP-NEG-011',
      capabilityType: EngineeringCapabilityType.EXTRUDE,
      actionName: 'EXTRUDE_NON_MANIFOLD',
      documentId: 'DOC-01',
      documentRevision: 2,
      executionCompleted: true,
      isSupportedCapability: true,
      mutationProof: CanonicalMutationVerifier.createValidProof({
        targetDocumentId: 'DOC-01',
        previousRevision: 1,
        mutationType: 'EXTRUDE',
        affectedEntities: ['SOLID-01'],
        contentBefore: { rev: 1 },
        contentAfter: { rev: 2 }
      }),
      validationProof: CapabilitySuccessValidators.validateCapability(
        EngineeringCapabilityType.EXTRUDE,
        { isManifold: false, isWatertight: false, eulerValid: false, volume: -5.0 }
      )
    });
    results.push({
      proofId: 'SUS-NEG-011',
      name: 'Validation failed',
      passed: !neg11.isSuccess && neg11.finalState === SuccessStateEnum.VALIDATION_FAILED,
      expectedState: SuccessStateEnum.VALIDATION_FAILED,
      actualState: neg11.finalState,
      isSuccess: neg11.isSuccess,
      description: 'When engineering validation criteria fail, operation must fail',
      rejectionReason: neg11.rejectionReasons.join('; ')
    });

    // SUS-NEG-012: Validation skipped -> SUCCESS must be false
    const neg12 = EngineeringSuccessResolver.resolveOperationSuccess({
      operationId: 'OP-NEG-012',
      capabilityType: EngineeringCapabilityType.KINEMATICS,
      actionName: 'KIN_SKIPPED_VALIDATION',
      documentId: 'DOC-01',
      documentRevision: 2,
      executionCompleted: true,
      isSupportedCapability: true,
      mutationProof: CanonicalMutationVerifier.createValidProof({
        targetDocumentId: 'DOC-01',
        previousRevision: 1,
        mutationType: 'JOINT_SOLVE',
        affectedEntities: ['JOINT-01'],
        contentBefore: { rev: 1 },
        contentAfter: { rev: 2 }
      }),
      validationProof: CapabilitySuccessValidators.validateCapability(
        EngineeringCapabilityType.KINEMATICS,
        {},
        { skipValidation: true }
      )
    });
    results.push({
      proofId: 'SUS-NEG-012',
      name: 'Validation skipped/bypassed',
      passed: !neg12.isSuccess && neg12.finalState === SuccessStateEnum.VALIDATION_FAILED,
      expectedState: SuccessStateEnum.VALIDATION_FAILED,
      actualState: neg12.finalState,
      isSuccess: neg12.isSuccess,
      description: 'Bypassing or skipping validation must strictly prevent success',
      rejectionReason: neg12.rejectionReasons.join('; ')
    });

    // SUS-NEG-013: Canonical mutation absent -> SUCCESS must be false
    const neg13 = EngineeringSuccessResolver.resolveOperationSuccess({
      operationId: 'OP-NEG-013',
      capabilityType: EngineeringCapabilityType.SURFACE,
      actionName: 'SURFACE_NO_MUTATION',
      documentId: 'DOC-01',
      documentRevision: 1,
      executionCompleted: true,
      isSupportedCapability: true,
      mutationProof: {
        isCanonicalMutation: false,
        targetDocumentId: 'DOC-01',
        previousRevision: 1,
        newRevision: 1,
        mutationType: 'SURFACE_TRIM',
        affectedCanonicalEntities: [],
        canonicalPayloadHashBefore: 'hash1',
        canonicalPayloadHashAfter: 'hash1', // identical hash = no change
        isStaleState: false,
        rebuildable: true
      },
      validationProof: validValidation
    });
    results.push({
      proofId: 'SUS-NEG-013',
      name: 'Canonical mutation absent',
      passed: !neg13.isSuccess && neg13.finalState === SuccessStateEnum.MUTATION_ABSENT,
      expectedState: SuccessStateEnum.MUTATION_ABSENT,
      actualState: neg13.finalState,
      isSuccess: neg13.isSuccess,
      description: 'Absence of canonical state mutation must reject success',
      rejectionReason: neg13.rejectionReasons.join('; ')
    });

    // SUS-NEG-014: Canonical mutation detected but invalid -> SUCCESS must be false
    const neg14 = EngineeringSuccessResolver.resolveOperationSuccess({
      operationId: 'OP-NEG-014',
      capabilityType: EngineeringCapabilityType.SHEET_METAL,
      actionName: 'SM_INVALID_MUTATION',
      documentId: 'DOC-01',
      documentRevision: 1,
      executionCompleted: true,
      isSupportedCapability: true,
      mutationProof: {
        isCanonicalMutation: true,
        targetDocumentId: '', // Invalid empty document ID
        previousRevision: 2,
        newRevision: 1, // Non-monotonic revision decrement
        mutationType: 'BEND',
        affectedCanonicalEntities: [],
        canonicalPayloadHashBefore: 'hashA',
        canonicalPayloadHashAfter: 'hashA',
        isStaleState: false,
        rebuildable: false
      },
      validationProof: validValidation
    });
    results.push({
      proofId: 'SUS-NEG-014',
      name: 'Canonical mutation detected but invalid',
      passed: !neg14.isSuccess && neg14.finalState === SuccessStateEnum.FAILED,
      expectedState: SuccessStateEnum.FAILED,
      actualState: neg14.finalState,
      isSuccess: neg14.isSuccess,
      description: 'Malformed mutation proof must reject success',
      rejectionReason: neg14.rejectionReasons.join('; ')
    });

    // SUS-NEG-015: Operation unsupported -> SUCCESS must be false and state = UNSUPPORTED
    const neg15 = EngineeringSuccessResolver.resolveOperationSuccess({
      operationId: 'OP-NEG-015',
      capabilityType: EngineeringCapabilityType.MOLD_TOOLING,
      actionName: 'MOLD_UNSUPPORTED',
      documentId: 'DOC-01',
      documentRevision: 1,
      executionCompleted: false,
      isSupportedCapability: false, // UNSUPPORTED
      mutationProof: CanonicalMutationVerifier.createNonCanonicalProof(
        NonCanonicalMutationReason.TEMPORARY_OBJECT
      ),
      validationProof: validValidation
    });
    results.push({
      proofId: 'SUS-NEG-015',
      name: 'Operation unsupported',
      passed: !neg15.isSuccess && neg15.finalState === SuccessStateEnum.UNSUPPORTED && neg15.verdict === 'UNSUPPORTED',
      expectedState: SuccessStateEnum.UNSUPPORTED,
      actualState: neg15.finalState,
      isSuccess: neg15.isSuccess,
      description: 'Unsupported operation must yield UNSUPPORTED and not SUCCESS',
      rejectionReason: neg15.rejectionReasons.join('; ')
    });

    // SUS-NEG-016: Canonical state stale -> SUCCESS must be false
    const neg16 = EngineeringSuccessResolver.resolveOperationSuccess({
      operationId: 'OP-NEG-016',
      capabilityType: EngineeringCapabilityType.DRAWING,
      actionName: 'DRW_STALE_STATE',
      documentId: 'DOC-01',
      documentRevision: 2,
      executionCompleted: true,
      isSupportedCapability: true,
      mutationProof: {
        isCanonicalMutation: true,
        targetDocumentId: 'DOC-01',
        previousRevision: 1,
        newRevision: 2,
        mutationType: 'UPDATE_VIEW',
        affectedCanonicalEntities: ['VIEW-01'],
        canonicalPayloadHashBefore: 'hash1',
        canonicalPayloadHashAfter: 'hash2',
        isStaleState: true, // STALE!
        rebuildable: true
      },
      validationProof: validValidation
    });
    results.push({
      proofId: 'SUS-NEG-016',
      name: 'Canonical state stale',
      passed: !neg16.isSuccess && neg16.finalState === SuccessStateEnum.STALE,
      expectedState: SuccessStateEnum.STALE,
      actualState: neg16.finalState,
      isSuccess: neg16.isSuccess,
      description: 'Applying changes to a stale document state must be rejected',
      rejectionReason: neg16.rejectionReasons.join('; ')
    });

    // SUS-NEG-017: Required persistence failed -> SUCCESS must be false
    const neg17 = EngineeringSuccessResolver.resolveOperationSuccess({
      operationId: 'OP-NEG-017',
      capabilityType: EngineeringCapabilityType.PMI_GDT,
      actionName: 'PMI_PERSISTENCE_FAIL',
      documentId: 'DOC-01',
      documentRevision: 2,
      executionCompleted: true,
      isSupportedCapability: true,
      mutationProof: CanonicalMutationVerifier.createValidProof({
        targetDocumentId: 'DOC-01',
        previousRevision: 1,
        mutationType: 'ATTACH_PMI',
        affectedEntities: ['PMI-01'],
        contentBefore: { rev: 1 },
        contentAfter: { rev: 2 }
      }),
      validationProof: validValidation,
      persistenceProof: {
        persistenceRequired: true,
        persistedSuccessfully: false, // FAILED
        storageTarget: 'CANONICAL_DOC_STORE',
        persistedRevision: 2,
        roundTripVerified: false
      }
    });
    results.push({
      proofId: 'SUS-NEG-017',
      name: 'Required persistence failed',
      passed: !neg17.isSuccess && neg17.finalState === SuccessStateEnum.PERSISTENCE_FAILED,
      expectedState: SuccessStateEnum.PERSISTENCE_FAILED,
      actualState: neg17.finalState,
      isSuccess: neg17.isSuccess,
      description: 'When persistence is required and fails, result must be PERSISTENCE_FAILED',
      rejectionReason: neg17.rejectionReasons.join('; ')
    });

    // SUS-NEG-018: Required regeneration failed -> SUCCESS must be false
    const neg18 = EngineeringSuccessResolver.resolveOperationSuccess({
      operationId: 'OP-NEG-018',
      capabilityType: EngineeringCapabilityType.GENERATIVE_DESIGN,
      actionName: 'GEN_REGEN_FAIL',
      documentId: 'DOC-01',
      documentRevision: 2,
      executionCompleted: true,
      isSupportedCapability: true,
      mutationProof: CanonicalMutationVerifier.createValidProof({
        targetDocumentId: 'DOC-01',
        previousRevision: 1,
        mutationType: 'PARAMETRIC_UPDATE',
        affectedEntities: ['GEN-01'],
        contentBefore: { rev: 1 },
        contentAfter: { rev: 2 }
      }),
      validationProof: validValidation,
      regenerationProof: {
        regenerationRequired: true,
        regenerationPassed: false, // FAILED
        regeneratedHash: 'badhash',
        deterministicReplayMatched: false
      }
    });
    results.push({
      proofId: 'SUS-NEG-018',
      name: 'Required regeneration failed',
      passed: !neg18.isSuccess && neg18.finalState === SuccessStateEnum.REGENERATION_FAILED,
      expectedState: SuccessStateEnum.REGENERATION_FAILED,
      actualState: neg18.finalState,
      isSuccess: neg18.isSuccess,
      description: 'When parametric regeneration is required and fails, result must be REGENERATION_FAILED',
      rejectionReason: neg18.rejectionReasons.join('; ')
    });

    const passCount = results.filter(r => r.passed).length;
    const totalCount = results.length;

    return {
      results,
      allPassed: passCount === totalCount && totalCount === 18,
      passCount,
      totalCount
    };
  }
}
