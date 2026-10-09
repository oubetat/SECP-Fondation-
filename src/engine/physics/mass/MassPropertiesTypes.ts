/**
 * SECP Core Physics Engine — Mass Properties Types & Interfaces
 * Unified Mass Properties Data Model for CAD Geometry, Parts, Subassemblies, and Assemblies.
 */

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface Transform3D {
  position: Vector3D;
  rotation: Vector3D; // Euler angles in radians (rx, ry, rz)
  scale?: Vector3D;
}

export type MassUnit = 'kg' | 'g';
export type LengthUnit = 'm' | 'mm';
export type InertiaUnit = 'kg·m²' | 'kg·mm²';
export type DensityUnit = 'kg/m³' | 'g/cm³';
export type VolumeUnit = 'm³' | 'mm³';

export interface MassPropertiesUnits {
  mass: MassUnit;
  length: LengthUnit;
  inertia: InertiaUnit;
  density: DensityUnit;
  volume: VolumeUnit;
}

export type ReferenceFrameType = 'LOCAL' | 'SUBASSEMBLY' | 'ASSEMBLY' | 'GLOBAL';

export interface MassPropertiesProvenance {
  inputHash: string;
  outputHash: string;
  calculationMethod: string;
  calculationVersion: string;
  computedAt: string;
  invalidationReason?: string;
  recalculationCount?: number;
  previousRevision?: string;
  newRevision?: string;
  [key: string]: any;
}

export interface MassProperties {
  mass: number;
  centerOfMass: Vector3D;
  inertiaTensor: number[][]; // 3x3 matrix
  referenceFrame: ReferenceFrameType;
  units: MassPropertiesUnits;
  volume: number;
  density: number;
  sourceGeometry?: string;
  sourceMaterial?: string;
  sourceTransform?: Transform3D;
  calculationMethod: string;
  calculationVersion: string;
  computedAt: string;
  provenance: MassPropertiesProvenance;
  isValid: boolean;
  validationMessages?: string[];
}

export type AnalyticalShapeType = 'BOX' | 'CYLINDER' | 'SPHERE' | 'HOLLOW_CYLINDER' | 'GENERAL_BREP';

export interface SolidGeometrySpec {
  shapeType: AnalyticalShapeType;
  dimensions: {
    dx?: number; // length in x (m or mm)
    dy?: number; // length in y
    dz?: number; // length in z
    radius?: number; // outer radius
    innerRadius?: number; // inner radius for hollow shapes
    height?: number; // height along cylinder axis
  };
  units: LengthUnit;
  isClosedSolid: boolean;
  hasValidTopology: boolean;
  geometryHash: string;
  name?: string;
}

export interface SolidValidationResult {
  isValid: boolean;
  volume: number;
  errors: string[];
}

export interface InertiaTensorSymmetryReport {
  isSymmetric: boolean;
  isPositiveDefinite: boolean;
  satisfiesTriangleInequality: boolean;
  maxSymmetryError: number;
  isValid: boolean;
  messages: string[];
}

export interface PrincipalInertiaResult {
  principalMoments: [number, number, number];
  principalAxes: number[][];
  reconstructionError: number;
}

export interface AnalyticalValidationReport {
  fixtureName: string;
  analyticalMass: number;
  secpMass: number;
  massErrorAbs: number;
  massErrorRel: number;
  analyticalCG: Vector3D;
  secpCG: Vector3D;
  cgErrorAbs: number;
  analyticalInertiaDiag: [number, number, number];
  secpInertiaDiag: [number, number, number];
  inertiaErrorAbs: number;
  inertiaErrorRel: number;
  tolerance: number;
  passed: boolean;
}
