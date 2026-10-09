import { TemperaturePropertyPoint } from "./types";

export class InterpolationEngine {
  /**
   * Performs deterministic linear interpolation between two points.
   * Assumes points are sorted by temperature.
   */
  public static interpolateLinear(
    targetT: number, 
    p1: TemperaturePropertyPoint, 
    p2: TemperaturePropertyPoint
  ): number {
    const t1 = p1.normalizedTemperature;
    const t2 = p2.normalizedTemperature;
    const v1 = p1.value;
    const v2 = p2.value;

    if (t1 === t2) return v1;

    // P(T) = V1 + (V2 - V1) * (T - T1) / (T2 - T1)
    return v1 + (v2 - v1) * (targetT - t1) / (t2 - t1);
  }
}
