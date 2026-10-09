/**
 * SECP Industrial OS v3 — PATCH-185: External Validation Package Types
 * Defines data structures for independent industrial validation, external reproduction,
 * independent oracles, and cross-environment validation certification.
 */

import { 
  EngineeringDomain, 
  ModelPackage, 
  MaterialsPackage, 
  BoundaryConditionsPackage, 
  MeshPackage, 
  SolverSettingsPackage, 
  DeterministicSeedPackage, 
  RuntimeSpecPackage, 
  EvidencePackage, 
  ResultPackage 
} from '../reproducibility/ReproducibilityTypes';

export type ValidationStatus = 'PENDING' | 'PASSED' | 'PASSED_WITHIN_UNCERTAINTY' | 'MARGINAL' | 'FAIL' | 'INCONCLUSIVE' | 'INVALIDATED';

export type ReferenceSourceType = 
  | 'ANALYTICAL_REFERENCE' 
  | 'EXPERIMENTAL_REFERENCE' 
  | 'CERTIFIED_BENCHMARK' 
  | 'PUBLISHED_BENCHMARK' 
  | 'INDEPENDENT_NUMERICAL_REFERENCE';

export interface ValidationTolerance {
  metric: string;
  unit: string;
  absoluteTolerance: number;
  relativeTolerance: number;
  acceptanceRule: 'STRICT_LOWER' | 'STRICT_UPPER' | 'BAND_PASS' | 'PERCENTAGE_DEVIATION';
  uncertainty: number;
  confidenceLevel: number; // e.g., 0.95 for 95%
}

export interface ToleranceContract {
  contractId: string;
  version: string;
  tolerances: ValidationTolerance[];
  isLocked: boolean;
  lockTimestamp?: string;
}

export interface ExpectedReference {
  referenceId: string;
  sourceType: ReferenceSourceType;
  methodDescription: string;
  referenceSource: string; // URL, DOI, or Certificate ID
  uncertainty: number;
  expectedValues: Record<string, number | number[] | any>;
  referenceHash: string;
}

export interface IndependentOracleSpec {
  oracleId: string;
  oracleType: 'ANALYTICAL_SOLVER' | 'INDEPENDENT_SOLVER_ENGINE' | 'EXPERIMENTAL_INTERPOLATOR' | 'HIGH_PRECISION_REF_LOOKUP';
  version: string;
  logicHash: string;
  description: string;
}

export interface ReplayInstructions {
  prerequisites: string[];
  environmentSetup: string[];
  packageVerificationSteps: string[];
  executionCommands: string[];
  expectedRuntimeSeconds: number;
  oracleExecutionSteps: string[];
  comparisonProcedure: string;
}

export interface ExternalValidationManifest {
  packageId: string;
  packageVersion: string;
  schemaVersion: string;
  createdAt: string;
  validationDomain: EngineeringDomain;
  modelHash: string;
  inputHash: string;
  solverHash: string;
  oracleHash: string;
  referenceHash: string;
  resultHash: string;
  environmentHash: string;
  rootHash: string;
  validationStatus: ValidationStatus;
}

export interface ExternalValidationPackage {
  manifest: ExternalValidationManifest;
  model: ModelPackage;
  inputs: {
    materials: MaterialsPackage;
    boundaryConditions: BoundaryConditionsPackage;
    mesh: MeshPackage;
    seeds: DeterministicSeedPackage;
    extraParameters: Record<string, any>;
  };
  solverConfiguration: SolverSettingsPackage;
  expectedReference: ExpectedReference;
  independentOracle: IndependentOracleSpec;
  toleranceContract: ToleranceContract;
  result: ResultPackage;
  environment: RuntimeSpecPackage;
  replayInstructions: ReplayInstructions;
  evidence: EvidencePackage;
  hashes: {
    modelHash: string;
    inputHash: string;
    solverHash: string;
    oracleHash: string;
    referenceHash: string;
    resultHash: string;
    environmentHash: string;
    packageHash: string;
  };
  provenance: {
    creationChain: string[];
    certificationHistory: Array<{ timestamp: string; status: ValidationStatus; signatory: string }>;
  };
}

export interface ValidationComparisonResult {
  metric: string;
  secpValue: number | number[];
  referenceValue: number | number[];
  deviationAbsolute: number;
  deviationRelative: number;
  toleranceAbsolute: number;
  toleranceRelative: number;
  status: ValidationStatus;
  message?: string;
}

export interface ValidationReport {
  reportId: string;
  timestamp: string;
  packageId: string;
  validatorVersion: string;
  oracleStatus: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  replayStatus: 'SUCCESS' | 'FAILED' | 'PARTIAL';
  comparisonResults: ValidationComparisonResult[];
  finalVerdict: ValidationStatus;
  evidenceHash: string;
  rootHash: string;
}

export interface ValidationCertificate {
  certificateId: string;
  packageId: string;
  validationId: string;
  validatorVersion: string;
  oracleVersion: string;
  environmentFingerprint: string;
  referenceType: ReferenceSourceType;
  toleranceContractId: string;
  resultHash: string;
  evidenceHash: string;
  rootHash: string;
  replayStatus: string;
  finalVerdict: ValidationStatus;
  timestamp: string;
  signature: string;
}
