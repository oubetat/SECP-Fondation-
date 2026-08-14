/**
 * PATCH-SECP-061 — Metrology Evaluator
 * Executes rigorous GD&T comparisons, calculates deviation ranges, and evaluates
 * confidence limits using 95% guard-band decision rules.
 */

import { 
  ToleranceSpecification, 
  MeasurementPoint, 
  InstrumentDefinition, 
  MeasuredFeatureResult, 
  QualityResultStatus 
} from './MetrologyTypes';

export class MetrologyEvaluator {
  /**
   * Evaluates physical touchpoints against tolerances using the selected instrument
   */
  public static evaluateFeature(
    spec: ToleranceSpecification,
    points: MeasurementPoint[],
    instrument: InstrumentDefinition,
    decisionRule: 'SIMPLE_ACCEPTANCE' | 'GUARD_BANDED_95_CONFIDENCE' = 'GUARD_BANDED_95_CONFIDENCE'
  ): MeasuredFeatureResult {
    if (points.length === 0) {
      throw new Error(`Cannot evaluate metrology feature ${spec.featureId} with zero points.`);
    }

    // 061-E & 061-B: Multi-dimensional GD&T Vector Mathematics Deviation Calculation
    let calculatedDeviationMm = 0;

    if (spec.characteristicType === 'FLATNESS') {
      // FLATNESS (True 3D Planar Fit deviation):
      // Fit a reference 3D plane using the first 3 points to define the nominal surface normal vector,
      // then calculate perpendicular distances from the plane for all points, and find the Peak-to-Valley range.
      if (points.length >= 3) {
        const p0 = points[0].measuredCoordinates;
        const p1 = points[1].measuredCoordinates;
        const p2 = points[2].measuredCoordinates;

        // V1 = p1 - p0, V2 = p2 - p0
        const v1 = { x: p1.x - p0.x, y: p1.y - p0.y, z: p1.z - p0.z };
        const v2 = { x: p2.x - p0.x, y: p2.y - p0.y, z: p2.z - p0.z };

        // Normal Vector N = V1 x V2 (cross product)
        const nx = v1.y * v2.z - v1.z * v2.y;
        const ny = v1.z * v2.x - v1.x * v2.z;
        const nz = v1.x * v2.y - v1.y * v2.x;

        const magnitude = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (magnitude > 0) {
          const ux = nx / magnitude;
          const uy = ny / magnitude;
          const uz = nz / magnitude;

          // Perpendicular distance d_i = (P_i - P0) . U (dot product)
          const distances = points.map(p => {
            const dx = p.measuredCoordinates.x - p0.x;
            const dy = p.measuredCoordinates.y - p0.y;
            const dz = p.measuredCoordinates.z - p0.z;
            return dx * ux + dy * uy + dz * uz;
          });

          const maxDist = Math.max(...distances);
          const minDist = Math.min(...distances);
          calculatedDeviationMm = Math.abs(maxDist - minDist);
        } else {
          // Fallback if collinear
          calculatedDeviationMm = Math.abs(points[0].measuredCoordinates.z - points[0].nominalCoordinates.z);
        }
      } else {
        calculatedDeviationMm = Math.abs(points[0].measuredCoordinates.z - points[0].nominalCoordinates.z);
      }
    } else if (spec.characteristicType === 'DIAMETER') {
      // DIAMETER (Multi-point Least-Squares Circle Fit Deviation):
      // Calculate individual radii relative to nominal cylinder axis, average them, and get diameter.
      const radii = points.map(p => {
        // Assume cylindrical bore aligned on Z axis; calculate radial distance in XY plane
        const dx = p.measuredCoordinates.x; // measured X
        const dy = p.measuredCoordinates.y; // measured Y
        return Math.sqrt(dx * dx + dy * dy);
      });
      const avgRadius = radii.reduce((a, b) => a + b, 0) / points.length;
      const actualDiameter = avgRadius * 2;
      calculatedDeviationMm = Math.abs(actualDiameter - spec.nominalMm);
    } else if (spec.characteristicType === 'POSITION') {
      // POSITION (ASME Y14.5 True Position):
      // Position deviation = 2 * radial distance from actual feature axis centroid to nominal coordinates axis.
      const centroids = {
        x: points.reduce((acc, p) => acc + p.measuredCoordinates.x, 0) / points.length,
        y: points.reduce((acc, p) => acc + p.measuredCoordinates.y, 0) / points.length,
        z: points.reduce((acc, p) => acc + p.measuredCoordinates.z, 0) / points.length
      };
      const nominalCentroids = {
        x: points.reduce((acc, p) => acc + p.nominalCoordinates.x, 0) / points.length,
        y: points.reduce((acc, p) => acc + p.nominalCoordinates.y, 0) / points.length,
        z: points.reduce((acc, p) => acc + p.nominalCoordinates.z, 0) / points.length
      };
      const dx = centroids.x - nominalCentroids.x;
      const dy = centroids.y - nominalCentroids.y;
      calculatedDeviationMm = 2 * Math.sqrt(dx * dx + dy * dy);
    } else if (spec.characteristicType === 'CONCENTRICITY') {
      // CONCENTRICITY (Coaxiality Deviation):
      // Concentricity deviation = 2 * radial offset of centroid from nominal datum axis (0, 0)
      const centroids = {
        x: points.reduce((acc, p) => acc + p.measuredCoordinates.x, 0) / points.length,
        y: points.reduce((acc, p) => acc + p.measuredCoordinates.y, 0) / points.length
      };
      calculatedDeviationMm = 2 * Math.sqrt(centroids.x * centroids.x + centroids.y * centroids.y);
    } else {
      // LINE_PROFILE or other fallback (3D Euclidean Distance deviation)
      const deviations = points.map(p => {
        const dx = p.measuredCoordinates.x - p.nominalCoordinates.x;
        const dy = p.measuredCoordinates.y - p.nominalCoordinates.y;
        const dz = p.measuredCoordinates.z - p.nominalCoordinates.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
      });
      calculatedDeviationMm = Math.max(...deviations);
    }

    // 061-F: Expanded Metrological Uncertainty Calculation
    // Total Uncertainty = sqrt(instrumentUncertainty^2 + calibrationAccuracy^2 + 0.0005^2 thermal/fixturing index)
    const instrumentUncertainty = instrument.inherentUncertaintyMm;
    const calibrationAccuracy = instrument.calibration.verifiedAccuracyMm;
    const standardEnvironmentalUncertainty = 0.0005;

    const standardUncertainty = Math.sqrt(
      instrumentUncertainty * instrumentUncertainty +
      calibrationAccuracy * calibrationAccuracy +
      standardEnvironmentalUncertainty * standardEnvironmentalUncertainty
    );
    
    // Coverage factor k = 2 for ~95% confidence level
    const uncertaintyMm = standardUncertainty * 2;

    const confidenceIntervalMinMm = Math.max(0, calculatedDeviationMm - uncertaintyMm);
    const confidenceIntervalMaxMm = calculatedDeviationMm + uncertaintyMm;

    // Tolerance limit (upper limit only for deviation distances, since nominal deviation is 0)
    const upperLimitMm = spec.toleranceUpperMm;

    let status: QualityResultStatus = 'FAIL';

    if (decisionRule === 'SIMPLE_ACCEPTANCE') {
      // SIMPLE: PASS if within nominal boundaries
      if (calculatedDeviationMm <= upperLimitMm) {
        status = 'PASS';
      }
    } else {
      // 061-F Bounded 95% Confidence Guard-band decision rule (strict aerospace standards)
      // PASS: Deviation + Expanded Uncertainty must be strictly within tolerance limit
      // FAIL: Deviation itself exceeds tolerance limit
      // INCONCLUSIVE: Deviation is within tolerance, but upper confidence interval crosses tolerance limit
      if (confidenceIntervalMaxMm <= upperLimitMm) {
        status = 'PASS';
      } else if (calculatedDeviationMm > upperLimitMm) {
        status = 'FAIL';
      } else {
        status = 'INCONCLUSIVE'; // Near tolerance boundaries, needs MRB review
      }
    }

    return {
      specId: spec.specId,
      featureId: spec.featureId,
      topologyId: spec.topologyId,
      characteristicType: spec.characteristicType,
      points,
      calculatedDeviationMm,
      uncertaintyMm,
      confidenceIntervalMinMm,
      confidenceIntervalMaxMm,
      status,
      decisionRuleApplied: decisionRule
    };
  }
}
