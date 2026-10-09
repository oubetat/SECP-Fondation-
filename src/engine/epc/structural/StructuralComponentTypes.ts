/**
 * SECP Industrial OS — EPC-020: Structural Component Types
 * Universal Engineering Contracts for Industrial Drone Structural Components,
 * B-Rep Solid Geometry, Materials, Assembly Integration, Mass Properties,
 * FEA Readiness, Manufacturing Definitions, Revision Control, and Traceability.
 */

import { Vector3D, CadSolidEntity } from '../../cadKernel';
import { AirframeInertiaTensor } from '../airframe/ParametricAirframeTypes';
import { Material } from '../../materials';

export type StructuralComponentType =
  | 'ARM'
  | 'MOTOR_MOUNT'
  | 'LANDING_GEAR'
  | 'PAYLOAD_STRUCTURE'
  | 'BATTERY_STRUCTURE';

export type ComponentLifecycleStatus =
  | 'DESIGN_DEFINED'
  | 'ACTIVE'
  | 'QUALIFIED'
  | 'RELEASED'
  | 'REVISED';

export type ManufacturingProcessType =
  | 'CNC_MILLING_5AXIS'
  | 'AUTOCLAVE_COMPOSITE_MOLDING'
  | 'INJECTION_MOLDING'
  | 'ADDITIVE_MANUFACTURING_DMLS'
  | 'SHEET_METAL_BENDING';

export type SectionGeometryType = 'RECTANGULAR_BOX' | 'CIRCULAR_TUBE' | 'I_BEAM' | 'CUSTOM_PROFILE';

export interface StructuralParameter<T = number | string | boolean> {
  readonly parameterId: string;
  readonly name: string;
  readonly value: T;
  readonly unit: string;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly default: T;
  readonly description: string;
  readonly source: string;
}

export interface MaterialReference {
  readonly materialId: string;
  readonly materialName: string;
  readonly category: string;
  readonly densityKgM3: number;
  readonly youngModulusGPa: number;
  readonly poissonsRatio: number;
  readonly yieldStrengthMPa: number;
  readonly ultimateStrengthMPa: number;
  readonly thermalConductivityWMK: number;
  readonly revision: string;
  readonly provenance: string;
}

export interface GeometricDimensionSpec {
  readonly name: string;
  readonly nominalMm: number;
  readonly toleranceMm: number;
  readonly upperLimitMm: number;
  readonly lowerLimitMm: number;
  readonly isCritical: boolean;
}

export interface ManufacturingDefinition {
  readonly process: ManufacturingProcessType;
  readonly materialName: string;
  readonly rawStockSpecification: string;
  readonly standardTolerances: string;
  readonly surfaceRoughnessRaUm: number;
  readonly criticalDimensions: readonly GeometricDimensionSpec[];
  readonly inspectionRequirements: readonly string[];
  readonly camToolpathReady: boolean;
  readonly estimatedCycleTimeMinutes: number;
  readonly qualityStandard: string;
}

export interface BoundaryConditionDefinition {
  readonly boundaryId: string;
  readonly name: string;
  readonly type: 'FIXED_SUPPORT' | 'PINNED' | 'ELASTIC_FOUNDATION' | 'SLIDING_CONTACT' | 'PRESCRIBED_DISPLACEMENT';
  readonly locationDescription: string;
  readonly constrainedDOFs: readonly ('TX' | 'TY' | 'TZ' | 'RX' | 'RY' | 'RZ')[];
}

export interface StructuralLoadCaseDefinition {
  readonly loadCaseId: string;
  readonly name: string;
  readonly description: string;
  readonly loadType: 'POINT_FORCE' | 'DISTRIBUTED_PRESSURE' | 'TORQUE' | 'INERTIAL_ACCELERATION' | 'DYNAMIC_IMPACT';
  readonly magnitudeN: number;
  readonly direction: Vector3D;
  readonly applicationPoint: Vector3D;
  readonly safetyFactorRequired: number;
  readonly boundaryConditions: readonly BoundaryConditionDefinition[];
  readonly analysisReferenceId: string;
}

export interface StructuralAnalysisReference {
  readonly analysisId: string;
  readonly analysisType: 'STATIC_STRESS' | 'MODAL_VIBRATION' | 'BUCKLING_ANALYSIS' | 'FATIGUE_LIFE';
  readonly targetSolver: 'SECP_STRUCTURAL_FEA' | 'EPC025_FEA_SOLVER' | 'EPC026_DYNAMICS_SOLVER';
  readonly status: 'PENDING_EPC025' | 'FEA_READY' | 'VALIDATED';
  readonly meshRequirements: {
    readonly elementType: 'TET10_QUADRATIC' | 'HEX20_SERENDIPITY' | 'SHELL_QUAD4';
    readonly targetElementSizeMm: number;
    readonly maxAspectRatio: number;
  };
  readonly allowableVonMisesStressMPa: number;
  readonly expectedMinimumSafetyFactor: number;
}

export interface ComponentAssemblyInterface {
  readonly interfaceId: string;
  readonly name: string;
  readonly mateKind: 'FIXED' | 'COINCIDENT' | 'CONCENTRIC' | 'DISTANCE' | 'PARALLEL';
  readonly matingTargetComponentId: string;
  readonly matingTargetType: string;
  readonly localAttachmentPoint: Vector3D;
  readonly contactAreaMm2: number;
  readonly fastenerSpecification: string;
  readonly fastenerQuantity: number;
  readonly tighteningTorqueNm: number;
  readonly traceableRequirementId: string;
}

export interface ComponentCoordinateSystem {
  readonly origin: Vector3D;
  readonly normal: Vector3D;
  readonly up: Vector3D;
  readonly eulerAnglesDeg: Vector3D;
}

export interface StructuralMassProperties {
  readonly volumeM3: number;
  readonly volumeCm3: number;
  readonly surfaceAreaM2: number;
  readonly massKg: number;
  readonly massGrams: number;
  readonly centerOfGravity: Vector3D;
  readonly inertiaTensor: AirframeInertiaTensor;
  readonly calculationMethod: 'PHYSICS_BASED_DERIVATION';
}

export interface StructuralComponent {
  readonly componentId: string;
  readonly productId: string;
  readonly caseId: 'EPC-CASE-001';
  readonly componentType: StructuralComponentType;
  readonly name: string;
  readonly partNumber: string;
  readonly revision: string;
  readonly status: ComponentLifecycleStatus;
  readonly coordinateSystem: ComponentCoordinateSystem;
  readonly parameterSet: Readonly<Record<string, StructuralParameter<any>>>;
  readonly materialReference: MaterialReference;
  readonly geometryReference: {
    readonly solidEntity: CadSolidEntity;
    readonly boundingDimensionsMm: {
      readonly length: number;
      readonly width: number;
      readonly height: number;
      readonly radius?: number;
    };
    readonly vertexCount: number;
    readonly faceCount: number;
    readonly isManifold: boolean;
    readonly eulerCharacteristic: number;
    readonly geometryHash: string;
  };
  readonly massProperties: StructuralMassProperties;
  readonly loadCases: readonly StructuralLoadCaseDefinition[];
  readonly analysisReferences: readonly StructuralAnalysisReference[];
  readonly manufacturingDefinition: ManufacturingDefinition;
  readonly assemblyInterfaces: readonly ComponentAssemblyInterface[];
  readonly traceableRequirementIds: readonly string[];
  readonly evidenceReferences: readonly string[];
  readonly contentHash: string;
  readonly parameterHash: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly author: string;
}

// ============================================================================
// Parameter Interfaces for the 5 Key Components
// ============================================================================

export interface ArmParametersConfig {
  readonly length: number; // mm (e.g. 280)
  readonly width: number; // mm (e.g. 25)
  readonly height: number; // mm (e.g. 20)
  readonly wallThickness: number; // mm (e.g. 2.0)
  readonly sectionType: SectionGeometryType; // 'RECTANGULAR_BOX' | 'CIRCULAR_TUBE'
  readonly mountingHolePattern: {
    readonly boltCircleDiameterMm: number; // e.g. 20
    readonly holeCount: number; // e.g. 4
    readonly holeDiameterMm: number; // e.g. 3.2 (M3 clearance)
  };
  readonly materialId?: string;
}

export interface MotorMountParametersConfig {
  readonly mountDiameter: number; // mm (e.g. 60)
  readonly boltPattern: {
    readonly boltCircleDiameterMm: number; // e.g. 25 (standard M3 25mm circle)
    readonly holeCount: number; // e.g. 4
    readonly threadSpec: string; // 'M3'
  };
  readonly mountThickness: number; // mm (e.g. 4.0)
  readonly hubDiameter: number; // mm (e.g. 12)
  readonly materialId?: string;
}

export interface LandingGearParametersConfig {
  readonly gearHeight: number; // mm (e.g. 180)
  readonly footprintWidth: number; // mm (e.g. 320)
  readonly legLength: number; // mm (e.g. 220)
  readonly legThickness: number; // mm (e.g. 16)
  readonly mountingPosition: Vector3D; // mm e.g. { x: 90, y: 90, z: -20 }
  readonly materialId?: string;
}

export interface PayloadStructureParametersConfig {
  readonly payloadLength: number; // mm (e.g. 160)
  readonly payloadWidth: number; // mm (e.g. 90)
  readonly payloadHeight: number; // mm (e.g. 40)
  readonly mountingPattern: {
    readonly railLengthMm: number; // e.g. 180
    readonly railSpacingMm: number; // e.g. 60
    readonly slotWidthMm: number; // e.g. 4.5
  };
  readonly supportThickness: number; // mm (e.g. 3.0)
  readonly materialId?: string;
}

export interface BatteryStructureParametersConfig {
  readonly batteryLength: number; // mm (e.g. 180)
  readonly batteryWidth: number; // mm (e.g. 75)
  readonly batteryHeight: number; // mm (e.g. 50)
  readonly clearance: number; // mm (e.g. 4.0)
  readonly wallThickness: number; // mm (e.g. 2.5)
  readonly mountingPattern: {
    readonly trayLengthMm: number; // e.g. 200
    readonly strapSlotsCount: number; // e.g. 4
    readonly railSpacingMm: number; // e.g. 70
  };
  readonly materialId?: string;
}

export interface StructuralSubsystemModel {
  readonly subsystemId: 'SUBSYSTEM-STRUCTURAL-001';
  readonly name: string;
  readonly revision: string;
  readonly components: readonly StructuralComponent[];
  readonly assemblyHierarchy: {
    readonly root: string;
    readonly parentChildPairs: readonly Array<{ readonly parentId: string; readonly childId: string; readonly relation: string }>;
  };
  readonly assemblyMatesCount: number;
  readonly collisionCheck: {
    readonly passed: boolean;
    readonly clashCount: number;
    readonly details: readonly string[];
  };
  readonly aggregateMassProperties: {
    readonly totalComponentsCount: number;
    readonly totalVolumeM3: number;
    readonly totalMassKg: number;
    readonly centerOfGravity: Vector3D;
    readonly inertiaTensor: AirframeInertiaTensor;
    readonly massBreakdownByType: Readonly<Record<StructuralComponentType, number>>;
  };
  readonly contentHash: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface EPC020EvidencePackage {
  readonly packageId: 'EPC020-EVIDENCE';
  readonly caseId: 'EPC-CASE-001';
  readonly epcNumber: 'EPC-020';
  readonly title: 'SECP EPC-020: Industrial Drone Structural Components Evidence Package';
  readonly timestamp: string;
  readonly components: readonly StructuralComponent[];
  readonly structuralSubsystem: StructuralSubsystemModel;
  readonly materialLedger: readonly MaterialReference[];
  readonly loadCaseRegistry: readonly StructuralLoadCaseDefinition[];
  readonly manufacturingLedger: readonly ManufacturingDefinition[];
  readonly requirementTraceability: readonly Array<{
    readonly requirementId: string;
    readonly componentIds: readonly string[];
    readonly status: 'LINKED' | 'VERIFIED';
  }>;
  readonly revisionLedger: readonly Array<{
    readonly componentId: string;
    readonly revision: string;
    readonly contentHash: string;
    readonly timestamp: string;
  }>;
  readonly canonicalPackageHash: string;
  readonly provenanceChain: readonly string[];
}

export interface EPC020ValidationResult {
  readonly epc: 'EPC-020';
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
