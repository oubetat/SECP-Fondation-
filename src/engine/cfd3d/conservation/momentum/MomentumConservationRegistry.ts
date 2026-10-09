/**
 * SECP Industrial OS v2 — Momentum Conservation Framework
 * PATCH-058: Momentum Conservation Registry
 */

import { MomentumConservationPolicy, DEFAULT_MOMENTUM_CONSERVATION_POLICY } from './MomentumConservationPolicy';

export class MomentumConservationRegistry {
  private static instance: MomentumConservationRegistry | null = null;
  private policy: MomentumConservationPolicy = DEFAULT_MOMENTUM_CONSERVATION_POLICY;

  private constructor() {}

  public static getInstance(): MomentumConservationRegistry {
    if (!MomentumConservationRegistry.instance) {
      MomentumConservationRegistry.instance = new MomentumConservationRegistry();
    }
    return MomentumConservationRegistry.instance;
  }

  public getPolicy(): MomentumConservationPolicy {
    return this.policy;
  }

  public setPolicy(policy: MomentumConservationPolicy): void {
    this.policy = policy;
  }

  public clear(): void {
    this.policy = DEFAULT_MOMENTUM_CONSERVATION_POLICY;
  }
}
