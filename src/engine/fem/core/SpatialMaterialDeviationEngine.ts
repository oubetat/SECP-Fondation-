import { FEMEvidenceEngine } from "./FEMEvidenceEngine";
import { SpatialMaterialField } from "./SpatialMaterialField";
import { AsBuiltMaterialState } from "./AsBuiltMaterialStateEngine";

export type ThresholdType =
  | 'SYMMETRIC_DELTA'
  | 'ABSOLUTE_RANGE'
  | 'RELATIVE_PERCENTAGE';

export type ConformanceStatus =
  | 'CONFORMING'
  | 'NONCONFORMING'
  | 'INDETERMINATE'
  | 'NOT_MEASURED'
  | 'INSUFFICIENT_COVERAGE'
  | 'INVALID_INPUT'
  | 'BLOCKED';

export interface AcceptanceCriteriaContract {
  criteriaId: string;
  propertyId: string;
  thresholdType: ThresholdType;
  maxSymmetricDelta?: number;
  minAbsoluteValue?: number;
  maxAbsoluteValue?: number;
  maxRelativePercentage?: number; // e.g. 0.05 for 5%
  unit: string;
  sourceSpecification: string;
}

export interface PointDeviationRecord {
  x: number;
  y: number;
  z: number;
  propertyId: string;
  intendedValue: number;
  actualValue?: number;
  signedDeviation?: number;      // p_actual - p_intended
  absoluteDeviation?: number;    // |p_actual - p_intended|
  relativeDeviation?: number;    // (p_actual - p_intended) / |p_intended|
  uncertainty?: number;
  isMeasured: boolean;
  isInterpolated: boolean;
  status: ConformanceStatus;
  rejectionReason?: string;
}

export interface RegionalDeviationSummary {
  totalEvaluatedPoints: number;
  conformingPointsCount: number;
  nonConformingPointsCount: number;
  indeterminatePointsCount: number;
  unmeasuredPointsCount: number;
  coverageRatio: number;
  maxPositiveDeviation: number;
  maxNegativeDeviation: number;
  maxAbsoluteDeviation: number;
  rmsDeviation: number;
  meanDeviation: number;
  worstCasePoint?: { x: number; y: number; z: number; delta: number };
}

export interface SpatialMaterialDeviationResult {
  deviationResultId: string;
  engineeringRevisionId: string;
  intendedFieldId: string;
  asBuiltStateId: string;
  propertyId: string;
  criteria: AcceptanceCriteriaContract;
  overallStatus: ConformanceStatus;
  regionalSummary: RegionalDeviationSummary;
  pointRecords: PointDeviationRecord[];
  resultHash: string;
  evaluatedAt: string;
}

export class SpatialMaterialDeviationEngine {
  /**
   * Evaluates point-level conformance against acceptance criteria taking uncertainty into account.
   */
  public static evaluatePointConformance(
    intendedValue: number,
    actualValue: number,
    uncertainty: number,
    criteria: AcceptanceCriteriaContract
  ): ConformanceStatus {
    const delta = actualValue - intendedValue;
    const absDelta = Math.abs(delta);
    const sigma = Math.max(0, uncertainty || 0);

    if (criteria.thresholdType === 'SYMMETRIC_DELTA') {
      const maxDelta = criteria.maxSymmetricDelta ?? 10000.0;
      if (absDelta <= maxDelta - sigma) {
        return 'CONFORMING';
      }
      if (absDelta > maxDelta + sigma) {
        return 'NONCONFORMING';
      }
      return 'INDETERMINATE';
    }

    if (criteria.thresholdType === 'ABSOLUTE_RANGE') {
      const minVal = criteria.minAbsoluteValue ?? -Infinity;
      const maxVal = criteria.maxAbsoluteValue ?? Infinity;

      const lowerPass = actualValue - sigma >= minVal;
      const lowerFail = actualValue + sigma < minVal;

      const upperPass = actualValue + sigma <= maxVal;
      const upperFail = actualValue - sigma > maxVal;

      if (lowerPass && upperPass) return 'CONFORMING';
      if (lowerFail || upperFail) return 'NONCONFORMING';
      return 'INDETERMINATE';
    }

    if (criteria.thresholdType === 'RELATIVE_PERCENTAGE') {
      if (Math.abs(intendedValue) < 1e-12) {
        // Division by zero safeguard
        return absDelta <= 1e-6 ? 'CONFORMING' : 'NONCONFORMING';
      }

      const maxPct = criteria.maxRelativePercentage ?? 0.05; // 5% default
      const relError = absDelta / Math.abs(intendedValue);
      const relSigma = sigma / Math.abs(intendedValue);

      if (relError <= maxPct - relSigma) {
        return 'CONFORMING';
      }
      if (relError > maxPct + relSigma) {
        return 'NONCONFORMING';
      }
      return 'INDETERMINATE';
    }

    return 'INVALID_INPUT';
  }

  /**
   * Calculates spatial material deviation field and conducts engineering conformance verification.
   */
  public static computeSpatialDeviation(
    asBuiltState: AsBuiltMaterialState,
    intendedField?: SpatialMaterialField,
    baseIntendedValue: number = 210000.0,
    criteria?: AcceptanceCriteriaContract,
    minCoverageThreshold: number = 0.8,
    options?: { timestamp?: string; deviationResultId?: string }
  ): SpatialMaterialDeviationResult {
    const defaultCriteria: AcceptanceCriteriaContract = criteria || {
      criteriaId: `CRIT_${Date.now()}`,
      propertyId: 'E',
      thresholdType: 'SYMMETRIC_DELTA',
      maxSymmetricDelta: 10500.0, // 5% of 210000 MPa
      unit: 'MPa',
      sourceSpecification: 'SPEC-DEFAULT-SECP-V8',
    };

    const propId = defaultCriteria.propertyId;

    // Sanity checks on input states
    if (!asBuiltState || !asBuiltState.asBuiltStateId || !asBuiltState.reconstructedPoints) {
      return this.buildInvalidResult(
        asBuiltState?.engineeringRevisionId || 'UNKNOWN',
        intendedField?.fieldId || 'NONE',
        asBuiltState?.asBuiltStateId || 'NONE',
        propId,
        defaultCriteria,
        'INVALID_INPUT'
      );
    }

    const pointRecords: PointDeviationRecord[] = [];
    let conformingCount = 0;
    let nonConformingCount = 0;
    let indeterminateCount = 0;
    let unmeasuredCount = 0;

    let maxPosDev = -Infinity;
    let maxNegDev = Infinity;
    let maxAbsDev = 0;
    let sumSqDev = 0;
    let sumDev = 0;
    let measuredCount = 0;

    let worstPoint: { x: number; y: number; z: number; delta: number } | undefined = undefined;

    for (const pt of asBuiltState.reconstructedPoints) {
      // Determine intended value at (x,y,z)
      let intendedVal = baseIntendedValue;
      if (intendedField) {
        const evalProps = intendedField.evaluate({ x: pt.x, y: pt.y, z: pt.z });
        if (evalProps && typeof evalProps[propId as any] === 'number') {
          intendedVal = evalProps[propId as any];
        }
      }

      if (!pt.isMeasured || !pt.reconstructedProperties[propId]) {
        // V8-ARCH-02: Unmeasured regions MUST NOT be assigned zero deviation
        unmeasuredCount++;
        pointRecords.push({
          x: pt.x,
          y: pt.y,
          z: pt.z,
          propertyId: propId,
          intendedValue: intendedVal,
          isMeasured: false,
          isInterpolated: false,
          status: 'NOT_MEASURED',
          rejectionReason: 'Domain point not covered by measurement dataset within sampling radius',
        });
        continue;
      }

      measuredCount++;
      const actualProp = pt.reconstructedProperties[propId];
      const actualVal = actualProp.value;
      const uncertainty = actualProp.uncertainty ?? 0.0;

      const signedDev = actualVal - intendedVal;
      const absDev = Math.abs(signedDev);

      let relDev: number | undefined = undefined;
      if (Math.abs(intendedVal) > 1e-12) {
        relDev = signedDev / Math.abs(intendedVal);
      }

      const status = this.evaluatePointConformance(intendedVal, actualVal, uncertainty, defaultCriteria);

      if (status === 'CONFORMING') conformingCount++;
      if (status === 'NONCONFORMING') nonConformingCount++;
      if (status === 'INDETERMINATE') indeterminateCount++;

      if (signedDev > maxPosDev) maxPosDev = signedDev;
      if (signedDev < maxNegDev) maxNegDev = signedDev;
      if (absDev > maxAbsDev) {
        maxAbsDev = absDev;
        worstPoint = { x: pt.x, y: pt.y, z: pt.z, delta: signedDev };
      }

      sumSqDev += signedDev * signedDev;
      sumDev += signedDev;

      pointRecords.push({
        x: pt.x,
        y: pt.y,
        z: pt.z,
        propertyId: propId,
        intendedValue: intendedVal,
        actualValue: actualVal,
        signedDeviation: signedDev,
        absoluteDeviation: absDev,
        relativeDeviation: relDev,
        uncertainty,
        isMeasured: true,
        isInterpolated: actualProp.isInterpolated,
        status,
      });
    }

    const totalEvalPoints = asBuiltState.reconstructedPoints.length;
    const coverageRatio = totalEvalPoints > 0 ? measuredCount / totalEvalPoints : 0.0;

    const rmsDev = measuredCount > 0 ? Math.sqrt(sumSqDev / measuredCount) : 0.0;
    const meanDev = measuredCount > 0 ? sumDev / measuredCount : 0.0;

    if (measuredCount === 0) {
      maxPosDev = 0;
      maxNegDev = 0;
    }

    // Determine overall conformance status
    let overallStatus: ConformanceStatus = 'CONFORMING';

    if (coverageRatio < minCoverageThreshold) {
      overallStatus = 'INSUFFICIENT_COVERAGE';
    } else if (nonConformingCount > 0) {
      // V8-ARCH-05: Localized non-conformance is preserved and NOT masked by global averages
      overallStatus = 'NONCONFORMING';
    } else if (indeterminateCount > 0) {
      overallStatus = 'INDETERMINATE';
    } else if (measuredCount === 0) {
      overallStatus = 'NOT_MEASURED';
    }

    const regionalSummary: RegionalDeviationSummary = {
      totalEvaluatedPoints: totalEvalPoints,
      conformingPointsCount: conformingCount,
      nonConformingPointsCount: nonConformingCount,
      indeterminatePointsCount: indeterminateCount,
      unmeasuredPointsCount: unmeasuredCount,
      coverageRatio,
      maxPositiveDeviation: maxPosDev,
      maxNegativeDeviation: maxNegDev,
      maxAbsoluteDeviation: maxAbsDev,
      rmsDeviation: rmsDev,
      meanDeviation: meanDev,
      worstCasePoint: worstPoint,
    };

    const deviationResultId = options?.deviationResultId || `DevRes_${asBuiltState.asBuiltStateId}_${intendedField?.fieldId || 'BASE'}`;
    const evaluatedAt = options?.timestamp || new Date().toISOString();

    const partialResult = {
      deviationResultId,
      engineeringRevisionId: asBuiltState.engineeringRevisionId,
      intendedFieldId: intendedField?.fieldId || 'BASE_PROPERTY',
      asBuiltStateId: asBuiltState.asBuiltStateId,
      propertyId: propId,
      criteria: defaultCriteria,
      overallStatus,
      regionalSummary,
      pointRecords,
      evaluatedAt,
    };

    const resultHash = FEMEvidenceEngine.hashData({
      engineeringRevisionId: asBuiltState.engineeringRevisionId,
      intendedFieldId: intendedField?.fieldId || 'BASE_PROPERTY',
      asBuiltStateId: asBuiltState.asBuiltStateId,
      propertyId: propId,
      criteria: defaultCriteria,
      overallStatus,
      regionalSummary,
      pointRecords,
    });

    return {
      ...partialResult,
      resultHash,
    };
  }

  private static buildInvalidResult(
    engRevId: string,
    intendedFieldId: string,
    asBuiltStateId: string,
    propertyId: string,
    criteria: AcceptanceCriteriaContract,
    status: ConformanceStatus
  ): SpatialMaterialDeviationResult {
    const partialResult = {
      deviationResultId: `DevRes_INVALID_${Date.now()}`,
      engineeringRevisionId: engRevId,
      intendedFieldId,
      asBuiltStateId,
      propertyId,
      criteria,
      overallStatus: status,
      regionalSummary: {
        totalEvaluatedPoints: 0,
        conformingPointsCount: 0,
        nonConformingPointsCount: 0,
        indeterminatePointsCount: 0,
        unmeasuredPointsCount: 0,
        coverageRatio: 0,
        maxPositiveDeviation: 0,
        maxNegativeDeviation: 0,
        maxAbsoluteDeviation: 0,
        rmsDeviation: 0,
        meanDeviation: 0,
      },
      pointRecords: [],
      evaluatedAt: new Date().toISOString(),
    };

    return {
      ...partialResult,
      resultHash: FEMEvidenceEngine.hashData(partialResult),
    };
  }
}
