/**
 * SECP Industrial OS — EPC-025: Structural Load Cases Schema & Types
 * Unified, canonical schema for engineering structural load cases derived from
 * System Engineering Requirements (EPC-017), CAD Airframe (EPC-019),
 * Structural Components (EPC-020), Assembly Mates (EPC-021), Mass Properties (EPC-022),
 * Propulsion (EPC-023), and Aerodynamics (EPC-024).
 */

export type LoadCaseType =
  | 'STATIC_GRAVITY'
  | 'HOVER'
  | 'CLIMB_ACCELERATION'
  | 'DESCENT'
  | 'FORWARD_FLIGHT'
  | 'MANEUVER'
  | 'PAYLOAD'
  | 'MOTOR_PROPULSION'
  | 'LANDING'
  | 'ASYMMETRIC_FAILURE';

export interface Point3D {
  readonly x: number; // m
  readonly y: number; // m
  readonly z: number; // m
}

export interface Vector3D {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface OperatingCondition {
  readonly operatingConditionId: string;
  readonly flightState: string;
  readonly airspeedMps: number;
  readonly climbRateMps: number;
  readonly altitudeM: number;
  readonly temperatureC: number;
  readonly windSpeedMps: number;
  readonly linearAccelerationMps2: Vector3D;
  readonly angularAccelerationRadS2: {
    readonly roll: number;
    readonly pitch: number;
    readonly yaw: number;
  };
  readonly gLoadFactor: number;
  readonly description: string;
}

export interface ForceVector {
  readonly point: Point3D;
  readonly force: Vector3D; // N
  readonly frame: 'BODY' | 'GLOBAL';
  readonly componentName: string;
  readonly description: string;
}

export interface MomentVector {
  readonly point: Point3D;
  readonly moment: Vector3D; // Nm
  readonly frame: 'BODY' | 'GLOBAL';
  readonly componentName: string;
  readonly description: string;
}

export interface PressureLoadSpec {
  readonly surfaceId: string;
  readonly surfaceName: string;
  readonly magnitudePa: number;
  readonly normalDirection: Vector3D;
  readonly distributionType: 'UNIFORM' | 'PARABOLIC' | 'CFD_MAPPED';
}

export interface ThermalLoadSpec {
  readonly componentId: string;
  readonly componentName: string;
  readonly ambientTempC: number;
  readonly operatingTempC: number;
  readonly deltaTempC: number;
  readonly thermalExpansionCoeff: number; // 1/K
}

export interface ContactLoadSpec {
  readonly contactName: string;
  readonly masterSurface: string;
  readonly slaveSurface: string;
  readonly frictionCoeff: number;
  readonly normalForceN: number;
}

export interface MotorLoadSpec {
  readonly unitId: string;
  readonly motorId: string;
  readonly location: Point3D;
  readonly thrustN: number;
  readonly torqueNm: number;
  readonly mountReactionForceN: Vector3D;
  readonly mountReactionTorqueNm: Vector3D;
}

export interface PropulsionLoadSpec {
  readonly totalThrustN: number;
  readonly totalTorqueNm: number;
  readonly motorLoads: readonly MotorLoadSpec[];
}

export interface PayloadLoadSpec {
  readonly payloadMassKg: number;
  readonly cgLocation: Point3D;
  readonly attachmentPoint: Point3D;
  readonly gLoadVector: Vector3D;
  readonly attachmentForceN: Vector3D;
  readonly attachmentMomentNm: Vector3D;
}

export interface BoundaryConditionSpec {
  readonly bcId: string;
  readonly name: string;
  readonly targetName: string;
  readonly targetType: 'NODE' | 'SURFACE' | 'INTERFACE' | 'LANDING_GEAR';
  readonly constraintType: 'FIXED' | 'PINNED' | 'SLIDING' | 'GROUND_CONTACT';
  readonly constrainedDOFs: {
    readonly tx: boolean;
    readonly ty: boolean;
    readonly tz: boolean;
    readonly rx: boolean;
    readonly ry: boolean;
    readonly rz: boolean;
  };
  readonly location: Point3D;
}

export interface MaterialSpec {
  readonly materialId: string;
  readonly materialName: string;
  readonly revision: string;
  readonly densityKgM3: number;
  readonly youngsModulusPa: number;
  readonly poissonsRatio: number;
  readonly yieldStrengthPa: number;
  readonly ultimateStrengthPa: number;
}

export interface LoadFactorSpec {
  readonly limitLoadFactor: number;
  readonly ultimateSafetyFactor: number; // Standard aerospace FOS = 1.5
  readonly designLoadFactor: number; // limitLoadFactor * ultimateSafetyFactor
  readonly dynamicAmplificationFactor: number;
}

export interface CombinedLoadComponent {
  readonly category: 'GRAVITY' | 'INERTIAL' | 'PROPULSION' | 'AERODYNAMIC' | 'PAYLOAD' | 'THERMAL';
  readonly appliedForceN: Vector3D;
  readonly appliedMomentNm: Vector3D;
  readonly description: string;
}

export interface LoadCalculationModel {
  readonly formulaName: string;
  readonly formulaExpression: string;
  readonly inputs: Record<string, number | string>;
  readonly outputs: Record<string, number>;
  readonly units: Record<string, string>;
  readonly source: string;
}

export interface FEAHandoffSpec {
  readonly analysisType: 'STATIC_LINEAR' | 'DYNAMIC_IMPACT' | 'TRANSIENT_DYNAMIC' | 'MODAL_VIBRATION' | 'FATIGUE_ANALYSIS';
  readonly targetSolver: 'SECP_3D_FEA_SOLVER';
  readonly meshRevision: string;
  readonly elementTypes: readonly string[];
  readonly expectedMaxVonMisesStressMPa: number;
  readonly expectedMaxDeflectionMm: number;
  readonly acceptanceCriteria: string;
}

export interface StructuralLoadCase {
  readonly loadCaseId: string; // LC-001 through LC-010
  readonly caseId: string; // EPC-016-DRONE-ASSEMBLY
  readonly requirementIds: readonly string[];
  readonly name: string;
  readonly description: string;
  readonly loadType: LoadCaseType;
  readonly operatingCondition: OperatingCondition;

  readonly revisions: {
    readonly geometryRevision: string;
    readonly assemblyRevision: string;
    readonly materialRevision: string;
    readonly configurationId: string;
    readonly loadCaseRevision: string;
  };

  readonly massProperties: {
    readonly totalMassKg: number;
    readonly cgLocation: Point3D;
    readonly gravityMps2: number;
    readonly linearAccelerationMps2: Vector3D;
  };

  readonly loads: {
    readonly forces: readonly ForceVector[];
    readonly moments: readonly MomentVector[];
    readonly pressures: readonly PressureLoadSpec[];
    readonly thermals: readonly ThermalLoadSpec[];
    readonly contacts: readonly ContactLoadSpec[];
    readonly motorLoads: readonly MotorLoadSpec[];
    readonly propulsion: PropulsionLoadSpec;
    readonly payload: PayloadLoadSpec;
    readonly componentsBreakdown: readonly CombinedLoadComponent[];
  };

  readonly calculationModel: LoadCalculationModel;
  readonly factors: LoadFactorSpec;
  readonly boundaryConditions: readonly BoundaryConditionSpec[];
  readonly material: MaterialSpec;

  readonly feaHandoffSpec: FEAHandoffSpec;

  readonly status: 'DEFINED' | 'CALCULATED' | 'FEA_HANDOFF_READY';
  readonly verdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  readonly createdAt: string;
}

export interface LoadCaseRequirementTraceability {
  readonly loadCaseId: string;
  readonly loadCaseName: string;
  readonly requirementId: string;
  readonly requirementTitle: string;
  readonly requirementCategory: string;
  readonly operatingConditionId: string;
  readonly derivedLoadFormula: string;
  readonly limitLoadN: number;
  readonly designLoadN: number;
  readonly status: 'VERIFIED' | 'UNVERIFIED';
}

export interface LoadCasePhysicsValidationReport {
  readonly loadCaseId: string;
  readonly forceBalanceX: number; // N
  readonly forceBalanceY: number; // N
  readonly forceBalanceZ: number; // N
  readonly momentBalanceX: number; // Nm
  readonly momentBalanceY: number; // Nm
  readonly momentBalanceZ: number; // Nm
  readonly isEquilibriumSatisfied: boolean;
  readonly unitsCheckPassed: boolean;
  readonly materialStressMargin: number;
  readonly remarks: string;
}

export interface FEAHandoffPackage {
  readonly packageId: string;
  readonly timestamp: string;
  readonly totalLoadCases: number;
  readonly loadCases: readonly StructuralLoadCase[];
  readonly geometryRevision: string;
  readonly assemblyRevision: string;
  readonly materialRevision: string;
  readonly solverTarget: string;
  readonly hash: string;
}
