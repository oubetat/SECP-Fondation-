import {
  Point3D,
  SamplingPolicy,
  Vector3D
} from "./types";

export interface SamplingAdaptiveSegment {
  pStart: { position: Point3D; toolAxis: Vector3D };
  pEnd: { position: Point3D; toolAxis: Vector3D };
  recommendedSteps: number;
  reasons: string[];
}

export class AdaptiveCollisionSampling {
  /**
   * Computes the adaptive sampling plan for a trajectory segment based on motion kinematics and proximity triggers.
   */
  public static evaluateSegmentSampling(
    p1: { position: Point3D; toolAxis: Vector3D },
    p2: { position: Point3D; toolAxis: Vector3D },
    basePolicy: SamplingPolicy,
    proximityDistance: number = 50.0
  ): SamplingAdaptiveSegment {
    const reasons: string[] = [];
    let requiredSteps = Math.max(2, basePolicy.sampleCount);

    // 1. Spatial displacement trigger
    const dx = p2.position.x - p1.position.x;
    const dy = p2.position.y - p1.position.y;
    const dz = p2.position.z - p1.position.z;
    const translationDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (translationDistance > basePolicy.maximumStep) {
      const stepFactor = Math.ceil(translationDistance / basePolicy.maximumStep);
      requiredSteps = Math.max(requiredSteps, stepFactor * 2);
      reasons.push("HIGH_TRANSLATION_STEP");
    }

    // 2. Angular orientation sweep trigger
    const dot = Math.max(-1.0, Math.min(1.0,
      p1.toolAxis.x * p2.toolAxis.x +
      p1.toolAxis.y * p2.toolAxis.y +
      p1.toolAxis.z * p2.toolAxis.z
    ));
    const angularDiffDeg = (Math.acos(dot) * 180) / Math.PI;

    if (angularDiffDeg > basePolicy.minAngularStepDeg) {
      const angularSteps = Math.ceil(angularDiffDeg / basePolicy.minAngularStepDeg);
      requiredSteps = Math.max(requiredSteps, angularSteps * 2);
      reasons.push("HIGH_ANGULAR_DELTA");
    }

    // 3. Proximity / Narrow clearance trigger
    if (proximityDistance < 5.0) {
      requiredSteps = Math.max(requiredSteps, 16);
      reasons.push("NARROW_CLEARANCE_ZONE");
    } else if (proximityDistance < 15.0) {
      requiredSteps = Math.max(requiredSteps, 8);
      reasons.push("PROXIMITY_MARGINAL_ZONE");
    }

    // 4. Singularity / Z-pole alignment trigger (near vertical rotary singular region)
    if (Math.abs(p1.toolAxis.z) > 0.99 || Math.abs(p2.toolAxis.z) > 0.99) {
      requiredSteps = Math.max(requiredSteps, 10);
      reasons.push("SINGULARITY_PROXIMITY");
    }

    return {
      pStart: p1,
      pEnd: p2,
      recommendedSteps: requiredSteps,
      reasons
    };
  }

  /**
   * Generates interpolated sample poses according to adaptive plan.
   */
  public static generateSamplePoses(
    segment: SamplingAdaptiveSegment
  ): Array<{ position: Point3D; toolAxis: Vector3D; t: number; sequence: number }> {
    const poses: Array<{ position: Point3D; toolAxis: Vector3D; t: number; sequence: number }> = [];
    const steps = segment.recommendedSteps;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const pos: Point3D = {
        x: segment.pStart.position.x + t * (segment.pEnd.position.x - segment.pStart.position.x),
        y: segment.pStart.position.y + t * (segment.pEnd.position.y - segment.pStart.position.y),
        z: segment.pStart.position.z + t * (segment.pEnd.position.z - segment.pStart.position.z)
      };

      // Simple vector slerp
      const dot = Math.max(-1.0, Math.min(1.0,
        segment.pStart.toolAxis.x * segment.pEnd.toolAxis.x +
        segment.pStart.toolAxis.y * segment.pEnd.toolAxis.y +
        segment.pStart.toolAxis.z * segment.pEnd.toolAxis.z
      ));
      let axis: Vector3D;
      if (Math.abs(dot - 1.0) < 1e-6) {
        axis = { ...segment.pStart.toolAxis };
      } else {
        const theta = Math.acos(dot);
        const sinTheta = Math.sin(theta);
        const s1 = Math.sin((1.0 - t) * theta) / sinTheta;
        const s2 = Math.sin(t * theta) / sinTheta;
        const raw = {
          x: s1 * segment.pStart.toolAxis.x + s2 * segment.pEnd.toolAxis.x,
          y: s1 * segment.pStart.toolAxis.y + s2 * segment.pEnd.toolAxis.y,
          z: s1 * segment.pStart.toolAxis.z + s2 * segment.pEnd.toolAxis.z
        };
        const len = Math.sqrt(raw.x * raw.x + raw.y * raw.y + raw.z * raw.z);
        axis = { x: raw.x / len, y: raw.y / len, z: raw.z / len };
      }

      poses.push({ position: pos, toolAxis: axis, t, sequence: i });
    }

    return poses;
  }

  /**
   * Computes coverage metric of the sampling plan.
   */
  public static calculateCoverageMetric(
    actualSamples: number,
    expectedSamples: number,
    continuousCoverage: boolean
  ): number {
    if (expectedSamples <= 0) return 1.0;
    const ratio = Math.min(1.0, actualSamples / expectedSamples);
    return continuousCoverage ? ratio : ratio * 0.75;
  }
}
