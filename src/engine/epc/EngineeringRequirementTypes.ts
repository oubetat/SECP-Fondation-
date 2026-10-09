/**
 * SECP Industrial OS — EPC-002: Engineering Requirement Schema
 * Domain-Agnostic Canonical Engineering Requirement Model and Types.
 */

export type RequirementPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type RequirementVerificationMethod =
  | 'ANALYSIS'
  | 'SIMULATION'
  | 'INSPECTION'
  | 'TEST'
  | 'MEASUREMENT'
  | 'REVIEW';

export type RequirementValidationMethod =
  | 'EXPERIMENT'
  | 'PHYSICAL_TEST'
  | 'FIELD_TEST'
  | 'SIMULATION_CORRELATION'
  | 'PROTOTYPE_TEST'
  | 'INDEPENDENT_VALIDATION';

export type ToleranceType = 'ABSOLUTE' | 'RELATIVE' | 'BOUNDS' | 'EXACT' | 'BAND_PASS';

export interface RequirementTolerance {
  readonly type?: ToleranceType;
  readonly absoluteTolerance?: number;
  readonly relativeTolerance?: number;
  readonly lowerBound?: number;
  readonly upperBound?: number;
  readonly nominalValue?: number;
  readonly description?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface EngineeringRequirement {
  readonly requirementId: string;
  readonly description: string;
  readonly parameter: string;
  readonly unit: string;
  readonly tolerance: RequirementTolerance;
  readonly priority: RequirementPriority;
  readonly verificationMethod: RequirementVerificationMethod;
  readonly validationMethod: RequirementValidationMethod;
  readonly category?: string;
  readonly revision?: string;
  readonly extensions?: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
}

export class EngineeringRequirementValidationError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string = 'MALFORMED_ENGINEERING_REQUIREMENT',
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'EngineeringRequirementValidationError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, EngineeringRequirementValidationError.prototype);
  }
}

export interface EPC002ValidationResult {
  readonly epc: 'EPC-002';
  readonly name: 'Engineering Requirement Schema';
  readonly verdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  readonly checks: Record<string, { passed: boolean; message: string; details?: unknown }>;
  readonly evidenceHash: string;
  readonly timestamp: string;
  readonly implementationRevision: string;
}
