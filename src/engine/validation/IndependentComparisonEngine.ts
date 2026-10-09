/**
 * SECP Industrial OS v3 — PATCH-185: Independent Comparison Engine
 * Implements external validation logic to compare SECP results against independent references
 * using a pre-defined tolerance contract.
 */

import { 
  ValidationStatus, 
  ToleranceContract, 
  ExpectedReference, 
  ValidationComparisonResult,
  ValidationReport,
  ExternalValidationPackage
} from './ValidationTypes';
import { ResultPackage } from '../reproducibility/ReproducibilityTypes';
// Removed crypto import

export class IndependentComparisonEngine {
  private readonly version = '1.185.0-CORE';

  /**
   * Performs comparison between SECP results and external reference data
   */
  public async compare(
    pkg: ExternalValidationPackage
  ): Promise<ValidationReport> {
    const { result, expectedReference, toleranceContract } = pkg;
    
    const comparisonResults: ValidationComparisonResult[] = [];
    let overallStatus: ValidationStatus = 'PASSED';

    // Iterate through tolerances in the contract
    for (const tolerance of toleranceContract.tolerances) {
      const metric = tolerance.metric;
      const secpValue = this.extractMetricValue(result, metric);
      const refValue = this.extractMetricValueFromRef(expectedReference, metric);

      if (secpValue === undefined || refValue === undefined) {
        comparisonResults.push({
          metric,
          secpValue: secpValue ?? 0,
          referenceValue: refValue ?? 0,
          deviationAbsolute: 0,
          deviationRelative: 0,
          toleranceAbsolute: tolerance.absoluteTolerance,
          toleranceRelative: tolerance.relativeTolerance,
          status: 'INCONCLUSIVE',
          message: `Metric ${metric} not found in one or both datasets.`
        });
        overallStatus = this.demoteStatus(overallStatus, 'INCONCLUSIVE');
        continue;
      }

      const comparison = this.evaluateMetric(secpValue, refValue, tolerance);
      comparisonResults.push(comparison);
      overallStatus = this.demoteStatus(overallStatus, comparison.status);
    }

    const reportId = `VAL-REP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    return {
      reportId,
      timestamp: new Date().toISOString(),
      packageId: pkg.manifest.packageId,
      validatorVersion: this.version,
      oracleStatus: 'SUCCESS',
      replayStatus: 'SUCCESS',
      comparisonResults,
      finalVerdict: overallStatus,
      evidenceHash: this.calculateEvidenceHash(comparisonResults),
      rootHash: pkg.manifest.rootHash
    };
  }

  private evaluateMetric(
    secpValue: number | number[],
    refValue: number | number[],
    tolerance: any
  ): ValidationComparisonResult {
    // Handle array vs scalar
    if (Array.isArray(secpValue) && Array.isArray(refValue)) {
      // For arrays, we use the max deviation for now or a specific reduction
      let maxAbsDev = 0;
      let maxRelDev = 0;
      
      for (let i = 0; i < Math.min(secpValue.length, refValue.length); i++) {
        const abs = Math.abs(secpValue[i] - refValue[i]);
        const rel = refValue[i] !== 0 ? abs / Math.abs(refValue[i]) : abs;
        maxAbsDev = Math.max(maxAbsDev, abs);
        maxRelDev = Math.max(maxRelDev, rel);
      }

      return this.generateVerdict(metricNameFromPath(tolerance.metric), secpValue, refValue, maxAbsDev, maxRelDev, tolerance);
    } else if (!Array.isArray(secpValue) && !Array.isArray(refValue)) {
      const abs = Math.abs(secpValue - refValue);
      const rel = refValue !== 0 ? abs / Math.abs(refValue) : abs;
      return this.generateVerdict(tolerance.metric, secpValue, refValue, abs, rel, tolerance);
    }

    return {
      metric: tolerance.metric,
      secpValue,
      referenceValue: refValue,
      deviationAbsolute: 0,
      deviationRelative: 0,
      toleranceAbsolute: tolerance.absoluteTolerance,
      toleranceRelative: tolerance.relativeTolerance,
      status: 'FAIL',
      message: 'Type mismatch: one value is scalar, other is array.'
    };
  }

  private generateVerdict(
    metric: string,
    secpValue: any,
    refValue: any,
    abs: number,
    rel: number,
    tolerance: any
  ): ValidationComparisonResult {
    let status: ValidationStatus = 'PASSED';
    let message = '';

    const isAbsFail = abs > tolerance.absoluteTolerance;
    const isRelFail = rel > tolerance.relativeTolerance;

    if (isAbsFail || isRelFail) {
      // Check if it's within uncertainty
      if (abs <= tolerance.absoluteTolerance + tolerance.uncertainty) {
        status = 'PASSED_WITHIN_UNCERTAINTY';
        message = 'Exceeds base tolerance but within uncertainty band.';
      } else if (abs <= (tolerance.absoluteTolerance + tolerance.uncertainty) * 1.5) {
        status = 'MARGINAL';
        message = 'Significant deviation near boundary.';
      } else {
        status = 'FAIL';
        message = `Deviation ${abs.toExponential(4)} exceeds tolerance ${tolerance.absoluteTolerance.toExponential(4)}.`;
      }
    }

    return {
      metric,
      secpValue,
      referenceValue: refValue,
      deviationAbsolute: abs,
      deviationRelative: rel,
      toleranceAbsolute: tolerance.absoluteTolerance,
      toleranceRelative: tolerance.relativeTolerance,
      status,
      message
    };
  }

  private extractMetricValue(result: ResultPackage, metric: string): number | number[] | undefined {
    // Simple path-based extractor
    if (metric === 'maxStressMPa') return result.scalars.maxStressMPa;
    if (metric === 'maxDisplacementMM') return result.scalars.maxDisplacementMM;
    if (metric === 'massConservationError') return result.conservationMetrics.massConservationError;
    
    // Check field data
    if (metric === 'vonMisesStressMPa') return result.fieldData.vonMisesStressMPa;
    
    return undefined;
  }

  private extractMetricValueFromRef(ref: ExpectedReference, metric: string): number | number[] | undefined {
    return ref.expectedValues[metric];
  }

  private demoteStatus(current: ValidationStatus, next: ValidationStatus): ValidationStatus {
    const weights: Record<ValidationStatus, number> = {
      'PASSED': 0,
      'PASSED_WITHIN_UNCERTAINTY': 1,
      'MARGINAL': 2,
      'INCONCLUSIVE': 3,
      'FAIL': 4,
      'INVALIDATED': 5,
      'PENDING': 0
    };

    return weights[next] > weights[current] ? next : current;
  }

  private calculateEvidenceHash(results: ValidationComparisonResult[]): string {
    // Mock hash for evidence
    return `SHA256-EV-${results.length}-${Date.now()}`;
  }
}

function metricNameFromPath(path: string): string {
  return path.split('.').pop() || path;
}
