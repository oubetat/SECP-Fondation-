import { PredictiveEngineeringRecord, PredictionModel, PredictionInputSnapshot } from './types';
import { CanonicalPredictionSerializer } from './CanonicalPredictionSerializer';
import { PredictionIdentityService } from './PredictionIdentityService';

export interface PredVerificationResult {
  valid: boolean;
  computedRootHash: string;
  verdict: 'MATCH' | 'MISMATCH' | 'INCOMPLETE' | 'INVALID';
  details: string;
}

export class IndependentPredictionVerifier {
  public static verifyPredictionTruth(
    record: PredictiveEngineeringRecord,
    model: PredictionModel,
    snapshot: PredictionInputSnapshot,
    targetName: string,
    claimedRootHash: string
  ): PredVerificationResult {

    // 1. Recompute input hash
    const inputHash = CanonicalPredictionSerializer.computeInputSnapshotHash(snapshot);
    if (inputHash !== record.inputStateHash) {
      return { valid: false, computedRootHash: '', verdict: 'INVALID', details: 'INPUT_HASH_MISMATCH' };
    }

    // 2. Fake Validation check (if it says PREDICTED or VALIDATED but violated rules)
    const unitCheck = PredictionIdentityService.verifyUnitSafety(model, snapshot);
    if (!unitCheck.valid && record.status !== 'INVALID') {
      return { valid: false, computedRootHash: '', verdict: 'INVALID', details: 'FAKE_VALIDATION: Unit mismatch ignored' };
    }

    const oodCheck = PredictionIdentityService.detectOOD(model, snapshot);
    if (oodCheck.status === 'OUT_OF_DISTRIBUTION' && record.status !== 'OUT_OF_DOMAIN' && record.status !== 'REJECTED') {
      return { valid: false, computedRootHash: '', verdict: 'INVALID', details: 'FAKE_VALIDATION: OOD ignored' };
    }

    const physicsCheck = PredictionIdentityService.verifyPhysicalPlausibility(targetName, record.predictionValue, record.predictionUnit);
    if (!physicsCheck.valid && record.status !== 'PHYSICS_INCONSISTENT') {
      return { valid: false, computedRootHash: '', verdict: 'INVALID', details: 'FAKE_VALIDATION: Physics violation ignored' };
    }

    // 3. Root Hash Computation
    const computedRootHash = CanonicalPredictionSerializer.computePredictionRootHash(
      inputHash,
      model.modelHash,
      record.predictionValue,
      record.uncertainty,
      oodCheck.status,
      physicsCheck.valid && unitCheck.valid
    );

    if (computedRootHash !== claimedRootHash) {
      return { valid: false, computedRootHash, verdict: 'MISMATCH', details: 'PREDICTION_TAMPERING: Computed root hash does not match claimed root hash' };
    }

    return { valid: true, computedRootHash, verdict: 'MATCH', details: '100% Differential Match between Primary and Independent Verifiers' };
  }
}
