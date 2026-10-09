/**
 * SECP Industrial OS — EPC-019: Parametric Airframe Types
 * Comprehensive Domain-Agnostic & Aerospace Specification Contracts
 * for Parametric CAD Modeling, Topology, Mass Properties, and Traceability.
 */

import { Vector3D, CadSolidEntity } from '../../cadKernel';
import { BRepValidationResult } from '../../cad-kernel/brep/BRepContracts';
import { TopoShape } from '../../cad-kernel/topology/TopologyContracts';

export type AirframeDomain = 'INDUSTRIAL_DRONE' | 'AEROSPACE' | 'ROBOTICS' | 'MECHANICAL';
export type AirframeModelType = 'PARAMETRIC_CAD' | 'CAD';
export type AirframeLifecycleStatus = 'DESIGN_DEFINED' | 'ACTIVE' | 'QUALIFIED' | 'RELEASED' | 'REVISED';

export type ConstraintType = 'GEOMETRIC' | 'STRUCTURAL' | 'CLEARANCE' | 'MANUFACTURING' | 'PHYSICS';

export interface DesignLimitDefinition {
  readonly limitId: string;
  readonly parameterName: string;
  readonly constraintType: ConstraintType;
  readonly value: number;
  readonly unit: string;
  readonly description: string;
  readonly source: string;
}

export interface AirframeParameter<T = number | string | boolean> {
  readonly parameterId: string;
  readonly name: string;
  readonly value: T;
  readonly unit: string;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly default: T;
  readonly description: string;
  readonly source: string;
  readonly revision: string;
}

export interface ParameterDependencyNode {
  readonly parameterId: string;
  readonly parameterName: string;
  readonly dependsOn: readonly string[];
  readonly impacts: readonly string[];
  readonly formulaDescription: string;
}

export interface ParameterDependencyGraph {
  readonly graphId: string;
  readonly nodes: readonly ParameterDependencyNode[];
  readonly evaluationOrder: readonly string[];
  readonly hasCycles?: boolean;
}

export type AirframeFeatureType =
  | 'BODY_UPPER_DECK'
  | 'BODY_LOWER_DECK'
  | 'BODY_STANDOFF'
  | 'ARM_BEAM'
  | 'MOTOR_MOUNT_BRACKET'
  | 'PAYLOAD_MOUNT_RAIL'
  | 'BATTERY_MOUNT_TRAY'
  | 'LANDING_GEAR_BRACKET';

export interface AirframeGeometricFeature {
  readonly featureId: string;
  readonly name: string;
  readonly type: AirframeFeatureType;
  readonly category: string;
  readonly partNumber: string;
  readonly sequence: number;
  readonly dimensions: {
    readonly lengthMm: number;
    readonly widthMm: number;
    readonly heightMm: number;
    readonly radiusMm?: number;
    readonly thicknessMm?: number;
  };
  readonly position: Vector3D;
  readonly rotation: Vector3D;
  readonly materialId: string;
  readonly materialName: string;
  readonly densityKgM3: number;
  readonly volumeM3: number;
  readonly surfaceAreaM2: number;
  readonly massKg: number;
  readonly centerOfGravity: Vector3D;
  readonly localInertia: {
    readonly Ixx: number;
    readonly Iyy: number;
    readonly Izz: number;
    readonly Ixy: number;
    readonly Ixz: number;
    readonly Iyz: number;
  };
  readonly solidEntity: CadSolidEntity;
  readonly brepShape?: TopoShape;
  readonly brepValidation?: BRepValidationResult;
  readonly traceableRequirementIds: readonly string[];
  readonly traceableSubsystemId: string;
}

export interface AirframeInertiaTensor {
  readonly Ixx: number;
  readonly Iyy: number;
  readonly Izz: number;
  readonly Ixy: number;
  readonly Ixz: number;
  readonly Iyz: number;
  readonly principalMoments: readonly [number, number, number];
}

export interface AirframeMassProperties {
  readonly totalVolumeM3: number;
  readonly totalSurfaceAreaM2: number;
  readonly totalMassKg: number;
  readonly centerOfGravity: Vector3D;
  readonly inertiaTensor: AirframeInertiaTensor;
  readonly massBreakdownByFeature: Readonly<Record<string, number>>;
  readonly calculationMethod: 'PHYSICS_BASED_DERIVATION';
}

export interface AirframeTopologyValidation {
  readonly isValid: boolean;
  readonly manifoldStatus: 'MANIFOLD' | 'NON_MANIFOLD' | 'OPEN' | 'UNPROVEN';
  readonly solidCount: number;
  readonly shellCount: number;
  readonly faceCount: number;
  readonly edgeCount: number;
  readonly vertexCount: number;
  readonly eulerCharacteristic: number;
  readonly selfIntersectionFree: boolean;
  readonly degenerateGeometryFree: boolean;
  readonly openShellDetected: boolean;
  readonly nonManifoldDetected: boolean;
  readonly diagnostics: readonly string[];
}

export interface AirframeStructuralInterface {
  readonly interfaceId: string;
  readonly name: string;
  readonly fromComponent: string;
  readonly toComponent: string;
  readonly interfaceType: 'MECHANICAL_BOLTED' | 'MECHANICAL_SLIDING' | 'VIBRATION_ISOLATED' | 'HINGE_FOLDING';
  readonly fastenerSpecification: string;
  readonly nominalClearanceMm: number;
  readonly contactAreaMm2: number;
  readonly traceableRequirementId: string;
  readonly traceableSubsystemId: string;
}

export interface ParametricAirframeConfig {
  // Central Body Parameters
  bodyLength: number; // mm
  bodyWidth: number; // mm
  bodyHeight: number; // mm
  bodyPlateThickness: number; // mm

  // Arm Parameters
  armCount: number; // e.g. 4, 6, 8
  armLength: number; // mm
  armWidth: number; // mm
  armThickness: number; // mm
  armOffsetZ: number; // mm

  // Motor Mount Parameters
  motorMountDiameter: number; // mm
  motorMountThickness: number; // mm
  motorMountOffset: number; // mm

  // Payload Mount Parameters
  payloadMountLength: number; // mm
  payloadMountWidth: number; // mm
  payloadMountHeight: number; // mm
  payloadClearance: number; // mm

  // Battery Mount Parameters
  batteryMountLength: number; // mm
  batteryMountWidth: number; // mm
  batteryMountHeight: number; // mm
  batteryClearance: number; // mm

  // Landing Gear Mount Parameters
  landingGearMountSpacing: number; // mm
  landingGearMountDiameter: number; // mm

  // Global Clearances & Materials
  structuralClearance: number; // mm
  fastenerDiameter: number; // mm
  bodyMaterialId: string;
  armMaterialId: string;
  mountMaterialId: string;
}

export interface ParametricAirframeModel {
  readonly modelId: 'DRONE-AIRFRAME-001';
  readonly caseId: 'EPC-CASE-001';
  readonly domain: 'INDUSTRIAL_DRONE';
  readonly modelType: 'PARAMETRIC_CAD';
  readonly name: string;
  readonly description: string;
  readonly revision: string;
  readonly lifecycleStatus: AirframeLifecycleStatus;
  readonly variantCode: string;
  readonly parameters: Readonly<Record<string, AirframeParameter<any>>>;
  readonly dependencyGraph: ParameterDependencyGraph;
  readonly features: readonly AirframeGeometricFeature[];
  readonly massProperties: AirframeMassProperties;
  readonly topologyValidation: AirframeTopologyValidation;
  readonly interfaces: readonly AirframeStructuralInterface[];
  readonly designLimits: readonly DesignLimitDefinition[];
  readonly cadKernelVersion: string;
  readonly contentHash: string;
  readonly geometryHash: string;
  readonly topologyHash: string;
  readonly parameterHash: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly author: string;
}

export interface AirframeRevisionDiff {
  readonly previousRevision: string;
  readonly newRevision: string;
  readonly timestamp: string;
  readonly changedParameters: ReadonlyArray<{
    readonly parameterName: string;
    readonly oldValue: any;
    readonly newValue: any;
    readonly unit: string;
  }>;
  readonly deltaMassKg: number;
  readonly deltaCG: Vector3D;
  readonly deltaInertia: {
    readonly deltaIxx: number;
    readonly deltaIyy: number;
    readonly deltaIzz: number;
  };
  readonly regeneratedFeatures: readonly string[];
  readonly impactReport: {
    readonly structuralImpact: string;
    readonly propulsionImpact: string;
    readonly massBudgetImpact: string;
  };
}

export interface EPC019ValidationResult {
  readonly epc: 'EPC-019';
  readonly verdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  readonly evidenceHash: string;
  readonly checks: Readonly<Record<string, { readonly passed: boolean; readonly message: string; readonly details?: unknown }>>;
  readonly summary: {
    readonly totalChecks: number;
    readonly passedChecks: number;
    readonly failedChecks: number;
  };
  readonly provenance: {
    readonly timestamp: string;
    readonly cadKernelVersion: string;
    readonly agent: string;
    readonly executionDurationMs: number;
  };
}
