/**
 * PATCH-SECP-064: Manufacturing Release & Certification Core
 * Defines standard data models and type representations for formal, auditable
 * product release decisions, deviation approvals, evidence package registries,
 * and immutable Manufacturing Release Certificates.
 */

export type ReleaseDecision = 'RELEASED' | 'CONDITIONAL_RELEASE' | 'BLOCKED' | 'HOLD';

export type DeviationSeverity = 'MINOR' | 'MAJOR' | 'CRITICAL';

export interface ReleaseEvidenceRecord {
  evidenceId: string;
  sourceBaselineId: string; // e.g. "SECP-060"
  evidenceType: 'EXECUTION_HASH' | 'METROLOGY_CERT' | 'SPC_CERT' | 'NCR_SUMMARY';
  contentHash: string;
  isVerified: boolean;
  verifiedBy: string;
  timestamp: string;
}

export interface DeviationApproval {
  deviationId: string;
  ncrId?: string;
  severity: DeviationSeverity;
  description: string;
  mitigationActions: string[];
  authorizedEngineerId: string;
  signatureHash: string;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  timestamp: string;
}

export interface SerialReleaseRecord {
  serialNumber: string;
  partId: string;
  executionVerified: boolean;
  metrologyVerified: boolean;
  spcVerified: boolean;
  ncrCleared: boolean;
  eligibilityStatus: 'ELIGIBLE' | 'BLOCKED';
}

export interface BatchReleaseOrder {
  batchId: string;
  productTypeId: string;
  quantity: number;
  serialReleaseList: SerialReleaseRecord[];
  overallStatus: 'COMPLIANT' | 'NON_COMPLIANT' | 'HOLD';
  releasedQuantity: number;
  blockedQuantity: number;
}

export interface ManufacturingReleaseCertificate {
  releaseId: string;
  productId: string;
  partSerials: string[];
  batchId?: string;
  
  // Technical configurations / digital thread checkpoints
  cadRevision: string;
  camRevision: string;
  ncProgramHash: string;
  executionHash: string;
  
  // High-fidelity quality certificates
  metrologyCertificateHash: string;
  processHealthCertificateHash: string;
  ncrCertificateHashes: string[];
  deviationApprovalIds: string[];
  
  decision: ReleaseDecision;
  releaseReason: string;
  approvedBy: string[];
  approvalTimestamp: string;
  
  evidenceRootHash: string;
  certificateHash: string; // Deterministic immutable SHA-256 process state signature
}

export interface ReleasePackage {
  packageId: string;
  timestamp: string;
  certificate: ManufacturingReleaseCertificate;
  evidenceItems: ReleaseEvidenceRecord[];
  deviationApprovals: DeviationApproval[];
  digitalThreadTraceHashes: string[];
}

export interface ReleaseProvenanceRecord {
  recordId: string;
  releaseId: string;
  timestamp: string;
  decision: ReleaseDecision;
  certificateHash: string;
  evidenceRootHash: string;
  signedBy: string;
  immutableSignature: string;
}

export interface LedgerAnchor {
  anchorId: string;
  provenanceRecordId: string;
  ledgerType: 'INTERNAL' | 'SECP_LOCAL_LEDGER' | 'EXTERNAL_AUDIT_LOG' | string;
  blockIndex: number;
  anchoredHash: string;
  anchoredTimestamp: string;
  anchorValidationSignature: string;
}

