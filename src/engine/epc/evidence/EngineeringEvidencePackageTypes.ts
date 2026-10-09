/**
 * SECP Industrial OS — EPC-009: Engineering Evidence Package Types
 */

import { EngineeringRequirement } from '../EngineeringRequirementTypes';
import { SimulationScenario } from '../../simulation/SimulationScenarioTypes';
import { EvidenceIntegrityRecord } from './EvidenceIntegrityTypes';
import { EvidenceProvenance } from './EvidenceProvenanceTypes';

export enum EvidencePackageLifecycle {
  DRAFT = 'DRAFT',
  ASSEMBLED = 'ASSEMBLED',
  VALIDATED = 'VALIDATED',
  SEALED = 'SEALED',
  SUPERSEDED = 'SUPERSEDED'
}

export enum EvidenceVerdictStatus {
  PASS = 'PASS',
  FAIL = 'FAIL',
  INCONCLUSIVE = 'INCONCLUSIVE'
}

export interface RequirementReference {
  requirementId: string;
  revision: string;
  status: string;
  verificationStatus: string;
  traceabilityReference?: string;
  priority: string;
}

export interface DesignReference {
  modelId: string;
  revision: string;
  hash?: string;
  assembly?: string;
  components?: string[];
  materials?: string[];
  parameters?: Record<string, any>;
  configurationId?: string;
}

export interface AnalysisRecord {
  analysisId: string;
  type: string; // FEA, CFD, etc.
  revision: string;
  scenarioId: string;
  scenarioRevision: string;
  status: string;
  executionReference?: string;
  inputReferences?: string[];
}

export interface ResultRecord {
  resultId: string;
  analysisId: string;
  metric: string;
  value: any;
  unit: string;
  tolerance?: string;
  status: EvidenceVerdictStatus;
  source: string;
  revision: string;
}

export interface TestRecord {
  testId: string;
  testType: string;
  description: string;
  expectedResult: string;
  actualResult: string;
  acceptanceCriteria: string;
  status: EvidenceVerdictStatus;
  executionReference?: string;
}

export interface MeasurementRecord {
  measurementId: string;
  variable: string;
  value: any;
  unit: string;
  sensor?: string;
  calibrationReference?: string;
  timestamp: string;
  uncertainty?: string;
  testCondition?: string;
  source: string;
}

export interface EvidenceReference {
  evidenceId: string;
  evidenceType: string; // Design, Simulation, Test, etc.
  sourceReference: string;
  contentHash: string;
  createdAt: string;
  createdBy: string;
  revision: string;
  provenanceReference?: string;
}

export interface VerdictRecord {
  verdictId: string;
  subjectId: string;
  criteria: string;
  evidenceReferences: string[];
  status: EvidenceVerdictStatus;
  reason: string;
  timestamp: string;
}

export interface EngineeringEvidencePackage {
  packageId: string;
  caseId: string;
  revision: string;
  status: EvidencePackageLifecycle;
  requirements: RequirementReference[];
  design: DesignReference[];
  analyses: AnalysisRecord[];
  results: ResultRecord[];
  tests: TestRecord[];
  measurements: MeasurementRecord[];
  evidence: EvidenceReference[];
  verdicts: VerdictRecord[];
  provenance: string;
  integrityRecords: Record<string, EvidenceIntegrityRecord>;
  provenanceRecords: Record<string, EvidenceProvenance>;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  canonicalHash?: string;
  epcNumber?: string;
  title?: string;
  metadata?: Record<string, any>;
}

export enum EvidencePackageError {
  INVALID_PACKAGE = 'INVALID_PACKAGE',
  MISSING_REQUIREMENT = 'MISSING_REQUIREMENT',
  CRITICAL_REQUIREMENT_UNTRACED = 'CRITICAL_REQUIREMENT_UNTRACED',
  MISSING_DESIGN_REFERENCE = 'MISSING_DESIGN_REFERENCE',
  MISSING_ANALYSIS_SCENARIO = 'MISSING_ANALYSIS_SCENARIO',
  RESULT_ORPHANED = 'RESULT_ORPHANED',
  EVIDENCE_SOURCE_MISSING = 'EVIDENCE_SOURCE_MISSING',
  VERDICT_WITHOUT_EVIDENCE = 'VERDICT_WITHOUT_EVIDENCE',
  HARDCODED_VERDICT_DETECTED = 'HARDCODED_VERDICT_DETECTED',
  SEALED_PACKAGE_MODIFICATION = 'SEALED_PACKAGE_MODIFICATION',
  INCOMPLETE_TRUTH_CHAIN = 'INCOMPLETE_TRUTH_CHAIN',
  INTEGRITY_FAILURE = 'INTEGRITY_FAILURE',
  PROVENANCE_MISSING = 'PROVENANCE_MISSING'
}

export interface PackageValidationResult {
  status: 'COMPLETE' | 'INCOMPLETE' | 'INVALID';
  verdict: EvidenceVerdictStatus;
  errors: EvidencePackageError[];
  traceabilityScore: number; // 0 to 1
}
