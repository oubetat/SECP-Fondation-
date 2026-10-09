/**
 * PATCH-284 — GD&T (Geometric Dimensioning & Tolerancing) Types
 * Strict Separation of Engineering Semantics from Graphical Representations
 */

export enum GDCharacteristic284 {
  STRAIGHTNESS = 'STRAIGHTNESS',
  FLATNESS = 'FLATNESS',
  CIRCULARITY = 'CIRCULARITY',
  CYLINDRICITY = 'CYLINDRICITY',
  LINE_PROFILE = 'LINE_PROFILE',
  SURFACE_PROFILE = 'SURFACE_PROFILE',
  PARALLELISM = 'PARALLELISM',
  PERPENDICULARITY = 'PERPENDICULARITY',
  ANGULARITY = 'ANGULARITY',
  POSITION = 'POSITION',
  CIRCULAR_RUNOUT = 'CIRCULAR_RUNOUT',
  TOTAL_RUNOUT = 'TOTAL_RUNOUT'
}

export enum GDModifier284 {
  NONE = 'NONE',
  MMC = 'MMC', // Maximum Material Condition
  LMC = 'LMC', // Least Material Condition
  RFS = 'RFS'  // Regardless of Feature Size
}

export enum GDTStatus284 {
  VALID = 'VALID',
  STALE = 'STALE',
  UNRESOLVED = 'UNRESOLVED',
  INVALID = 'INVALID',
  AMBIGUOUS = 'AMBIGUOUS'
}

export enum GDTZoneType284 {
  PARALLEL_PLANES = 'PARALLEL_PLANES',
  CYLINDRICAL = 'CYLINDRICAL',
  CIRCULAR = 'CIRCULAR',
  PROFILE_ZONE = 'PROFILE_ZONE'
}

export interface DatumFeature284 {
  id: string;
  label: string; // A, B, C, etc.
  entityId: string; // Real CAD B-Rep element
  entityType: 'VERTEX' | 'EDGE' | 'FACE' | 'AXIS' | 'DATUM' | 'COMPONENT';
  revision: string;
  status: GDTStatus284;
}

export interface GDTFeatureControl284 {
  id: string;
  featureRef: {
    entityId: string;
    entityType: 'VERTEX' | 'EDGE' | 'FACE' | 'AXIS' | 'DATUM' | 'COMPONENT';
  };
  characteristic: GDCharacteristic284;
  toleranceValue: number;
  modifier: GDModifier284;
  
  // Datum Reference Frame ordered primary, secondary, tertiary
  datums: string[]; // labels e.g. ["A", "B"] or ["A"]
  
  status: GDTStatus284;
  revision: string;
  associatedViewId?: string; // Drawing view correlation

  placement: {
    origin: [number, number, number];
    textOffset: [number, number, number];
  };
}

export interface GDTEvidence284 {
  controlId: string;
  timestamp: string;
  modelRevision: string;
  characteristic: GDCharacteristic284;
  toleranceValue: number;
  bonusTolerance: number;
  status: GDTStatus284;
  hash: string;
}
