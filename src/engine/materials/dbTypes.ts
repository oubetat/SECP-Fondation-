import { MaterialIdentity, MaterialProperty, PropertyProvenance } from "./types";

export enum DatabaseNamespace {
  SECP_NATIVE = 'SECP_NATIVE',
  IMPORTED = 'IMPORTED',
  MANUFACTURER = 'MANUFACTURER',
  STANDARD = 'STANDARD',
  USER_DEFINED = 'USER_DEFINED',
  PROJECT = 'PROJECT',
  EXPERIMENTAL = 'EXPERIMENTAL'
}

export enum MaterialDBStatus {
  DRAFT = 'DRAFT',
  IMPORTED = 'IMPORTED',
  NORMALIZED = 'NORMALIZED',
  VERIFIED = 'VERIFIED',
  VALIDATED = 'VALIDATED',
  CERTIFIED = 'CERTIFIED',
  DEPRECATED = 'DEPRECATED',
  SUPERSEDED = 'SUPERSEDED',
  QUARANTINED = 'QUARANTINED',
  INVALID = 'INVALID'
}

export interface MaterialRecord {
  dbId: string;
  materialId: string;
  canonicalName: string;
  family: string;
  subfamily?: string;
  gradeId?: string;
  specificationId?: string;
  conditionId?: string;
  stateId?: string;
  revision: number;
  namespace: DatabaseNamespace;
  status: MaterialDBStatus;
  createdAt: string;
  updatedAt: string;
  identity: MaterialIdentity;
  properties: MaterialProperty[];
}

export interface MaterialDataset {
  datasetId: string;
  materialId: string;
  sourceId: string;
  revision: number;
  schemaVersion: string;
  importTimestamp: string;
  importer: string;
  recordCount: number;
  checksum: string;
  provenance: PropertyProvenance;
  validationStatus: MaterialDBStatus;
}

export interface MaterialImportManifest {
  importId: string;
  source: string;
  sourceHash: string;
  schemaVersion: string;
  importedBy: string;
  timestamp: string;
  recordCount: number;
  acceptedCount: number;
  rejectedCount: number;
  conflictCount: number;
  warningCount: number;
  validationResult: string;
}

export interface MaterialSimulationPackage {
  packageId: string;
  identity: MaterialIdentity;
  revision: number;
  condition?: string;
  state: any;
  requiredProperties: string[];
  properties: MaterialProperty[];
  units: Record<string, string>;
  validityDomains: any[];
  model: string;
  sourceReferences: string[];
  evidenceHashes: string[];
  timestamp: string;
}
