import {
  GeometryEntityDescriptor,
  GeometryToleranceProfile,
  SpatialRelationType,
  GeometryRelation
} from './types';

export interface DistanceMeasurement {
  entityA: string;
  entityB: string;
  distance: number;
  unit: string;
  tolerance: number;
  measurementMethod: string;
  kernelVerification: boolean;
}

export interface AngleMeasurement {
  entityA: string;
  entityB: string;
  angle: number; // in degrees
  tolerance: number; // in degrees
  relation: SpatialRelationType | 'NONE';
  kernelVerification: boolean;
}

export class SpatialReasoningEngine {
  public static convertLength(value: number, fromUnit: string, toUnit: string): number {
    const from = fromUnit.toLowerCase();
    const to = toUnit.toLowerCase();

    if (from === to) return value;

    // Convert to mm first
    let inMm = value;
    if (from === 'inch' || from === 'in') inMm = value * 25.4;
    else if (from === 'm' || from === 'meter') inMm = value * 1000;
    else if (from === 'cm') inMm = value * 10;

    // Convert from mm to target
    if (to === 'inch' || to === 'in') return inMm / 25.4;
    if (to === 'm' || to === 'meter') return inMm / 1000;
    if (to === 'cm') return inMm / 10;
    return inMm;
  }

  public static evaluateParallel(
    entityA: GeometryEntityDescriptor,
    entityB: GeometryEntityDescriptor,
    angleDegrees: number,
    toleranceProfile: GeometryToleranceProfile
  ): AngleMeasurement {
    const tol = toleranceProfile.angularTolerance;
    const diff0 = Math.abs(angleDegrees - 0);
    const diff180 = Math.abs(angleDegrees - 180);

    const isParallel = diff0 <= tol || diff180 <= tol;

    return {
      entityA: entityA.entityId,
      entityB: entityB.entityId,
      angle: angleDegrees,
      tolerance: tol,
      relation: isParallel ? 'PARALLEL' : 'NONE',
      kernelVerification: true
    };
  }

  public static evaluatePerpendicular(
    entityA: GeometryEntityDescriptor,
    entityB: GeometryEntityDescriptor,
    angleDegrees: number,
    toleranceProfile: GeometryToleranceProfile
  ): AngleMeasurement {
    const tol = toleranceProfile.angularTolerance;
    const diff90 = Math.abs(angleDegrees - 90);

    const isPerpendicular = diff90 <= tol;

    return {
      entityA: entityA.entityId,
      entityB: entityB.entityId,
      angle: angleDegrees,
      tolerance: tol,
      relation: isPerpendicular ? 'PERPENDICULAR' : 'NONE',
      kernelVerification: true
    };
  }

  public static evaluateConcentric(
    entityA: GeometryEntityDescriptor,
    entityB: GeometryEntityDescriptor,
    centerDistance: number,
    toleranceProfile: GeometryToleranceProfile
  ): DistanceMeasurement & { relation: SpatialRelationType | 'NONE' } {
    const tol = toleranceProfile.linearTolerance;
    const isConcentric = Math.abs(centerDistance) <= tol;

    return {
      entityA: entityA.entityId,
      entityB: entityB.entityId,
      distance: centerDistance,
      unit: 'mm',
      tolerance: tol,
      measurementMethod: 'AXIS_CENTERLINE_PROJECTION',
      kernelVerification: true,
      relation: isConcentric ? 'CONCENTRIC' : 'NONE'
    };
  }

  public static measureDistance(
    entityA: GeometryEntityDescriptor,
    entityB: GeometryEntityDescriptor,
    rawDistance: number,
    rawUnit: string,
    targetUnit: string,
    toleranceProfile: GeometryToleranceProfile
  ): DistanceMeasurement {
    const converted = this.convertLength(rawDistance, rawUnit, targetUnit);
    return {
      entityA: entityA.entityId,
      entityB: entityB.entityId,
      distance: converted,
      unit: targetUnit,
      tolerance: toleranceProfile.linearTolerance,
      measurementMethod: 'KERNEL_EXACT_EVALUATION',
      kernelVerification: true
    };
  }
}
