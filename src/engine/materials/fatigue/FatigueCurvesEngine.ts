import { 
  FatigueDataset, 
  FatigueCurveParameters, 
  FatigueCurveType, 
  FatigueVerdict 
} from "./types";
import { BasquinModel } from "./FatigueModels";
import { MeanStressCorrection } from "./MeanStressCorrection";

export class FatigueCurvesEngine {
  /**
   * Fits an SN curve to a dataset using log-log linear regression for Basquin parameters.
   * log(sigma_a) = log(sigma_f') + b * log(2Nf)
   */
  public static fitSNBasquin(dataset: FatigueDataset): FatigueCurveParameters {
    const validPoints = dataset.points.filter(p => !p.isRunout && p.cyclesToFailure > 0 && p.amplitude > 0);
    
    if (validPoints.length < 2) {
      throw new Error("Insufficient data for SN fitting.");
    }

    // Y = log10(amplitude)
    // X = log10(2 * cyclesToFailure)
    const Y = validPoints.map(p => Math.log10(p.amplitude));
    const X = validPoints.map(p => Math.log10(2 * p.cyclesToFailure));

    const n = X.length;
    const sumX = X.reduce((a, b) => a + b, 0);
    const sumY = Y.reduce((a, b) => a + b, 0);
    const sumXY = X.reduce((a, b, i) => a + b * Y[i], 0);
    const sumXX = X.reduce((a, b) => a + b * b, 0);

    const b = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const logSigmaF = (sumY - b * sumX) / n;
    const sigmaF = Math.pow(10, logSigmaF);

    return {
      modelId: `basquin-${dataset.datasetId}`,
      type: FatigueCurveType.SN,
      parameters: { sigmaF, b },
      validityDomain: {
        minAmplitude: Math.min(...validPoints.map(p => p.amplitude)),
        maxAmplitude: Math.max(...validPoints.map(p => p.amplitude)),
        minCycles: Math.min(...validPoints.map(p => p.cyclesToFailure)),
        maxCycles: Math.max(...validPoints.map(p => p.cyclesToFailure))
      },
      revision: 1
    };
  }

  public static predictLife(
    amplitude: number,
    meanStress: number,
    params: FatigueCurveParameters,
    correctionModel: 'GOODMAN' | 'GERBER' | 'SODERBERG' | 'NONE' = 'NONE',
    referenceProperties?: { S_ut?: number, S_yt?: number }
  ): { life: number; verdict: FatigueVerdict } {
    
    let correctedAmplitude = amplitude;
    if (correctionModel === 'GOODMAN' && referenceProperties?.S_ut) {
      correctedAmplitude = MeanStressCorrection.goodman(amplitude, meanStress, referenceProperties.S_ut);
    } else if (correctionModel === 'GERBER' && referenceProperties?.S_ut) {
      correctedAmplitude = MeanStressCorrection.gerber(amplitude, meanStress, referenceProperties.S_ut);
    } else if (correctionModel === 'SODERBERG' && referenceProperties?.S_yt) {
      correctedAmplitude = MeanStressCorrection.soderberg(amplitude, meanStress, referenceProperties.S_yt);
    }

    if (correctedAmplitude === Infinity) {
      return { life: 0, verdict: FatigueVerdict.INVALID_INPUT };
    }

    if (params.type === FatigueCurveType.SN) {
      const life = BasquinModel.predictLife(correctedAmplitude, params.parameters);
      return { life, verdict: FatigueVerdict.VALID };
    }

    return { life: 0, verdict: FatigueVerdict.INVALID_INPUT };
  }
}
