/**
 * SECP Industrial OS v3 — PROMPT-057: Persistence Proof Types
 *
 * Defines the canonical contracts, evidence structures, proof results,
 * and acceptance gate definitions for end-to-end CAD model persistence.
 */

import { EngineeringDocument } from '../cad-kernel/document/CADDocument';

export type PersistenceGateVerdict = 'PASS' | 'FAIL' | 'UNPROVEN';

export interface PersistenceNegativeProofResult {
  proofId: string;
  title: string;
  passed: boolean;
  description: string;
  details: string;
  rejectedPattern: string;
}

export interface PersistencePositiveProofResult {
  proofId: string;
  title: string;
  passed: boolean;
  description: string;
  details: string;
  evidenceHash?: string;
  reconstructedFeatureCount?: number;
}

export interface GateVerificationDetail {
  gateId: string;
  name: string;
  passed: boolean;
  explanation: string;
  metadata?: Record<string, any>;
}

export interface PersistenceEvidencePackage {
  packageId: string;
  timestamp: string;
  documentId: string;
  revisionBeforeSave: number;
  revisionAfterReload: number;
  
  serializedByteLength: number;
  runtimeDestructionConfirmed: boolean;
  
  featureHistoryBefore: { id: string; type: string; parameters: Record<string, any> }[];
  featureHistoryAfter: { id: string; type: string; parameters: Record<string, any> }[];
  
  referenceMapBefore: Record<string, string>;
  referenceMapAfter: Record<string, string>;
  
  dependencyGraphBefore: Record<string, string[]>;
  dependencyGraphAfter: Record<string, string[]>;
  
  geometrySignatureBefore: string;
  geometrySignatureAfter: string;
  
  topologySignatureBefore: string;
  topologySignatureAfter: string;
  
  lineageCountBefore: number;
  lineageCountAfter: number;
  
  volumeBefore: number;
  volumeAfter: number;
  
  regenerationVerified: boolean;
  independentVerificationPassed: boolean;
  merkleRoot: string;
  cryptographicSignature: string;
  verdict: PersistenceGateVerdict;
}

export interface Gate057Report {
  gateId: 'GATE-SECP-057';
  promptId: 'PROMPT-057';
  title: string;
  timestamp: string;
  verdict: PersistenceGateVerdict;
  passedCount: number;
  totalCount: number;
  score: number;
  
  gates: Record<string, GateVerificationDetail>;
  negativeProofs: PersistenceNegativeProofResult[];
  positiveProofs: PersistencePositiveProofResult[];
  evidencePackage: PersistenceEvidencePackage;
  criticalFailuresDetected: string[];
  cryptographicSignature: string;
  provenanceLedgerEntry: {
    ledgerIndex: 57;
    parentGate: 'GATE-SECP-056';
    merkleRoot: string;
  };
}
