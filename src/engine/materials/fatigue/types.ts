import { PropertyProvenance } from "../types";

export enum FatigueCurveType {
  SN = 'SN', // Stress-Life
  EN = 'EN'  // Strain-Life
}

export enum CycleConvention {
  CYCLES = 'CYCLES',
  REVERSALS = 'REVERSALS'
}

export interface FatigueDataset {
  datasetId: string;
  materialId: string;
  materialRevision: number;
  loadingMode: string; // e.g., Axial, Bending
  stressRatio: number; // R
  points: FatigueDataPoint[];
  temperature: number; // K
  environment: string;
  surfaceCondition: string;
  provenance: PropertyProvenance;
}

export interface FatigueDataPoint {
  amplitude: number; // Stress or Strain amplitude
  cyclesToFailure: number;
  isRunout: boolean;
}

export interface FatigueCurveParameters {
  modelId: string;
  type: FatigueCurveType;
  parameters: Record<string, number>;
  validityDomain: {
    minAmplitude: number;
    maxAmplitude: number;
    minCycles: number;
    maxCycles: number;
  };
  revision: number;
}

export enum FatigueVerdict {
  VALID = 'VALID',
  OUTSIDE_DOMAIN = 'OUTSIDE_DOMAIN',
  INVALID_INPUT = 'INVALID_INPUT',
  FIT_FAILURE = 'FIT_FAILURE'
}
