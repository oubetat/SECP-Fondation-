/**
 * SECP Industrial OS v2 — Flux Scheme Registry
 * PATCH-053: Flux Framework
 */

import { NumericalFluxScheme } from './FluxScheme';
import { CentralFluxScheme } from './CentralFlux';
import { UpwindFluxScheme } from './UpwindFlux';

export class FluxRegistry {
  private static instance: FluxRegistry | null = null;
  private schemes: Map<string, NumericalFluxScheme> = new Map();

  private constructor() {
    this.registerDefaults();
  }

  public static getInstance(): FluxRegistry {
    if (!FluxRegistry.instance) {
      FluxRegistry.instance = new FluxRegistry();
    }
    return FluxRegistry.instance;
  }

  public static resetInstance(): void {
    FluxRegistry.instance = new FluxRegistry();
  }

  private registerDefaults(): void {
    this.registerScheme(new CentralFluxScheme());
    this.registerScheme(new UpwindFluxScheme());
  }

  public registerScheme(scheme: NumericalFluxScheme): { success: boolean; error?: string } {
    if (!scheme || typeof scheme !== 'object') {
      return { success: false, error: 'Invalid scheme object' };
    }

    if (!scheme.id || typeof scheme.id !== 'string' || scheme.id.trim().length === 0) {
      return { success: false, error: 'Scheme must have a non-empty string ID' };
    }

    if (!scheme.version || typeof scheme.version !== 'string') {
      return { success: false, error: 'Scheme must have a valid version string' };
    }

    if (typeof scheme.compute !== 'function') {
      return { success: false, error: 'Scheme must implement compute()' };
    }

    if (this.schemes.has(scheme.id)) {
      return { success: false, error: `Duplicate scheme ID: ${scheme.id}` };
    }

    this.schemes.set(scheme.id, scheme);
    return { success: true };
  }

  public getScheme(id: string): NumericalFluxScheme | undefined {
    return this.schemes.get(id);
  }

  public listSchemes(): string[] {
    return Array.from(this.schemes.keys()).sort();
  }
}
