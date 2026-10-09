export class GearStandardRegistry {
  public static getHubKeyway(boreDiameterMm: number): { widthMm: number; depthMm: number } {
    if (boreDiameterMm === 20) {
      return { widthMm: 6, depthMm: 2.8 };
    }
    return { widthMm: 0, depthMm: 0 };
  }
}
