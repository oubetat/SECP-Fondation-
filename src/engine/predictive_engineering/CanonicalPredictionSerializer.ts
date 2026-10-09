import * as crypto from 'crypto';
import { PredictionInputSnapshot, PredictiveEngineeringRecord, PredictionModel } from './types';

export class CanonicalPredictionSerializer {
  public static sha256(data: string): string {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
  }

  public static computeInputSnapshotHash(snap: Partial<PredictionInputSnapshot>): string {
    const featureStrs = Object.keys(snap.features || {}).sort().map(k => `${k}:${snap.features![k].value}:${snap.features![k].unit}`);
    return this.sha256([
      snap.geometryHash,
      snap.materialHash,
      snap.telemetryHash,
      snap.configurationHash,
      featureStrs.join(',')
    ].join('|'));
  }

  public static computePredictionRootHash(
    inputStateHash: string,
    modelHash: string,
    predictionValue: number,
    uncertainty: number,
    oodStatus: string,
    physicsPlausibility: boolean
  ): string {
    return this.sha256([
      inputStateHash,
      modelHash,
      Number(predictionValue.toFixed(6)),
      Number(uncertainty.toFixed(6)),
      oodStatus,
      physicsPlausibility ? 'PASS' : 'FAIL'
    ].join('|PRED_ROOT|'));
  }
}
