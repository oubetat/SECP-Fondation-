import {
  StructuralValidationEvidence,
  ValidationVerdict,
  ReferenceDataset,
  ValidationMetricResult,
  ValidationStatus
} from "./types";
import { ReferenceDatasetManager } from "./ReferenceDatasetManager";
import { CorrelationEngines } from "./CorrelationEngines";

export class StructuralValidationEngine {
  /**
   * Orchestrates the validation of a simulation result against a reference dataset.
   */
  public static validate(
    caseId: string,
    analysisId: string,
    simulationResult: any,
    referenceDataset: ReferenceDataset,
    criteria: { metricId: string; threshold: number }[]
  ): StructuralValidationEvidence {
    const validationId = `VAL_${ReferenceDatasetManager.hashDataset(`${caseId}_${analysisId}_${Date.now()}`)}`;
    
    // 1. Verify Dataset Integrity
    const integrityValid = ReferenceDatasetManager.verifyIntegrity(referenceDataset);
    if (!integrityValid) {
      return this.createFailureEvidence(validationId, caseId, analysisId, referenceDataset.datasetId, ValidationVerdict.REFERENCE_DATA_INTEGRITY_FAILURE);
    }

    const metrics: ValidationMetricResult[] = [];

    // 2. Perform Correlations based on criteria
    for (const criterion of criteria) {
      let metricResult: ValidationMetricResult | null = null;

      switch (criterion.metricId) {
        case 'DISPLACEMENT_RMSE':
          if (simulationResult.u && referenceDataset.data.u) {
            metricResult = CorrelationEngines.correlateDisplacement(
              referenceDataset.data.u,
              simulationResult.u,
              referenceDataset.uncertainty,
              criterion.threshold
            );
          }
          break;
        case 'FREQUENCY_ERROR':
          if (simulationResult.freq && referenceDataset.data.freq) {
            metricResult = CorrelationEngines.correlateFrequency(
              referenceDataset.data.freq,
              simulationResult.freq,
              criterion.threshold
            );
          }
          break;
        case 'FATIGUE_LIFE_ERROR':
          if (simulationResult.life && referenceDataset.data.life) {
            metricResult = CorrelationEngines.correlateFatigueLife(
              referenceDataset.data.life,
              simulationResult.life
            );
          }
          break;
      }

      if (metricResult) {
        metrics.push(metricResult);
      }
    }

    // 3. Determine Final Verdict
    let verdict = ValidationVerdict.VALIDATED;
    if (metrics.length === 0) {
      verdict = ValidationVerdict.INSUFFICIENT_REFERENCE_DATA;
    } else if (metrics.some(m => m.status === ValidationStatus.FAIL)) {
      verdict = ValidationVerdict.VALIDATION_FAILURE;
    } else if (metrics.some(m => m.status === ValidationStatus.WARNING)) {
      verdict = ValidationVerdict.PARTIALLY_VALIDATED;
    }

    return {
      validationId,
      caseId,
      analysisId,
      referenceDatasetId: referenceDataset.datasetId,
      verdict,
      metrics,
      timestamp: new Date().toISOString(),
      provenanceHash: ReferenceDatasetManager.lockDataset(referenceDataset)
    };
  }

  private static createFailureEvidence(
    validationId: string,
    caseId: string,
    analysisId: string,
    datasetId: string,
    verdict: ValidationVerdict
  ): StructuralValidationEvidence {
    return {
      validationId,
      caseId,
      analysisId,
      referenceDatasetId: datasetId,
      verdict,
      metrics: [],
      timestamp: new Date().toISOString(),
      provenanceHash: 'INVALID'
    };
  }
}
