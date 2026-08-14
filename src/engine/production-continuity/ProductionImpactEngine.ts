/**
 * PATCH-SECP-067: Production Impact Engine
 * Measures the blast radius of a failure event.
 */

export class ProductionImpactEngine {
  public static assessImpact(affectedMachines: string[], totalMachines: number): number {
    return (affectedMachines.length / totalMachines) * 100;
  }
}
