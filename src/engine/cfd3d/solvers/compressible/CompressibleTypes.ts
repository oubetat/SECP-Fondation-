/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-253 — Compressible CFD Types & Data Structures
 */

export enum CompressibleFailureCode253 {
  INVALID_EOS = 'INVALID_EOS',
  NEGATIVE_DENSITY = 'NEGATIVE_DENSITY',
  NEGATIVE_PRESSURE = 'NEGATIVE_PRESSURE',
  INVALID_THERMODYNAMIC_STATE = 'INVALID_THERMODYNAMIC_STATE',
  CFL_FAILURE = 'CFL_FAILURE',
  NUMERICAL_FLUX_FAILURE = 'NUMERICAL_FLUX_FAILURE',
  SHOCK_CAPTURING_FAILURE = 'SHOCK_CAPTURING_FAILURE',
  COMPRESSIBLE_SOLVER_DIVERGENCE = 'COMPRESSIBLE_SOLVER_DIVERGENCE',
  MASS_CONSERVATION_FAILURE = 'MASS_CONSERVATION_FAILURE',
  ENERGY_CONSERVATION_FAILURE = 'ENERGY_CONSERVATION_FAILURE',
  THERMODYNAMIC_CONSISTENCY_FAILURE = 'THERMODYNAMIC_CONSISTENCY_FAILURE',
  COMPRESSIBLE_VALIDATION_FAILURE = 'COMPRESSIBLE_VALIDATION_FAILURE'
}

export enum FluxSchemeType {
  UPWIND = 'UPWIND',
  CENTRAL = 'CENTRAL',
  LAX_FRIEDRICHS = 'LAX_FRIEDRICHS',
  HLL = 'HLL'
}

export interface CompressiblePhysicsModel {
  readonly gasConstant: number;      // R (e.g. 287 J/kg*K for Air)
  readonly specificHeatRatio: number;// gamma (e.g. 1.4)
  readonly referencePressure: number;// Pa
  readonly referenceTemperature: number; // K
  readonly fluxScheme: FluxSchemeType;
  readonly enableShockCapturing: boolean;
  readonly artificialViscosity: number;
}

export interface ThermodynamicState {
  readonly density: number;
  readonly pressure: number;
  readonly temperature: number;
  readonly internalEnergy: number; // e = Cv * T
  readonly enthalpy: number;       // h = Cp * T
  readonly totalEnergy: number;    // E = e + 0.5 * |u|^2
  readonly speedOfSound: number;   // a = sqrt(gamma * R * T)
  readonly machNumber: number;     // M = |u| / a
}

export interface CompressibleBC {
  readonly patchId: string;
  readonly type: 'INLET' | 'OUTLET' | 'WALL';
  readonly totalPressure?: number;
  readonly totalTemperature?: number;
  readonly staticPressure?: number;
  readonly staticTemperature?: number;
  readonly velocity?: [number, number, number];
  readonly wallType?: 'ADIABATIC' | 'ISOTHERMAL';
  readonly wallTemperature?: number;
}

export interface CompressibleFlowDiagnostics {
  readonly maxMach: number;
  readonly meanMach: number;
  readonly minDensity: number;
  readonly maxDensity: number;
  readonly minPressure: number;
  readonly maxPressure: number;
  readonly meanTemperature: number;
  readonly maxCFL: number;
  readonly massImbalance: number;
  readonly energyImbalance: number;
  readonly shockCellsCount: number;
}

export interface CompressibleFlowEvidencePackage {
  readonly geometryHash: string;
  readonly meshHash: string;
  readonly fluidIdentity: string;
  readonly equationOfState: string;
  readonly thermodynamicProperties: { gasConstant: number; gamma: number };
  readonly boundaryConditions: CompressibleBC[];
  readonly initialConditions: {
    density: number[];
    velocity: [number, number, number][];
    pressure: number[];
  };
  readonly fluxScheme: FluxSchemeType;
  readonly riemannSolver: string;
  readonly cflSettings: { maxCFL: number; adaptiveDt: boolean };
  readonly solverConfiguration: { isSteady: boolean; maxIterations: number };
  readonly residualHistory: { mass: number[]; momentum: number[]; energy: number[] };
  readonly conservationAudit: {
    massError: number;
    energyError: number;
    passed: boolean;
  };
  readonly thermodynamicConsistency: {
    passed: boolean;
    maxDeviation: number;
  };
  readonly meshConvergence: {
    coarseGCI: number;
    fineGCI: number;
    converging: boolean;
  };
  readonly temporalConvergence: {
    dtList: number[];
    passed: boolean;
  };
  readonly benchmarkComparisons: {
    benchmarkId: string;
    passed: boolean;
    theoreticalVal: number;
    simulatedVal: number;
    relativeError: number;
  }[];
  readonly errorMetrics: { l1: number; l2: number; lInfin: number };
  readonly deterministicReproduction: { passed: boolean; fingerprint: string };
  readonly finalVerdict: 'PROVEN' | 'PARTIAL' | 'UNPROVEN' | 'SIMULATED' | 'ABSENT';
}
