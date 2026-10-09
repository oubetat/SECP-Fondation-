import { EvidenceBus314 } from '../engineering_ai/copilot/EvidenceBus314';

// ============================================================================
// 1. Core Types and Domain Structures
// ============================================================================

export type Sim2RealVerdict = 'PASS' | 'FAIL' | 'INCONCLUSIVE';

export type ComparisonState =
  | 'WAITING_FOR_DATA'
  | 'ALIGNING'
  | 'COMPARING'
  | 'VALID'
  | 'DEGRADED'
  | 'STALE'
  | 'FAILED'
  | 'INCONCLUSIVE';

export type ConfigMismatchType =
  | 'GEOMETRY_MISMATCH'
  | 'MATERIAL_MISMATCH'
  | 'LOAD_MISMATCH'
  | 'BOUNDARY_MISMATCH'
  | 'OPERATING_CONDITION_MISMATCH'
  | 'SENSOR_MISMATCH';

export type ComparisonDomain = 'CFD' | 'FEA' | 'THERMAL' | 'STRUCTURAL' | 'MACHINE' | 'PROCESS';

export interface SimulationRunFingerprint {
  simulationRunId: string;
  solver: string;
  solverVersion: string;
  modelName: string;
  modelRevision: string;
  meshVersion?: string;
  materialDatabaseVersion?: string;
  parameterSet?: Record<string, any>;
  boundaryConditions?: Record<string, any>;
  hardware?: string;
  timestamp: string;
}

export interface PhysicalTrialFingerprint {
  physicalTrialId: string;
  machineId: string;
  machineRevision: string;
  sensorConfigurationId: string;
  calibrationStatus: 'CALIBRATED' | 'EXPIRED' | 'UNVERIFIED';
  calibrationDate?: string;
  calibrationReference?: string;
  operatingConditions?: Record<string, any>;
  trialTimestamp: string;
}

export interface ComparisonScenario {
  scenarioId: string;
  domain: ComparisonDomain;
  geometry: string;
  material: string;
  operatingConditions: Record<string, any>;
  boundaryConditions: Record<string, any>;
  timeWindow: { start: string; end: string };
}

export interface SimulationMeasurement {
  variableName: string;
  unit: string;
  location: { x: number; y: number; z: number };
  coordinateSystem: string;
  timestamps: number[]; // relative ms or unix epoch
  values: number[];
  uncertainty?: number;
}

export interface PhysicalMeasurement {
  variableName: string;
  unit: string;
  location: { x: number; y: number; z: number };
  coordinateSystem: string;
  timestamps: number[];
  values: number[];
  sensorId: string;
  quality: 'VALID' | 'SUSPECT' | 'INVALID' | 'STALE' | 'FILTERED';
  rawValues?: number[];
  uncertainty?: number;
  filterHistory?: string[];
}

export interface VariableComparisonResult {
  variableName: string;
  unit: string;
  isCritical: boolean;
  count: number;
  
  // Statistical Point Metrics
  absoluteError: number[];
  signedError: number[];
  relativeError: number[];
  percentageError: number[];
  
  // Summary Error Metrics
  rmse: number;
  mae: number;
  maxAbsoluteError: number;
  meanBias: number;
  errorStdDev: number;
  correlation: number;
  rSquared: number;
  
  // Transient / Dynamical Metrics
  simPeak: number;
  measuredPeak: number;
  peakError: number;
  peakTimeErrorMs: number;
  settlingTimeErrorMs?: number;
  riseTimeErrorMs?: number;
  phaseErrorRad?: number;
  dominantFreqErrorHz?: number;
  
  // Uncertainty-Aware & Residuals
  totalUncertainty: number; // Combined Measurement + Model Uncertainty
  confidenceInterval: [number, number];
  residualPattern: 'NONE' | 'SYSTEMATIC_BIAS' | 'DRIFT' | 'OSCILLATION' | 'NONLINEAR_MISMATCH';
  modelBiasDetected: boolean;
  
  // Tolerance & Verdict
  targetMetric: 'RMSE' | 'MAE' | 'MAX_ERR' | 'BIAS';
  configuredTolerance: number;
  verdict: Sim2RealVerdict;
}

export interface AcceptanceMatrixItem {
  variableName: string;
  metricUsed: string;
  measuredValue: number;
  toleranceLimit: number;
  verdict: Sim2RealVerdict;
  isCritical: boolean;
}

export interface Sim2RealComparisonReport {
  comparisonId: string;
  scenarioId: string;
  simulationRun: SimulationRunFingerprint;
  physicalTrial: PhysicalTrialFingerprint;
  state: ComparisonState;
  detectedMismatches: ConfigMismatchType[];
  variableResults: Record<string, VariableComparisonResult>;
  acceptanceMatrix: AcceptanceMatrixItem[];
  globalVerdict: Sim2RealVerdict;
  limitations: string[];
  validationScope: {
    operatingRange: string;
    geometry: string;
    material: string;
    timeRange: string;
  };
  evidenceId: string;
  timestamp: string;
}

// ============================================================================
// 2. Unit Normalization & Coordinate Alignment
// ============================================================================

export class UnitNormalizer {
  public static normalizeToCanonical(value: number, unit: string): { value: number; canonicalUnit: string } {
    switch (unit) {
      case 'bar':
        return { value: value * 100000, canonicalUnit: 'Pa' };
      case 'psi':
        return { value: value * 6894.76, canonicalUnit: 'Pa' };
      case 'kPa':
        return { value: value * 1000, canonicalUnit: 'Pa' };
      case 'Fahrenheit':
        return { value: (value - 32) * (5 / 9), canonicalUnit: 'Celsius' };
      case 'Kelvin':
        return { value: value - 273.15, canonicalUnit: 'Celsius' };
      case 'mm':
        return { value: value / 1000, canonicalUnit: 'm' };
      case 'cm':
        return { value: value / 100, canonicalUnit: 'm' };
      default:
        return { value, canonicalUnit: unit };
    }
  }
}

// ============================================================================
// 3. Mathematical & Error Analytics Engine
// ============================================================================

export class Sim2RealMathEngine {
  public static calculateComparison(
    sim: SimulationMeasurement,
    phys: PhysicalMeasurement,
    toleranceMetric: 'RMSE' | 'MAE' | 'MAX_ERR' | 'BIAS',
    toleranceLimit: number,
    isCritical: boolean = false,
    simUncertainty: number = 0.05
  ): VariableComparisonResult {
    // 1. Unit Normalization
    const normSimVals = sim.values.map(v => UnitNormalizer.normalizeToCanonical(v, sim.unit).value);
    const normPhysVals = phys.values.map(v => UnitNormalizer.normalizeToCanonical(v, phys.unit).value);
    const canonicalUnit = UnitNormalizer.normalizeToCanonical(sim.values[0] || 0, sim.unit).canonicalUnit;

    const n = Math.min(normSimVals.length, normPhysVals.length);
    if (n === 0) {
      throw new Error('SIM2REAL_MATH_ERROR: Cannot calculate comparison with zero samples.');
    }

    const absErrors: number[] = [];
    const signedErrors: number[] = [];
    const relErrors: number[] = [];
    const pctErrors: number[] = [];

    let sumSquareErr = 0;
    let sumAbsErr = 0;
    let sumSignedErr = 0;

    let simPeak = 0;
    let physPeak = 0;
    let simPeakIdx = 0;
    let physPeakIdx = 0;

    for (let i = 0; i < n; i++) {
      const s = normSimVals[i];
      const p = normPhysVals[i];

      const signedErr = s - p; // Signed Error
      const absErr = Math.abs(signedErr);
      const relErr = Math.abs(p) > 1e-9 ? absErr / Math.abs(p) : 0;
      const pctErr = relErr * 100;

      signedErrors.push(signedErr);
      absErrors.push(absErr);
      relErrors.push(relErr);
      pctErrors.push(pctErr);

      sumSquareErr += signedErr * signedErr;
      sumAbsErr += absErr;
      sumSignedErr += signedErr;

      if (i === 0 || Math.abs(s) > Math.abs(simPeak)) {
        simPeak = s;
        simPeakIdx = i;
      }
      if (i === 0 || Math.abs(p) > Math.abs(physPeak)) {
        physPeak = p;
        physPeakIdx = i;
      }
    }

    const rmse = Math.sqrt(sumSquareErr / n);
    const mae = sumAbsErr / n;
    const maxAbsoluteError = Math.max(...absErrors);
    const meanBias = sumSignedErr / n;

    // Error Standard Deviation
    const varErr = signedErrors.reduce((acc, e) => acc + Math.pow(e - meanBias, 2), 0) / n;
    const errorStdDev = Math.sqrt(varErr);

    // Correlation & R^2
    const meanSim = normSimVals.slice(0, n).reduce((a, b) => a + b, 0) / n;
    const meanPhys = normPhysVals.slice(0, n).reduce((a, b) => a + b, 0) / n;

    let numCorr = 0;
    let denSim = 0;
    let denPhys = 0;
    let ssTot = 0;
    let ssRes = 0;

    for (let i = 0; i < n; i++) {
      const dS = normSimVals[i] - meanSim;
      const dP = normPhysVals[i] - meanPhys;
      numCorr += dS * dP;
      denSim += dS * dS;
      denPhys += dP * dP;

      ssTot += Math.pow(normPhysVals[i] - meanPhys, 2);
      ssRes += Math.pow(normSimVals[i] - normPhysVals[i], 2);
    }

    const correlation = (denSim > 0 && denPhys > 0) ? numCorr / Math.sqrt(denSim * denPhys) : 0;
    const rSquared = ssTot > 0 ? Math.max(0, 1 - (ssRes / ssTot)) : 0;

    // Peak comparison
    const peakError = Math.abs(simPeak - physPeak);
    const simPeakTime = sim.timestamps[simPeakIdx] || 0;
    const physPeakTime = phys.timestamps[physPeakIdx] || 0;
    const peakTimeErrorMs = Math.abs(simPeakTime - physPeakTime);

    // Uncertainty Combination
    const physUncertainty = phys.uncertainty || 0.02;
    const combinedUncertainty = Math.sqrt(Math.pow(physUncertainty, 2) + Math.pow(simUncertainty, 2));

    // Residual Pattern Analysis
    let residualPattern: 'NONE' | 'SYSTEMATIC_BIAS' | 'DRIFT' | 'OSCILLATION' | 'NONLINEAR_MISMATCH' = 'NONE';
    let modelBiasDetected = false;

    if (Math.abs(meanBias) > 0.3 * mae) {
      residualPattern = 'SYSTEMATIC_BIAS';
      modelBiasDetected = true;
    } else if (errorStdDev > mae * 1.5) {
      residualPattern = 'OSCILLATION';
    }

    // Determine Metric Check
    let measuredMetricValue = rmse;
    if (toleranceMetric === 'MAE') measuredMetricValue = mae;
    if (toleranceMetric === 'MAX_ERR') measuredMetricValue = maxAbsoluteError;
    if (toleranceMetric === 'BIAS') measuredMetricValue = Math.abs(meanBias);

    // Verdict Judgment
    let verdict: Sim2RealVerdict = 'PASS';
    if (measuredMetricValue > toleranceLimit) {
      verdict = 'FAIL';
    }

    return {
      variableName: sim.variableName,
      unit: canonicalUnit,
      isCritical,
      count: n,
      absoluteError: absErrors,
      signedError: signedErrors,
      relativeError: relErrors,
      percentageError: pctErrors,
      rmse: Number(rmse.toFixed(4)),
      mae: Number(mae.toFixed(4)),
      maxAbsoluteError: Number(maxAbsoluteError.toFixed(4)),
      meanBias: Number(meanBias.toFixed(4)),
      errorStdDev: Number(errorStdDev.toFixed(4)),
      correlation: Number(correlation.toFixed(4)),
      rSquared: Number(rSquared.toFixed(4)),
      simPeak: Number(simPeak.toFixed(4)),
      measuredPeak: Number(physPeak.toFixed(4)),
      peakError: Number(peakError.toFixed(4)),
      peakTimeErrorMs,
      totalUncertainty: Number(combinedUncertainty.toFixed(4)),
      confidenceInterval: [
        Number((meanBias - 1.96 * errorStdDev).toFixed(4)),
        Number((meanBias + 1.96 * errorStdDev).toFixed(4))
      ],
      residualPattern,
      modelBiasDetected,
      targetMetric: toleranceMetric,
      configuredTolerance: toleranceLimit,
      verdict
    };
  }
}

// ============================================================================
// 4. Core Sim2Real Engine Component
// ============================================================================

export class Sim2RealEngine {
  private runs: Map<string, SimulationRunFingerprint> = new Map();
  private trials: Map<string, PhysicalTrialFingerprint> = new Map();
  private scenarios: Map<string, ComparisonScenario> = new Map();

  public registerSimulationRun(run: SimulationRunFingerprint): void {
    this.runs.set(run.simulationRunId, run);
  }

  public registerPhysicalTrial(trial: PhysicalTrialFingerprint): void {
    this.trials.set(trial.physicalTrialId, trial);
  }

  public registerScenario(scenario: ComparisonScenario): void {
    this.scenarios.set(scenario.scenarioId, scenario);
  }

  public analyzeConfigurationMismatches(
    simRun: SimulationRunFingerprint,
    trial: PhysicalTrialFingerprint
  ): ConfigMismatchType[] {
    const mismatches: ConfigMismatchType[] = [];

    if (trial.calibrationStatus === 'EXPIRED') {
      mismatches.push('SENSOR_MISMATCH');
    }
    if (simRun.parameterSet?.material !== trial.operatingConditions?.material) {
      mismatches.push('MATERIAL_MISMATCH');
    }
    if (simRun.boundaryConditions?.coolantPressure !== trial.operatingConditions?.coolantPressure) {
      mismatches.push('OPERATING_CONDITION_MISMATCH');
    }

    return mismatches;
  }

  public compareSimulationToReality(
    comparisonId: string,
    scenarioId: string,
    simRunId: string,
    trialId: string,
    simMeasurements: SimulationMeasurement[],
    physMeasurements: PhysicalMeasurement[],
    tolerances: Record<string, { metric: 'RMSE' | 'MAE' | 'MAX_ERR' | 'BIAS'; limit: number; isCritical?: boolean }>
  ): Sim2RealComparisonReport {
    const simRun = this.runs.get(simRunId);
    const trial = this.trials.get(trialId);

    if (!simRun || !trial) {
      throw new Error(`SIM2REAL_ERROR: Registered run or trial not found for ${simRunId} / ${trialId}`);
    }

    // 1. Mismatch Analysis
    const mismatches = this.analyzeConfigurationMismatches(simRun, trial);

    // 2. Sensor Quality Pre-check
    const invalidPhys = physMeasurements.filter(p => p.quality === 'INVALID');
    if (invalidPhys.length > 0 && physMeasurements.length === invalidPhys.length) {
      // Inconclusive if physical measurements are completely invalid
      const report: Sim2RealComparisonReport = {
        comparisonId,
        scenarioId,
        simulationRun: simRun,
        physicalTrial: trial,
        state: 'INCONCLUSIVE',
        detectedMismatches: mismatches,
        variableResults: {},
        acceptanceMatrix: [],
        globalVerdict: 'INCONCLUSIVE',
        limitations: ['All physical sensors returned INVALID data. System cannot validate model.'],
        validationScope: {
          operatingRange: 'N/A',
          geometry: simRun.modelName,
          material: simRun.parameterSet?.material || 'Unknown',
          timeRange: 'N/A'
        },
        evidenceId: `EVID-SIM2REAL-${Date.now()}`,
        timestamp: new Date().toISOString()
      };
      return report;
    }

    // 3. Variable-by-Variable Analytics
    const variableResults: Record<string, VariableComparisonResult> = {};
    const acceptanceMatrix: AcceptanceMatrixItem[] = [];
    let globalFail = false;

    for (const sim of simMeasurements) {
      const phys = physMeasurements.find(p => p.variableName === sim.variableName);
      if (!phys) continue;

      const tolConfig = tolerances[sim.variableName] || { metric: 'RMSE', limit: 10.0, isCritical: false };
      const varResult = Sim2RealMathEngine.calculateComparison(
        sim,
        phys,
        tolConfig.metric,
        tolConfig.limit,
        tolConfig.isCritical,
        0.05
      );

      variableResults[sim.variableName] = varResult;

      let measuredVal = varResult.rmse;
      if (tolConfig.metric === 'MAE') measuredVal = varResult.mae;
      if (tolConfig.metric === 'MAX_ERR') measuredVal = varResult.maxAbsoluteError;
      if (tolConfig.metric === 'BIAS') measuredVal = Math.abs(varResult.meanBias);

      acceptanceMatrix.push({
        variableName: sim.variableName,
        metricUsed: tolConfig.metric,
        measuredValue: measuredVal,
        toleranceLimit: tolConfig.limit,
        verdict: varResult.verdict,
        isCritical: !!tolConfig.isCritical
      });

      // Critical Variable Rule: If a critical variable fails, global fails!
      if (varResult.verdict === 'FAIL') {
        globalFail = true;
      }
    }

    const globalVerdict: Sim2RealVerdict = globalFail ? 'FAIL' : 'PASS';
    const evidenceId = `EVID-SIM2REAL-${Date.now()}-${Math.random().toString(36).slice(-4)}`;

    const report: Sim2RealComparisonReport = {
      comparisonId,
      scenarioId,
      simulationRun: simRun,
      physicalTrial: trial,
      state: globalVerdict === 'PASS' ? 'VALID' : 'FAILED',
      detectedMismatches: mismatches,
      variableResults,
      acceptanceMatrix,
      globalVerdict,
      limitations: mismatches.length > 0 ? mismatches.map(m => `Configuration Mismatch: ${m}`) : ['None'],
      validationScope: {
        operatingRange: 'Standard Production Envelope',
        geometry: simRun.modelName,
        material: simRun.parameterSet?.material || 'Steel-4140',
        timeRange: '0s - 10s'
      },
      evidenceId,
      timestamp: new Date().toISOString()
    };

    // Register on Evidence Bus
    EvidenceBus314.getInstance().registerEvidence(
      'DESIGN_REVIEW',
      `RUN-SIM2REAL-${Date.now()}`,
      simRun.modelRevision,
      'Sim2RealEngine',
      globalVerdict === 'PASS' ? 'VALIDATED' : 'FAILED',
      {
        comparisonId,
        scenarioId,
        globalVerdict,
        detectedMismatchesCount: mismatches.length,
        evidenceId
      }
    );

    return report;
  }
}
