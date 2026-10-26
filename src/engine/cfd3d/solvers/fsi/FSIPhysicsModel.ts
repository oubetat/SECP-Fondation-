/**
 * SECP Industrial OS — Engineering Truth OS
 * src/engine/cfd3d/solvers/fsi/FSIPhysicsModel.ts
 *
 * Encapsulates the governing physical properties and numerical constraints
 * for coupled fluid-structure interaction simulations.
 */

import { FSIPhenomenon, FSICouplingScheme } from './index';

export interface FSIPhysicsParameters {
  phenomenon?: FSIPhenomenon;
  couplingScheme?: FSICouplingScheme;
  isTransient?: boolean;
  isCompressible?: boolean;
  enableTurbulenceRANS?: boolean;
  enableThermalHT?: boolean;
  enableLargeDeformation?: boolean;
  enableStructuralContact?: boolean;
  fluidDensity?: number;
  fluidViscosity?: number;
  youngsModulus?: number;
  poissonsRatio?: number;
  solidDensity?: number;
}

export class FSIPhysicsModel {
  public phenomenon: FSIPhenomenon;
  public couplingScheme: FSICouplingScheme;
  public isTransient: boolean;
  public isCompressible: boolean;
  public enableTurbulenceRANS: boolean;
  public enableThermalHT: boolean;
  public enableLargeDeformation: boolean;
  public enableStructuralContact: boolean;
  public fluidDensity: number;
  public fluidViscosity: number;
  public youngsModulus: number;
  public poissonsRatio: number;
  public solidDensity: number;

  constructor(params: FSIPhysicsParameters = {}) {
    this.phenomenon = params.phenomenon ?? FSIPhenomenon.TWO_WAY_FSI;
    this.couplingScheme = params.couplingScheme ?? FSICouplingScheme.IMPLICIT;
    this.isTransient = params.isTransient ?? true;
    this.isCompressible = params.isCompressible ?? false;
    this.enableTurbulenceRANS = params.enableTurbulenceRANS ?? true;
    this.enableThermalHT = params.enableThermalHT ?? false;
    this.enableLargeDeformation = params.enableLargeDeformation ?? false;
    this.enableStructuralContact = params.enableStructuralContact ?? false;
    this.fluidDensity = params.fluidDensity ?? 1.225; // Air standard density (kg/m^3)
    this.fluidViscosity = params.fluidViscosity ?? 1.81e-5; // Dynamic viscosity (Pa*s)
    this.youngsModulus = params.youngsModulus ?? 70e9; // 70 GPa Aluminum default
    this.poissonsRatio = params.poissonsRatio ?? 0.30;
    this.solidDensity = params.solidDensity ?? 2700; // kg/m^3
  }

  /**
   * Validates physical bounds to prevent unphysical numerical collapse.
   */
  public validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!Number.isFinite(this.fluidDensity) || this.fluidDensity <= 0) {
      errors.push(`Invalid fluid density: ${this.fluidDensity} (must be > 0)`);
    }
    if (!Number.isFinite(this.fluidViscosity) || this.fluidViscosity <= 0) {
      errors.push(`Invalid fluid dynamic viscosity: ${this.fluidViscosity} (must be > 0)`);
    }
    if (!Number.isFinite(this.youngsModulus) || this.youngsModulus <= 0) {
      errors.push(`Invalid Young's Modulus: ${this.youngsModulus} (must be > 0)`);
    }
    if (!Number.isFinite(this.poissonsRatio) || this.poissonsRatio <= -1.0 || this.poissonsRatio >= 0.5) {
      errors.push(`Invalid Poisson's Ratio: ${this.poissonsRatio} (must be in (-1, 0.5))`);
    }
    if (!Number.isFinite(this.solidDensity) || this.solidDensity <= 0) {
      errors.push(`Invalid solid density: ${this.solidDensity} (must be > 0)`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Evaluates acoustic speed of sound in solid (for elastodynamics / stability).
   */
  public getSolidWaveSpeed(): number {
    return Math.sqrt(this.youngsModulus / this.solidDensity);
  }

  /**
   * Evaluates shear modulus G = E / (2 * (1 + nu)).
   */
  public getShearModulus(): number {
    return this.youngsModulus / (2 * (1 + this.poissonsRatio));
  }
}
