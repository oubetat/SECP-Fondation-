/**
 * SECP Industrial OS v3 — PROMPT-056: Tool Qualification Types
 * Type definitions for Tool-by-Tool End-to-End Engineering Qualification.
 */

export type ToolLifecycleStage =
  | 'CREATE'
  | 'MODIFY'
  | 'REGENERATE'
  | 'UNDO'
  | 'REDO'
  | 'SAVE'
  | 'RELOAD'
  | 'VERIFY';

export type ToolStageVerdict = 'PASS' | 'FAIL' | 'UNSUPPORTED';

export interface ToolQualificationRecord {
  toolId: string;
  capability: string;
  workbench: string;
  isSupported: boolean;
  stages: Record<ToolLifecycleStage, ToolStageVerdict>;
  stageDetails: Record<ToolLifecycleStage, string>;
  finalVerdict: 'PASS' | 'FAIL' | 'UNSUPPORTED';
  beforeHash?: string;
  afterHash?: string;
  reloadedHash?: string;
  evidenceHash?: string;
}

export interface ToolNegativeProofResult {
  proofId: string; // TP-NEG-001 ... TP-NEG-024
  title: string;
  passed: boolean;
  description: string;
  details: string;
}

export interface ToolPositiveProofResult {
  proofId: string; // TP-POS-001 ... TP-POS-008
  title: string;
  passed: boolean;
  description: string;
  details: string;
}

export interface Gate056Report {
  gateId: 'GATE-SECP-056';
  promptId: 'PROMPT-056';
  title: 'Tool-by-Tool End-to-End Engineering Qualification Gate';
  timestamp: string;
  verdict: 'PASS' | 'FAIL';
  passedCount: number;
  totalCount: number;
  score: number; // 0 - 100
  matrix: ToolQualificationRecord[];
  negativeProofs: ToolNegativeProofResult[];
  positiveProofs: ToolPositiveProofResult[];
  criticalFailuresDetected: string[];
  cryptographicSignature: string;
  provenanceLedgerEntry: {
    ledgerIndex: number;
    parentGate: string;
    merkleRoot: string;
  };
}
