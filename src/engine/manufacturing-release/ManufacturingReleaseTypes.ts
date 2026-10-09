export type DeviationSeverity = 'MINOR' | 'CRITICAL' | string;

export type ReleaseDecision = 'RELEASED' | 'HOLD' | 'BLOCKED' | 'CONDITIONAL_RELEASE' | string;

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
  overallStatus: 'COMPLIANT' | 'NON_COMPLIANT' | 'HOLD' | string;
  releasedQuantity: number;
  blockedQuantity: number;
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

export interface ManufacturingReleaseCertificate {
  releaseId: string;
  productId: string;
  partSerials: string[];
  batchId?: string;
  cadRevision: string;
  camRevision: string;
  ncProgramHash: string;
  executionHash: string;
  metrologyCertificateHash: string;
  processHealthCertificateHash: string;
  ncrCertificateHashes: string[];
  deviationApprovalIds: string[];
  decision: ReleaseDecision;
  releaseReason: string;
  approvedBy: string[];
  approvalTimestamp: string;
  evidenceRootHash: string;
  certificateHash: string;
}

export interface ReleaseEvidenceRecord {
  evidenceId: string;
  sourceBaselineId: string;
  evidenceType: 'EXECUTION_HASH' | string;
  contentHash: string;
  verifiedBy: string;
  timestamp: string;
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
  decision: string;
  certificateHash: string;
  evidenceRootHash: string;
  signedBy: string;
  immutableSignature: string;
}

export interface LedgerAnchor {
  anchorId: string;
  provenanceRecordId: string;
  ledgerType: string;
  blockIndex: number;
  anchoredHash: string;
  anchoredTimestamp: string;
  anchorValidationSignature: string;
}
