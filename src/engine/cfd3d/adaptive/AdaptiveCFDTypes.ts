/**
 * SECP Industrial OS v2 — Adaptive Industrial CFD Engine Types
 * Phase 15 (PATCH-174)
 *
 * Defines the comprehensive data models, configuration schemas, diagnostics,
 * monitoring structures, and adaptive control contracts for industrial CFD.
 */

export type FlowRegime = 'INCOMPRESSIBLE' | 'SUBSONIC' | 'TRANSONIC' | 'SUPERSONIC' | 'HYPERSONIC';
export type TimeIntegrationScheme = 'STEADY_STATE' | 'EXPLICIT_EULER' | 'IMPLICIT_EULER' | 'CRANK_NICOLSON' | 'DUAL_TIME_STEPPING';
export type SpatialDiscretizationScheme = 'FIRST_ORDER_UPWIND' | 'SECOND_ORDER_UPWIND' | 'QUICK' | 'TVD_MINMOD' | 'TVD_VAN_LEER' | 'TVD_SUPERBEE' | 'ROE' | 'AUSM_PLUS';
export type BoundaryType = 'INLET' | 'OUTLET' | 'WALL' | 'WALL_NO_SLIP' | 'WALL_SLIP' | 'WALL_MOVING' | 'SYMMETRY' | 'PRESSURE_INLET' | 'PRESSURE_OUTLET' | 'VELOCITY_INLET' | 'VELOCITY_OUTLET' | 'FARFIELD';

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface BoundingBox3D {
  min: Vector3D;
  max: Vector3D;
}

export interface FluidPhysicalProperties {
  readonly name?: string;
  readonly densityKgM3?: number;
  readonly viscosityPaS?: number;
  readonly density?: number;
  readonly viscosity?: number;
  readonly specificHeat?: number;
  readonly specificHeatRatio?: number;
  readonly gasConstant?: number;
  readonly thermalConductivity?: number;
  readonly specificHeatRatioGamma?: number; // e.g. 1.4 for air
  readonly specificGasConstantR?: number;   // e.g. 287.058 J/(kg·K)
  readonly thermalConductivityWMK?: number; // e.g. 0.026 W/(m·K)
  readonly referenceTemperatureK?: number;
  readonly referencePressurePa?: number;
}

export type FluidProperties3D = FluidPhysicalProperties;

export interface BoundaryConditionDef {
  readonly patchId?: string;
  readonly patchName?: string;
  readonly name?: string;
  readonly type: BoundaryType;
  readonly faceIndices?: number[];
  readonly velocity?: Vector3D;
  readonly u?: number;
  readonly v?: number;
  readonly w?: number;
  readonly pressurePa?: number;
  readonly temperatureK?: number;
  readonly turbulentKineticEnergyK?: number;
  readonly turbulentDissipationOmega?: number;
  readonly wallVelocity?: Vector3D;
  readonly wallTemperatureK?: number;
}

export type CaseBoundaryCondition3D = BoundaryConditionDef;

export interface CaseDefinition3D {
  readonly caseId?: string;
  readonly name?: string;
  readonly description?: string;
  readonly dimension?: string;
  readonly flowRegime?: FlowRegime;
  readonly referenceVelocityMS?: number;
  readonly referenceLengthM?: number;
  readonly characteristicLengthM?: number;
  readonly referenceAreaM2?: number;
  readonly fluid: FluidPhysicalProperties;
  readonly boundaryConditions: Record<string, BoundaryConditionDef> | BoundaryConditionDef[];
  readonly timeIntegration?: TimeIntegrationScheme;
  readonly spatialScheme?: SpatialDiscretizationScheme;
  readonly initialConditions?: {
    velocity?: Vector3D;
    pressurePa?: number;
    temperatureK?: number;
    turbulentKineticEnergyK?: number;
    turbulentDissipationRate?: number;
  };
  readonly turbulenceModelIdentity?: string;
  readonly targetConvergence?: {
    residualTolerance?: number;
    maxIterations?: number;
    monitorTolerance?: number; // relative change in Cd, Cl, deltaP
    minConsecutiveConvergedIters?: number;
  };
}

export interface MeshQualityReport {
  readonly isValid: boolean;
  readonly totalCells: number;
  readonly totalFaces: number;
  readonly totalNodes: number;
  readonly boundaryFaces: number;
  readonly internalFaces: number;
  readonly maxNonOrthogonalityDeg: number;
  readonly avgNonOrthogonalityDeg: number;
  readonly maxSkewness: number;
  readonly avgSkewness: number;
  readonly maxAspectRatio: number;
  readonly maxCellVolumeRatio: number;
  readonly minCellVolumeM3: number;
  readonly maxCellVolumeM3: number;
  readonly qualityGrade: 'EXCELLENT' | 'GOOD' | 'ACCEPTABLE' | 'DEGRADED' | 'UNSUITABLE';
  readonly warnings: string[];
  readonly criticalErrors: string[];
}

export interface PreFlightCheckReport {
  readonly isReadyForSolve: boolean;
  readonly checkedItems: {
    readonly code: string;
    readonly name: string;
    readonly passed: boolean;
    readonly message: string;
  }[];
  readonly identifiedRisks: string[];
  readonly recommendedAdjustments: string[];
}

export interface AdaptiveCFLState {
  readonly currentCFL: number;
  readonly targetCFL: number;
  readonly minCFL: number;
  readonly maxCFL: number;
  readonly currentTimestepS: number;
  readonly minTimestepS: number;
  readonly maxTimestepS: number;
  readonly temporalErrorEstimate: number;
  readonly cflHistory: number[];
  readonly timestepHistory: number[];
}

export interface DynamicRelaxationState {
  readonly alphaPressure: number;
  readonly alphaMomentum: number;
  readonly alphaEnergy: number;
  readonly alphaTurbulence: number;
  readonly alphaDensity: number;
  readonly adaptationCount: number;
  readonly history: {
    iter: number;
    alphaP: number;
    alphaU: number;
    reason: string;
  }[];
}

export interface ResidualSnapshot {
  readonly iteration: number;
  readonly continuityL2: number;
  readonly continuityLInf: number;
  readonly momentumXL2: number;
  readonly momentumYL2: number;
  readonly momentumZL2: number;
  readonly energyL2?: number;
  readonly densityL2?: number;
  readonly maxResidual: number;
  readonly isMonotonicallyDecreasing: boolean;
}

export interface PhysicalMonitorsSnapshot {
  readonly iteration: number;
  readonly dragCoefficientCd: number;
  readonly liftCoefficientCl: number;
  readonly totalPressureDropPa: number;
  readonly inletMassFlowKgS: number;
  readonly outletMassFlowKgS: number;
  readonly massFlowImbalancePercent: number;
  readonly maxMachNumber: number;
  readonly wallMaxShearStressPa: number;
  readonly dragChangePercent20Iters: number;
  readonly isPhysicallyStabilized: boolean;
}

export interface DivergenceRecoveryRecord {
  readonly eventId: string;
  readonly iteration: number;
  readonly triggerReason: string;
  readonly recoveryActionsTaken: string[];
  readonly previousGoodStateIteration: number;
  readonly successfulRecovery: boolean;
}

import {
  ConservationIterationTelemetry,
  MassConservationMetrics,
  MomentumConservationMetrics,
  EnergyConservationMetrics,
  ContinuityMetrics,
  PhysicalBoundsReport,
  FluxBalanceReport
} from '../conservation/enforcement/ConservationEnforcementTypes';

export interface ShockSensorReport {
  readonly maxDucrosSensor: number;
  readonly maxPressureGradient: number;
  readonly shockDetected: boolean;
  readonly shockFrontCellCount: number;
  readonly highestLocalMach: number;
}

export interface AdaptiveCFDSolution {
  readonly caseId: string;
  readonly converged: boolean;
  readonly totalIterations: number;
  readonly acceptedIterations: number;
  readonly rejectedIterations: number;
  readonly totalSimulatedTimeS: number;
  readonly executionTimeMs: number;
  readonly finalResiduals: ResidualSnapshot;
  readonly finalMonitors: PhysicalMonitorsSnapshot;
  readonly finalMassConservation?: MassConservationMetrics;
  readonly finalMomentumConservation?: MomentumConservationMetrics;
  readonly finalEnergyConservation?: EnergyConservationMetrics;
  readonly finalContinuity?: ContinuityMetrics;
  readonly finalPhysicalBounds?: PhysicalBoundsReport;
  readonly finalFluxBalance?: FluxBalanceReport;
  readonly finalTurbulenceDiagnostics?: any;
  readonly conservationTelemetry?: ConservationIterationTelemetry[];
  readonly meshQuality: MeshQualityReport;
  readonly preFlight: PreFlightCheckReport;
  readonly cflState: AdaptiveCFLState;
  readonly relaxationState: DynamicRelaxationState;
  readonly shockReport: ShockSensorReport;
  readonly recoveryHistory: DivergenceRecoveryRecord[];
  readonly convergenceHistory: {
    iteration: number;
    residuals: ResidualSnapshot;
    monitors: PhysicalMonitorsSnapshot;
    cfl: number;
    dt: number;
  }[];
  readonly evidenceArtifact: {
    cryptographicHash: string;
    signature: string;
    timestamp: string;
    conservationVerified: boolean;
    massBalanceErrorPercent: number;
  };
}
