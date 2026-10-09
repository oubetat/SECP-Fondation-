/**
 * PATCH-SECP-069: Industrial Data Governance & Engineering Digital Thread Types
 * Defines the core models for industrial data lifecycle and lineage.
 */

export type DataClassification = 'PUBLIC' | 'INTERNAL' | 'PROPRIETARY' | 'CONFIDENTIAL' | 'SOVEREIGN';

export type GovernanceDecision = 'ACCEPT' | 'REJECT' | 'QUARANTINE' | 'REVALIDATE' | 'SUPERSEDED';

export interface EngineeringDataIdentity {
  id: string;
  type: 'CAD' | 'CAM' | 'FEA' | 'NC' | 'TELEMETRY' | 'INSPECTION' | 'MAINTENANCE' | 'PRODUCTION_RECORD';
  source: string;
  hash: string;
  classification: DataClassification;
  owner: string;
  createdAt: string;
}

export interface DataVersion {
  id: string;
  dataId: string;
  version: string;
  hash: string;
  parentVersionId?: string;
  timestamp: string;
}

export interface DataLineage {
  id: string;
  targetDataId: string;
  sourceDataIds: string[];
  transformation: string;
  timestamp: string;
}

export interface DataQualityRecord {
  id: string;
  dataId: string;
  completeness: number; // 0.0 - 1.0
  validity: boolean;
  consistency: boolean;
  freshness: string;
  timestamp: string;
}

export interface DigitalThreadRecord {
  id: string;
  name: string;
  nodes: {
    type: string;
    id: string;
    description: string;
  }[];
  timestamp: string;
}

export interface DataProvenanceRecord {
  recordId: string;
  dataId: string;
  versionId: string;
  hash: string;
  signedBy: string;
  immutableSignature: string;
  timestamp: string;
}

export interface DigitalThreadPackage {
  packageId: string;
  identity: EngineeringDataIdentity;
  version: DataVersion;
  lineage: DataLineage;
  quality: DataQualityRecord;
  provenance: DataProvenanceRecord;
  decision: GovernanceDecision;
}
