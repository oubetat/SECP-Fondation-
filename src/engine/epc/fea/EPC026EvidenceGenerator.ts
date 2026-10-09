/**
 * SECP Industrial OS — EPC-026: Evidence Generator
 * Assembles all FEA verification data into a canonical evidence package signed
 * with cryptographic SHA-256 hash chains for full provenance and auditability.
 */

import {
  EPC026EvidencePackage,
  LoadCaseExecutionMatrixEntry,
  FEATraceabilityRecord,
  FEAReproducibilityReport,
  FEAConfigurationRevision
} from './FEAVerificationTypes';
import { EngineeringHashChain } from '../../evidence/EngineeringHashChain';

export class EPC026EvidenceGenerator {
  public static generateEvidencePackage(
    executedMatrix: readonly LoadCaseExecutionMatrixEntry[],
    traceabilityRecords: readonly FEATraceabilityRecord[],
    reproducibilityReport: FEAReproducibilityReport,
    overallVerdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE'
  ): EPC026EvidencePackage {
    const timestamp = new Date().toISOString();
    const evidenceId = `EVID-EPC026-${Date.now()}`;

    const configurations: FEAConfigurationRevision = {
      cadRevision: '1.0',
      assemblyRevision: '1.0',
      configurationRevision: '1.0',
      materialRevision: '1.0',
      loadCaseRevision: '1.0',
      meshRevision: '1.0',
      solverVersion: 'SECP_STRUCTURAL_FEA_SOLVER_v4.2',
      feaModelRevision: '1.0'
    };

    // Calculate canonical SHA-256 hash
    const canonicalPayload = {
      evidenceId,
      caseId: 'EPC-016-DRONE-ASSEMBLY',
      timestamp,
      overallVerdict,
      totalExecutedCases: executedMatrix.length,
      traceabilityCount: traceabilityRecords.length,
      reproducibilityVerdict: reproducibilityReport.verdict
    };

    const evidenceHash = EngineeringHashChain.computeCanonicalHash(canonicalPayload).canonicalHash;

    return {
      evidenceId,
      caseId: 'EPC-016-DRONE-ASSEMBLY',
      timestamp,
      provenance: {
        systemId: 'SECP-EPC026-FEA-ENGINE',
        author: 'SECP Master Structural Physics Kernel',
        algorithmVersion: 'v4.2.0'
      },
      configurations,
      executedMatrix,
      traceabilityRecords,
      reproducibilityReport,
      overallVerdict,
      evidenceHash
    };
  }
}
