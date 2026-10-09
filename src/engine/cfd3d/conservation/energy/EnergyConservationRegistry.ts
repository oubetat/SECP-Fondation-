/**
 * SECP Industrial OS v2 — Energy Conservation Framework
 * PATCH-059: Energy Conservation Registry
 */

import { EnergyConservationPolicy, DEFAULT_ENERGY_CONSERVATION_POLICY } from './EnergyConservationPolicy';

export class EnergyConservationRegistry {
  private static instance: EnergyConservationRegistry | null = null;
  private policy: EnergyConservationPolicy = DEFAULT_ENERGY_CONSERVATION_POLICY;

  private constructor() {}

  public static getInstance(): EnergyConservationRegistry {
    if (!EnergyConservationRegistry.instance) {
      EnergyConservationRegistry.instance = new EnergyConservationRegistry();
    }
    return EnergyConservationRegistry.instance;
  }

  public getPolicy(): EnergyConservationPolicy {
    return this.policy;
  }

  public setPolicy(policy: EnergyConservationPolicy): void {
    this.policy = policy;
  }

  public clear(): void {
    this.policy = DEFAULT_ENERGY_CONSERVATION_POLICY;
  }
}
