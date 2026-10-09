import { pureSha256 } from '../../polyfills/crypto';

export enum SecurityScopeClassification {
  IN_SCOPE = 'IN_SCOPE',
  OUT_OF_SCOPE = 'OUT_OF_SCOPE',
  PARTIALLY_ASSESSED = 'PARTIALLY_ASSESSED',
  NOT_ASSESSED = 'NOT_ASSESSED'
}

export enum AssetClassification {
  CAD_DATA = 'CAD_DATA',
  CAE_DATA = 'CAE_DATA',
  CAM_DATA = 'CAM_DATA',
  PLM_DATA = 'PLM_DATA',
  BOM_DATA = 'BOM_DATA',
  SIMULATION_DATA = 'SIMULATION_DATA',
  TELEMETRY = 'TELEMETRY',
  PHYSICAL_TRIAL_DATA = 'PHYSICAL_TRIAL_DATA',
  EVIDENCE = 'EVIDENCE',
  CREDENTIALS = 'CREDENTIALS',
  TOKENS = 'TOKENS',
  SECRETS = 'SECRETS',
  CONFIGURATION = 'CONFIGURATION',
  SOURCE_CODE = 'SOURCE_CODE',
  MODELS = 'MODELS',
  AUDIT_LOGS = 'AUDIT_LOGS'
}

export enum AssetCriticality {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum SecurityVulnerabilitySeverity {
  INFO = 'INFO',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum SecurityIncidentType {
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  DATA_EXFILTRATION = 'DATA_EXFILTRATION',
  PRIVILEGE_ESCALATION = 'PRIVILEGE_ESCALATION',
  MALWARE = 'MALWARE',
  INTEGRITY_FAILURE = 'INTEGRITY_FAILURE',
  CREDENTIAL_COMPROMISE = 'CREDENTIAL_COMPROMISE',
  DENIAL_OF_SERVICE = 'DENIAL_OF_SERVICE',
  INSIDER_THREAT = 'INSIDER_THREAT',
  SUPPLY_CHAIN_EVENT = 'SUPPLY_CHAIN_EVENT'
}

export enum SecurityMaturityLevel {
  LEVEL_0 = 'LEVEL_0: Basic Security Controls Exist',
  LEVEL_1 = 'LEVEL_1: Authenticated Platform',
  LEVEL_2 = 'LEVEL_2: Authorized Engineering Access',
  LEVEL_3 = 'LEVEL_3: Audited Engineering Security',
  LEVEL_4 = 'LEVEL_4: Security-Tested Production Platform',
  LEVEL_5 = 'LEVEL_5: Independent Security Qualification',
  LEVEL_6 = 'LEVEL_6: Continuously Assessed Secure Engineering OS'
}

export enum TruthSecurityClassification {
  IMPLEMENTED = 'IMPLEMENTED',
  TESTED = 'TESTED',
  VERIFIED = 'VERIFIED',
  QUALIFIED = 'QUALIFIED',
  PRODUCTION_QUALIFIED = 'PRODUCTION_QUALIFIED'
}

export interface SecurityAuditScopeItem {
  componentId: string;
  name: string;
  category: 'APPLICATION' | 'SERVICE' | 'API' | 'DATABASE' | 'STORAGE' | 'KERNEL' | 'WORKER' | 'GPU' | 'WASM' | 'PLM' | 'EVIDENCE_BUS' | 'INTEGRATION';
  classification: SecurityScopeClassification;
  trustBoundary: string;
  description: string;
}

export interface AttackSurfaceItem {
  id: string;
  channel: 'HTTP' | 'WEBSOCKET' | 'WEBRTC' | 'API' | 'FILE_UPLOAD' | 'FILE_IMPORT' | 'FILE_EXPORT' | 'WORKER_MESSAGING' | 'GPU_INTERFACES' | 'WASM_INTERFACES' | 'DATABASE_CONNECTIONS' | 'EXTERNAL_INTEGRATIONS';
  endpointOrInterface: string;
  authenticated: boolean;
  authorizedRoles: string[];
  inputValidationActive: boolean;
  rateLimited: boolean;
  riskRating: AssetCriticality;
}

export interface SecurityThreatModelItem {
  threatId: string;
  asset: AssetClassification;
  threatDescription: string;
  actor: 'ANONYMOUS_EXTERNAL' | 'AUTHENTICATED_TENANT_USER' | 'MALICIOUS_INSIDER' | 'COMPROMISED_WORKER' | 'ROGUE_AI_AGENT' | 'MALICIOUS_SUPPLIER';
  attackSurface: string;
  controls: string[];
  residualRisk: AssetCriticality;
}

export interface SecurityFinding {
  findingId: string;
  title: string;
  component: string;
  severity: SecurityVulnerabilitySeverity;
  cveId?: string;
  exploitability: 'LOW' | 'MEDIUM' | 'HIGH';
  discoveryMethod: 'AUTOMATED_SCAN' | 'FUZZ_TEST' | 'THREAT_MODEL' | 'CODE_AUDIT' | 'PENETRATION_TEST';
  remediationPlan: string;
  status: 'OPEN' | 'REMEDIATED' | 'VERIFIED_CLOSED';
  retestedAndVerified: boolean;
  verificationEvidenceHash?: string;
}

export interface SecurityIncidentRecord {
  incidentId: string;
  type: SecurityIncidentType;
  detectedAt: number;
  severity: AssetCriticality;
  targetAsset: AssetClassification;
  originIpOrIdentity: string;
  state: 'DETECTED' | 'CONTAINED' | 'INVESTIGATED' | 'ERADICATED' | 'RECOVERED' | 'VERIFIED';
  containmentDetails: string;
  evidenceMerkleRoot: string;
}

export interface SecurityAuditEvidencePackage {
  auditId: string;
  scopeHash: string;
  configurationHash: string;
  totalControlsTested: number;
  criticalPassed: boolean;
  riskScore: number;
  maturityLevel: SecurityMaturityLevel;
  truthStatus: TruthSecurityClassification;
  merkleRoot: string;
  timestamp: number;
  auditorIdentity: string;
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
