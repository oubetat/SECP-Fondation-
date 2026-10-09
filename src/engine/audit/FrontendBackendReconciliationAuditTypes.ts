/**
 * SECP Industrial OS v2 — PROMPT-061: Frontend/Backend Reconciliation Audit
 * Core Type Definitions & Zero-Assumption Reconciliation Interfaces
 */

export type ReconciliationStatus = 'PASS' | 'FAIL' | 'N/A' | 'UNPROVEN';

export type GlobalReconciliationVerdict = 
  | 'RECONCILED' 
  | 'PARTIALLY RECONCILED' 
  | 'NOT RECONCILED' 
  | 'UNPROVEN';

export type ToolDomain = 
  | 'CAD_PARAMETRIC'
  | 'CAD_SKETCH'
  | 'CAD_DIRECT_HYBRID'
  | 'ASSEMBLY_KINEMATICS'
  | 'FEM_STRUCTURAL'
  | 'CFD_FLUID'
  | 'CAM_MANUFACTURING'
  | 'MATERIALS_METROLOGY'
  | 'PLM_REVISION_COLLAB'
  | 'EVIDENCE_VERIFICATION';

export type LayerName = 
  | 'UI'
  | 'BACKEND'
  | 'INTENT'
  | 'DOCUMENT'
  | 'EVALUATOR'
  | 'KERNEL'
  | 'BREP'
  | 'TOPOLOGY'
  | 'VERIFICATION'
  | 'EVIDENCE';

/**
 * Detailed Layer-Level Assertion (1 of the 140 Assertions)
 */
export interface LayerAssertionDetail {
  assertionId: string;
  toolId: string;
  toolName: string;
  layer: LayerName;
  status: ReconciliationStatus;
  sourceFile: string;
  symbol: string;
  executionPath: string;
  testId: string;
  runtimeResult: string;
  verificationResult: string;
  evidenceId: string;
  isApplicable: boolean;
  notes?: string;
}

/**
 * Report 01: Frontend Capability Details
 */
export interface FrontendCapabilityEntry {
  toolId: string;
  toolName: string;
  domain: ToolDomain;
  uiLocation: string;
  uiComponent: string;
  userAction: string;
  commandOrEvent: string;
  intentProduced: string;
  backendEndpointOrDispatcher: string;
  documentInteraction: string;
  evaluatorInteraction: string;
  kernelInteraction: string;
  resultRendering: string;
  verificationVisibility: boolean;
  evidenceVisibility: boolean;
  isVisualPlaceholderOnly: boolean;
  isDeadButton: boolean;
  hasFakeSuccess: boolean;
  sourceFile: string;
  lineSymbol: string;
}

/**
 * Report 02: Backend Engineering Capability Details
 */
export interface BackendCapabilityEntry {
  capabilityId: string;
  capabilityName: string;
  domain: ToolDomain;
  backendEntryPoint: string;
  intentHandler: string;
  documentMutation: string;
  evaluator: string;
  kernelOperation: string;
  geometryResultType: string;
  bRepResult: 'SOLID' | 'SHELL' | 'FACE' | 'WIRE' | 'N/A';
  topologyResult: 'VERTEX_EDGE_FACE_LOOP' | 'MESH_DISCRETIZATION' | 'KINEMATIC_GRAPH' | 'N/A';
  verificationMechanism: string;
  evidenceGeneration: string;
  persistenceOrSerialization: string;
  testCoverage: string[];
  runtimeExecutionEvidence: string;
  isMockOrStubInProduction: boolean;
  isOrphanBackend: boolean;
  backendOrphanCategory?: 'API_AUTOMATION' | 'INFRASTRUCTURE' | 'INTERNAL_ENGINEERING' | 'MISSING_UI';
  sourceFile: string;
}

/**
 * Report 03: Layer-by-Layer Cross Reconciliation Matrix Row
 */
export interface ToolReconciliationMatrixRow {
  toolId: string;
  toolName: string;
  domain: ToolDomain;
  ui: ReconciliationStatus;
  backend: ReconciliationStatus;
  intent: ReconciliationStatus;
  document: ReconciliationStatus;
  evaluator: ReconciliationStatus;
  kernel: ReconciliationStatus;
  bRep: ReconciliationStatus;
  topology: ReconciliationStatus;
  verification: ReconciliationStatus;
  evidence: ReconciliationStatus;
  applicableLayersCount: number;
  passedLayersCount: number;
  verdict: ReconciliationStatus;
  notes: string;
}

/**
 * Report 04: Tool Execution Trace (For ALL 14 Tools)
 */
export interface ToolExecutionTrace {
  toolId: string;
  toolName: string;
  domain: ToolDomain;
  chain: {
    uiSource: string;
    intentSource: string;
    backendSource: string;
    documentMutation: string;
    evaluator: string;
    kernel: string;
    geometryBRep: string;
    topology: string;
    verification: string;
    evidence: string;
  };
  provenanceChain: {
    actualEngineeringResult: string;
    independentVerification: string;
    canonicalEvidencePayload: string;
    sha256Proof: string;
    provenanceIntegrity: string;
  };
  negativeProofVerified: boolean;
  determinismVerified: boolean;
  testReferences: string[];
  runtimeVerified: boolean;
  hasBreakPoint: boolean;
  breakPointDetails?: string;
}

/**
 * Report 05: Orphan Capabilities
 */
export interface OrphanAnalysisReport {
  scanMethodology: string;
  totalProductionComponentsScanned: number;
  totalBackendModulesScanned: number;
  frontendOrphans: {
    toolId: string;
    toolName: string;
    uiLocation: string;
    reason: string;
  }[];
  backendOrphans: {
    capabilityId: string;
    capabilityName: string;
    purposeCategory: 'API_AUTOMATION' | 'INFRASTRUCTURE' | 'INTERNAL_ENGINEERING' | 'MISSING_UI';
    sourceFile: string;
    isFailure: boolean;
  }[];
}

/**
 * Report 06: False Capabilities / Mocks / Stubs
 */
export interface FalseCapabilityAuditFinding {
  toolOrFile: string;
  findingType: 'MOCK_IN_PRODUCTION' | 'STUB_FUNCTION' | 'HARDCODED_VERDICT' | 'UI_ONLY_SIMULATION' | 'FABRICATED_EVIDENCE' | 'NO_OP_HANDLER';
  severity: 'CRITICAL' | 'MAJOR' | 'BENIGN';
  description: string;
  sourceLocation: string;
  remediated: boolean;
}

export interface FalseCapabilityScanReport {
  scanScope: string;
  filesInspectedCount: number;
  regexPatternsTested: string[];
  totalMatchesEvaluated: number;
  productionMockCount: number;
  productionStubCount: number;
  hardcodedVerdictCount: number;
  findings: FalseCapabilityAuditFinding[];
}

/**
 * Report 07: Verification & Evidence Traceability
 */
export interface VerificationEvidenceTraceEntry {
  toolId: string;
  toolName: string;
  resultBound: boolean;
  validationBound: boolean;
  verifierIdentity: string;
  isSelfAttested: boolean;
  deterministicHash: boolean;
  canonicalSerialization: boolean;
  cryptographicProof: string;
  provenanceTraceable: boolean;
  evidenceId: string;
}

/**
 * Report 08: Critical Breakpoints
 */
export interface CriticalBreakpointEntry {
  toolId: string;
  layer: LayerName;
  reason: string;
  impact: string;
}

/**
 * Full Complete Audit Package
 */
export interface FullReconciliationAuditPackage {
  auditTimestamp: string;
  totalToolsAudited: number;
  totalAssertionsCount: number; // Exactly 140
  applicableAssertionsCount: number; // Exactly 140 - N/A count
  passedApplicableAssertionsCount: number;
  failedAssertionsCount: number;
  unprovenAssertionsCount: number;
  naAssertionsCount: number;
  
  frontendToolsCount: number;
  backendCapabilitiesCount: number;
  fullyReconciledCount: number;
  partiallyReconciledCount: number;
  notReconciledCount: number;
  unprovenCount: number;
  criticalFailuresCount: number;
  orphanFrontendCount: number;
  orphanBackendCount: number;
  fakeStubMockFindingsCount: number;
  verificationFailuresCount: number;
  evidenceFailuresCount: number;
  finalVerdict: GlobalReconciliationVerdict;
  traceableScorePercent: number | 'NOT COMPUTABLE';
  
  // The 140 Layer Assertions Detailed Table
  assertionsMatrix: LayerAssertionDetail[];

  // The 8 Canonical Deliverable Reports
  report01_FrontendCapabilities: FrontendCapabilityEntry[];
  report02_BackendCapabilities: BackendCapabilityEntry[];
  report03_ReconciliationMatrix: ToolReconciliationMatrixRow[];
  report04_ExecutionTraces: ToolExecutionTrace[];
  report05_OrphanAnalysis: OrphanAnalysisReport;
  report06_FalseCapabilityScan: FalseCapabilityScanReport;
  report07_VerificationEvidenceTrace: VerificationEvidenceTraceEntry[];
  report08_CriticalBreakpoints: CriticalBreakpointEntry[];
}
