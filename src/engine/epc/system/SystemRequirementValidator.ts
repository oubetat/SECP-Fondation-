/**
 * SECP Industrial OS — EPC-017: System Requirement Validator
 * Strict Domain-Agnostic Schema, Dimensional, Mathematical Consistency,
 * Acceptance Criteria, and Critical Rule Validation.
 */

import { EngineeringRequirementValidator } from '../EngineeringRequirementValidator';
import {
  SystemRequirement,
  SystemRequirementValidationError,
  SystemRequirementCategory,
  SystemRequirementType,
  SystemRequirementPriority,
  SystemRequirementVerificationMethod,
  SystemRequirementValidationMethod,
  SystemRequirementStatus
} from './SystemRequirementTypes';

export const VALID_SYSTEM_REQUIREMENT_TYPES: readonly SystemRequirementType[] = [
  'FUNCTIONAL',
  'PERFORMANCE',
  'PHYSICAL',
  'INTERFACE',
  'ENVIRONMENTAL',
  'STRUCTURAL',
  'THERMAL',
  'POWER',
  'CONTROL',
  'MANUFACTURING',
  'VERIFICATION',
  'VALIDATION'
];

export const VALID_SYSTEM_REQUIREMENT_CATEGORIES: readonly string[] = [
  'MISSION',
  'PERFORMANCE',
  'AERODYNAMICS',
  'PROPULSION',
  'STRUCTURAL',
  'MASS',
  'POWER',
  'BATTERY',
  'THERMAL',
  'CONTROL',
  'FLIGHT_DYNAMICS',
  'PAYLOAD',
  'ENDURANCE',
  'ENVIRONMENT',
  'SAFETY',
  'MANUFACTURING',
  'MAINTAINABILITY',
  'INTEROPERABILITY'
];

export const VALID_SYSTEM_PRIORITIES: readonly SystemRequirementPriority[] = [
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW'
];

export const VALID_SYSTEM_VERIFICATION_METHODS: readonly SystemRequirementVerificationMethod[] = [
  'ANALYSIS',
  'SIMULATION',
  'INSPECTION',
  'CALCULATION',
  'TEST',
  'MEASUREMENT',
  'REVIEW'
];

export const VALID_SYSTEM_VALIDATION_METHODS: readonly SystemRequirementValidationMethod[] = [
  'SIMULATION_VALIDATION',
  'PHYSICAL_TEST',
  'EXPERIMENTAL_DATA',
  'INSPECTION',
  'FIELD_TEST',
  'INDEPENDENT_VALIDATION',
  'EXPERIMENT',
  'PROTOTYPE_TEST',
  'SIMULATION_CORRELATION'
];

export const VALID_SYSTEM_STATUSES: readonly SystemRequirementStatus[] = [
  'DRAFT',
  'DEFINED',
  'IMPLEMENTED',
  'VERIFIABLE',
  'VERIFIED',
  'VALIDATED',
  'FAILED',
  'INCONCLUSIVE'
];

const BANNED_ACCEPTANCE_CRITERIA_PATTERNS = [
  /^looks\s+good$/i,
  /^simulation\s+successful$/i,
  /^test\s+passes$/i,
  /^pass$/i,
  /^passed$/i,
  /^ok$/i,
  /^tbd$/i,
  /^none$/i,
  /^n\/a$/i,
  /^check$/i,
  /^fine$/i
];

export class SystemRequirementValidator {
  /**
   * Validates a single SystemRequirement against all structural, physical,
   * dimensional, and logical constraints.
   */
  public static validate(candidate: unknown): SystemRequirement {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      throw new SystemRequirementValidationError(
        'SystemRequirement must be a non-null object',
        'INVALID_REQUIREMENT_STRUCTURE'
      );
    }

    const obj = candidate as Record<string, unknown>;

    // 1. requirementId
    if (obj.requirementId === undefined || obj.requirementId === null) {
      throw new SystemRequirementValidationError(
        'SystemRequirement is missing required field: requirementId',
        'MISSING_REQUIREMENT_ID'
      );
    }
    if (typeof obj.requirementId !== 'string' || obj.requirementId.trim() === '') {
      throw new SystemRequirementValidationError(
        'requirementId must be a non-empty string',
        'INVALID_REQUIREMENT_ID'
      );
    }

    // 2. caseId
    if (obj.caseId === undefined || obj.caseId === null || typeof obj.caseId !== 'string' || obj.caseId.trim() === '') {
      throw new SystemRequirementValidationError(
        'SystemRequirement is missing or has invalid field: caseId',
        'MISSING_CASE_ID'
      );
    }

    // 3. domain
    if (obj.domain === undefined || obj.domain === null || typeof obj.domain !== 'string' || obj.domain.trim() === '') {
      throw new SystemRequirementValidationError(
        'SystemRequirement is missing or has invalid field: domain',
        'MISSING_DOMAIN'
      );
    }

    // 4. category
    if (obj.category === undefined || obj.category === null || typeof obj.category !== 'string' || obj.category.trim() === '') {
      throw new SystemRequirementValidationError(
        'SystemRequirement is missing or has invalid field: category',
        'MISSING_CATEGORY'
      );
    }

    // 5. title
    if (obj.title === undefined || obj.title === null || typeof obj.title !== 'string' || obj.title.trim() === '') {
      throw new SystemRequirementValidationError(
        'SystemRequirement is missing or has invalid field: title',
        'MISSING_TITLE'
      );
    }

    // 6. description
    if (obj.description === undefined || obj.description === null || typeof obj.description !== 'string' || obj.description.trim() === '') {
      throw new SystemRequirementValidationError(
        'SystemRequirement is missing or has invalid field: description',
        'MISSING_DESCRIPTION'
      );
    }

    // 7. type
    if (obj.type === undefined || obj.type === null) {
      throw new SystemRequirementValidationError(
        'SystemRequirement is missing required field: type',
        'MISSING_TYPE'
      );
    }
    if (typeof obj.type !== 'string' || !VALID_SYSTEM_REQUIREMENT_TYPES.includes(obj.type as SystemRequirementType)) {
      throw new SystemRequirementValidationError(
        `Invalid requirement type '${obj.type}'. Allowed: ${VALID_SYSTEM_REQUIREMENT_TYPES.join(', ')}`,
        'INVALID_TYPE'
      );
    }

    // 8. priority
    if (obj.priority === undefined || obj.priority === null) {
      throw new SystemRequirementValidationError(
        'SystemRequirement is missing required field: priority',
        'MISSING_PRIORITY'
      );
    }
    if (typeof obj.priority !== 'string' || !VALID_SYSTEM_PRIORITIES.includes(obj.priority as SystemRequirementPriority)) {
      throw new SystemRequirementValidationError(
        `Invalid requirement priority '${obj.priority}'. Allowed: ${VALID_SYSTEM_PRIORITIES.join(', ')}`,
        'INVALID_PRIORITY'
      );
    }

    // 9. verificationMethod
    if (obj.verificationMethod === undefined || obj.verificationMethod === null) {
      throw new SystemRequirementValidationError(
        'SystemRequirement is missing required field: verificationMethod',
        'MISSING_VERIFICATION_METHOD'
      );
    }
    if (typeof obj.verificationMethod !== 'string' || !VALID_SYSTEM_VERIFICATION_METHODS.includes(obj.verificationMethod as SystemRequirementVerificationMethod)) {
      throw new SystemRequirementValidationError(
        `Invalid verificationMethod '${obj.verificationMethod}'. Allowed: ${VALID_SYSTEM_VERIFICATION_METHODS.join(', ')}`,
        'INVALID_VERIFICATION_METHOD'
      );
    }

    // 10. validationMethod (Mandatory for CRITICAL priority)
    if (obj.priority === 'CRITICAL') {
      if (obj.validationMethod === undefined || obj.validationMethod === null || (typeof obj.validationMethod === 'string' && obj.validationMethod.trim() === '')) {
        throw new SystemRequirementValidationError(
          `Critical requirement '${obj.requirementId}' must specify a valid validationMethod`,
          'MISSING_CRITICAL_VALIDATION_METHOD'
        );
      }
    }
    if (obj.validationMethod !== undefined && obj.validationMethod !== null) {
      if (typeof obj.validationMethod !== 'string' || !VALID_SYSTEM_VALIDATION_METHODS.includes(obj.validationMethod as SystemRequirementValidationMethod)) {
        throw new SystemRequirementValidationError(
          `Invalid validationMethod '${obj.validationMethod}'. Allowed: ${VALID_SYSTEM_VALIDATION_METHODS.join(', ')}`,
          'INVALID_VALIDATION_METHOD'
        );
      }
    }

    // 11. status
    if (obj.status === undefined || obj.status === null) {
      throw new SystemRequirementValidationError(
        'SystemRequirement is missing required field: status',
        'MISSING_STATUS'
      );
    }
    if (typeof obj.status !== 'string' || !VALID_SYSTEM_STATUSES.includes(obj.status as SystemRequirementStatus)) {
      throw new SystemRequirementValidationError(
        `Invalid status '${obj.status}'. Allowed: ${VALID_SYSTEM_STATUSES.join(', ')}`,
        'INVALID_STATUS'
      );
    }

    // 12. acceptanceCriteria
    if (obj.acceptanceCriteria === undefined || obj.acceptanceCriteria === null || typeof obj.acceptanceCriteria !== 'string' || obj.acceptanceCriteria.trim() === '') {
      throw new SystemRequirementValidationError(
        `SystemRequirement '${obj.requirementId}' is missing or has empty acceptanceCriteria`,
        'MISSING_ACCEPTANCE_CRITERIA'
      );
    }
    const trimmedCriteria = obj.acceptanceCriteria.trim();
    for (const pattern of BANNED_ACCEPTANCE_CRITERIA_PATTERNS) {
      if (pattern.test(trimmedCriteria)) {
        throw new SystemRequirementValidationError(
          `Invalid acceptanceCriteria '${trimmedCriteria}' for requirement '${obj.requirementId}'. Criteria must be a formal verifiable rule or mathematical expression.`,
          'INVALID_ACCEPTANCE_CRITERIA'
        );
      }
    }

    // 13. Numeric and Unit Validation
    const hasNumericAspect =
      obj.parameter !== undefined ||
      obj.value !== undefined ||
      obj.minimumValue !== undefined ||
      obj.maximumValue !== undefined ||
      obj.targetValue !== undefined ||
      obj.unit !== undefined;

    if (hasNumericAspect) {
      // Must have parameter
      if (obj.parameter === undefined || obj.parameter === null || typeof obj.parameter !== 'string' || obj.parameter.trim() === '') {
        throw new SystemRequirementValidationError(
          `Numeric requirement '${obj.requirementId}' must specify a valid parameter name`,
          'MISSING_PARAMETER'
        );
      }

      // Must have unit
      if (obj.unit === undefined || obj.unit === null || typeof obj.unit !== 'string' || obj.unit.trim() === '') {
        throw new SystemRequirementValidationError(
          `Numeric requirement '${obj.requirementId}' with parameter '${obj.parameter}' is missing a valid engineering unit`,
          'MISSING_UNIT'
        );
      }

      const unitSymbol = obj.unit.trim();
      if (!EngineeringRequirementValidator.isUnitValid(unitSymbol)) {
        throw new SystemRequirementValidationError(
          `Invalid or unsupported engineering unit '${unitSymbol}' in requirement '${obj.requirementId}'`,
          'INVALID_UNIT'
        );
      }

      if (!EngineeringRequirementValidator.isDimensionallyCompatible(obj.parameter as string, unitSymbol)) {
        throw new SystemRequirementValidationError(
          `Dimensionally incompatible parameter '${obj.parameter}' and unit '${unitSymbol}' in requirement '${obj.requirementId}'`,
          'DIMENSIONAL_INCOMPATIBILITY'
        );
      }

      // Validate numeric fields for finite numbers
      const checkNumeric = (name: string, val: unknown) => {
        if (val !== undefined && val !== null) {
          if (typeof val !== 'number' || Number.isNaN(val) || !Number.isFinite(val)) {
            throw new SystemRequirementValidationError(
              `Field '${name}' in requirement '${obj.requirementId}' must be a finite number`,
              'INVALID_NUMERIC_VALUE'
            );
          }
        }
      };

      checkNumeric('value', obj.value);
      checkNumeric('minimumValue', obj.minimumValue);
      checkNumeric('maximumValue', obj.maximumValue);
      checkNumeric('targetValue', obj.targetValue);

      // 14. Consistency Checks: min <= target <= max
      const minVal = obj.minimumValue as number | undefined;
      const maxVal = obj.maximumValue as number | undefined;
      const targetVal = obj.targetValue as number | undefined;

      if (typeof minVal === 'number' && typeof maxVal === 'number') {
        if (minVal > maxVal) {
          throw new SystemRequirementValidationError(
            `Inconsistent bounds in requirement '${obj.requirementId}': minimumValue (${minVal}) exceeds maximumValue (${maxVal})`,
            'INVALID_BOUNDS_RANGE'
          );
        }
      }

      if (typeof minVal === 'number' && typeof targetVal === 'number') {
        if (targetVal < minVal) {
          throw new SystemRequirementValidationError(
            `Inconsistent target in requirement '${obj.requirementId}': targetValue (${targetVal}) is below minimumValue (${minVal})`,
            'TARGET_BELOW_MINIMUM'
          );
        }
      }

      if (typeof maxVal === 'number' && typeof targetVal === 'number') {
        if (targetVal > maxVal) {
          throw new SystemRequirementValidationError(
            `Inconsistent target in requirement '${obj.requirementId}': targetValue (${targetVal}) exceeds maximumValue (${maxVal})`,
            'TARGET_ABOVE_MAXIMUM'
          );
        }
      }

      if (obj.tolerance !== undefined && obj.tolerance !== null) {
        EngineeringRequirementValidator.validateTolerance(obj.tolerance);
      }
    }

    // 15. Mission Lineage check
    if (obj.derivedFromMissionId !== undefined && obj.derivedFromMissionId !== null) {
      if (typeof obj.derivedFromMissionId !== 'string' || obj.derivedFromMissionId.trim() === '') {
        throw new SystemRequirementValidationError(
          `Invalid derivedFromMissionId in requirement '${obj.requirementId}'`,
          'INVALID_MISSION_REFERENCE'
        );
      }
    }

    return obj as unknown as SystemRequirement;
  }

  /**
   * Validates an entire collection of system requirements, ensuring uniqueness of IDs.
   */
  public static validateCollection(requirements: readonly unknown[]): readonly SystemRequirement[] {
    if (!Array.isArray(requirements)) {
      throw new SystemRequirementValidationError(
        'Requirements collection must be an array',
        'INVALID_COLLECTION'
      );
    }

    const validated: SystemRequirement[] = [];
    const seenIds = new Set<string>();

    for (let i = 0; i < requirements.length; i++) {
      const item = requirements[i];
      const validReq = this.validate(item);

      if (seenIds.has(validReq.requirementId)) {
        throw new SystemRequirementValidationError(
          `Duplicate requirementId detected: '${validReq.requirementId}' at index ${i}`,
          'DUPLICATE_REQUIREMENT_ID'
        );
      }
      seenIds.add(validReq.requirementId);
      validated.push(validReq);
    }

    return validated;
  }
}
