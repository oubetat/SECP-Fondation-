/**
 * SECP Industrial OS v2 — Conservation Enforcement Engine Types
 * Phase 16 (PATCH-175: Conservation Battery → Conservation Enforcement Engine)
 *
 * Formal contracts, budgets, state machine definitions, and telemetry data structures
 * for real-time inline conservation enforcement.
 */

export type ConservationState =
  | 'STABLE'
  | 'MONITORING'
  | 'WARNING'
  | 'RECOVERY'
  | 'RETRY'
  | 'CRITICAL'
  | 'REJECT'
  | 'FAIL_SAFE_STOP';

export type EnforcementDecision =
  | 'ACCEPT'
  | 'WARN'
  | 'RECOVER'
  | 'REJECT'
  | 'ABORT';

export type ResidualRegime =
  | 'CONVERGING'
  | 'STAGNATING'
  | 'OSCILLATING'
  | 'DIVERGING'
  | 'PHYSICALLY_INVALID';

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface ConservationBudget {
  equation: 'MASS' | 'MOMENTUM_X' | 'MOMENTUM_Y' | 'MOMENTUM_Z' | 'ENERGY' | 'CONTINUITY';
  absoluteTolerance: number;
  relativeTolerance: number;
  localTolerance: number;
  globalTolerance: number;
  warningThreshold: number;
  criticalThreshold: number;
}

export interface LocalDefectRecord {
  cellId: number;
  faceId?: number;
  region: string;
  equation: string;
  errorMagnitude: number;
  coordinates: Vector3D;
}

export interface MassConservationMetrics {
  totalMassKg: number;
  inletMassFluxKgS: number;
  outletMassFluxKgS: number;
  internalFluxSumKgS: number;
  massImbalanceKgS: number;
  relativeMassError: number;
  maxLocalContinuityErrorKgS: number;
  worstCell: LocalDefectRecord;
  passed: boolean;
}

export interface DirectionalMomentumMetrics {
  convectiveFluxN: number;
  pressureForceN: number;
  viscousForceN: number;
  bodyForceN: number;
  netForceN: number;
  momentumFluxImbalanceN: number;
  directionalConservationError: number;
  passed: boolean;
}

export interface MomentumConservationMetrics {
  mx: DirectionalMomentumMetrics;
  my: DirectionalMomentumMetrics;
  mz: DirectionalMomentumMetrics;
  totalMomentumResidual: number;
  worstCell: LocalDefectRecord;
  passed: boolean;
}

export interface EnergyConservationMetrics {
  convectiveEnergyFluxW: number;
  pressureWorkW: number;
  viscousDissipationW: number;
  heatFluxW: number;
  sourceTermsW: number;
  totalEnergyBalanceW: number;
  energyResidual: number;
  energyImbalanceW: number;
  relativeEnergyError: number;
  unphysicalEnergyCreationDetected: boolean;
  unphysicalEnergyDestructionDetected: boolean;
  worstCell: LocalDefectRecord;
  passed: boolean;
}

export interface ContinuityMetrics {
  maximumContinuityDefectKgS: number;
  meanContinuityDefectKgS: number;
  rmsContinuityDefectKgS: number;
  globalContinuityImbalanceKgS: number;
  worstCell: LocalDefectRecord;
  worstFace: { faceId: number; errorMagnitude: number };
  passed: boolean;
}

export interface ResidualEnforcementMetrics {
  absoluteResidual: number;
  normalizedResidual: number;
  rmsResidual: number;
  maxResidual: number;
  regime: ResidualRegime;
  stagnationCounter: number;
  oscillationCounter: number;
  divergenceFactor: number;
  passed: boolean;
}

export interface PhysicalBoundsViolation {
  variable: 'DENSITY' | 'PRESSURE' | 'TEMPERATURE' | 'VELOCITY' | 'ENERGY' | 'MACH' | 'TURBULENCE';
  cellId: number;
  value: number;
  limit: { min?: number; max?: number };
  severity: 'WARNING' | 'CRITICAL' | 'FATAL';
  message: string;
}

export interface PhysicalBoundsReport {
  isValid: boolean;
  violations: PhysicalBoundsViolation[];
  minDensity: number;
  maxDensity: number;
  minPressure: number;
  maxPressure: number;
  minTemperature: number;
  maxTemperature: number;
  maxVelocity: number;
  maxMach: number;
}

export interface FluxBalanceReport {
  massBalance: {
    inletFlux: number;
    outletFlux: number;
    wallFlux: number;
    internalNet: number;
    sourceNet: number;
    imbalance: number;
    relError: number;
  };
  momentumBalance: {
    fx_inflow: number;
    fx_outflow: number;
    fx_pressure: number;
    fx_viscous: number;
    fx_imbalance: number;
    fy_inflow: number;
    fy_outflow: number;
    fy_pressure: number;
    fy_viscous: number;
    fy_imbalance: number;
    fz_inflow: number;
    fz_outflow: number;
    fz_pressure: number;
    fz_viscous: number;
    fz_imbalance: number;
  };
  energyBalance: {
    inflowEnergy: number;
    outflowEnergy: number;
    heatAddition: number;
    workDone: number;
    imbalance: number;
    relError: number;
  };
}

export interface RecoveryActionLog {
  iteration: number;
  trigger: string;
  actionTaken: 'REDUCE_DT' | 'REDUCE_RELAXATION' | 'REDUCE_CFL' | 'SWITCH_LIMITER' | 'RESTORE_CHECKPOINT';
  previousValue: number;
  adjustedValue: number;
  timestamp: number;
}

export interface ConservationIterationTelemetry {
  iteration: number;
  timeStepS: number;
  state: ConservationState;
  decision: EnforcementDecision;
  isAccepted: boolean;
  rejectionReason?: string;
  mass: MassConservationMetrics;
  momentum: MomentumConservationMetrics;
  energy: EnergyConservationMetrics;
  continuity: ContinuityMetrics;
  residual: ResidualEnforcementMetrics;
  physicalBounds: PhysicalBoundsReport;
  fluxBalance: FluxBalanceReport;
  cfl: number;
  relaxationFactors: { alphaU: number; alphaP: number; alphaT?: number };
  recoveryActions: RecoveryActionLog[];
}

export interface ConservationCheckpoint {
  iteration: number;
  u: number[];
  v: number[];
  w: number[];
  p: number[];
  T?: number[];
  massImbalance: number;
  timestamp: number;
}

export interface ConservationRegressionEntry {
  caseId: string;
  name: string;
  massImbalanceBaseline: number;
  momentumResidualBaseline: number;
  energyImbalanceBaseline: number;
  continuityRmsBaseline: number;
  residualBaseline: number;
  maxIterationsBaseline: number;
  recordedDate: string;
}
