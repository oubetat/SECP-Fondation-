import { pureSha256 } from '../../polyfills/crypto';

export enum CertificationMaturityLevel {
  LEVEL_0 = 'LEVEL_0: Architecture Claim',
  LEVEL_1 = 'LEVEL_1: Implemented',
  LEVEL_2 = 'LEVEL_2: Tested',
  LEVEL_3 = 'LEVEL_3: Verified',
  LEVEL_4 = 'LEVEL_4: Validated',
  LEVEL_5 = 'LEVEL_5: Production Validated',
  LEVEL_6 = 'LEVEL_6: Independently Reviewed',
  LEVEL_7 = 'LEVEL_7: Production Certified'
}

export enum ProductionCertificationVerdict {
  CERTIFIED = 'CERTIFIED',
  CONDITIONALLY_CERTIFIED = 'CONDITIONALLY_CERTIFIED',
  NOT_CERTIFIED = 'NOT_CERTIFIED'
}

export enum CertificationStateMachine {
  PREPARING = 'PREPARING',
  BASELINED = 'BASELINED',
  TESTING = 'TESTING',
  VERIFYING = 'VERIFYING',
  VALIDATING = 'VALIDATING',
  AUDITING = 'AUDITING',
  INDEPENDENT_REVIEW = 'INDEPENDENT_REVIEW',
  CERTIFICATION_REVIEW = 'CERTIFICATION_REVIEW',
  CERTIFIED = 'CERTIFIED',
  FAILED = 'FAILED'
}

export interface CertifiedDomainScope {
  domain: string;
  certifiedScope: string;
  outOfScopeBoundary: string;
  verificationEvidenceId: string;
  validationStatus: 'CERTIFIED' | 'CONDITIONALLY_CERTIFIED';
  numericalTolerance: string;
}

export interface ProofCaseCertificationRecord {
  caseId: string;
  name: string;
  industryCategory: 'Aerospace' | 'Robotics' | 'Automotive' | 'Turbomachinery' | 'Industrial Systems';
  workflowStatus: 'Completed & Certified' | 'In Progress';
  partsCount: number;
  physicsCoupled: string;
  evidenceMerkle: string;
}

export interface CertificationRiskItem {
  riskId: string;
  title: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  impact: string;
  mitigation: string;
  residualRisk: 'ACCEPTED_OPERATIONAL' | 'REJECTED';
  status: 'MITIGATED_AND_VERIFIED' | 'OPEN';
}

export interface SECPProductionCertificationManifest {
  certificationRunId: string;
  baselineId: string;
  repositoryRevision: string;
  gitCommitHash: string;
  buildId: string;
  kernelVersion: string;
  solverEngineVersions: {
    cfd: string;
    fea: string;
    cam: string;
    gcs: string;
  };
  timestamp: number;
  maturityTier: CertificationMaturityLevel;
  verdict: ProductionCertificationVerdict;
  truthScore: number;
  totalChecks: number;
  passedChecks: number;
  evidencePackageHash: string;
  cryptographicSignature: string;
  evidenceBusBlockHeight: number;
  certifiedDomainsCount: number;
  proofCasesCompleted: number;
}

export function canonicalJsonStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(item => canonicalJsonStringify(item)).join(',') + ']';
  }
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map(k => `${JSON.stringify(k)}:${canonicalJsonStringify(obj[k])}`);
  return '{' + pairs.join(',') + '}';
}

export function computeCertDigest(data: any): string {
  return pureSha256(canonicalJsonStringify(data));
}
