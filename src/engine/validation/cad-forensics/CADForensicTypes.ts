/**
 * SECP Industrial OS v2 — CAD Forensic Qualification Types
 * PATCH-033: CAD Kernel Forensic Qualification
 */

import { EngineeringEvidence } from '../../evidence/EngineeringEvidenceTypes';

export type CADForensicVerdict =
  | 'PROVEN'
  | 'PARTIAL'
  | 'UNPROVEN'
  | 'FAILED'
  | 'NOT_IMPLEMENTED'
  | 'INVALID';

export type CADForensicExecutionMode =
  | 'EXACT'
  | 'NUMERICAL'
  | 'TOPOLOGICAL'
  | 'INTEROPERABILITY'
  | 'DETERMINISM';

export interface CADForensicCase {
  readonly id: string;
  readonly capability: string;
  readonly description: string;

  readonly inputIdentity: string;
  readonly expectedInvariant?: string;

  readonly executionMode: CADForensicExecutionMode;

  readonly result?: unknown;
  readonly verdict: CADForensicVerdict;

  readonly evidenceId?: string;
  readonly timestamp: string;
}

export interface CADForensicMetrics {
  readonly executionTimeMs: number;
  readonly precision?: number;
  readonly memoryUsage?: number;
}

export interface CADForensicFinding {
  readonly caseId: string;
  readonly verdict: CADForensicVerdict;
  readonly metrics: CADForensicMetrics;
  readonly evidence?: EngineeringEvidence;
  readonly observations: string[];
  readonly limitations: string[];
}

export interface CADCapabilityMatrixEntry {
  readonly capability: string;
  readonly implementation: 'IMPLEMENTED' | 'PARTIAL' | 'NOT_IMPLEMENTED';
  readonly tested: boolean;
  readonly verified: boolean;
  readonly evidence: boolean;
  readonly verdict: CADForensicVerdict;
}

export interface CADForensicReport {
  readonly kernelVersion: string;
  readonly timestamp: string;
  readonly matrix: CADCapabilityMatrixEntry[];
  readonly findings: CADForensicFinding[];
  readonly summary: {
    readonly provenCount: number;
    readonly partialCount: number;
    readonly unprovenCount: number;
    readonly failedCount: number;
    readonly totalCount: number;
  };
  readonly gateVerdict: 'PASS' | 'FAIL' | 'UNPROVEN' | 'INCONCLUSIVE' | 'INVALID';
}
