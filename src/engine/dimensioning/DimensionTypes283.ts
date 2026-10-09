
/**
 * PATCH-283 — Professional Dimensioning Types
 * Focus: Semantic Engineering Relationships vs Graphical Representation
 */

export enum DimensionType283 {
  LINEAR = 'LINEAR',
  HORIZONTAL = 'HORIZONTAL',
  VERTICAL = 'VERTICAL',
  ALIGNED = 'ALIGNED',
  RADIAL = 'RADIAL',
  DIAMETER = 'DIAMETER',
  ANGULAR = 'ANGULAR',
  ARC_LENGTH = 'ARC_LENGTH',
  COORDINATE = 'COORDINATE',
  ORDINATE = 'ORDINATE'
}

export enum DimensionSource283 {
  MODEL = 'MODEL',
  PMI = 'PMI',
  DRAWING = 'DRAWING',
  MEASUREMENT = 'MEASUREMENT'
}

export enum DimensionStatus283 {
  VALID = 'VALID',
  STALE = 'STALE',
  UNRESOLVED = 'UNRESOLVED',
  INVALID = 'INVALID',
  AMBIGUOUS = 'AMBIGUOUS'
}

export enum ToleranceType283 {
  NONE = 'NONE',
  SYMMETRIC = 'SYMMETRIC',
  BILATERAL = 'BILATERAL',
  UNILATERAL = 'UNILATERAL',
  LIMITS = 'LIMITS'
}

export interface DimensionTolerance283 {
  type: ToleranceType283;
  upperDeviation?: number;
  lowerDeviation?: number;
  upperLimit?: number;
  lowerLimit?: number;
}

export interface DimensionReference283 {
  entityId: string;
  entityType: 'VERTEX' | 'EDGE' | 'FACE' | 'AXIS' | 'DATUM' | 'COMPONENT';
  componentPath?: string[]; // For assembly context
  point?: [number, number, number]; // Pick point for disambiguation
}

export interface DimensionStyle283 {
  font: string;
  textHeight: number;
  lineWidth: number;
  arrowSize: number;
  color: string;
  precision: number;
  unitSystem: 'METRIC' | 'IMPERIAL';
  showTrailingZeros: boolean;
  dualDimensions: boolean;
}

export interface EngineeringDimension283 {
  id: string;
  type: DimensionType283;
  references: DimensionReference283[];
  nominalValue: number;
  actualValue?: number; // From measurement
  tolerance: DimensionTolerance283;
  unit: string;
  source: DimensionSource283;
  status: DimensionStatus283;
  revision: string;
  associatedViewId?: string; // For Drawing context
  
  // Graphical properties
  placement: {
    origin: [number, number, number];
    direction: [number, number, number];
    textOffset: [number, number, number];
  };
  
  style: DimensionStyle283;
  visibility: boolean;
  metadata: Record<string, any>;
}

export interface DimensionEvidence283 {
  dimensionId: string;
  timestamp: string;
  modelRevision: string;
  value: number;
  tolerance: DimensionTolerance283;
  status: DimensionStatus283;
  hash: string; // Integrity hash
}
