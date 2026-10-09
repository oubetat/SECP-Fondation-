export type EngineeringID = string;

export enum EngineeringObjectStatus {
  STABLE = 'STABLE',
  INVALIDATED = 'INVALIDATED',
  PROTOTYPE = 'PROTOTYPE'
}

export interface EngineeringRevision {
  id: string;
  timestamp: string;
  author: string;
  comment: string;
  hash: string;
}

export interface EngineeringProvenance {
  sourceId: string;
  sourceDomain: string;
  transformType: string;
  timestamp: string;
  runtimeVersion: string;
}

export interface EngineeringObject {
  id: EngineeringID;
  name: string;
  domain: string;
  status: EngineeringObjectStatus;
  revision: EngineeringRevision;
  provenance: EngineeringProvenance;
  simulationResultIds: string[];
  evidenceIds: string[];
  isCertified: boolean;
  metadata: any;
}
