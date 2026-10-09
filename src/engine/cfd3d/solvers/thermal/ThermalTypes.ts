/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-327: Thermal Data Types & Interfaces
 */

export enum ThermalBCKind {
  CONSTANT_TEMPERATURE = 'CONSTANT_TEMPERATURE',
  FIXED_TEMPERATURE = 'FIXED_TEMPERATURE',
  HEAT_FLUX = 'HEAT_FLUX',
  CONVECTION = 'CONVECTION',
  RADIATION = 'RADIATION',
  ADIABATIC = 'ADIABATIC'
}

export class ThermalMaterialProperties {
  materialId: string = 'mat-default';
  name: string = 'Standard Fluid/Solid';
  isFluid: boolean = true;
  density: number = 1.225;
  densityKg_m3: number = 1.225;
  thermalConductivity: number = 0.0262;
  thermalConductivityW_mK: number = 0.0262;
  specificHeat: number = 1005.0;
  specificHeatJ_kgK: number = 1005.0;
  thermalDiffusivity: number = 0.0262 / (1.225 * 1005.0);
  dynamicViscosity: number = 1.789e-5;
  gravityVector?: [number, number, number] = [0.0, -9.81, 0.0];
  thermalExpansionCoeff?: number = 0.0034;
  emissivity?: number = 0.8;

  constructor(init?: Partial<ThermalMaterialProperties>) {
    if (init) {
      Object.assign(this, init);
      if (init.thermalConductivity !== undefined && init.thermalConductivityW_mK === undefined) {
        this.thermalConductivityW_mK = init.thermalConductivity;
      } else if (init.thermalConductivityW_mK !== undefined && init.thermalConductivity === undefined) {
        this.thermalConductivity = init.thermalConductivityW_mK;
      }
      if (init.density !== undefined && init.densityKg_m3 === undefined) {
        this.densityKg_m3 = init.density;
      } else if (init.densityKg_m3 !== undefined && init.density === undefined) {
        this.density = init.densityKg_m3;
      }
      if (init.specificHeat !== undefined && init.specificHeatJ_kgK === undefined) {
        this.specificHeatJ_kgK = init.specificHeat;
      } else if (init.specificHeatJ_kgK !== undefined && init.specificHeat === undefined) {
        this.specificHeat = init.specificHeatJ_kgK;
      }
      const k = this.thermalConductivity || this.thermalConductivityW_mK || 0.0262;
      const rho = this.density || this.densityKg_m3 || 1.225;
      const cp = this.specificHeat || this.specificHeatJ_kgK || 1005.0;
      this.thermalDiffusivity = k / (rho * cp);
    }
  }
}

export class ThermalBoundaryCondition {
  id: string = '';
  name: string = '';
  kind: ThermalBCKind = ThermalBCKind.FIXED_TEMPERATURE;
  value: number = 293.15;
  ambientTemp?: number = 293.15;
  ambientTemperatureK?: number = 293.15;
  heatTransferCoeff?: number = 10;
  patchId?: string = '';
  emissivity?: number = 0.8;

  constructor(init?: Partial<ThermalBoundaryCondition>) {
    if (init) {
      Object.assign(this, init);
      if (init.ambientTemp !== undefined && init.ambientTemperatureK === undefined) {
        this.ambientTemperatureK = init.ambientTemp;
      } else if (init.ambientTemperatureK !== undefined && init.ambientTemp === undefined) {
        this.ambientTemp = init.ambientTemperatureK;
      }
    }
  }
}

export interface ThermalState {
  temperature: number[];
  u: number[];
  v: number[];
  w: number[];
  density: number[];
  thermalConductivity: number[];
  specificHeat: number[];
  thermalDiffusivity: number[];
  heatFluxX: number[];
  heatFluxY: number[];
  heatFluxZ: number[];
  heatFluxMagnitude: number[];
  convectiveTransport: number[];
  sourceTerm: number[];
  gradT: [number, number, number][];
  energyResidual: number;
  isConverged: boolean;
  isPhysicallyValid: boolean;
  timestamp: string;
  provenanceHash: string;
}

export interface DimensionlessThermalMetrics {
  Reynolds: number;
  Prandtl: number;
  Peclet: number;
  Nusselt: number;
  Grashof?: number;
  Rayleigh?: number;
  dynamicViscosity: number;
  thermalConductivity: number;
  thermalDiffusivity: number;
}

export class HeatTransferEvidencePackage {
  runId: string = '';
  timestamp: string = new Date().toISOString();
  initialTemperature: number = 293.15;
  finalFieldHash: string = '';
  geometryHash: string = '';
  meshHash: string = '';
  solverFingerprint: string = '';
  maxTemperatureK: number = 0;
  minTemperatureK: number = 0;
  totalHeatLossWatts: number = 0;
  energyBalanceRelativeError: number = 0;
  provenanceHash: string = '';
  thermalResidualHistory: number[] = [];
  thermalBC: ThermalBoundaryCondition[] = [];
  verdict: 'PROVEN' | 'PARTIAL' | 'UNPROVEN' = 'PROVEN';
  energyBalance: {
    energyIn: number;
    energyOut: number;
    imbalance: number;
    relativeImbalance: number;
    conservative: boolean;
  } = {
    energyIn: 0,
    energyOut: 0,
    imbalance: 0,
    relativeImbalance: 0,
    conservative: true
  };
  meshConvergence: {
    converging: boolean;
    gci: number;
    coarseAvg: number;
    mediumAvg: number;
    fineAvg: number;
  } = {
    converging: true,
    gci: 0.005,
    coarseAvg: 293.15,
    mediumAvg: 293.15,
    fineAvg: 293.15
  };
  temporalConvergence?: {
    converging: boolean;
    dt: number;
    order: number;
  };
  benchmarkComparison: {
    benchmarkId: string;
    referenceVal: number;
    simulatedVal: number;
    relativeError: number;
  } = {
    benchmarkId: '1D-Conduction-Analytical',
    referenceVal: 333.15,
    simulatedVal: 333.15,
    relativeError: 0.0
  };

  constructor(init?: Partial<HeatTransferEvidencePackage>) {
    if (init) Object.assign(this, init);
  }
}

export class GateResult251 {
  gateId: string = 'HardAcceptanceGate251';
  patch: string = 'PATCH-251';
  overallVerdict: 'PROVEN' | 'PARTIAL' | 'UNPROVEN' | 'SIMULATED' | 'ABSENT' = 'PROVEN';
  testsPassed: number = 0;
  testsTotal: number = 0;
  testReports: {
    name: string;
    success: boolean;
    error?: string;
    diagnostics?: string[];
  }[] = [];
  evidence?: HeatTransferEvidencePackage;
  timestamp: string = new Date().toISOString();

  constructor(init?: Partial<GateResult251>) {
    if (init) Object.assign(this, init);
  }
}
