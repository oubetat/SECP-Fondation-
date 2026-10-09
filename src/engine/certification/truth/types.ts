export enum TruthVerdict {
  PASS = 'PASS',
  FAIL = 'FAIL',
  UNPROVEN = 'UNPROVEN',
  INVALID = 'INVALID',
  STALE = 'STALE',
  UNAUTHORIZED = 'UNAUTHORIZED'
}

export enum CertificationScope {
  GEOMETRY = 'GEOMETRY',
  MANUFACTURING = 'MANUFACTURING',
  STRUCTURAL = 'STRUCTURAL',
  GEOMETRY_INTEGRITY = 'GEOMETRY_INTEGRITY',
  REPRODUCIBILITY = 'REPRODUCIBILITY',
  SIMULATION_RESULT = 'SIMULATION_RESULT',
  PHYSICAL_METROLOGY = 'PHYSICAL_METROLOGY',
  DFM = 'DFM',
  CAM_TOOLPATH = 'CAM_TOOLPATH'
}

export interface VerificationSummary {
  status: string;
  patchId?: string;
  findings?: number;
  timestamp?: string;
  details?: string;
}

export interface EvidenceLeafRecord {
  entityId: string;
  partId: string;
  revisionId: string;
  cadRevisionHash: string;
  canonicalGeometryHash: string;
  artifactKind: string;
  artifactContentHash: string;
  evidenceType: string;
  authorityIdentity: string;
  sourceIdentity: string;
  executionIdentity: string;
  createdAt?: string;
  leafHash?: string;
  payload?: Record<string, any>;
  status?: string;
}

export interface CertificateVerificationResult {
  certificateId: string;
  overallVerdict: TruthVerdict;
  integrityVerified: boolean;
  evidenceVerified: boolean;
  provenanceVerified: boolean;
  custodyVerified: boolean;
  signatureVerified: boolean;
  scopeValidated: boolean;
  revisionBindingVerified?: boolean;
  geometryBindingVerified?: boolean;
  entityBindingVerified?: boolean;
  recomputedMerkleRoot?: string;
  findings: string[];
  calculatedHashes: {
    artifactHash: string;
    evidenceRootHash: string;
    certificateHash: string;
  };
  timestamp: string;
}

export interface EngineeringTruthCertificate {
  certificateId: string;
  certificateVersion: string;
  engineeringObjectId: string;
  engineeringObjectType: string;
  projectId: string;
  revisionId: string;
  cadRevisionHash?: string;
  canonicalGeometryHash?: string;
  issuedAt: string;
  issuedBy: string;
  artifactHash: string;
  evidenceRootHash: string;
  evidenceLedgerRoot: string;
  attestationRoot: string;
  chainOfCustodyRoot: string;
  sourceArtifacts: string[];
  dependencyArtifacts: string[];
  verificationResults: VerificationSummary[];
  certificationScope: CertificationScope[];
  evidenceLeaves?: EvidenceLeafRecord[];
  verdict: TruthVerdict;
  verdictReason: string;
  reproducibility: boolean;
  determinism: boolean;
  provenanceIntegrity: boolean;
  tamperEvidence: boolean;
  limitations: string[];
  unprovenClaims: string[];
  excludedClaims: string[];
  issuer: string;
  status: string;
  certificateHash: string;
  certificateSignature: string;
}
