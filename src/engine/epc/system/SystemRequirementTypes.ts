/**
 * SECP Industrial OS — EPC-017: System Requirements Model & Types
 * Domain-Agnostic Canonical System Requirement Schema, Categories,
 * Traceability Links, Change Impact, and Verification Contracts.
 */

import {
  RequirementTolerance,
  ToleranceType
} from '../EngineeringRequirementTypes';

export type SystemRequirementCategory =
  | 'MISSION'
  | 'PERFORMANCE'
  | 'AERODYNAMICS'
  | 'PROPULSION'
  | 'STRUCTURAL'
  | 'MASS'
  | 'POWER'
  | 'BATTERY'
  | 'THERMAL'
  | 'CONTROL'
  | 'FLIGHT_DYNAMICS'
  | 'PAYLOAD'
  | 'ENDURANCE'
  | 'ENVIRONMENT'
  | 'SAFETY'
  | 'MANUFACTURING'
  | 'MAINTAINABILITY'
  | 'INTEROPERABILITY'
  | string;

export type SystemRequirementType =
  | 'FUNCTIONAL'
  | 'PERFORMANCE'
  | 'PHYSICAL'
  | 'INTERFACE'
  | 'ENVIRONMENTAL'
  | 'STRUCTURAL'
  | 'THERMAL'
  | 'POWER'
  | 'CONTROL'
  | 'MANUFACTURING'
  | 'VERIFICATION'
  | 'VALIDATION';

export type SystemRequirementPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type SystemRequirementVerificationMethod =
  | 'ANALYSIS'
  | 'SIMULATION'
  | 'INSPECTION'
  | 'CALCULATION'
  | 'TEST'
  | 'MEASUREMENT'
  | 'REVIEW';

export type SystemRequirementValidationMethod =
  | 'SIMULATION_VALIDATION'
  | 'PHYSICAL_TEST'
  | 'EXPERIMENTAL_DATA'
  | 'INSPECTION'
  | 'FIELD_TEST'
  | 'INDEPENDENT_VALIDATION'
  | 'EXPERIMENT'
  | 'PROTOTYPE_TEST'
  | 'SIMULATION_CORRELATION';

export type SystemRequirementStatus =
  | 'DRAFT'
  | 'DEFINED'
  | 'IMPLEMENTED'
  | 'VERIFIABLE'
  | 'VERIFIED'
  | 'VALIDATED'
  | 'FAILED'
  | 'INCONCLUSIVE';

export type SystemRequirementSource =
  | 'MISSION_DEFINITION'
  | 'CUSTOMER_REQUIREMENT'
  | 'ENGINEERING_ASSUMPTION'
  | 'REGULATORY_REFERENCE'
  | 'DESIGN_TARGET'
  | 'STANDARDS'
  | string;

export type ExecutionStatus = 'PENDING' | 'PASSED' | 'FAILED' | 'INCONCLUSIVE' | 'NOT_RUN';

export type ExecutionReadinessStatus = 'NOT_READY' | 'READY_FOR_VERIFICATION' | 'BLOCKED';

export interface SystemRequirementChangeRecord {
  readonly revision: string | number;
  readonly timestamp: string;
  readonly changedFields: readonly string[];
  readonly reason?: string;
  readonly author?: string;
  readonly previousValues?: Record<string, unknown>;
}

/**
 * Universal System Engineering Requirement
 */
export interface SystemRequirement {
  readonly requirementId: string;
  readonly caseId: string;
  readonly domain: string;
  readonly category: SystemRequirementCategory;
  readonly title: string;
  readonly description: string;
  readonly type: SystemRequirementType;

  // Quantitative / Parametric Fields (optional for qualitative requirements)
  readonly parameter?: string;
  readonly value?: number;
  readonly unit?: string;
  readonly minimumValue?: number;
  readonly maximumValue?: number;
  readonly targetValue?: number;
  readonly tolerance?: RequirementTolerance;

  // Verification & Validation Contracts
  readonly acceptanceCriteria: string;
  readonly priority: SystemRequirementPriority;
  readonly verificationMethod: SystemRequirementVerificationMethod;
  readonly validationMethod?: SystemRequirementValidationMethod;
  readonly source: SystemRequirementSource;
  readonly status: SystemRequirementStatus;

  // Traceability & Lineage
  readonly parentRequirementId?: string;
  readonly derivedFromMissionId?: string;
  readonly verificationStatus: ExecutionStatus;
  readonly validationStatus: ExecutionStatus;
  readonly verificationEvidenceId?: string;
  readonly validationEvidenceId?: string;

  // Execution Readiness
  readonly readinessStatus: ExecutionReadinessStatus;
  readonly readinessMissingInputs?: readonly string[];

  // Versioning & Provenance
  readonly revision: string | number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly changeHistory?: readonly SystemRequirementChangeRecord[];
  readonly metadata?: Record<string, unknown>;
}

export type DroneSystemRequirement = SystemRequirement;

export class SystemRequirementValidationError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string = 'MALFORMED_SYSTEM_REQUIREMENT',
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SystemRequirementValidationError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, SystemRequirementValidationError.prototype);
  }
}

export interface ChangeImpactResult {
  readonly requirementId: string;
  readonly parameter: string;
  readonly previousValue: unknown;
  readonly newValue: unknown;
  readonly impactedSubsystems: readonly string[];
  readonly impactedDisciplines: readonly string[];
  readonly impactedArtifacts: readonly string[];
  readonly requiresReanalysis: boolean;
  readonly description: string;
}

export interface RequirementCoverageReport {
  readonly totalRequirements: number;
  readonly categoryBreakdown: Record<string, number>;
  readonly priorityBreakdown: Record<SystemRequirementPriority, number>;
  readonly statusBreakdown: Record<SystemRequirementStatus, number>;
  readonly withVerificationPathCount: number;
  readonly withValidationPathCount: number;
  readonly verifiedCount: number;
  readonly validatedCount: number;
  readonly criticalCount: number;
  readonly criticalVerifiedCount: number;
  readonly criticalUnverifiedIds: readonly string[];
  readonly coveragePercentage: number;
  readonly isGateBlocked: boolean;
  readonly gateBlockReason?: string;
}

export interface ReadinessEvaluationResult {
  readonly requirementId: string;
  readonly readinessStatus: ExecutionReadinessStatus;
  readonly isReady: boolean;
  readonly missingInputs: readonly string[];
  readonly reason: string;
}

export interface EPC017ValidationResult {
  readonly epc: 'EPC-017';
  readonly name: 'System Requirements';
  readonly verdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  readonly checks: Record<string, { passed: boolean; message: string; details?: unknown }>;
  readonly evidenceHash: string;
  readonly timestamp: string;
  readonly implementationRevision: string;
}
