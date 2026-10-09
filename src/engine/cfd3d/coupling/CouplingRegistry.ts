/**
 * SECP Industrial OS v2 — Coupling Scheme Registry
 * PATCH-054: Pressure-Velocity Coupling
 */

import { PressureVelocityCouplingScheme } from './CouplingScheme';
import { SimpleCouplingScheme } from './SimpleCoupling';

export class CouplingRegistry {
  private static instance: CouplingRegistry | null = null;
  private schemes: Map<string, PressureVelocityCouplingScheme> = new Map();

  private constructor() {
    this.registerDefaults();
  }

  public static getInstance(): CouplingRegistry {
    if (!CouplingRegistry.instance) {
      CouplingRegistry.instance = new CouplingRegistry();
    }
    return CouplingRegistry.instance;
  }

  public static resetInstance(): void {
    CouplingRegistry.instance = new CouplingRegistry();
  }

  private registerDefaults(): void {
    this.registerScheme(new SimpleCouplingScheme());
  }

  public registerScheme(scheme: PressureVelocityCouplingScheme): { success: boolean; error?: string } {
    if (!scheme || typeof scheme !== 'object') {
      return { success: false, error: 'Invalid scheme object' };
    }

    if (!scheme.id || typeof scheme.id !== 'string' || scheme.id.trim().length === 0) {
      return { success: false, error: 'Scheme must have a non-empty string ID' };
    }

    if (!scheme.version || typeof scheme.version !== 'string') {
      return { success: false, error: 'Scheme must have a valid version string' };
    }

    if (this.schemes.has(scheme.id)) {
      return { success: false, error: `Duplicate coupling scheme ID: ${scheme.id}` };
    }

    this.schemes.set(scheme.id, scheme);
    return { success: true };
  }

  public getScheme(id: string): PressureVelocityCouplingScheme | undefined {
    return this.schemes.get(id);
  }

  public listSchemes(): string[] {
    return Array.from(this.schemes.keys()).sort();
  }
}
