import { pureSha256 } from '../../polyfills/crypto';

export enum IndustrialTruthClassification {
  IMPLEMENTED = 'IMPLEMENTED',
  TESTED = 'TESTED',
  VERIFIED = 'VERIFIED',
  VALIDATED = 'VALIDATED',
  PRODUCTION_VALIDATED = 'PRODUCTION_VALIDATED'
}

export enum IndustrialOSMaturityLevel {
  LEVEL_0 = 'LEVEL_0: Concept',
  LEVEL_1 = 'LEVEL_1: Implemented',
  LEVEL_2 = 'LEVEL_2: Tested',
  LEVEL_3 = 'LEVEL_3: Verified',
  LEVEL_4 = 'LEVEL_4: Validated',
  LEVEL_5 = 'LEVEL_5: Production Qualified',
  LEVEL_6 = 'LEVEL_6: Independently Audited'
}

export enum ProductionReadinessVerdict {
  PRODUCTION_READY = 'PRODUCTION_READY',
  PRODUCTION_READY_WITH_SCOPE_LIMITATIONS = 'PRODUCTION_READY_WITH_SCOPE_LIMITATIONS',
  CONDITIONAL = 'CONDITIONAL',
  NOT_PRODUCTION_READY = 'NOT_PRODUCTION_READY',
  INCONCLUSIVE = 'INCONCLUSIVE'
}

export enum FindingSeverity {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  INFORMATIONAL = 'INFORMATIONAL'
}

export interface DomainCapabilityAssessment {
  domainId: string;
  name: string;
  category: 'KERNEL' | 'CAD' | 'CAE' | 'CAM' | 'INTEROP' | 'AI' | 'COMPUTE' | 'TWIN' | 'SECURITY' | 'INTEGRITY' | 'PRODUCTION';
  classification: IndustrialTruthClassification;
  maturity: IndustrialOSMaturityLevel;
  evidenceId: string;
  testedCount: number;
  verifiedCount: number;
  validatedCount: number;
  knownLimitations: string[];
  operationalScope: string;
}

export interface AuditFindingRecord {
  findingId: string;
  domain: string;
  severity: FindingSeverity;
  title: string;
  description: string;
  evidenceRef: string;
  impact: string;
  workaroundOrMitigation: string;
  status: 'OPEN' | 'DOCUMENTED_LIMITATION' | 'RESOLVED_AND_VERIFIED';
}

export interface FullAuditEvidencePackage {
  auditId: string;
  repositoryRevision: string;
  gitCommitHash: string;
  schemaVersion: string;
  kernelVersion: string;
  timestamp: number;
  globalScore: number; // 0 - 100
  overallMaturity: IndustrialOSMaturityLevel;
  readinessDecision: ProductionReadinessVerdict;
  totalRequirementsAudited: number;
  passedCount: number;
  failedCount: number;
  inconclusiveCount: number;
  auditMerkleRoot: string;
  cryptographicSignature: string;
  evidenceBusBlockHeight: number;
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

export function computeAuditDigest(data: any): string {
  return pureSha256(canonicalJsonStringify(data));
}
