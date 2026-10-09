export class ShaftStandardRegistry {
  public static getFitTolerance(diameter: number, fitClass: string): { lower: number; upper: number } {
    // Mock ISO 286 Fit Table
    const fits: Record<string, any> = {
      'h6': { lower: -13, upper: 0 },
      'h7': { lower: -21, upper: 0 },
      'k5': { lower: 2, upper: 11 },
      'm5': { lower: 8, upper: 17 }
    };
    return fits[fitClass] || { lower: 0, upper: 0 };
  }

  public static getKeywayDimensions(shaftDiameter: number): { width: number; depth: number } {
    // Mock DIN 6885-1
    if (shaftDiameter <= 22) return { width: 6, depth: 3.5 };
    if (shaftDiameter <= 30) return { width: 8, depth: 4.0 };
    if (shaftDiameter <= 38) return { width: 10, depth: 5.0 };
    return { width: 12, depth: 5.0 };
  }

  public static getKeywayForDiameter(diameter: number) {
    return { width: 8, depth: 4.0 };
  }

  public static getSnapRingForDiameter(diameter: number) {
    return { grooveDiameter: 23.9, grooveWidth: 1.3 };
  }

  public static getMetricThreadSpec(diameter: number) {
    return { threadPitch: 1.5, minorDiameter: 18.376, nominalDiameter: diameter };
  }
}
