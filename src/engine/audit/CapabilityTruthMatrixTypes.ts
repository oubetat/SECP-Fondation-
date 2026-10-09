/**
 * SECP Industrial OS v2 — PROMPT-062: Capability Truth Matrix
 * Core Type Definitions & Zero-Claim Verification Schema
 */

export type ToolTruthStatus = 'PASS' | 'FAIL' | 'N/A' | 'UNPROVEN';

export type CapabilityTruthVerdict = 
  | 'FULLY PROVEN' 
  | 'PARTIALLY PROVEN' 
  | 'NOT PROVEN' 
  | 'CRITICAL FAILURE';

export interface ToolProofCard {
  toolId: string;
  toolName: string;
  domain: string;
  
  ui: {
    status: ToolTruthStatus;
    sourceFile: string;
    symbol: string;
    userAction: string;
    component: string;
    runtimeProof: string;
    testId: string;
  };

  canonical: {
    status: ToolTruthStatus;
    sourceFile: string;
    intentType: string;
    dispatcher: string;
    documentMutation: string;
    evaluator: string;
    runtimeProof: string;
    testId: string;
  };

  kernel: {
    status: ToolTruthStatus;
    sourceFile: string;
    entryPoint: string;
    computation: string;
    resultSummary: string;
    runtimeProof: string;
    testId: string;
  };

  e2e: {
    status: ToolTruthStatus;
    executionPath: string;
    runtimeExecutionProof: string;
    determinismProof: string;
    negativeValidationProof: string;
    testId: string;
  };

  verified: {
    status: ToolTruthStatus;
    verificationId: string;
    verifierFile: string;
    verifierMethod: string;
    independentProof: string;
    isSelfAttested: boolean;
    testId: string;
  };

  evidence: {
    status: ToolTruthStatus;
    evidenceId: string;
    evidenceEngineFile: string;
    payloadStructure: string;
    hashProof: string;
    provenanceLink: string;
    testId: string;
  };
}

export interface TruthMatrixRow {
  toolId: string;
  toolName: string;
  domain: string;
  ui: ToolTruthStatus;
  canonical: ToolTruthStatus;
  kernel: ToolTruthStatus;
  e2e: ToolTruthStatus;
  verified: ToolTruthStatus;
  evidence: ToolTruthStatus;
  applicableCells: number;
  passCells: number;
  unprovenCells: number;
  failCells: number;
  naCells: number;
}

export interface CapabilityTruthReport {
  timestamp: string;
  totalTools: number;
  totalCells: number;
  applicableCells: number;
  passCells: number;
  failCells: number;
  unprovenCells: number;
  naCells: number;
  e2ePassCount: number;
  verifiedPassCount: number;
  evidencePassCount: number;
  criticalFailuresCount: number;
  truthScore: number | 'NOT COMPUTABLE';
  finalVerdict: CapabilityTruthVerdict;
  matrix: TruthMatrixRow[];
  proofCards: ToolProofCard[];
}
