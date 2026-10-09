import { PropertyProvenance } from "../types";

export enum FractureMode {
  MODE_I = 'MODE_I',   // Opening
  MODE_II = 'MODE_II',  // Sliding
  MODE_III = 'MODE_III', // Tearing
  MIXED = 'MIXED'
}

export enum FracturePropertyType {
  KIC = 'KIC',   // Plane-strain fracture toughness
  KC = 'KC',     // Plane-stress fracture toughness
  JIC = 'JIC',   // Elastic-plastic fracture toughness
  JC = 'JC',
  GIC = 'GIC',   // Energy release rate critical
  CTODC = 'CTODC' // Crack tip opening displacement critical
}

export interface FractureDataset {
  datasetId: string;
  materialId: string;
  materialRevision: number;
  specimenType: string;
  specimenGeometry: Record<string, number>;
  crackGeometry: {
    length: number;
    orientation: string;
  };
  thickness: number;
  loadingMode: FractureMode;
  temperature: number; // K
  environment: string;
  fractureProperty: FracturePropertyType;
  measuredValue: number;
  units: string;
  provenance: PropertyProvenance;
}

export interface FracturePropertyModel {
  propertyId: string;
  type: FracturePropertyType;
  materialId: string;
  materialRevision: number;
  value: number;
  units: string;
  loadingMode: FractureMode;
  temperature: number;
  environment: string;
  validityDomain: {
    minThickness: number;
    maxThickness: number;
    minTemperature: number;
    maxTemperature: number;
  };
  provenance: PropertyProvenance;
  revision: number;
}

export enum FractureVerdict {
  SUBCRITICAL = 'SUBCRITICAL',
  CRITICAL = 'CRITICAL',
  SUPERCRITICAL = 'SUPERCRITICAL',
  OUTSIDE_DOMAIN = 'OUTSIDE_VALIDITY_DOMAIN',
  INVALID_PROVENANCE = 'INVALID_PROVENANCE'
}
