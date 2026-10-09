/**
 * SECP Industrial OS v2 — PROMPT-063: Zero Phantom Capability Audit
 * Core Type Definitions & Phantom Capability Elimination Schema
 */

export type CapabilityVerdict = 
  | 'PASS' 
  | 'FAIL' 
  | 'PHANTOM' 
  | 'UNPROVEN' 
  | 'N/A';

export type UiBackendMatchStatus = 
  | 'MATCH' 
  | 'MISMATCH' 
  | 'UNPROVEN' 
  | 'N/A';

export type GlobalPhantomAuditVerdict = 
  | 'ZERO PHANTOM — FULLY PROVEN'
  | 'ZERO PHANTOM — PARTIALLY PROVEN'
  | 'PHANTOM CAPABILITIES DETECTED'
  | 'NOT PROVEN'
  | 'CRITICAL FAILURE';

export type FindingSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface PhantomCapabilityFinding {
  id: string;
  capabilityId: string;
  capabilityName: string;
  uiClaim: string;
  missingOrFalseBackendCapability: string;
  evidence: string;
  severity: FindingSeverity;
}

export interface OrphanBackendEntry {
  id: string;
  backendCapability: string;
  backendEntry: string;
  uiPath: string;
  isReachable: boolean;
  verdict: CapabilityVerdict;
  category: 'API_AUTOMATION' | 'INFRASTRUCTURE' | 'INTERNAL_ENGINEERING' | 'DISCONNECTED_ORPHAN';
}

export interface ShadowPipelineFinding {
  id: string;
  capabilityId: string;
  description: string;
  shadowPath: string;
  canonicalPath: string;
  divergenceDetected: boolean;
}

export interface MockStubFinding {
  id: string;
  sourceFile: string;
  line: number;
  snippet: string;
  isProductionMock: boolean;
  isDefensiveCode: boolean;
  explanation: string;
}

export interface FalseSuccessFinding {
  id: string;
  capabilityId: string;
  scenario: string;
  reportedStatus: string;
  actualStatus: string;
  isFalseSuccess: boolean;
}

export interface FullCapabilityRecord {
  capabilityId: string; // PHC-001 ... PHC-014
  capabilityName: string;
  domain: string;
  
  // UI Layer
  uiDeclaration: string;
  uiSource: string;
  uiSymbol: string;
  uiHandler: string;
  uiActionTrigger: string;
  uiStatus: CapabilityVerdict;

  // Canonical Pipeline
  intent: string;
  canonicalIntent: string;
  dispatcher: string;
  documentMutation: string;
  evaluator: string;
  canonicalStatus: CapabilityVerdict;

  // Backend / Kernel / Solver
  backendSource: string;
  kernelEntryPoint: string;
  computationSummary: string;
  engineeringResult: string;
  kernelStatus: CapabilityVerdict;

  // Verification
  verifierFile: string;
  verifierMethod: string;
  verificationAudit: string;
  isSelfAttested: boolean;
  verificationStatus: CapabilityVerdict;

  // Evidence
  evidenceId: string;
  evidenceFile: string;
  evidencePayloadSummary: string;
  sha256Proof: string;
  evidenceStatus: CapabilityVerdict;

  // E2E Provenance & Integrity
  e2ePath: string;
  e2eStatus: CapabilityVerdict;
  
  // UI/Backend Equality
  uiBackendMatch: UiBackendMatchStatus;
  
  // Determinism & Negative Validation
  determinismRuns: { runIndex: number; hash: string; matches: boolean }[];
  negativeAdversarialResult: { input: string; rejectedCorrectly: boolean; errorCode: string };

  finalVerdict: CapabilityVerdict;
}

export interface TruthMatrixAuditRow {
  capabilityId: string;
  capabilityName: string;
  domain: string;
  ui: CapabilityVerdict;
  handler: CapabilityVerdict;
  intent: CapabilityVerdict;
  canonical: CapabilityVerdict;
  backend: CapabilityVerdict;
  kernel: CapabilityVerdict;
  result: CapabilityVerdict;
  verified: CapabilityVerdict;
  evidence: CapabilityVerdict;
  uiBackendMatch: UiBackendMatchStatus;
  verdict: CapabilityVerdict;
}

export interface ZeroPhantomAuditReport {
  timestamp: string;
  totalCapabilities: number;
  totalUiDeclaredCapabilities: number;
  totalBackendCapabilities: number;
  
  reconciledMatchesCount: number;
  reconciledMismatchesCount: number;
  reconciledUnprovenCount: number;
  
  totalMatrixCells: number; // 14 * 10 columns = 140
  applicableMatrixCells: number;
  passedMatrixCells: number;
  failedMatrixCells: number;
  unprovenMatrixCells: number;
  naMatrixCells: number;
  
  truthScore: number | 'NOT COMPUTABLE';
  finalVerdict: GlobalPhantomAuditVerdict;

  phantomCapabilities: PhantomCapabilityFinding[];
  orphanBackendCapabilities: OrphanBackendEntry[];
  shadowPipelines: ShadowPipelineFinding[];
  mockStubFindings: MockStubFinding[];
  falseSuccessFindings: FalseSuccessFinding[];
  
  capabilities: FullCapabilityRecord[];
  matrix: TruthMatrixAuditRow[];
}
