export enum MaterialCondition {
  ANNEALED = 'ANNEALED',
  NORMALIZED = 'NORMALIZED',
  QUENCHED = 'QUENCHED',
  TEMPERED = 'TEMPERED',
  AGED = 'AGED',
  SOLUTION_TREATED = 'SOLUTION_TREATED',
  AS_CAST = 'AS_CAST',
  AS_FORGED = 'AS_FORGED',
  COLD_WORKED = 'COLD_WORKED'
}

export enum MaterialForm {
  SHEET = 'SHEET',
  PLATE = 'PLATE',
  BAR = 'BAR',
  ROD = 'ROD',
  TUBE = 'TUBE',
  CASTING = 'CASTING',
  FORGING = 'FORGING',
  POWDER = 'POWDER',
  AM_PART = 'AM_PART'
}

export enum MaterialProcessType {
  CASTING = 'CASTING',
  FORGING = 'FORGING',
  ROLLING = 'ROLLING',
  EXTRUSION = 'EXTRUSION',
  HEAT_TREATMENT = 'HEAT_TREATMENT',
  WELDING = 'WELDING',
  AM = 'AM'
}

export interface MaterialProcessStep {
  stepId: string;
  type: MaterialProcessType;
  parameters: Record<string, any>;
  timestamp: string;
  author: string;
}
export enum MaterialFamily {
  METAL = 'METAL',
  POLYMER = 'POLYMER',
  CERAMIC = 'CERAMIC',
  COMPOSITE = 'COMPOSITE',
  SEMICONDUCTOR = 'SEMICONDUCTOR',
  GLASS = 'GLASS',
  ELASTOMER = 'ELASTOMER',
  BIOMATERIAL = 'BIOMATERIAL',
  FLUID = 'FLUID',
  POWDER = 'POWDER',
  FOAM = 'FOAM',
  OTHER = 'OTHER'
}

export enum PropertySourceType {
  EXPERIMENT = 'EXPERIMENT',
  STANDARD = 'STANDARD',
  MANUFACTURER = 'MANUFACTURER',
  SUPPLIER = 'SUPPLIER',
  PUBLICATION = 'PUBLICATION',
  DATABASE = 'DATABASE',
  CERTIFICATE = 'CERTIFICATE'
}

export enum MaterialStatus {
  DRAFT = 'DRAFT',
  VALIDATED = 'VALIDATED',
  VERIFIED = 'VERIFIED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  DEPRECATED = 'DEPRECATED'
}

export interface PropertyProvenance {
  sourceId: string;
  sourceType: PropertySourceType;
  reference: string;
  timestamp: string;
  author: string;
  hash: string;
}

export interface MaterialProperty {
  name: string;
  value: number;
  unit: string;
  dimension: string;
  uncertainty?: number;
  provenance: PropertyProvenance;
  validityDomain?: {
    minTemp?: number;
    maxTemp?: number;
    minPressure?: number;
    maxPressure?: number;
  };
}

export interface MaterialIdentity {
  materialId: string;
  canonicalName: string;
  family: MaterialFamily;
  grade?: string;
  specification?: string;
  standard?: string;
  revision: number;
  aliases: string[];
  form?: MaterialForm;
  condition?: MaterialCondition;
}

export interface MaterialBatch {
  batchId: string;
  heatNumber?: string;
  lotNumber?: string;
  manufacturingDate: string;
  certificateId?: string;
}

export interface MaterialState {
  temperature: number;
  pressure: number;
  condition: string; // e.g., 'annealed', 'cold-worked'
  processingHistory: string[];
}

export interface MaterialEvidence {
  materialId: string;
  revision: number;
  fingerprint: string;
  stateHash: string;
  verdict: string;
  timestamp: string;
}
