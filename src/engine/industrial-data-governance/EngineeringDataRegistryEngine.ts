/**
 * PATCH-SECP-069: Engineering Data Registry Engine
 * Manages identity and registration of industrial data artifacts.
 */

import { EngineeringDataIdentity } from './IndustrialDataGovernanceTypes';

export class EngineeringDataRegistryEngine {
  private static registry: Map<string, EngineeringDataIdentity> = new Map();

  public static registerData(data: EngineeringDataIdentity): void {
    this.registry.set(data.id, data);
  }

  public static getData(id: string): EngineeringDataIdentity | undefined {
    return this.registry.get(id);
  }
}
