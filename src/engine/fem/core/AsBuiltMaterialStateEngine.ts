import { FEMEvidenceEngine } from "./FEMEvidenceEngine";
import { CoordinateFrameTransformEngine, CoordinateFrameContract } from "./GeometryMaterialAssignment";
import { SpatialMaterialField } from "./SpatialMaterialField";

export type DataOrigin =
  | 'PHYSICAL_MEASUREMENT'
  | 'SYNTHETIC_TEST_DATA'
  | 'SIMULATION_OUTPUT'
  | 'INFERRED_FROM_MEASUREMENTS'
  | 'IMPORTED_UNVERIFIED';

export type QualityStatus = 'VALIDATED' | 'REJECTED' | 'UNVERIFIED' | 'OUT_OF_BOUNDS' | 'CONFLICTING';

export interface RawMeasurementPoint {
  pointId: string;
  x: number;
  y: number;
  z: number;
  propertyId: 'E' | 'nu' | 'density' | 'porosity' | 'yieldStrength' | string;
  value: number;
  unit: 'Pa' | 'MPa' | 'GPa' | 'kg/m3' | 'g/cm3' | 'dimensionless' | string;
  uncertainty?: number;
  qualityStatus?: QualityStatus;
}

export interface AsBuiltMaterialDataset {
  datasetId: string;
  partInstanceId: string;
  engineeringRevisionId: string;
  geometryRevisionId: string;
  measurementMethodId: string;
  dataOrigin: DataOrigin;
  sensorMetadata: {
    deviceName: string;
    resolution: number;
    accuracy: number;
    calibrationDate?: string;
  };
  coordinateFrameId?: string;
  rawPoints: RawMeasurementPoint[];
  createdAt: string;
}

export interface ValidationReport {
  isValid: boolean;
  validPointCount: number;
  rejectedPointCount: number;
  conflictingPointCount: number;
  outOfBoundsCount: number;
  dataOrigin: DataOrigin;
  errors: string[];
  warnings: string[];
}

export interface ReconstructedProperty {
  value: number;
  uncertainty: number;
  isInterpolated: boolean;
  unit: string;
}

export interface ReconstructedFieldPoint {
  x: number;
  y: number;
  z: number;
  reconstructedProperties: Record<string, ReconstructedProperty>;
  isMeasured: boolean;
  qualityStatus: 'VALIDATED' | 'OUT_OF_BOUNDS' | 'UNMEASURED';
}

export interface AsBuiltMaterialState {
  asBuiltStateId: string;
  datasetId: string;
  partInstanceId: string;
  engineeringRevisionId: string;
  geometryRevisionId: string;
  intendedFieldId?: string;
  reconstructionMethod: 'POINTWISE' | 'IDW_INTERPOLATION' | 'VOXEL_GRID';
  reconstructedPoints: ReconstructedFieldPoint[];
  coverageRatio: number;
  unmeasuredVolumeRatio: number;
  unmeasuredRegions: Array<{ min: [number, number, number]; max: [number, number, number] }>;
  registrationError: { maxError: number; rmsError: number };
  stateHash: string;
  createdAt: string;
}

export interface ComparisonResultPoint {
  x: number;
  y: number;
  z: number;
  propertyId: string;
  intendedValue: number;
  actualValue: number;
  delta: number;
  relativeError: number;
  uncertainty: number;
  withinTolerance: boolean;
  status: 'PASS' | 'FAIL' | 'INDETERMINATE' | 'BLOCKED';
}

export interface IntendedVsAsBuiltComparison {
  comparisonId: string;
  asBuiltStateId: string;
  intendedFieldId?: string;
  engineeringRevisionId: string;
  geometryRevisionId: string;
  overallStatus: 'PASS' | 'FAIL' | 'INDETERMINATE' | 'BLOCKED';
  toleranceThresholdRatio: number; // e.g. 0.05 for 5%
  evaluatedPointsCount: number;
  passCount: number;
  failCount: number;
  indeterminateCount: number;
  maxRelativeError: number;
  meanRelativeError: number;
  pointComparisons: ComparisonResultPoint[];
  evaluatedAt: string;
}

export class AsBuiltMaterialStateEngine {
  /**
   * Converts material values to standard SI / SECP units (MPa for E, kg/m3 for density, Pa to MPa, GPa to MPa).
   */
  public static normalizePropertyValue(value: number, unit: string): { normalizedValue: number; normalizedUnit: string } {
    const u = unit.trim().toLowerCase();
    if (u === 'pa') return { normalizedValue: value / 1e6, normalizedUnit: 'MPa' };
    if (u === 'gpa') return { normalizedValue: value * 1000, normalizedUnit: 'MPa' };
    if (u === 'mpa') return { normalizedValue: value, normalizedUnit: 'MPa' };
    if (u === 'g/cm3') return { normalizedValue: value * 1000, normalizedUnit: 'kg/m3' };
    if (u === 'kg/m3') return { normalizedValue: value, normalizedUnit: 'kg/m3' };
    return { normalizedValue: value, normalizedUnit: unit };
  }

  /**
   * Validates imported raw measurement dataset against structural, numeric, physical, and domain rules.
   */
  public static validateMeasurementDataset(
    dataset: AsBuiltMaterialDataset,
    geometryBounds?: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }
  ): ValidationReport {
    const errors: string[] = [];
    const warnings: string[] = [];
    let validCount = 0;
    let rejectedCount = 0;
    let conflictingCount = 0;
    let outOfBoundsCount = 0;

    if (!dataset.datasetId) errors.push("Missing datasetId");
    if (!dataset.partInstanceId) errors.push("Missing partInstanceId");
    if (!dataset.engineeringRevisionId) errors.push("Missing engineeringRevisionId");
    if (!dataset.geometryRevisionId) errors.push("Missing geometryRevisionId");

    if (dataset.dataOrigin === 'SYNTHETIC_TEST_DATA') {
      warnings.push("Dataset origin is tagged as SYNTHETIC_TEST_DATA — NOT PHYSICAL MEASUREMENT EVIDENCE");
    } else if (dataset.dataOrigin === 'IMPORTED_UNVERIFIED') {
      warnings.push("Dataset origin is IMPORTED_UNVERIFIED — requires verification before production adjudication");
    }

    if (!dataset.rawPoints || dataset.rawPoints.length === 0) {
      errors.push("Dataset contains no raw measurement points");
      return {
        isValid: false,
        validPointCount: 0,
        rejectedPointCount: 0,
        conflictingPointCount: 0,
        outOfBoundsCount: 0,
        dataOrigin: dataset.dataOrigin,
        errors,
        warnings,
      };
    }

    const pointLocMap = new Map<string, RawMeasurementPoint>();

    for (const pt of dataset.rawPoints) {
      // Check numeric validity
      if (
        typeof pt.x !== 'number' || typeof pt.y !== 'number' || typeof pt.z !== 'number' ||
        typeof pt.value !== 'number' || isNaN(pt.x) || isNaN(pt.y) || isNaN(pt.z) || isNaN(pt.value) ||
        !isFinite(pt.x) || !isFinite(pt.y) || !isFinite(pt.z) || !isFinite(pt.value)
      ) {
        pt.qualityStatus = 'REJECTED';
        rejectedCount++;
        errors.push(`Point ${pt.pointId || 'unknown'} has invalid non-numeric or infinite coordinates/values`);
        continue;
      }

      // Physical positivity validation
      const norm = this.normalizePropertyValue(pt.value, pt.unit);
      if (pt.propertyId === 'E' && norm.normalizedValue <= 0) {
        pt.qualityStatus = 'REJECTED';
        rejectedCount++;
        errors.push(`Point ${pt.pointId}: Young's modulus E must be strictly positive (>0), got ${norm.normalizedValue} MPa`);
        continue;
      }
      if (pt.propertyId === 'density' && norm.normalizedValue <= 0) {
        pt.qualityStatus = 'REJECTED';
        rejectedCount++;
        errors.push(`Point ${pt.pointId}: Density must be strictly positive (>0), got ${norm.normalizedValue} kg/m3`);
        continue;
      }
      if (pt.propertyId === 'porosity' && (norm.normalizedValue < 0 || norm.normalizedValue > 1)) {
        pt.qualityStatus = 'REJECTED';
        rejectedCount++;
        errors.push(`Point ${pt.pointId}: Porosity must be between 0 and 1, got ${norm.normalizedValue}`);
        continue;
      }

      // Geometric bounding box check
      if (geometryBounds) {
        const isOutside =
          pt.x < geometryBounds.minX || pt.x > geometryBounds.maxX ||
          pt.y < geometryBounds.minY || pt.y > geometryBounds.maxY ||
          pt.z < geometryBounds.minZ || pt.z > geometryBounds.maxZ;
        if (isOutside) {
          pt.qualityStatus = 'OUT_OF_BOUNDS';
          outOfBoundsCount++;
          warnings.push(`Point ${pt.pointId} at (${pt.x}, ${pt.y}, ${pt.z}) is outside geometry bounding box`);
          continue;
        }
      }

      // Check duplicate/conflicting coordinates
      const locKey = `${pt.x.toFixed(4)},${pt.y.toFixed(4)},${pt.z.toFixed(4)}:${pt.propertyId}`;
      if (pointLocMap.has(locKey)) {
        const existing = pointLocMap.get(locKey)!;
        const normExisting = this.normalizePropertyValue(existing.value, existing.unit);
        if (Math.abs(normExisting.normalizedValue - norm.normalizedValue) > 1e-4) {
          pt.qualityStatus = 'CONFLICTING';
          existing.qualityStatus = 'CONFLICTING';
          conflictingCount++;
          errors.push(`Conflicting measurement for ${pt.propertyId} at (${pt.x}, ${pt.y}, ${pt.z}): ${normExisting.normalizedValue} vs ${norm.normalizedValue}`);
          continue;
        }
      } else {
        pointLocMap.set(locKey, pt);
      }

      pt.qualityStatus = 'VALIDATED';
      validCount++;
    }

    const isValid = errors.length === 0 && validCount > 0;
    return {
      isValid,
      validPointCount: validCount,
      rejectedPointCount: rejectedCount,
      conflictingPointCount: conflictingCount,
      outOfBoundsCount,
      dataOrigin: dataset.dataOrigin,
      errors,
      warnings,
    };
  }

  /**
   * Spatially registers dataset points into part local/global coordinates using frame transformation.
   */
  public static registerDatasetToGeometry(
    dataset: AsBuiltMaterialDataset,
    targetFrame: CoordinateFrameContract,
    referenceLandmarks?: Array<{ local: [number, number, number]; global: [number, number, number] }>
  ): { registeredPoints: RawMeasurementPoint[]; registrationError: { maxError: number; rmsError: number } } {
    const registeredPoints: RawMeasurementPoint[] = dataset.rawPoints.map(pt => {
      const gPt = CoordinateFrameTransformEngine.toGlobal({ x: pt.x, y: pt.y, z: pt.z }, targetFrame);
      return {
        ...pt,
        x: gPt.x,
        y: gPt.y,
        z: gPt.z,
      };
    });

    let maxErr = 0;
    let sumSqErr = 0;
    let count = 0;

    if (referenceLandmarks && referenceLandmarks.length > 0) {
      for (const lm of referenceLandmarks) {
        const calcPt = CoordinateFrameTransformEngine.toGlobal(
          { x: lm.local[0], y: lm.local[1], z: lm.local[2] },
          targetFrame
        );
        const dx = calcPt.x - lm.global[0];
        const dy = calcPt.y - lm.global[1];
        const dz = calcPt.z - lm.global[2];
        const err = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (err > maxErr) maxErr = err;
        sumSqErr += err * err;
        count++;
      }
    }

    const rmsErr = count > 0 ? Math.sqrt(sumSqErr / count) : 0;

    return {
      registeredPoints,
      registrationError: { maxError: maxErr, rmsError: rmsErr }
    };
  }

  /**
   * Reconstructs As-Built material state over target sample points or mesh nodes using IDW interpolation.
   */
  public static reconstructAsBuiltState(
    dataset: AsBuiltMaterialDataset,
    targetEvalPoints: Array<{ x: number; y: number; z: number }>,
    samplingRadius: number = 50.0,
    idwPower: number = 2.0
  ): AsBuiltMaterialState {
    const validPoints = dataset.rawPoints.filter(p => p.qualityStatus === 'VALIDATED');
    const reconstructedPoints: ReconstructedFieldPoint[] = [];

    let measuredEvalCount = 0;
    let totalUncertainty = 0;

    const unmeasuredBoundingBoxes: Array<{ min: [number, number, number]; max: [number, number, number] }> = [];

    for (const ep of targetEvalPoints) {
      // Find valid dataset points within samplingRadius
      const neighborPoints: Array<{ pt: RawMeasurementPoint; dist: number }> = [];
      for (const vp of validPoints) {
        const normVp = this.normalizePropertyValue(vp.value, vp.unit);
        const dx = vp.x - ep.x;
        const dy = vp.y - ep.y;
        const dz = vp.z - ep.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist <= samplingRadius) {
          neighborPoints.push({
            pt: { ...vp, value: normVp.normalizedValue, unit: normVp.normalizedUnit },
            dist
          });
        }
      }

      if (neighborPoints.length === 0) {
        // Unmeasured point
        reconstructedPoints.push({
          x: ep.x,
          y: ep.y,
          z: ep.z,
          reconstructedProperties: {},
          isMeasured: false,
          qualityStatus: 'UNMEASURED',
        });
        unmeasuredBoundingBoxes.push({
          min: [ep.x - 1, ep.y - 1, ep.z - 1],
          max: [ep.x + 1, ep.y + 1, ep.z + 1],
        });
        continue;
      }

      measuredEvalCount++;

      // Group neighbors by property
      const propertyGroups = new Map<string, Array<{ value: number; dist: number; uncertainty: number }>>();
      for (const n of neighborPoints) {
        const propKey = n.pt.propertyId;
        if (!propertyGroups.has(propKey)) {
          propertyGroups.set(propKey, []);
        }
        propertyGroups.get(propKey)!.push({
          value: n.pt.value,
          dist: n.dist,
          uncertainty: n.pt.uncertainty ?? (dataset.sensorMetadata.accuracy || 0.01 * n.pt.value),
        });
      }

      const reconstructedProps: Record<string, ReconstructedProperty> = {};

      for (const [propId, samples] of propertyGroups.entries()) {
        // Check for exact coincident point
        const exactMatch = samples.find(s => s.dist < 1e-6);
        if (exactMatch) {
          reconstructedProps[propId] = {
            value: exactMatch.value,
            uncertainty: exactMatch.uncertainty,
            isInterpolated: false,
            unit: propId === 'E' ? 'MPa' : 'kg/m3',
          };
        } else {
          // IDW Interpolation
          let weightSum = 0;
          let weightedValueSum = 0;
          let weightedUncertaintySqSum = 0;

          for (const s of samples) {
            const w = 1.0 / Math.pow(s.dist, idwPower);
            weightSum += w;
            weightedValueSum += w * s.value;
            weightedUncertaintySqSum += w * w * s.uncertainty * s.uncertainty;
          }

          const interpVal = weightedValueSum / weightSum;
          const interpUncertainty = Math.sqrt(weightedUncertaintySqSum) / weightSum;

          reconstructedProps[propId] = {
            value: interpVal,
            uncertainty: interpUncertainty,
            isInterpolated: true,
            unit: propId === 'E' ? 'MPa' : 'kg/m3',
          };
        }
      }

      reconstructedPoints.push({
        x: ep.x,
        y: ep.y,
        z: ep.z,
        reconstructedProperties: reconstructedProps,
        isMeasured: true,
        qualityStatus: 'VALIDATED',
      });
    }

    const totalEvalCount = targetEvalPoints.length;
    const coverageRatio = totalEvalCount > 0 ? measuredEvalCount / totalEvalCount : 0.0;
    const unmeasuredVolumeRatio = 1.0 - coverageRatio;

    const asBuiltStateId = `ABState_${dataset.datasetId}_${Date.now()}`;
    const createdAt = new Date().toISOString();

    const partialState = {
      asBuiltStateId,
      datasetId: dataset.datasetId,
      partInstanceId: dataset.partInstanceId,
      engineeringRevisionId: dataset.engineeringRevisionId,
      geometryRevisionId: dataset.geometryRevisionId,
      reconstructionMethod: 'IDW_INTERPOLATION' as const,
      reconstructedPoints,
      coverageRatio,
      unmeasuredVolumeRatio,
      unmeasuredRegions: unmeasuredBoundingBoxes.slice(0, 10),
      registrationError: { maxError: 0.0, rmsError: 0.0 },
      createdAt,
    };

    const stateHash = FEMEvidenceEngine.hashData(partialState);

    return {
      ...partialState,
      stateHash,
    };
  }

  /**
   * Compares reconstructed As-Built material state against Intended material field or base material.
   */
  public static compareIntendedVsAsBuilt(
    asBuiltState: AsBuiltMaterialState,
    intendedField?: SpatialMaterialField,
    baseE: number = 210000.0, // Default 210 GPa in MPa
    toleranceRatio: number = 0.05 // 5% tolerance
  ): IntendedVsAsBuiltComparison {
    const pointComparisons: ComparisonResultPoint[] = [];

    let passCount = 0;
    let failCount = 0;
    let indeterminateCount = 0;
    let maxRelErr = 0;
    let sumRelErr = 0;
    let evalCount = 0;

    for (const pt of asBuiltState.reconstructedPoints) {
      if (!pt.isMeasured || !pt.reconstructedProperties['E']) {
        continue;
      }

      const actualProp = pt.reconstructedProperties['E'];
      const actualVal = actualProp.value;
      const uncertainty = actualProp.uncertainty;

      let intendedVal = baseE;
      if (intendedField) {
        intendedVal = intendedField.evaluateProperty('E', pt.x, pt.y, pt.z, baseE);
      }

      const delta = actualVal - intendedVal;
      const relativeError = Math.abs(delta) / intendedVal;

      if (relativeError > maxRelErr) maxRelErr = relativeError;
      sumRelErr += relativeError;
      evalCount++;

      const allowedTolerance = toleranceRatio * intendedVal;
      const absDelta = Math.abs(delta);

      let ptStatus: 'PASS' | 'FAIL' | 'INDETERMINATE' | 'BLOCKED' = 'PASS';
      let withinTol = true;

      if (absDelta <= allowedTolerance - uncertainty) {
        ptStatus = 'PASS';
        withinTol = true;
        passCount++;
      } else if (absDelta > allowedTolerance + uncertainty) {
        ptStatus = 'FAIL';
        withinTol = false;
        failCount++;
      } else {
        // Measurement uncertainty overlaps boundary
        ptStatus = 'INDETERMINATE';
        withinTol = false;
        indeterminateCount++;
      }

      pointComparisons.push({
        x: pt.x,
        y: pt.y,
        z: pt.z,
        propertyId: 'E',
        intendedValue: intendedVal,
        actualValue: actualVal,
        delta,
        relativeError,
        uncertainty,
        withinTolerance: withinTol,
        status: ptStatus,
      });
    }

    let overallStatus: 'PASS' | 'FAIL' | 'INDETERMINATE' | 'BLOCKED' = 'PASS';

    if (asBuiltState.coverageRatio < 0.8) {
      overallStatus = 'BLOCKED'; // Incomplete coverage gate failure
    } else if (failCount > 0) {
      overallStatus = 'FAIL';
    } else if (indeterminateCount > 0) {
      overallStatus = 'INDETERMINATE';
    } else if (evalCount === 0) {
      overallStatus = 'BLOCKED';
    }

    const meanRelErr = evalCount > 0 ? sumRelErr / evalCount : 0.0;

    return {
      comparisonId: `Comp_${asBuiltState.asBuiltStateId}_${Date.now()}`,
      asBuiltStateId: asBuiltState.asBuiltStateId,
      intendedFieldId: intendedField?.fieldId,
      engineeringRevisionId: asBuiltState.engineeringRevisionId,
      geometryRevisionId: asBuiltState.geometryRevisionId,
      overallStatus,
      toleranceThresholdRatio: toleranceRatio,
      evaluatedPointsCount: evalCount,
      passCount,
      failCount,
      indeterminateCount,
      maxRelativeError: maxRelErr,
      meanRelativeError: meanRelErr,
      pointComparisons,
      evaluatedAt: new Date().toISOString(),
    };
  }
}
