/**
 * SECP Industrial OS v2 — Mass Conservation Framework
 * PATCH-057: Conservation Registry
 */

import { MassConservationPolicy, DEFAULT_MASS_CONSERVATION_POLICY } from './MassConservationPolicy';

export class MassConservationRegistry {
  private static instance: MassConservationRegistry | null = null;
  private policy: MassConservationPolicy = DEFAULT_MASS_CONSERVATION_POLICY;

  private constructor() {}

  public static getInstance(): MassConservationRegistry {
    if (!MassConservationRegistry.instance) {
      MassConservationRegistry.instance = new MassConservationRegistry();
    }
    return MassConservationRegistry.instance;
  }

  public getPolicy(): MassConservationPolicy {
    return this.policy;
  }

  public setPolicy(policy: MassConservationPolicy): void {
    this.policy = policy;
  }

  public clear(): void {
    this.policy = DEFAULT_MASS_CONSERVATION_POLICY;
  }
}
