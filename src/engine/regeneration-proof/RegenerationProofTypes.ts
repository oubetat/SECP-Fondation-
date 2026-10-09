/**
 * SECP Industrial OS v3 — PROMPT-058: Regeneration Proof Types
 *
 * Defines the canonical contracts, evidence structures, proof results,
 * and acceptance gate definitions for deterministic, dependency-aware
 * feature regeneration across the CAD kernel.
 */

import { EngineeringDocument } from '../cad-kernel/document/CADDocument';

export type RegenerationGateVerdict = 'PASS' | 'FAIL' | 'UNPROVEN';

export interface RegenerationNegativeProofResult {
  proofId: string;
  title: string;
  passed: boolean;
  description: string;
  details: string;
  rejectedPattern: string;
}

export interface RegenerationPositiveProofResult {
  proofId: string;
  title: string;
  passed: boolean;
  description: string;
  details: string;
  evidenceHash?: string;
  regeneratedFeatureCount?: number;
}

export interface GateVerificationDetail {
  gateId: string;
  name: string;
  passed: boolean;
  explanation: string;
  metadata?: Record<string, any>;
}

export interface RegenerationEvidencePackage {
  packageId: string;
  timestamp: string;
  documentId: string;
  revisionBefore: number;
  revisionAfter: number;

  featureHistoryBefore: { id: string; type: string; parameters: Record<string, any>; state: string }[];
  featureHistoryAfter: { id: string; type: string; parameters: Record<string, any>; state: string }[];

  dependencyGraphBefore: Record<string, string[]>;
  dependencyGraphAfter: Record<string, string[]>;

  earlyFeatureMutation: {
    featureId: string;
    parameterName: string;
    valueBefore: any;
    valueAfter: any;
  };

  invalidatedFeatureSet: string[];
  evaluationOrder: string[];
  evaluatorExecutions: { featureId: string; status: string; executionTimeMs: number }[];
  kernelExecutions: { operation: string; shapeType: string; vertexCount: number; faceCount: number }[];

  geometrySignatureBefore: string;
  geometrySignatureAfter: string;

  topologySignatureBefore: string;
  topologySignatureAfter: string;

  lineageMap: Record<string, string>;
  downstreamResults: { featureId: string; status: string; geometryHash: string }[];

  validationResults: { rule: string; passed: boolean; details?: string }[];
  verificationResults: { verifier: string; passed: boolean; score: number }[];
  evidenceReferences: string[];

  merkleRoot: string;
  cryptographicSignature: string;
  verdict: RegenerationGateVerdict;
}

export interface Gate058Report {
  gateId: 'GATE-SECP-058';
  promptId: 'PROMPT-058';
  title: string;
  timestamp: string;
  verdict: RegenerationGateVerdict;
  passedCount: number;
  totalCount: number;
  score: number;

  gates: Record<string, GateVerificationDetail>;
  negativeProofs: RegenerationNegativeProofResult[];
  positiveProofs: RegenerationPositiveProofResult[];
  evidencePackage: RegenerationEvidencePackage;
  criticalFailuresDetected: string[];
  cryptographicSignature: string;
  provenanceLedgerEntry: {
    ledgerIndex: 58;
    parentGate: 'GATE-SECP-057';
    merkleRoot: string;
  };
}
