import { pureSha256 } from '../../polyfills/crypto';

export enum IntegrityState {
  UNVERIFIED = 'UNVERIFIED',
  VERIFYING = 'VERIFYING',
  VALID = 'VALID',
  DEGRADED = 'DEGRADED',
  CORRUPTED = 'CORRUPTED',
  CONFLICTED = 'CONFLICTED',
  STALE = 'STALE',
  INCONCLUSIVE = 'INCONCLUSIVE'
}

export enum IntegrityMaturityLevel {
  LEVEL_0 = 'LEVEL_0: Unverified Data',
  LEVEL_1 = 'LEVEL_1: Hashable Data',
  LEVEL_2 = 'LEVEL_2: Verified Artifact Integrity',
  LEVEL_3 = 'LEVEL_3: Revision & Reference Integrity',
  LEVEL_4 = 'LEVEL_4: Cross-Domain Integrity',
  LEVEL_5 = 'LEVEL_5: Evidence-Linked Integrity',
  LEVEL_6 = 'LEVEL_6: Production Data Integrity'
}

export enum IntegrityTruthClassification {
  IMPLEMENTED = 'IMPLEMENTED',
  TESTED = 'TESTED',
  VERIFIED = 'VERIFIED',
  VALIDATED = 'VALIDATED',
  PRODUCTION_VALIDATED = 'PRODUCTION_VALIDATED'
}

export enum EngineeringArtifactCategory {
  CAD_BREP = 'CAD_BREP',
  CAD_ASSEMBLY = 'CAD_ASSEMBLY',
  FEA_CFD_MESH = 'FEA_CFD_MESH',
  SIMULATION_RESULT = 'SIMULATION_RESULT',
  CAM_TOOLPATH = 'CAM_TOOLPATH',
  PLM_BOM = 'PLM_BOM',
  ENGINEERING_DRAWING = 'ENGINEERING_DRAWING',
  TELEMETRY_DATASET = 'TELEMETRY_DATASET',
  DIGITAL_TWIN_STATE = 'DIGITAL_TWIN_STATE',
  EVIDENCE_PACKAGE = 'EVIDENCE_PACKAGE'
}

export interface EngineeringArtifactRecord {
  artifactId: string;
  projectId: string;
  name: string;
  category: EngineeringArtifactCategory;
  revisionId: string;
  schemaVersion: string;
  unitContext: {
    quantityType: string;
    unit: string;
    coordinateSystemId: string;
  };
  expectedHash: string;
  computedHash: string;
  integrityState: IntegrityState;
  provenance: {
    originSystem: string;
    authorOrAgent: string;
    createdAt: number;
    parentRevisionHash?: string;
    sourceReferences: string[];
  };
  isCritical: boolean;
}

export interface CrossDomainReferenceLink {
  sourceArtifactId: string;
  sourceRevision: string;
  sourceDomain: 'CAD' | 'CAE' | 'CAM' | 'PLM' | 'TELEMETRY' | 'EVIDENCE';
  targetArtifactId: string;
  targetRevision: string;
  targetDomain: 'CAD' | 'CAE' | 'CAM' | 'PLM' | 'TELEMETRY' | 'EVIDENCE';
  relationType: 'DRIVES_MESH' | 'FEEDS_SIMULATION' | 'DRIVES_TOOLPATH' | 'DEFINES_BOM' | 'VALIDATES_WITH_TELEMETRY' | 'RECORDS_EVIDENCE';
  isConsistent: boolean;
  mismatchDetail?: string;
}

export interface DataIntegrityIncident {
  incidentId: string;
  detectionTime: number;
  artifactId: string;
  expectedHash: string;
  actualHash: string;
  revision: string;
  source: string;
  impact: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'CONTAINED' | 'REPAIRED_AND_VERIFIED';
  repairLog?: {
    method: string;
    repairedBy: string;
    newArtifactHash: string;
    verifiedAt: number;
  };
}

export interface DataIntegrityEvidencePackage {
  auditId: string;
  policyVersion: string;
  projectId: string;
  totalArtifactsAudited: number;
  validCount: number;
  corruptedCount: number;
  conflictedCount: number;
  staleCount: number;
  coveragePercent: number;
  globalVerdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  integrityMaturity: IntegrityMaturityLevel;
  auditMerkleRoot: string;
  timestamp: number;
  evidenceBusBlock: {
    blockHeight: number;
    prevBlockHash: string;
    currentHash: string;
    timestamp: number;
  };
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

export function computeCanonicalDigest(data: any): string {
  return pureSha256(canonicalJsonStringify(data));
}
