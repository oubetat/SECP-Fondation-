export enum FatigueVerdict {
  SAFE_FOR_DEFINED_CRITERION = 'SAFE_FOR_DEFINED_CRITERION',
  FATIGUE_FAILURE = 'FATIGUE_FAILURE',
  INSUFFICIENT_LIFE = 'INSUFFICIENT_LIFE',
  NOT_CONVERGED = 'NOT_CONVERGED',
  INVALID_STRESS_HISTORY = 'INVALID_STRESS_HISTORY',
  INVALID_LOAD_HISTORY = 'INVALID_LOAD_HISTORY',
  INVALID_MATERIAL_DATA = 'INVALID_MATERIAL_DATA',
  MISSING_FATIGUE_CURVE = 'MISSING_FATIGUE_CURVE',
  CYCLE_COUNTING_FAILURE = 'CYCLE_COUNTING_FAILURE',
  MEAN_STRESS_CORRECTION_FAILURE = 'MEAN_STRESS_CORRECTION_FAILURE',
  OUTSIDE_MATERIAL_DATA_RANGE = 'OUTSIDE_MATERIAL_DATA_RANGE',
  DAMAGE_MODEL_FAILURE = 'DAMAGE_MODEL_FAILURE',
  STRUCTURAL_RESPONSE_FAILURE = 'STRUCTURAL_RESPONSE_FAILURE',
  REFERENCE_VALIDATION_FAILURE = 'REFERENCE_VALIDATION_FAILURE',
  INDEPENDENT_VERIFICATION_FAILURE = 'INDEPENDENT_VERIFICATION_FAILURE',
  NUMERICAL_FAILURE = 'NUMERICAL_FAILURE',
  NOT_SUPPORTED = 'NOT_SUPPORTED',
  VERIFIED = 'VERIFIED'
}

export enum MeanStressCorrectionMethod {
  GOODMAN = 'GOODMAN',
  GERBER = 'GERBER',
  SODERBERG = 'SODERBERG',
  NONE = 'NONE'
}

export enum CycleCountingMethod {
  RAINFLOW = 'RAINFLOW',
  CONSTANT_AMPLITUDE = 'CONSTANT_AMPLITUDE'
}

export enum DamageRule {
  LINEAR_MINER = 'LINEAR_MINER'
}

export enum ExtrapolationPolicy {
  REJECT = 'REJECT',
  OUTSIDE_MATERIAL_DATA_RANGE = 'OUTSIDE_MATERIAL_DATA_RANGE'
}

export interface LoadHistory {
  historyId: string;
  time: number[];
  loadVector: number[][];
  loadScale?: number;
  duration?: number;
  units: string;
  historyHash: string;
}

export interface StressHistory {
  locationId: string;
  elementId: number;
  integrationPoint: number;
  tensor?: number[][];
  time: number[];
  principalStresses?: number[][];
  equivalentStress: number[];
  units: string;
}

export interface StrainHistory {
  locationId: string;
  elementId: number;
  integrationPoint: number;
  tensor?: number[][];
  time: number[];
  principalStrains?: number[][];
  equivalentStrain: number[];
  units: string;
}

export interface ExtractedCycle {
  cycleId: number;
  count: number;             // 1.0 for full cycle, 0.5 for half cycle
  range: number;             // Delta_sigma = sigma_max - sigma_min
  amplitude: number;         // sigma_a = Delta_sigma / 2
  mean: number;              // sigma_m = (sigma_max + sigma_min) / 2
  stressRatio: number;       // R = sigma_min / sigma_max
  maxStress: number;
  minStress: number;
  correctedAmplitude?: number;
  damage?: number;
  cyclesToFailure?: number;
  startPointIndex?: number;
  endPointIndex?: number;
}

export interface SNPoint {
  stressAmplitude: number;   // Pa or MPa
  cyclesToFailure: number;   // N_f
}

export interface SNMaterialModel {
  materialId: string;
  name?: string;
  curveData?: SNPoint[];
  curveType: 'TABULATED' | 'BASQUIN';
  basquinParams?: {
    sf_prime: number;        // Fatigue strength coefficient (Pa or MPa)
    b: number;               // Fatigue strength exponent (-0.12 to -0.05 typical)
    E?: number;              // Young's Modulus
  };
  stressRatio?: number;      // R (e.g., -1 for fully reversed)
  uts: number;               // Ultimate Tensile Strength (Pa or MPa)
  yieldStrength?: number;    // Yield Strength (Pa or MPa)
  surfaceCondition?: string;
  enduranceLimit?: number;   // Se
  units: string;
  sourceMetadata?: string;
}

export interface ENMaterialModel {
  materialId: string;
  sf_prime: number;          // Fatigue strength coefficient
  b: number;                 // Fatigue strength exponent
  ef_prime: number;          // Fatigue ductility coefficient
  c: number;                 // Fatigue ductility exponent
  E: number;                 // Elastic modulus
  uts?: number;
  yieldStrength?: number;
  units: string;
}

export interface FatigueHotspot {
  elementId: number;
  integrationPoint: number;
  locationId: string;
  coordinate?: number[];
  stressHistory: StressHistory;
  strainHistory?: StrainHistory;
  damage: number;
  predictedLife: number;     // Number of repetitions/blocks or total cycles
  governingCycle?: ExtractedCycle;
  governingCriterion: string;
}

export interface FatigueAnalysisModel {
  modelId: string;
  meshId: string;
  loadHistory?: LoadHistory;
  fatigueMaterialModel: SNMaterialModel;
  enMaterialModel?: ENMaterialModel;
  cycleCountingMethod: CycleCountingMethod;
  meanStressCorrection: MeanStressCorrectionMethod;
  damageRule: DamageRule;
  units: string;
}

export interface FatigueStateHash {
  structuralStateHash: string;
  loadHistoryHash: string;
  materialFatigueHash: string;
  cycleCountingPolicy: string;
  meanStressPolicy: string;
  damageRule: string;
  solverConfiguration: string;
  compositeHash: string;
}

export interface FatigueEvidence {
  modelId?: string;
  structuralStateHash?: string;
  loadHistoryHash?: string;
  materialHash?: string;
  fatigueCurveHash?: string;
  cycleCounter?: string;
  cycleCountHash?: string;
  meanStressMethod?: string;
  damageRule?: string;
  hotspot?: FatigueHotspot;
  hotspots?: FatigueHotspot[];
  cycles?: ExtractedCycle[];
  totalCycles?: number;
  stateHash?: string;
  stressRange?: number;
  stressAmplitude?: number;
  meanStress?: number;
  cycleCount?: number;
  damage: number;
  cumulativeDamage?: number;
  predictedLife: number;
  governingCycle?: ExtractedCycle;
  convergence?: boolean;
  independentVerification?: boolean;
  verdict: FatigueVerdict;
  details?: string;
}

export interface HardAcceptanceGate086Check {
  id: string;
  description: string;
  passed: boolean;
  details?: string;
}

export interface HardAcceptanceGate086Report {
  verdict: string;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  checks: HardAcceptanceGate086Check[];
  evidence?: FatigueEvidence;
  timestamp: string;
}

export type FatigueResult = FatigueEvidence;

