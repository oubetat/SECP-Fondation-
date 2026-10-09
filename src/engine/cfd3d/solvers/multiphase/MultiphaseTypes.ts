/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-252 — Multiphase CFD Types & Data Structures
 */

export enum MultiphaseFailureCode252 {
  INVALID_PHASE_PROPERTIES = 'INVALID_PHASE_PROPERTIES',
  PHASE_FRACTION_OUT_OF_BOUNDS = 'PHASE_FRACTION_OUT_OF_BOUNDS',
  INTERFACE_CFL_FAILURE = 'INTERFACE_CFL_FAILURE',
  MULTIPHASE_SOLVER_DIVERGENCE = 'MULTIPHASE_SOLVER_DIVERGENCE',
  MASS_CONSERVATION_FAILURE = 'MASS_CONSERVATION_FAILURE',
  VOLUME_CONSERVATION_FAILURE = 'VOLUME_CONSERVATION_FAILURE',
  SURFACE_TENSION_FAILURE = 'SURFACE_TENSION_FAILURE',
  SPURIOUS_CURRENT_FAILURE = 'SPURIOUS_CURRENT_FAILURE',
  INTERFACE_RESOLUTION_FAILURE = 'INTERFACE_RESOLUTION_FAILURE',
  MULTIPHASE_VALIDATION_FAILURE = 'MULTIPHASE_VALIDATION_FAILURE'
}

export enum InterfaceModelType {
  VOF = 'VOF',
  LEVEL_SET = 'LEVEL_SET',
  EULERIAN = 'EULERIAN',
  LAGRANGIAN = 'LAGRANGIAN'
}

export interface Phase {
  readonly phaseId: string;
  readonly name: string;
  readonly density: number;             // kg/m^3
  readonly viscosity: number;           // Pa*s
  readonly thermalConductivity?: number;// W/m*K
  readonly specificHeat?: number;       // J/kg*K
  readonly molecularWeight?: number;    // g/mol
}

export interface MultiphasePhysicsModel {
  readonly interfaceModel: InterfaceModelType;
  readonly gravityVector: [number, number, number];
  readonly surfaceTensionCoefficient: number; // N/m (sigma)
  readonly staticContactAngle: number;        // degrees (theta)
  readonly enableTurbulenceCoupling: boolean;
  readonly enableThermalCoupling: boolean;
  readonly enablePhaseChange: boolean;
}

export interface MultiphaseBC {
  readonly patchId: string;
  readonly phase1Fraction: number; // Inlet alpha_1
  readonly phase2Fraction: number; // Inlet alpha_2
  readonly contactAngle?: number;  // Wall contact angle
}

export interface MultiphaseDiagnostics {
  readonly time: number;
  readonly iteration: number;
  readonly minPhaseFraction: number;
  readonly maxPhaseFraction: number;
  readonly totalVolume1: number;
  readonly totalVolume2: number;
  readonly totalMass1: number;
  readonly totalMass2: number;
  readonly interfaceArea: number;
  readonly interfaceLocation: [number, number, number];
  readonly interfaceCFL: number;
  readonly massImbalance: number;
  readonly volumeImbalance: number;
  readonly maxSpuriousVelocity: number;
  readonly meanSpuriousVelocity: number;
  readonly spuriousCurrentStatus: 'STABLE' | 'UNSTABLE';
}

export interface MultiphaseEvidencePackage {
  readonly geometryHash: string;
  readonly meshHash: string;
  readonly phases: Phase[];
  readonly interfaceModel: InterfaceModelType;
  readonly surfaceTension: number;
  readonly gravity: [number, number, number];
  readonly boundaryConditions: MultiphaseBC[];
  readonly initialConditions: { alpha1: number[]; velocity: [number, number, number][] };
  readonly solverSettings: {
    isSteady: boolean;
    timeStep: number;
    maxIterations: number;
    underRelaxation: number;
  };
  readonly cflHistory: number[];
  readonly residualHistory: { momentum: number[]; continuity: number[]; phaseFraction: number[] };
  readonly phaseMassHistory: { phase1: number[]; phase2: number[] };
  readonly phaseVolumeHistory: { phase1: number[]; phase2: number[] };
  readonly interfaceMetrics: { area: number; curvature: number };
  readonly meshConvergence: {
    coarseGCI: number;
    fineGCI: number;
    converging: boolean;
  };
  readonly temporalConvergence: {
    dt: number;
    order: number;
    converging: boolean;
  };
  readonly conservationAudit: {
    relativeVolumeError: number;
    relativeMassError: number;
    isVolumeConservative: boolean;
    isMassConservative: boolean;
  };
  readonly benchmarkComparison: {
    benchmarkId: string;
    passed: boolean;
    referenceVal: number;
    simulatedVal: number;
    relativeError: number;
  };
  readonly errorMetrics: string[];
  readonly deterministicReproduction: {
    passed: boolean;
    fingerprint: string;
  };
  readonly finalVerdict: 'PROVEN' | 'PARTIAL' | 'UNPROVEN' | 'SIMULATED' | 'ABSENT';
}
