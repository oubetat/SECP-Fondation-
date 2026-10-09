/**
 * PATCH-222 — Bearing Engineering Subsystem Types
 * Comprehensive data structures, mathematical definitions, ISO/DIN/ANSI standard registries,
 * parametric geometry definitions, tolerance classes, and kinematic models.
 */

import { Vector3D } from '../../cadKernel';
import { Transform3D, AssemblyConstraint, AssemblyComponent, PartDefinition } from '../AssemblyConstraintTypes';

export type BearingType =
  | 'DEEP_GROOVE_BALL'
  | 'ANGULAR_CONTACT_BALL'
  | 'SELF_ALIGNING_BALL'
  | 'CYLINDRICAL_ROLLER'
  | 'TAPERED_ROLLER'
  | 'SPHERICAL_ROLLER'
  | 'NEEDLE_ROLLER'
  | 'THRUST_BALL'
  | 'THRUST_ROLLER';

export type BearingConfiguration =
  | 'OPEN'
  | 'SHIELDED_ZZ'
  | 'SEALED_2RS'
  | 'FLANGED'
  | 'SINGLE_ROW'
  | 'DOUBLE_ROW'
  | 'SNAP_RING_GROOVE';

export type BearingStandard =
  | 'ISO'
  | 'DIN'
  | 'ANSI_ABMA'
  | 'JIS';

export type ComplianceStatus = 'VERIFIED' | 'PARTIAL' | 'UNVERIFIED';

export type ToleranceClass =
  | 'ABEC_1_NORMAL' // ISO Normal / P0
  | 'ABEC_3_P6'     // ISO P6
  | 'ABEC_5_P5'     // ISO P5
  | 'ABEC_7_P4'     // ISO P4
  | 'ABEC_9_P2';    // ISO P2

export type RadialClearanceClass =
  | 'C2'  // Smaller than Normal
  | 'CN'  // Normal
  | 'C3'  // Greater than Normal
  | 'C4'  // Greater than C3
  | 'C5'; // Greater than C4

export type BearingMaterialGrade =
  | 'BEARING_STEEL_100CR6'
  | 'STAINLESS_STEEL_440C'
  | 'CERAMIC_SI3N4'
  | 'HYBRID_CERAMIC';

export interface BearingMaterialProperties {
  grade: BearingMaterialGrade;
  name: string;
  densityKgM3: number;
  elasticModulusGPa: number;
  poissonsRatio: number;
  thermalExpansionPpmK: number;
  hardness: string;
  isHybrid: boolean;
}

export const BEARING_MATERIALS: Record<BearingMaterialGrade, BearingMaterialProperties> = {
  BEARING_STEEL_100CR6: {
    grade: 'BEARING_STEEL_100CR6',
    name: 'Through-Hardened Bearing Steel (100Cr6 / AISI 52100)',
    densityKgM3: 7830,
    elasticModulusGPa: 210,
    poissonsRatio: 0.30,
    thermalExpansionPpmK: 11.7,
    hardness: '60-64 HRC',
    isHybrid: false
  },
  STAINLESS_STEEL_440C: {
    grade: 'STAINLESS_STEEL_440C',
    name: 'Martensitic Stainless Steel (AISI 440C / X105CrMo17)',
    densityKgM3: 7750,
    elasticModulusGPa: 200,
    poissonsRatio: 0.28,
    thermalExpansionPpmK: 10.2,
    hardness: '58-60 HRC',
    isHybrid: false
  },
  CERAMIC_SI3N4: {
    grade: 'CERAMIC_SI3N4',
    name: 'Silicon Nitride Ceramic (Si3N4 ISO 26602)',
    densityKgM3: 3200,
    elasticModulusGPa: 310,
    poissonsRatio: 0.26,
    thermalExpansionPpmK: 3.2,
    hardness: '1600 HV10',
    isHybrid: false
  },
  HYBRID_CERAMIC: {
    grade: 'HYBRID_CERAMIC',
    name: 'Hybrid Bearing (100Cr6 Rings + Si3N4 Rolling Elements)',
    densityKgM3: 6500, // effective composite density
    elasticModulusGPa: 250,
    poissonsRatio: 0.28,
    thermalExpansionPpmK: 8.5,
    hardness: 'Ring 62HRC / Ball 1600HV',
    isHybrid: true
  }
};

export interface BearingCoordinateSystem {
  origin: Vector3D;
  axis: Vector3D;           // Main rotational/axial center axis (default: 0, 0, 1)
  radialDirection: Vector3D; // Primary radial vector (default: 1, 0, 0)
  axialDirection: Vector3D;  // Normal axial direction (default: 0, 0, 1)
}

export interface BRepTopologySummary {
  solidType: 'BEARING_COMPOUND_SOLID';
  shellCount: number;        // Inner ring + Outer ring + Rolling elements + Cage + Seals
  faceCount: number;
  edgeCount: number;
  vertexCount: number;
  isWatertight: boolean;
  eulerCharacteristic: number; // Sum of Euler characteristics for constituent solids
}

export interface BearingRollingElementSpec {
  elementType: 'BALL' | 'CYLINDRICAL_ROLLER' | 'TAPERED_ROLLER' | 'SPHERICAL_ROLLER' | 'NEEDLE_ROLLER';
  count: number;             // Algorithmic ball/roller count Z
  diameter: number;          // Dw in mm
  length?: number;           // Lw in mm (for roller bearings)
  pitchDiameter: number;     // dm = (d + D)/2 in mm
  orbitRadius: number;       // dm / 2 in mm
  angularSpacingDeg: number; // 360 / Z in deg
  contactAngleDeg: number;   // alpha in deg
  racewayCurvatureInner: number; // ri = 0.52 * Dw
  racewayCurvatureOuter: number; // ro = 0.53 * Dw
}

export interface BearingRingSpec {
  innerRingBore: number;     // d in mm
  innerRingOD: number;       // d1 shoulder in mm
  innerRingWidth: number;    // B in mm
  innerRacewayRadius: number; // raceway bottom radius in mm
  outerRingOD: number;       // D in mm
  outerRingBore: number;     // D1 shoulder in mm
  outerRingWidth: number;    // B in mm
  outerRacewayRadius: number; // raceway top radius in mm
  chamferMin: number;        // r_min in mm
  flangeOD?: number;         // For flanged bearings (D1)
  flangeWidth?: number;      // For flanged bearings (C1)
  snapRingGrooveOD?: number; // For snap ring groove
}

export interface BearingMassProperties {
  volumeMm3: number;
  volumeM3: number;
  massKg: number;
  centerOfMass: Vector3D;
  boundingBox: {
    min: Vector3D;
    max: Vector3D;
  };
  momentOfInertiaZzKgMm2: number;
}

export interface BearingDefinition {
  bearingId: string;
  standard: BearingStandard;
  standardDoc: string;       // e.g. "ISO 15:2017", "DIN 625-1"
  manufacturerClass: string; // e.g. "Metric Series Deep Groove"
  partNumber: string;        // e.g. "6204", "6204-2RS", "7204-B"
  bearingType: BearingType;
  boreDiameter: number;      // d (mm)
  outerDiameter: number;     // D (mm)
  width: number;             // B / T / H (mm)
  configuration: BearingConfiguration;
  toleranceClass: ToleranceClass;
  radialClearanceClass: RadialClearanceClass;
  material: BearingMaterialGrade;
  cageMaterial: 'STEEL_STAMPED' | 'BRASS_MACHINED' | 'POLYAMIDE_PA66';
  sealMaterial?: 'NBR_RUBBER' | 'STEEL_SHIELD_SPCC' | 'VITON_FKM';
  dynamicLoadRatingC_kN: number;  // ISO 281 basic dynamic load
  staticLoadRatingC0_kN: number; // ISO 76 basic static load
  limitingSpeedRpm: number;
  referenceSpeedRpm: number;
  
  // Parametric calculated properties
  rings: BearingRingSpec;
  rollingElements: BearingRollingElementSpec;
  massProperties: BearingMassProperties;
  topologySummary: BRepTopologySummary;
  coordinateSystem: BearingCoordinateSystem;
  
  revision: string;          // e.g. "REV-A"
  geometryHash: string;      // Deterministic SHA-256
  topologyHash: string;      // Deterministic SHA-256
  provenanceHash: string;
  createdAt: string;
}

export type ShaftFitClass = 'h6' | 'j6' | 'k5' | 'm5' | 'n6' | 'p6' | 'CUSTOM';
export type HousingFitClass = 'H7' | 'J7' | 'K7' | 'M7' | 'N7' | 'P7' | 'CUSTOM';

export type FitType = 'CLEARANCE_FIT' | 'TRANSITION_FIT' | 'INTERFERENCE_FIT';

export interface BearingFitAnalysis {
  shaftFit: {
    shaftDiameterMm: number;
    nominalBoreMm: number;
    fitClass: ShaftFitClass;
    shaftLowerDevUm: number;
    shaftUpperDevUm: number;
    boreLowerDevUm: number;
    boreUpperDevUm: number;
    minFitUm: number;        // positive = clearance, negative = interference
    maxFitUm: number;
    fitType: FitType;
    recommendation: string;
    operatingExpansionMm: number;
  };
  housingFit: {
    housingBoreMm: number;
    nominalODMm: number;
    fitClass: HousingFitClass;
    housingLowerDevUm: number;
    housingUpperDevUm: number;
    odLowerDevUm: number;
    odUpperDevUm: number;
    minFitUm: number;
    maxFitUm: number;
    fitType: FitType;
    recommendation: string;
    operatingContractionMm: number;
  };
  operatingInternalClearanceUm: number;
  operatingClearanceStatus: 'PASS' | 'WARNING' | 'FAIL';
}

export interface BearingClearanceAnalysis {
  radialClearanceMm: number;
  axialClearanceMm: number;
  housingClearanceMm: number;
  neighboringComponentClearanceMm: number;
  status: 'PASS' | 'WARNING' | 'FAIL';
  diagnostics: string[];
}

export interface BearingInterferenceAnalysis {
  hasInterference: boolean;
  shaftInterferenceMm: number;
  housingInterferenceMm: number;
  sealCollision: boolean;
  cageCollision: boolean;
  status: 'PASS' | 'WARNING' | 'FAIL';
  diagnostics: string[];
}

export interface BearingInstance {
  instanceId: string;
  bearingDefinitionId: string;
  partNumber: string;
  name: string;
  assemblyId: string;
  placementTransform: Transform3D;
  worldTransform: Transform3D;
  motionModel: 'ROTATIONAL_FREE' | 'AXIAL_SLIDING' | 'CONSTRAINED' | 'FIXED';
  currentRotationDeg: number;
  innerRingSpeedRpm: number;
  outerRingSpeedRpm: number;
  cageSpeedRpm: number;
  ballSpinSpeedRpm: number;
  matingShaftId?: string;
  matingHousingId?: string;
  fitAnalysis?: BearingFitAnalysis;
  clearanceAnalysis?: BearingClearanceAnalysis;
  interferenceAnalysis?: BearingInterferenceAnalysis;
  suppressed: boolean;
  fixed: boolean;
  revision: number;
}

export type ShaftRecognitionVerdict =
  | 'COMPATIBLE'
  | 'CLEARANCE_REQUIRED'
  | 'INTERFERENCE'
  | 'INCOMPATIBLE';

export interface ShaftRecognitionResult {
  shaftInstanceId: string;
  detectedDiameterMm: number;
  bearingBoreMm: number;
  differenceMm: number;
  verdict: ShaftRecognitionVerdict;
  suggestedFitClass: ShaftFitClass;
  axisCenter: Vector3D;
  axisDirection: Vector3D;
  shoulderPositionZ?: number;
}

export interface BearingBOMEntry {
  itemNumber: string;
  partNumber: string;
  bearingType: string;
  sizeDimension: string; // e.g. "20 x 47 x 14 mm"
  quantity: number;
  standard: string;
  material: string;
  configuration: string;
  revision: string;
  instanceIds: string[];
}
