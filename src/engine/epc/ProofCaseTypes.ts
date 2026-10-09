/**
 * SECP Industrial OS — EPC-001: Proof Case Project Schema
 * Domain-Agnostic Canonical Engineering Proof Case Project Model.
 */

export type ProofCaseType =
  | 'PRODUCT'
  | 'SYSTEM'
  | 'PROCESS'
  | 'CROSS_DOMAIN'
  | 'PHYSICAL_VALIDATION'
  | (string & {});

export type ProofCaseDomain =
  | 'AEROSPACE'
  | 'ROBOTICS'
  | 'AUTOMOTIVE'
  | 'FLUID_SYSTEMS'
  | 'THERMAL'
  | 'MANUFACTURING'
  | 'GENERAL_ENGINEERING'
  | (string & {});

export type ProofCaseStatus =
  | 'DRAFT'
  | 'DEFINED'
  | 'ACTIVE'
  | 'VERIFICATION'
  | 'VALIDATED'
  | 'CLOSED'
  | 'FAILED';

export interface ProofCaseRevision {
  readonly revisionId: string;
  readonly branchName?: string;
  readonly timestamp?: string;
  readonly parentRevisionId?: string;
  readonly author?: string;
  readonly changeSummary?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface ProofCaseOwner {
  readonly ownerId: string;
  readonly name?: string;
  readonly email?: string;
  readonly organizationId?: string;
  readonly role?: string;
}

export interface ProofCaseRequirementReference {
  readonly requirementId: string;
  readonly title: string;
  readonly category?: string;
  readonly revision?: string;
  readonly status?: string;
  readonly uri?: string;
  readonly metadata?: Record<string, unknown>;
}

export type ProofCaseModelType =
  | 'CAD'
  | 'FEA'
  | 'CFD'
  | 'THERMAL'
  | 'DYNAMICS'
  | 'CONTROL'
  | 'MANUFACTURING'
  | 'DIGITAL_TWIN'
  | (string & {});

export interface ProofCaseModelReference {
  readonly modelId: string;
  readonly modelType: ProofCaseModelType;
  readonly name: string;
  readonly revision?: string;
  readonly format?: string;
  readonly checksum?: string;
  readonly uri?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface ProofCaseSimulationReference {
  readonly simulationId: string;
  readonly name: string;
  readonly solverType?: string;
  readonly status?: string;
  readonly resultHash?: string;
  readonly uri?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface ProofCaseManufacturingReference {
  readonly definitionId: string;
  readonly name: string;
  readonly processType?: string;
  readonly status?: string;
  readonly routingId?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface ProofCaseTestReference {
  readonly testId: string;
  readonly name: string;
  readonly testType?: string;
  readonly status?: string;
  readonly result?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface ProofCaseEvidenceReference {
  readonly evidenceId: string;
  readonly evidenceType?: string;
  readonly resultHash?: string;
  readonly payloadHash?: string;
  readonly timestamp?: string;
  readonly verificationStatus?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface ProofCaseProject {
  readonly caseId: string;
  readonly caseType: ProofCaseType;
  readonly domain: ProofCaseDomain;
  readonly revision: string | ProofCaseRevision;
  readonly status: ProofCaseStatus;
  readonly owner: string | ProofCaseOwner;
  readonly requirements: readonly ProofCaseRequirementReference[];
  readonly models: readonly ProofCaseModelReference[];
  readonly simulations: readonly ProofCaseSimulationReference[];
  readonly manufacturing: readonly ProofCaseManufacturingReference[];
  readonly tests: readonly ProofCaseTestReference[];
  readonly evidence: readonly ProofCaseEvidenceReference[];
  readonly extensions?: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
}

export class ProofCaseValidationError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, code: string = 'MALFORMED_EPC_PROJECT', details?: Record<string, unknown>) {
    super(message);
    this.name = 'ProofCaseValidationError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ProofCaseValidationError.prototype);
  }
}

export interface EPC001ValidationResult {
  readonly epc: 'EPC-001';
  readonly name: 'Proof Case Project Schema';
  readonly verdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  readonly checks: Record<string, { passed: boolean; message: string; details?: unknown }>;
  readonly evidenceHash: string;
  readonly timestamp: string;
  readonly implementationRevision: string;
}
