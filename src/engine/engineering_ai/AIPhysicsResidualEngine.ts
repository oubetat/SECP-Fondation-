import { AIPhysicsResidual } from './types';

export class AIPhysicsResidualEngine {
  public static computeResidual(
    aiPrediction: number,
    physicsValue: number,
    toleranceRelative: number = 0.05
  ): AIPhysicsResidual {
    const absoluteError = Math.abs(aiPrediction - physicsValue);
    const denominator = Math.max(Math.abs(physicsValue), 1e-6);
    const relativeError = absoluteError / denominator;
    const isWithinTolerance = relativeError <= toleranceRelative;

    return {
      aiPrediction,
      physicsValue,
      absoluteError,
      relativeError,
      isWithinTolerance
    };
  }
}
