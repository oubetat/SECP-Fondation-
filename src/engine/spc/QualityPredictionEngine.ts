import { SPCObservation, ProcessBaseline, DriftState } from './SPCTypes';

export interface ProcessHealthPrediction {
  probabilityOfDefect: number;
  recommendedAction: string;
}

export class QualityPredictionEngine {
  public static predictProcessHealth(
    dataset: SPCObservation[],
    baseline: ProcessBaseline,
    drift: DriftState
  ): ProcessHealthPrediction {
    let probabilityOfDefect = 0.1;
    let recommendedAction = 'Process is stable. Continue normal operations.';

    if (drift.state === 'DEGRADING' || drift.slopeMmPerSample > 0.001) {
      probabilityOfDefect = 0.85;
      recommendedAction = 'Execute preventative tool maintenance immediately to restore process stability.';
    }

    return {
      probabilityOfDefect,
      recommendedAction
    };
  }
}
