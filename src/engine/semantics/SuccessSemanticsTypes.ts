/**
 * SECP Industrial OS v3 — PROMPT-052: Success Semantics Types
 * Formal definitions, contracts, state machine states, and proof records for Engineering Success.
 */

export enum SuccessStateEnum {
  REQUESTED = 'REQUESTED',
  EXECUTING = 'EXECUTING',
  EXECUTED = 'EXECUTED',
  CANONICAL_MUTATED = 'CANONICAL_MUTATED',
  VALIDATING = 'VALIDATING',
  VALID = 'VALID',
  VERIFIED = 'VERIFIED',
  SUCCESS = 'SUCCESS',
  
  // Terminal failure states
  FAILED = 'FAILED',
  INVALID = 'INVALID',
  UNSUPPORTED = 'UNSUPPORTED',
  CANCELLED = 'CANCELLED',
  CONFLICT = 'CONFLICT',
  STALE = 'STALE',
  DIVERGED = 'DIVERGED',
  MUTATION_ABSENT = 'MUTATION_ABSENT',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  REGENERATION_FAILED = 'REGENERATION_FAILED',
  PERSISTENCE_FAILED = 'PERSISTENCE_FAILED'
}

export enum EngineeringCapabilityType {
  SKETCH = 'SKETCH',
  EXTRUDE = 'EXTRUDE',
  REVOLVE = 'REVOLVE',
  SWEEP = 'SWEEP',
  LOFT = 'LOFT',
  FILLET = 'FILLET',
  CHAMFER = 'CHAMFER',
  HOLE = 'HOLE',
  DIRECT_MODELING = 'DIRECT_MODELING',
  ASSEMBLY = 'ASSEMBLY',
  MATE = 'MATE',
  KINEMATICS = 'KINEMATICS',
  SURFACE = 'SURFACE',
  SHEET_METAL = 'SHEET_METAL',
  WELDMENT = 'WELDMENT',
  MOLD_TOOLING = 'MOLD_TOOLING',
  DRAWING = 'DRAWING',
  PMI_GDT = 'PMI_GDT',
  GENERATIVE_DESIGN = 'GENERATIVE_DESIGN',
  REVERSE_ENGINEERING = 'REVERSE_ENGINEERING',
  SIMULATION = 'SIMULATION'
}

export enum NonCanonicalMutationReason {
  REACT_STATE_ONLY = 'REACT_STATE_ONLY',
  UI_STATE_ONLY = 'UI_STATE_ONLY',
  SELECTED_FEATURE_CHANGE = 'SELECTED_FEATURE_CHANGE',
  SET_STATE_CALL = 'SET_STATE_CALL',
  NOTIFICATION_OR_TOAST = 'NOTIFICATION_OR_TOAST',
  PREVIEW_OR_RENDER_ONLY = 'PREVIEW_OR_RENDER_ONLY',
  CSS_OR_CANVAS_UPDATE = 'CSS_OR_CANVAS_UPDATE',
  WEBGPU_VISUAL_ONLY = 'WEBGPU_VISUAL_ONLY',
  MESH_ONLY_PREVIEW = 'MESH_ONLY_PREVIEW',
  TEMPORARY_OBJECT = 'TEMPORARY_OBJECT',
  LOCAL_ARRAY_MUTATION = 'LOCAL_ARRAY_MUTATION',
  METADATA_ONLY_CHANGE = 'METADATA_ONLY_CHANGE',
  PROMISE_RESOLUTION_ONLY = 'PROMISE_RESOLUTION_ONLY',
  CALLBACK_EXECUTION_ONLY = 'CALLBACK_EXECUTION_ONLY',
  TIMER_OR_DELAY_ONLY = 'TIMER_OR_DELAY_ONLY',
  EVIDENCE_HASH_ONLY = 'EVIDENCE_HASH_ONLY',
  OBJECT_CREATED_WITHOUT_INSERTION = 'OBJECT_CREATED_WITHOUT_INSERTION'
}

export interface CanonicalMutationProof {
  isCanonicalMutation: boolean;
  targetDocumentId: string;
  previousRevision: number;
  newRevision: number;
  mutationType: string;
  affectedCanonicalEntities: readonly string[];
  canonicalPayloadHashBefore: string;
  canonicalPayloadHashAfter: string;
  isStaleState: boolean;
  rebuildable: boolean;
  nonCanonicalReasons?: readonly NonCanonicalMutationReason[];
  details?: string;
}

export interface ValidationProof {
  validationPassed: boolean;
  capabilityType: EngineeringCapabilityType;
  validationRuleSet: string;
  checkedCriteria: readonly {
    criterionId: string;
    description: string;
    passed: boolean;
    errorDetail?: string;
  }[];
  skippedValidation?: boolean;
  validatorIdentifier: string;
  timestamp: string;
}

export interface VerificationProof {
  verificationRequired: boolean;
  verificationPassed: boolean;
  verifierIdentifier: string;
  independentCheckCount: number;
  checks: readonly {
    checkId: string;
    passed: boolean;
    detail: string;
  }[];
  timestamp: string;
}

export interface PersistenceProof {
  persistenceRequired: boolean;
  persistedSuccessfully: boolean;
  storageTarget: string;
  persistedRevision: number;
  roundTripVerified: boolean;
}

export interface RegenerationProof {
  regenerationRequired: boolean;
  regenerationPassed: boolean;
  regeneratedHash: string;
  deterministicReplayMatched: boolean;
}

export interface EvidenceRecordInfo {
  evidenceId: string;
  payloadHash: string;
  timestamp: string;
  // Crucial: Evidence alone does not constitute success
  derivedFromVerifiedOutcome: boolean;
}

export interface SuccessResolutionRequest {
  operationId: string;
  capabilityType: EngineeringCapabilityType;
  actionName: string;
  documentId: string;
  documentRevision: number;
  
  // Execution Context
  executionCompleted: boolean;
  isSupportedCapability: boolean;
  
  // Proofs
  mutationProof: CanonicalMutationProof;
  validationProof: ValidationProof;
  verificationProof?: VerificationProof;
  persistenceProof?: PersistenceProof;
  regenerationProof?: RegenerationProof;
  
  // Optional Evidence (Evidence cannot create success)
  evidenceRecord?: EvidenceRecordInfo;
  
  // UI / Presentation Flags (Forbidden from influencing verdict)
  uiStateChanges?: Record<string, unknown>;
  toastNotificationSent?: boolean;
  promiseResolved?: boolean;
  timerCompleted?: boolean;
  previewMeshCreated?: boolean;
}

export interface SuccessResolutionResult {
  operationId: string;
  capabilityType: EngineeringCapabilityType;
  verdict: 'SUCCESS' | 'FAIL' | 'UNSUPPORTED' | 'INVALID';
  finalState: SuccessStateEnum;
  isSuccess: boolean;
  timestamp: string;
  
  // Breakdown of verification
  canonicalMutationVerified: boolean;
  validationPassed: boolean;
  verificationPassed: boolean;
  persistencePassed: boolean;
  regenerationPassed: boolean;
  
  // Diagnostics
  rejectionReasons: readonly string[];
  criticalFailures: readonly string[];
  auditTrace: readonly string[];
  
  // Cryptographic audit fingerprint
  resolutionHash: string;
}

export interface AuditMatrixRow {
  operation: EngineeringCapabilityType;
  successSource: string;
  canonicalMutationProven: boolean;
  validationProven: boolean;
  verificationProven: boolean;
  evidenceProven: boolean;
  persistenceProven: boolean;
  regenerationProven: boolean;
  verdict: 'PASS' | 'FAIL';
  notes: string;
}
