/**
 * SECP Industrial OS v2 — PROMPT-064: Zero Hidden Capability Audit Types
 * 
 * CORE CONTRACT:
 * - Direction 1: UI Capability -> Backend Capability (Every declared UI capability has real backend execution)
 * - Direction 2: Backend Capability -> UI Exposure (Every real backend capability accurately classified)
 * - Strict Status Model: "UI-EXPOSED" | "BACKEND-ONLY" | "PHANTOM" | "FAIL" | "UNPROVEN" | "N/A"
 * - No Generic "PASS" as status to prevent hiding the distinction between UI exposure and Backend-only.
 */

export type CapabilityExposureStatus = 
  | 'UI-EXPOSED'
  | 'BACKEND-ONLY'
  | 'PHANTOM'
  | 'FAIL'
  | 'UNPROVEN'
  | 'N/A';

export type GlobalHiddenAuditVerdict =
  | 'ZERO HIDDEN CAPABILITY — FULLY PROVEN'
  | 'PARTIALLY PROVEN'
  | 'NOT PROVEN'
  | 'CRITICAL FAILURE';

export type CapabilityDomain =
  | 'CAD_PARAMETRIC'
  | 'GEOMETRIC_CONSTRAINTS_2D_3D'
  | 'ASSEMBLY_KINEMATICS'
  | 'CAE_STRUCTURAL_FEA'
  | 'CAE_CFD_FLUIDS'
  | 'CAM_5AXIS_CNC'
  | 'MATERIALS_METROLOGY'
  | 'PLM_REVISION_COLLAB'
  | 'FORENSIC_INTEGRITY'
  | 'INTEROP_STEP_STL'
  | 'NURBS_SURFACES'
  | 'TOPOLOGY_MESH';

export interface CapabilityTraceability {
  uiControl?: string;
  uiHandler?: string;
  intent?: string;
  canonicalIntent?: string;
  dispatcher?: string;
  documentMutation?: string;
  evaluator?: string;
  backendKernel: string;
  engineeringComputation: string;
  verifier: string;
  evidenceId: string;
  sha256Proof: string;
}

export interface DeterminismRunRecord {
  runIndex: number;
  hash: string;
  matches: boolean;
}

export interface NegativeAdversarialCheck {
  input: string;
  rejectedCorrectly: boolean;
  errorCode: string;
}

export interface ComprehensiveCapabilityRecord {
  id: string;
  name: string;
  domain: CapabilityDomain;
  sourceFile: string;
  symbol: string;
  exportStatus: 'EXPORTED' | 'INTERNAL';
  callers: string[];
  executionEntryPoint: string;
  requiredInputs: string;
  output: string;
  engineeringMeaning: string;
  kernelSolver: string;
  backendCapability: boolean;
  backendExecutable: boolean;
  engineeringResult: string;
  verification: string;
  evidence: string;
  uiExposed: boolean;
  uiPath: string;
  canonicalPath: string;
  status: CapabilityExposureStatus;
  reason: string;
  traceability: CapabilityTraceability;
  determinismRuns: DeterminismRunRecord[];
  negativeAdversarialResult: NegativeAdversarialCheck;
}

export interface CapabilityExposureTruthMatrixRow {
  capabilityId: string;
  capabilityName: string;
  domain: string;
  backend: boolean;
  executable: boolean;
  engineeringResult: string;
  verified: string;
  evidence: string;
  uiExposed: boolean;
  uiPath: string;
  status: CapabilityExposureStatus;
}

export interface UiToBackendMatrixRow {
  uiCapabilityId: string;
  uiCapabilityName: string;
  uiAction: string;
  backendMatch: 'MATCH' | 'MISMATCH' | 'UNPROVEN';
  canonicalPath: string;
  kernel: string;
  result: string;
  verification: string;
  evidence: string;
  status: CapabilityExposureStatus;
}

export interface BackendToUiMatrixRow {
  backendCapabilityId: string;
  backendCapabilityName: string;
  domain: string;
  realBackend: boolean;
  executable: boolean;
  engineeringValid: boolean;
  uiExposure: boolean;
  exposurePath: string;
  status: CapabilityExposureStatus;
}

export interface DiscoveredBackendCapability {
  id: string;
  name: string;
  domain: CapabilityDomain;
  sourceFile: string;
  symbol: string;
  exportStatus: 'EXPORTED' | 'INTERNAL';
  callers: string[];
  executionEntryPoint: string;
  requiredInputs: string;
  output: string;
  engineeringMeaning: string;
  kernelSolver: string;
  executable: boolean;
  engineeringValid: boolean;
  uiExposed: boolean;
  uiPath: string;
  status: CapabilityExposureStatus;
}

export interface DeclaredUiCapability {
  id: string;
  name: string;
  domain: CapabilityDomain;
  uiControl: string;
  uiSource: string;
  uiHandler: string;
  intent: string;
  canonicalIntent: string;
  dispatcher: string;
  backendSource: string;
  kernelEntryPoint: string;
  status: CapabilityExposureStatus;
}

export interface ReconciliationFinding {
  id: string;
  capabilityId: string;
  direction: 'UI_TO_BACKEND' | 'BACKEND_TO_UI';
  claim: string;
  actualStatus: CapabilityExposureStatus;
  reconciled: boolean;
  discrepancyDetails?: string;
}

export interface ShadowPipelineAuditFinding {
  id: string;
  capabilityId: string;
  capabilityName: string;
  description: string;
  shadowPath: string;
  canonicalPath: string;
  divergenceDetected: boolean;
  severity: 'CLEAN' | 'WARNING' | 'CRITICAL';
}

export interface MockStubScanFinding {
  id: string;
  sourceFile: string;
  line: number;
  snippet: string;
  classification: 'DEFENSIVE_GUARD' | 'INTENTIONAL_FALLBACK' | 'ACTUAL_MOCK' | 'ACTUAL_STUB' | 'TEST_ONLY';
  isProductionMock: boolean;
  explanation: string;
}

export interface FalseSuccessScanFinding {
  id: string;
  capabilityId: string;
  scenario: string;
  reportedStatus: string;
  actualStatus: string;
  isFalseSuccess: boolean;
}

export interface CoverageStatistics {
  totalUiCapabilities: number;
  totalBackendCapabilities: number;
  totalEvaluatedCapabilities: number;
  uiExposedCount: number;
  backendOnlyCount: number;
  phantomCount: number;
  failCount: number;
  unprovenCount: number;
  naCount: number;
  reconciliationRate: number; // percentage
  zeroPhantomRate: number; // percentage
  zeroHiddenRate: number; // percentage
}

export interface ZeroHiddenCapabilityAuditReport {
  timestamp: string;
  statistics: CoverageStatistics;
  verdict: GlobalHiddenAuditVerdict;
  allCapabilities: ComprehensiveCapabilityRecord[];
  discoveredBackendCapabilities: DiscoveredBackendCapability[];
  declaredUiCapabilities: DeclaredUiCapability[];
  exposureTruthMatrix: CapabilityExposureTruthMatrixRow[];
  uiToBackendMatrix: UiToBackendMatrixRow[];
  backendToUiMatrix: BackendToUiMatrixRow[];
  reconciliationFindings: ReconciliationFinding[];
  shadowPipelines: ShadowPipelineAuditFinding[];
  mockStubFindings: MockStubScanFinding[];
  falseSuccessFindings: FalseSuccessScanFinding[];
  criticalFindings: string[];
}
