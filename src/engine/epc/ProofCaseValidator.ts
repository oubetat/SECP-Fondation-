/**
 * SECP Industrial OS — EPC-001: Proof Case Project Validator
 * Strict Schema Validation and Lifecycle State Validation for ProofCaseProject.
 */

import {
  ProofCaseProject,
  ProofCaseStatus,
  ProofCaseValidationError,
  ProofCaseType,
  ProofCaseDomain,
  ProofCaseRevision,
  ProofCaseOwner
} from './ProofCaseTypes';

export const VALID_CASE_STATUSES: readonly ProofCaseStatus[] = [
  'DRAFT',
  'DEFINED',
  'ACTIVE',
  'VERIFICATION',
  'VALIDATED',
  'CLOSED',
  'FAILED'
];

export const VALID_CASE_TYPES: readonly string[] = [
  'PRODUCT',
  'SYSTEM',
  'PROCESS',
  'CROSS_DOMAIN',
  'PHYSICAL_VALIDATION'
];

export const VALID_CASE_DOMAINS: readonly string[] = [
  'AEROSPACE',
  'ROBOTICS',
  'AUTOMOTIVE',
  'FLUID_SYSTEMS',
  'THERMAL',
  'MANUFACTURING',
  'GENERAL_ENGINEERING'
];

const VALID_LIFECYCLE_TRANSITIONS: Record<ProofCaseStatus, readonly ProofCaseStatus[]> = {
  DRAFT: ['DEFINED', 'FAILED'],
  DEFINED: ['ACTIVE', 'DRAFT', 'FAILED'],
  ACTIVE: ['VERIFICATION', 'DRAFT', 'FAILED'],
  VERIFICATION: ['VALIDATED', 'FAILED', 'ACTIVE'],
  VALIDATED: ['CLOSED', 'ACTIVE'],
  CLOSED: ['ACTIVE', 'DRAFT'],
  FAILED: ['DRAFT', 'DEFINED']
};

export class ProofCaseValidator {
  /**
   * Validates a candidate ProofCaseProject object.
   * Throws ProofCaseValidationError if any rule is violated.
   */
  public static validate(candidate: unknown): ProofCaseProject {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      throw new ProofCaseValidationError(
        'ProofCaseProject must be a non-null object',
        'INVALID_PROJECT_STRUCTURE'
      );
    }

    const obj = candidate as Record<string, unknown>;

    // 1. Mandatory caseId
    if (obj.caseId === undefined || obj.caseId === null) {
      throw new ProofCaseValidationError(
        'ProofCaseProject missing mandatory field: caseId',
        'MISSING_CASE_ID'
      );
    }
    if (typeof obj.caseId !== 'string' || obj.caseId.trim() === '') {
      throw new ProofCaseValidationError(
        'caseId must be a non-empty string',
        'INVALID_CASE_ID'
      );
    }

    // 2. Mandatory caseType
    if (obj.caseType === undefined || obj.caseType === null) {
      throw new ProofCaseValidationError(
        'ProofCaseProject missing mandatory field: caseType',
        'MISSING_CASE_TYPE'
      );
    }
    if (typeof obj.caseType !== 'string' || obj.caseType.trim() === '') {
      throw new ProofCaseValidationError(
        'caseType must be a non-empty string',
        'INVALID_CASE_TYPE'
      );
    }

    // 3. Mandatory domain
    if (obj.domain === undefined || obj.domain === null) {
      throw new ProofCaseValidationError(
        'ProofCaseProject missing mandatory field: domain',
        'MISSING_DOMAIN'
      );
    }
    if (typeof obj.domain !== 'string' || obj.domain.trim() === '') {
      throw new ProofCaseValidationError(
        'domain must be a non-empty string',
        'INVALID_DOMAIN'
      );
    }

    // 4. Mandatory revision
    if (obj.revision === undefined || obj.revision === null) {
      throw new ProofCaseValidationError(
        'ProofCaseProject missing mandatory field: revision',
        'MISSING_REVISION'
      );
    }
    if (typeof obj.revision === 'string') {
      if (obj.revision.trim() === '') {
        throw new ProofCaseValidationError(
          'revision string must not be empty',
          'INVALID_REVISION'
        );
      }
    } else if (typeof obj.revision === 'object') {
      const revObj = obj.revision as Record<string, unknown>;
      if (!revObj.revisionId || typeof revObj.revisionId !== 'string' || revObj.revisionId.trim() === '') {
        throw new ProofCaseValidationError(
          'revision object must contain a non-empty revisionId',
          'INVALID_REVISION'
        );
      }
    } else {
      throw new ProofCaseValidationError(
        'revision must be a string or structured revision object',
        'INVALID_REVISION'
      );
    }

    // 5. Mandatory status
    if (obj.status === undefined || obj.status === null) {
      throw new ProofCaseValidationError(
        'ProofCaseProject missing mandatory field: status',
        'MISSING_STATUS'
      );
    }
    if (typeof obj.status !== 'string' || !VALID_CASE_STATUSES.includes(obj.status as ProofCaseStatus)) {
      throw new ProofCaseValidationError(
        `Invalid status '${obj.status}'. Allowed statuses: ${VALID_CASE_STATUSES.join(', ')}`,
        'INVALID_STATUS'
      );
    }

    // 6. Mandatory owner
    if (obj.owner === undefined || obj.owner === null) {
      throw new ProofCaseValidationError(
        'ProofCaseProject missing mandatory field: owner',
        'MISSING_OWNER'
      );
    }
    if (typeof obj.owner === 'string') {
      if (obj.owner.trim() === '') {
        throw new ProofCaseValidationError(
          'owner string must not be empty',
          'INVALID_OWNER'
        );
      }
    } else if (typeof obj.owner === 'object') {
      const ownerObj = obj.owner as Record<string, unknown>;
      if (!ownerObj.ownerId || typeof ownerObj.ownerId !== 'string' || ownerObj.ownerId.trim() === '') {
        throw new ProofCaseValidationError(
          'owner object must contain a non-empty ownerId',
          'INVALID_OWNER'
        );
      }
    } else {
      throw new ProofCaseValidationError(
        'owner must be a string or structured owner object',
        'INVALID_OWNER'
      );
    }

    // 7. Mandatory collections (must be arrays)
    const collections = [
      'requirements',
      'models',
      'simulations',
      'manufacturing',
      'tests',
      'evidence'
    ] as const;

    for (const collectionName of collections) {
      if (obj[collectionName] === undefined || obj[collectionName] === null) {
        throw new ProofCaseValidationError(
          `ProofCaseProject missing mandatory collection: ${collectionName}`,
          `MISSING_COLLECTION_${collectionName.toUpperCase()}`
        );
      }
      if (!Array.isArray(obj[collectionName])) {
        throw new ProofCaseValidationError(
          `Collection '${collectionName}' must be an array`,
          `INVALID_COLLECTION_${collectionName.toUpperCase()}`
        );
      }
    }

    // Validate elements inside models if present
    const models = obj.models as unknown[];
    for (let i = 0; i < models.length; i++) {
      const m = models[i];
      if (!m || typeof m !== 'object') {
        throw new ProofCaseValidationError(
          `Model reference at index ${i} must be an object`,
          'MALFORMED_MODEL_REFERENCE'
        );
      }
      const modelObj = m as Record<string, unknown>;
      if (!modelObj.modelId || typeof modelObj.modelId !== 'string' || modelObj.modelId.trim() === '') {
        throw new ProofCaseValidationError(
          `Model reference at index ${i} missing valid modelId`,
          'MALFORMED_MODEL_REFERENCE'
        );
      }
      if (!modelObj.modelType || typeof modelObj.modelType !== 'string' || modelObj.modelType.trim() === '') {
        throw new ProofCaseValidationError(
          `Model reference at index ${i} missing valid modelType`,
          'MALFORMED_MODEL_REFERENCE'
        );
      }
    }

    // Validate elements inside evidence if present
    const evidenceItems = obj.evidence as unknown[];
    for (let i = 0; i < evidenceItems.length; i++) {
      const ev = evidenceItems[i];
      if (!ev || typeof ev !== 'object') {
        throw new ProofCaseValidationError(
          `Evidence reference at index ${i} must be an object`,
          'MALFORMED_EVIDENCE_REFERENCE'
        );
      }
      const evObj = ev as Record<string, unknown>;
      if (!evObj.evidenceId || typeof evObj.evidenceId !== 'string' || evObj.evidenceId.trim() === '') {
        throw new ProofCaseValidationError(
          `Evidence reference at index ${i} missing valid evidenceId`,
          'MALFORMED_EVIDENCE_REFERENCE'
        );
      }
    }

    return obj as unknown as ProofCaseProject;
  }

  /**
   * Validates state transitions for a ProofCaseProject lifecycle.
   */
  public static validateStatusTransition(
    currentStatus: ProofCaseStatus,
    targetStatus: ProofCaseStatus
  ): { valid: boolean; reason?: string } {
    if (currentStatus === targetStatus) {
      return { valid: true };
    }

    const allowed = VALID_LIFECYCLE_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(targetStatus)) {
      return {
        valid: false,
        reason: `Cannot transition ProofCase status from '${currentStatus}' to '${targetStatus}'. Allowed target states: ${allowed ? allowed.join(', ') : 'none'}`
      };
    }

    return { valid: true };
  }
}
