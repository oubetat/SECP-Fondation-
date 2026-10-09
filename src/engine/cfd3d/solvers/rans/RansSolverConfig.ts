/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-062: RANS Solver Configuration
 */

import { RansFormulation } from './RansSolverTypes';

export interface RansSolverConfigOptions {
  readonly maxIterations?: number;
  readonly meanVelocityRelaxation?: number;
  readonly meanPressureRelaxation?: number;
  readonly turbulenceRelaxation?: number;
  readonly absoluteContinuityTolerance?: number;
  readonly absoluteMomentumTolerance?: number;
  readonly absoluteTurbulenceTolerance?: number;
  readonly pressureVelocityScheme?: 'SIMPLE' | 'SIMPLEC' | 'PISO';
  readonly turbulenceModel?: string;
  readonly wallTreatment?: string;
}

export class RansSolverConfig {
  public readonly formulation: RansFormulation = RansFormulation.STEADY_INCOMPRESSIBLE_RANS;
  public readonly maxIterations: number;
  public readonly meanVelocityRelaxation: number;
  public readonly meanPressureRelaxation: number;
  public readonly turbulenceRelaxation: number;
  public readonly absoluteContinuityTolerance: number;
  public readonly absoluteMomentumTolerance: number;
  public readonly absoluteTurbulenceTolerance: number;
  public readonly pressureVelocityScheme: 'SIMPLE' | 'SIMPLEC' | 'PISO';
  public readonly turbulenceModel: string;
  public readonly wallTreatment: string;
  public readonly configHash: string;

  constructor(options: RansSolverConfigOptions = {}) {
    this.maxIterations = options.maxIterations ?? 100;
    this.meanVelocityRelaxation = options.meanVelocityRelaxation ?? 0.7;
    this.meanPressureRelaxation = options.meanPressureRelaxation ?? 0.3;
    this.turbulenceRelaxation = options.turbulenceRelaxation ?? 0.5;
    this.absoluteContinuityTolerance = options.absoluteContinuityTolerance ?? 1e-6;
    this.absoluteMomentumTolerance = options.absoluteMomentumTolerance ?? 1e-6;
    this.absoluteTurbulenceTolerance = options.absoluteTurbulenceTolerance ?? 1e-6;
    this.pressureVelocityScheme = options.pressureVelocityScheme ?? 'SIMPLE';
    this.turbulenceModel = options.turbulenceModel ?? 'NONE';
    this.wallTreatment = options.wallTreatment ?? 'STANDARD_WALL_FUNCTION';

    this.validate();
    this.configHash = this.computeHash();
  }

  private validate(): void {
    if (this.maxIterations <= 0) throw new Error('Invalid maxIterations');
    if (this.meanVelocityRelaxation <= 0 || this.meanVelocityRelaxation > 1) throw new Error('Invalid meanVelocityRelaxation');
    if (this.meanPressureRelaxation <= 0 || this.meanPressureRelaxation > 1) throw new Error('Invalid meanPressureRelaxation');
  }

  private computeHash(): string {
    const raw = `${this.formulation}:${this.maxIterations}:${this.turbulenceModel}:${this.wallTreatment}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash << 5) - hash + raw.charCodeAt(i);
      hash |= 0;
    }
    return `rans-config-hash-${Math.abs(hash).toString(16)}`;
  }
}
