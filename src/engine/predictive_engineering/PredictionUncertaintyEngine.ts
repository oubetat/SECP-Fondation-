import { UncertaintyEstimation } from './types';

export class PredictionUncertaintyEngine {
  public static computeUncertainty(
    basePrediction: number,
    modelVariance: number,
    inputVariance: number
  ): UncertaintyEstimation {
    // Simplified propagation: total variance = model variance + input variance
    const totalVariance = modelVariance + inputVariance;
    const stdDev = Math.sqrt(totalVariance);
    
    // Assume normal distribution for 95% CI (z ~ 1.96)
    const zScore95 = 1.96;
    const margin = zScore95 * stdDev;

    return {
      uncertaintyType: 'TOTAL',
      uncertaintyValue: stdDev,
      confidenceLevel: 0.95,
      lowerBound: basePrediction - margin,
      upperBound: basePrediction + margin
    };
  }
}
