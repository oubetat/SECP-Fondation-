/**
 * SECP Industrial OS v2 — Turbulence Telemetry & Time-Series Logger
 * Phase 16 (PATCH-176: Turbulence Benchmark → Advanced Turbulence Framework)
 */

import { TurbulenceModelIdentity, TurbulenceDiagnosticReport, TurbulenceState } from '../types/TurbulenceTypes';

export interface TurbulenceTelemetrySample {
  iteration: number;
  timeStep: number;
  simulatedTimeS: number;
  modelIdentity: TurbulenceModelIdentity;
  cfl: number;
  meanK: number;
  maxK: number;
  meanNut: number;
  maxNutRatio: number;
  meanProduction: number;
  meanDissipation: number;
  prodToDissRatio: number;
  maxQCriterion: number;
  maxVorticity: number;
  coherentCores: number;
  positivityViolations: number;
  residualK: number;
  residualOmegaOrEps: number;
  stabilityStatus: 'STABLE' | 'DAMPED' | 'UNSTABLE';
}

export class TurbulenceTelemetry {
  private history: TurbulenceTelemetrySample[] = [];
  private maxHistoryLength = 500;

  public logIteration(
    iteration: number,
    timeStep: number,
    simTime: number,
    modelIdentity: TurbulenceModelIdentity,
    cfl: number,
    diagnostics: TurbulenceDiagnosticReport,
    residuals: { k: number; omegaOrEps: number },
    molecularViscosity: number,
    density: number,
    states: TurbulenceState[]
  ): void {
    const nu = molecularViscosity / density;
    let posViolations = 0;
    for (const s of states) {
      if (s.k < 0 || (s.omega !== undefined && s.omega < 0) || (s.epsilon !== undefined && s.epsilon < 0) || s.nut < 0) {
        posViolations++;
      }
    }

    const sample: TurbulenceTelemetrySample = {
      iteration,
      timeStep,
      simulatedTimeS: simTime,
      modelIdentity,
      cfl,
      meanK: diagnostics.meanK,
      maxK: diagnostics.maxK,
      meanNut: diagnostics.meanNut,
      maxNutRatio: nu > 0 ? diagnostics.maxNut / nu : 0,
      meanProduction: diagnostics.meanProductionK,
      meanDissipation: diagnostics.meanDissipationK,
      prodToDissRatio: diagnostics.productionToDissipationRatio,
      maxQCriterion: diagnostics.vortexMetrics.maxQCriterion,
      maxVorticity: diagnostics.vortexMetrics.maxVorticityMagnitude,
      coherentCores: diagnostics.vortexMetrics.coherentVortexCoresCount,
      positivityViolations: posViolations,
      residualK: residuals.k,
      residualOmegaOrEps: residuals.omegaOrEps,
      stabilityStatus: diagnostics.stabilityStatus
    };

    this.history.push(sample);
    if (this.history.length > this.maxHistoryLength) {
      this.history.shift();
    }
  }

  public getHistory(): TurbulenceTelemetrySample[] {
    return [...this.history];
  }

  public getLatest(): TurbulenceTelemetrySample | null {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null;
  }

  public clear(): void {
    this.history = [];
  }
}
