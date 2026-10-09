/**
 * SECP CAD Kernel — Parametric Sketch Dimension Types
 * PATCH-193: Sketch Editing & Dimensioning
 */

import { Vector2D } from '../IndustrialConstraintTypes';

export type DimensionType =
  | 'DISTANCE'
  | 'HORIZONTAL_DISTANCE'
  | 'VERTICAL_DISTANCE'
  | 'LINE_LENGTH'
  | 'RADIUS'
  | 'DIAMETER'
  | 'ANGLE'
  | 'ARC_LENGTH'
  | 'PERPENDICULAR_DISTANCE';

export type DimensionUnit = 'mm' | 'cm' | 'm' | 'in' | 'deg' | 'rad';

export type ToleranceType = 'NONE' | 'SYMMETRIC' | 'DEVIATION' | 'LIMIT';

export interface DimensionTolerance {
  type: ToleranceType;
  upper: number;
  lower: number;
}

export interface DimensionProvenanceEntry {
  timestamp: string;
  action: 'CREATED' | 'EDITED' | 'CONVERTED_TO_DRIVING' | 'CONVERTED_TO_REFERENCE' | 'DELETED';
  previousValue?: number;
  newValue: number;
  isDriving: boolean;
  authorId: string;
  transactionId: string;
}

export interface DimensionProvenance {
  creator: string;
  createdAt: string;
  modificationHistory: DimensionProvenanceEntry[];
}

export interface SketchDimension {
  id: string;
  name: string;
  type: DimensionType;
  entityIds: string[];          // References to points, lines, circles, arcs
  constraintId: string;         // Underlying GCS constraint ID (if driving or associated)
  value: number;                // Base numeric value in standard internal units (mm for linear, deg for angular)
  displayValue: number;         // Value converted to active display unit
  unit: DimensionUnit;          // Unit chosen for display / input
  isDriving: boolean;           // True = Driving (controls geometry), False = Reference / Driven (measurement only)
  position: Vector2D;           // Visual placement coordinate of dimension text / annotation
  textOffset?: Vector2D;
  tolerance?: DimensionTolerance;
  expression?: string;          // Optional algebraic expression e.g. "D1 / 2 + 5"
  provenance: DimensionProvenance;
}

export interface DimensionCreateSpec {
  id?: string;
  name?: string;
  type?: DimensionType;
  entityIds: string[];
  value?: number;
  unit?: DimensionUnit;
  isDriving?: boolean;
  position?: Vector2D;
  expression?: string;
  tolerance?: DimensionTolerance;
  authorId?: string;
}
