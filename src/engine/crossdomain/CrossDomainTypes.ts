/**
 * SECP Industrial OS — EPC-013 & M9: Cross-Domain Engineering Truth Types
 * Authoritative cross-domain definitions ensuring:
 * ONE ENGINEERING TRUTH -> MULTIPLE DOMAIN CAPABILITIES
 */
import { GenericExecutionEnvelope } from '../execution/CoreExecutionTypes';
import { EvidenceLeafRecord } from '../certification/truth/types';

export enum EngineeringDomain {
  ROBOTICS = 'ROBOTICS',
  AEROSPACE = 'AEROSPACE',
  AUTOMOTIVE = 'AUTOMOTIVE',
  ENERGY = 'ENERGY',
  MARINE = 'MARINE',
  OIL_GAS = 'OIL_GAS',
  DRONE = 'DRONE',
  ROBOT = 'ROBOT',
  EVTOL = 'EVTOL',
  VEHICLE = 'VEHICLE',
  PUMP = 'PUMP',
  HEAT_EXCHANGER = 'HEAT_EXCHANGER',
  GEARBOX = 'GEARBOX',
  TURBOMACHINERY = 'TURBOMACHINERY',
  MANUFACTURING_CELL = 'MANUFACTURING_CELL',
  TEST_DOMAIN = 'TEST_DOMAIN'
}

export enum EngineeringServiceType {
  CAD = 'CAD',
  GEOMETRY = 'GEOMETRY',
  ASSEMBLY = 'ASSEMBLY',
  MASS_PROPERTIES = 'MASS_PROPERTIES',
  FEA = 'FEA',
  CFD = 'CFD',
  CAM = 'CAM',
  CONFIGURATION = 'CONFIGURATION',
  VERIFICATION = 'VERIFICATION',
  EVIDENCE = 'EVIDENCE',
  PROVENANCE = 'PROVENANCE',
  REPRODUCIBILITY = 'REPRODUCIBILITY',
  CROSS_DOMAIN_CONTINUITY = 'CROSS_DOMAIN_CONTINUITY'
}

export type CrossDomainResultStatus =
  | 'VALID'
  | 'STALE'
  | 'INVALIDATED'
  | 'SUPERSEDED'
  | 'REQUIRES_RECOMPUTATION';

export interface CrossDomainServiceContract {
  serviceId: string;
  serviceName: string;
  serviceVersion: string;
  implementationFingerprint: string;
  supportedDomains: EngineeringDomain[];
  inputSchema: Record<string, any>;
  outputSchema: Record<string, any>;
}

export interface CrossDomainExecutionRecord {
  executionId: string;
  serviceId: string;
  domainId: EngineeringDomain;
  workflowId: string;
  implementationFingerprint: string;
  inputHash: string;
  outputHash: string;
  startedAt: string;
  completedAt: string;
  status: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  evidenceId?: string;
}

export enum ReuseStatus {
  VERIFIED = 'VERIFIED',
  NOT_VERIFIED = 'NOT_VERIFIED',
  INCONCLUSIVE = 'INCONCLUSIVE',
  ARCHITECTURAL_DUPLICATION = 'ARCHITECTURAL_DUPLICATION'
}

export interface ServiceReuseAssertion {
  serviceId: EngineeringServiceType;
  domainsTested: EngineeringDomain[];
  implementationIds: string[];
  executionCount: number;
  successfulExecutions: number;
  reuseStatus: ReuseStatus;
  evidenceReferences: string[];
}

/**
 * M9 Cross-Domain Handoff Representation
 * Defines an authoritative transfer of verified engineering output from Domain A to Domain B.
 */
export interface CrossDomainHandoffRecord {
  readonly handoffId: string;
  readonly engineeringObjectId: string;
  readonly sourceRevisionId: string;
  readonly sourceRevisionHash: string;
  readonly sourceGeometryHash: string;
  readonly sourceDomain: EngineeringDomain | string;
  readonly sourceExecutionId: string;
  readonly sourceResultDigest: string;
  readonly targetDomain: EngineeringDomain | string;
  readonly targetParameterKey: string;
  readonly targetParameterValue: any;
  readonly status: CrossDomainResultStatus;
  readonly createdAt: string;
  readonly relationHash: string;
}

/**
 * M9 Cross-Domain Conflict Definition
 * Captures conflicting domain conclusions without silent merging or averaging.
 */
export type CrossDomainConflictType =
  | 'CONSTRAINT_VIOLATION'
  | 'PARAMETRIC_MISMATCH'
  | 'SAFETY_MARGIN_DEFICIT'
  | 'MATERIAL_COMPATIBILITY'
  | 'GOVERNANCE_BLOCK';

export type CrossDomainConflictStatus =
  | 'UNRESOLVED'
  | 'UNDER_REVIEW'
  | 'RESOLVED_OVERRIDE'
  | 'RESOLVED_REVISION'
  | 'REJECTED';

export interface CrossDomainConflictRecord {
  readonly conflictId: string;
  readonly engineeringObjectId: string;
  readonly revisionId: string;
  readonly domainA: string;
  readonly domainB: string;
  readonly resultA: Record<string, any>;
  readonly resultB: Record<string, any>;
  readonly evidenceA?: EvidenceLeafRecord;
  readonly evidenceB?: EvidenceLeafRecord;
  readonly provenanceA?: string;
  readonly provenanceB?: string;
  readonly conflictType: CrossDomainConflictType;
  status: CrossDomainConflictStatus;
  readonly createdAt: string;
  resolutionAuthority?: string;
  resolutionReference?: string;
  resolutionRevision?: string;
  resolvedAt?: string;
  resolutionRationale?: string;
}
