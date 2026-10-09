/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-061: Laminar Solver Configuration
 */

import { LaminarFormulation } from './LaminarSolverTypes';
import { LaminarSolverFailureCode } from './LaminarFailure';

export interface LaminarSolverConfigOptions {
  readonly maxIterations?: number;
  readonly velocityRelaxation?: number; // alpha_u
  readonly pressureRelaxation?: number; // alpha_p
  readonly energyRelaxation?: number;   // alpha_e
  readonly absoluteContinuityTolerance?: number;
  readonly absoluteMomentumTolerance?: number;
  readonly absoluteEnergyTolerance?: number;
  readonly pressureVelocityScheme?: 'SIMPLE' | 'SIMPLEC' | 'PISO';
  readonly energyEnabled?: boolean;
}

export class LaminarSolverConfig {
  public readonly formulation: LaminarFormulation = LaminarFormulation.STEADY_INCOMPRESSIBLE_NAVIER_STOKES;
  public readonly maxIterations: number;
  public readonly velocityRelaxation: number;
  public readonly pressureRelaxation: number;
  public readonly energyRelaxation: number;
  public readonly absoluteContinuityTolerance: number;
  public readonly absoluteMomentumTolerance: number;
  public readonly absoluteEnergyTolerance: number;
  public readonly pressureVelocityScheme: 'SIMPLE' | 'SIMPLEC' | 'PISO';
  public readonly energyEnabled: boolean;
  public readonly configHash: string;

  constructor(options: LaminarSolverConfigOptions = {}) {
    this.maxIterations = options.maxIterations ?? 100;
    this.velocityRelaxation = options.velocityRelaxation ?? 0.7;
    this.pressureRelaxation = options.pressureRelaxation ?? 0.3;
    this.energyRelaxation = options.energyRelaxation ?? 1.0;
    this.absoluteContinuityTolerance = options.absoluteContinuityTolerance ?? 1e-6;
    this.absoluteMomentumTolerance = options.absoluteMomentumTolerance ?? 1e-6;
    this.absoluteEnergyTolerance = options.absoluteEnergyTolerance ?? 1e-6;
    this.pressureVelocityScheme = options.pressureVelocityScheme ?? 'SIMPLE';
    this.energyEnabled = options.energyEnabled ?? false;

    this.validate();
    this.configHash = this.computeHash();
  }

  public validate(): void {
    if (this.maxIterations <= 0 || !Number.isInteger(this.maxIterations)) {
      throw new Error(`Invalid maxIterations: ${this.maxIterations}`);
    }
    if (this.velocityRelaxation <= 0 || this.velocityRelaxation > 1.0) {
      throw new Error(`INVALID_RELAXATION_FACTOR: velocityRelaxation ${this.velocityRelaxation} out of range (0, 1]`);
    }
    if (this.pressureRelaxation <= 0 || this.pressureRelaxation > 1.0) {
      throw new Error(`INVALID_RELAXATION_FACTOR: pressureRelaxation ${this.pressureRelaxation} out of range (0, 1]`);
    }
    if (this.energyRelaxation <= 0 || this.energyRelaxation > 1.0) {
      throw new Error(`INVALID_RELAXATION_FACTOR: energyRelaxation ${this.energyRelaxation} out of range (0, 1]`);
    }
  }

  private computeHash(): string {
    const raw = `${this.formulation}:${this.maxIterations}:${this.velocityRelaxation}:${this.pressureRelaxation}:${this.energyRelaxation}:${this.pressureVelocityScheme}:${this.energyEnabled}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash << 5) - hash + raw.charCodeAt(i);
      hash |= 0;
    }
    return `config-hash-${Math.abs(hash).toString(16)}`;
  }
}
