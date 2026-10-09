import { 
  TemperatureDependentProperty, 
  ResolutionStatus, 
  ExtrapolationPolicy, 
  InterpolationPolicy 
} from "./types";
import { InterpolationEngine } from "./InterpolationEngine";

export interface ResolvedProperty {
  value: number;
  status: ResolutionStatus;
  details: string;
}

export class TemperaturePropertyResolver {
  /**
   * Resolves a property value at a specific temperature (in Kelvin).
   */
  public static resolve(property: TemperatureDependentProperty, targetK: number): ResolvedProperty {
    const { points, validityDomain, extrapolationPolicy, interpolationPolicy } = property;

    // 1. Check Domain
    if (targetK < validityDomain.tMin || targetK > validityDomain.tMax) {
      if (extrapolationPolicy === ExtrapolationPolicy.DISALLOW) {
        return { value: NaN, status: ResolutionStatus.OUTSIDE_DOMAIN, details: `Temperature ${targetK}K is outside validity domain [${validityDomain.tMin}, ${validityDomain.tMax}]K` };
      }
      // Handling extrapolation if allowed (Simplified)
      const value = this.extrapolate(property, targetK);
      return { value, status: ResolutionStatus.EXTRAPOLATED, details: `Extrapolated from domain boundary` };
    }

    // 2. Exact Match
    const exact = points.find(p => Math.abs(p.normalizedTemperature - targetK) < 1e-9);
    if (exact) {
      return { value: exact.value, status: ResolutionStatus.EXACT_DATA_POINT, details: `Exact data point found` };
    }

    // 3. Find bounding points
    const sortedPoints = [...points].sort((a, b) => a.normalizedTemperature - b.normalizedTemperature);
    const upperIdx = sortedPoints.findIndex(p => p.normalizedTemperature > targetK);
    
    if (upperIdx === -1) {
       // Should have been caught by domain check or extrapolation, but for safety:
       const last = sortedPoints[sortedPoints.length - 1];
       return { value: last.value, status: ResolutionStatus.EXTRAPOLATED, details: `Clamped to max` };
    }
    
    if (upperIdx === 0) {
       const first = sortedPoints[0];
       return { value: first.value, status: ResolutionStatus.EXTRAPOLATED, details: `Clamped to min` };
    }

    const p1 = sortedPoints[upperIdx - 1];
    const p2 = sortedPoints[upperIdx];

    // 4. Interpolate
    let value: number;
    if (interpolationPolicy === InterpolationPolicy.LINEAR) {
      value = InterpolationEngine.interpolateLinear(targetK, p1, p2);
    } else {
      // Fallback or other policies
      value = p1.value; 
    }

    return { value, status: ResolutionStatus.INTERPOLATED, details: `Interpolated between ${p1.normalizedTemperature}K and ${p2.normalizedTemperature}K` };
  }

  private static extrapolate(property: TemperatureDependentProperty, targetK: number): number {
    const sortedPoints = [...property.points].sort((a, b) => a.normalizedTemperature - b.normalizedTemperature);
    if (targetK < property.validityDomain.tMin) {
      return sortedPoints[0].value; // Flat extrapolation (Simplified)
    } else {
      return sortedPoints[sortedPoints.length - 1].value;
    }
  }
}
