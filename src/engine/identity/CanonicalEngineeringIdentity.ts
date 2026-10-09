/**
 * SECP Industrial OS v2 — PATCH-158: Engineering Identity Layer
 * The definitive contract for engineering entity identification.
 */

export enum EngineeringObjectType {
  PROJECT = 'PROJECT',
  DESIGN = 'DESIGN',
  GEOMETRY = 'GEOMETRY',
  BREP = 'BREP',
  FEATURE = 'FEATURE',
  ASSEMBLY = 'ASSEMBLY',
  COMPONENT = 'COMPONENT',
  PART = 'PART',
  MATERIAL = 'MATERIAL',
  MESH = 'MESH',
  SIMULATION = 'SIMULATION',
  SOLVER = 'SOLVER',
  RESULT = 'RESULT',
  TOOLPATH = 'TOOLPATH',
  MACHINE = 'MACHINE',
  INSPECTION = 'INSPECTION',
  DIGITAL_TWIN = 'DIGITAL_TWIN',
  EVIDENCE = 'EVIDENCE',
  CERTIFICATE = 'CERTIFICATE',
  REVISION = 'REVISION',
  CONFIGURATION = 'CONFIGURATION',
  WORKFLOW = 'WORKFLOW'
}

export enum IdentityClassification {
  PUBLIC = 'PUBLIC',
  INTERNAL = 'INTERNAL',
  CONFIDENTIAL = 'CONFIDENTIAL',
  SECRET = 'SECRET',
  TOP_SECRET = 'TOP_SECRET'
}

/**
 * Immutable Engineering Identity.
 * Stable, deterministic, and cryptographically bound to the object definition.
 */
export interface EngineeringIdentity {
  readonly identityId: string;        // SHA-256 of canonical identity fields
  readonly objectType: EngineeringObjectType;
  readonly projectId: string;
  readonly revisionId: string;
  readonly objectVersion: number;
  readonly parentIdentityId?: string;
  readonly contentHash: string;      // SHA-256 of object metadata/content
  readonly timestamp: string;
  readonly createdBy: string;
  readonly classification?: IdentityClassification;
  readonly tags?: readonly string[];
  readonly artifactId?: string;
  readonly artifactType?: string;
  readonly namespace?: string;
  readonly schemaVersion?: string;
}
