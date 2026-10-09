/**
 * SECP Industrial OS v2 — Energy Conservation Framework
 * PATCH-059: Volumetric Heat Source Representation
 */

export class VolumetricHeatSource {
  constructor(
    public readonly sourceModelId: string,
    public readonly ratePerUnitVolume: number // [W/m^3]
  ) {
    if (!Number.isFinite(ratePerUnitVolume)) {
      throw new Error(`Non-finite heat source rate: ${ratePerUnitVolume}`);
    }
  }

  public calculateTotalPower(cellVolume: number): number {
    if (!Number.isFinite(cellVolume) || cellVolume <= 0) {
      throw new Error(`Invalid cell volume for heat source calculation: ${cellVolume}`);
    }
    return this.ratePerUnitVolume * cellVolume;
  }
}
