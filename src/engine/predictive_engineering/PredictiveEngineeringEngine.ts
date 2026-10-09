import { PredictionModel, PredictionInputSnapshot, PredictiveEngineeringRecord } from './types';
import { CanonicalPredictionSerializer } from './CanonicalPredictionSerializer';
import { PredictionIdentityService } from './PredictionIdentityService';
import { PredictionUncertaintyEngine } from './PredictionUncertaintyEngine';

export class PredictiveEngineeringEngine {
  public createPrediction(
    predictionId: string,
    model: PredictionModel,
    snapshot: PredictionInputSnapshot,
    horizon: number,
    horizonUnit: string,
    baseValue: number, // Simulated model output
    modelVariance: number,
    inputVariance: number,
    targetName: string
  ): PredictiveEngineeringRecord {
    const inputStateHash = CanonicalPredictionSerializer.computeInputSnapshotHash(snapshot);
    
    // Checks
    const unitCheck = PredictionIdentityService.verifyUnitSafety(model, snapshot);
    const oodCheck = PredictionIdentityService.detectOOD(model, snapshot);
    const physicsCheck = PredictionIdentityService.verifyPhysicalPlausibility(targetName, baseValue, model.canonicalUnits[targetName] || 'unit');

    const uncertainty = PredictionUncertaintyEngine.computeUncertainty(baseValue, modelVariance, inputVariance);

    let verdict: PredictiveEngineeringRecord['status'] = 'PREDICTED';
    let physicsPlausibility = true;

    if (!unitCheck.valid) {
      verdict = 'INVALID';
      physicsPlausibility = false;
    } else if (oodCheck.status === 'OUT_OF_DISTRIBUTION') {
      verdict = 'OUT_OF_DOMAIN';
    } else if (!physicsCheck.valid) {
      verdict = 'PHYSICS_INCONSISTENT';
      physicsPlausibility = false;
    }

    const predictionRootHash = CanonicalPredictionSerializer.computePredictionRootHash(
      inputStateHash,
      model.modelHash,
      baseValue,
      uncertainty.uncertaintyValue,
      oodCheck.status,
      physicsPlausibility
    );

    return {
      predictionId,
      entityId: 'ENT-001',
      entityType: 'COMPONENT',
      predictionType: targetName,
      modelId: model.modelId,
      modelVersion: model.modelVersion,
      inputStateId: snapshot.snapshotId,
      inputStateHash,
      predictionVersion: 1,
      createdAt: new Date().toISOString(),
      horizon,
      horizonUnit,
      predictionValue: baseValue,
      predictionUnit: model.canonicalUnits[targetName] || 'unit',
      uncertainty: uncertainty.uncertaintyValue,
      confidenceLevel: uncertainty.confidenceLevel,
      status: verdict,
      predictionRootHash,
      oodStatus: oodCheck.status,
      physicsPlausibility
    };
  }
}
