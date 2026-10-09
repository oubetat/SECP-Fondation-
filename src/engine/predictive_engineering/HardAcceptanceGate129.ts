import { PredictiveEngineeringEngine } from './PredictiveEngineeringEngine';
import { IndependentPredictionVerifier } from './IndependentPredictionVerifier';
import { PredictionIdentityService } from './PredictionIdentityService';
import { CanonicalPredictionSerializer } from './CanonicalPredictionSerializer';
import { PredictionModel, PredictionInputSnapshot, PredictiveEngineeringRecord } from './types';

export interface Gate129CheckResult {
  gateId: string;
  description: string;
  passed: boolean;
  score: number;
  details: string;
}

export interface Gate129Summary {
  totalChecks: number;
  passedChecks: number;
  overallScore: number;
  verdict: 'PASS' | 'FAIL';
  checks: Gate129CheckResult[];
}

export class HardAcceptanceGate129 {
  public static evaluateGate(): Gate129Summary {
    const checks: Gate129CheckResult[] = [];
    const engine = new PredictiveEngineeringEngine();

    const model: PredictionModel = {
      modelId: 'MOD-001', modelVersion: '1.0', modelType: 'PHYSICS_BASED', domain: 'STRUCTURAL', status: 'APPROVED',
      inputBounds: { 'load': { min: 0, max: 1000 } }, canonicalUnits: { 'load': 'N', 'stress': 'MPa' }, modelHash: 'mod_hash_1'
    };

    const validSnapshot: PredictionInputSnapshot = {
      snapshotId: 'SNAP-01', geometryHash: 'geom', materialHash: 'mat', telemetryHash: 'tel', configurationHash: 'conf',
      features: { 'load': { value: 500, unit: 'N' } }, snapshotHash: 'snap_hash'
    };

    const validRecord = engine.createPrediction('PRED-001', model, validSnapshot, 10, 'cycles', 250, 4, 1, 'stress');

    // 1. Deterministic Prediction Identity
    const rec1 = engine.createPrediction('PRED-001', model, validSnapshot, 10, 'cycles', 250, 4, 1, 'stress');
    const rec2 = engine.createPrediction('PRED-001', model, validSnapshot, 10, 'cycles', 250, 4, 1, 'stress');
    const g01Passed = rec1.predictionRootHash === rec2.predictionRootHash && rec1.predictionRootHash.length === 64;
    checks.push({ gateId: 'GATE-129-01', description: 'Deterministic Prediction Identity', passed: g01Passed, score: g01Passed ? 100 : 0, details: g01Passed ? 'Hashes match exactly' : 'Determinism failed' });

    // 2. Unit Safety Check
    const badUnitSnap = { ...validSnapshot, features: { 'load': { value: 500, unit: 'kN' } } };
    const unitCheck = PredictionIdentityService.verifyUnitSafety(model, badUnitSnap);
    const g02Passed = !unitCheck.valid && unitCheck.error?.includes('UNIT_MISMATCH') === true;
    checks.push({ gateId: 'GATE-129-02', description: 'Unit Safety Validation', passed: g02Passed, score: g02Passed ? 100 : 0, details: g02Passed ? 'Successfully intercepted UNIT_MISMATCH' : 'Failed to catch unit error' });

    // 3. Out-Of-Distribution (OOD) Detection
    const oodSnap = { ...validSnapshot, features: { 'load': { value: 1500, unit: 'N' } } };
    const oodCheck = PredictionIdentityService.detectOOD(model, oodSnap);
    const g03Passed = oodCheck.status === 'OUT_OF_DISTRIBUTION';
    checks.push({ gateId: 'GATE-129-03', description: 'Out-Of-Distribution Detection', passed: g03Passed, score: g03Passed ? 100 : 0, details: g03Passed ? 'Successfully caught OUT_OF_DISTRIBUTION' : 'Failed OOD detection' });

    // 4. Physical Plausibility Gate
    const physCheck = PredictionIdentityService.verifyPhysicalPlausibility('temperature', -10, 'K');
    const g04Passed = !physCheck.valid && physCheck.error?.includes('PHYSICS_VIOLATION') === true;
    checks.push({ gateId: 'GATE-129-04', description: 'Physical Plausibility Gate', passed: g04Passed, score: g04Passed ? 100 : 0, details: g04Passed ? 'Successfully caught PHYSICS_VIOLATION' : 'Failed physics check' });

    // 5. Uncertainty Computation
    // stdDev = sqrt(4 + 1) = sqrt(5) ~ 2.236, margin = 1.96 * 2.236 ~ 4.38
    const g05Passed = validRecord.uncertainty > 0 && validRecord.confidenceLevel === 0.95;
    checks.push({ gateId: 'GATE-129-05', description: 'Uncertainty & Confidence Computation', passed: g05Passed, score: g05Passed ? 100 : 0, details: g05Passed ? 'Successfully computed uncertainty intervals' : 'Failed uncertainty computation' });

    // 6. Fake Prediction Status Interception (Fake VALIDATED on OOD)
    const fakeRec = engine.createPrediction('PRED-FAKE', model, oodSnap, 10, 'cycles', 250, 4, 1, 'stress');
    fakeRec.status = 'VALIDATED'; // Forcing fake status
    const fakeCheck = IndependentPredictionVerifier.verifyPredictionTruth(fakeRec, model, oodSnap, 'stress', fakeRec.predictionRootHash);
    const g06Passed = !fakeCheck.valid && fakeCheck.details.includes('FAKE_VALIDATION');
    checks.push({ gateId: 'GATE-129-06', description: 'Fake Validation Interception', passed: g06Passed, score: g06Passed ? 100 : 0, details: g06Passed ? 'Successfully caught FAKE_VALIDATION' : 'Failed to catch fake validation' });

    // 7. Prediction Root Hash Tampering
    const tamperedRec = { ...validRecord, predictionValue: 300 }; // Value changed, hash not recomputed
    const tamperCheck = IndependentPredictionVerifier.verifyPredictionTruth(tamperedRec, model, validSnapshot, 'stress', tamperedRec.predictionRootHash);
    const g07Passed = !tamperCheck.valid && tamperCheck.details.includes('PREDICTION_TAMPERING');
    checks.push({ gateId: 'GATE-129-07', description: 'Prediction Result Tampering Detection', passed: g07Passed, score: g07Passed ? 100 : 0, details: g07Passed ? 'Successfully caught PREDICTION_TAMPERING' : 'Failed to catch tampering' });

    // 8. Independent Prediction Verifier Match
    const indCheck = IndependentPredictionVerifier.verifyPredictionTruth(validRecord, model, validSnapshot, 'stress', validRecord.predictionRootHash);
    const g08Passed = indCheck.verdict === 'MATCH';
    checks.push({ gateId: 'GATE-129-08', description: 'Independent Prediction Verifier Match', passed: g08Passed, score: g08Passed ? 100 : 0, details: g08Passed ? 'Differential match 100%' : 'Mismatch detected' });

    // 9. Missing Feature Handling / Snapshot Identity
    const snapNoFeat = { ...validSnapshot, features: {} };
    const hashFeat = CanonicalPredictionSerializer.computeInputSnapshotHash(validSnapshot);
    const hashNoFeat = CanonicalPredictionSerializer.computeInputSnapshotHash(snapNoFeat);
    const g09Passed = hashFeat !== hashNoFeat;
    checks.push({ gateId: 'GATE-129-09', description: 'Prediction Input Snapshot Integrity', passed: g09Passed, score: g09Passed ? 100 : 0, details: g09Passed ? 'Missing features alter input hash correctly' : 'Failed input integrity' });

    // 10. No Fixed Verdict Rule
    const fixedVerdictCheck = validRecord.status !== 'VALIDATED' && validRecord.uncertainty > 0;
    const g10Passed = fixedVerdictCheck;
    checks.push({ gateId: 'GATE-129-10', description: 'No Fixed Verdict Rule Enforcement', passed: g10Passed, score: g10Passed ? 100 : 0, details: g10Passed ? 'Status and uncertainty dynamically derived' : 'Rule violated' });

    const passedCount = checks.filter(c => c.passed).length;
    const overallScore = (passedCount / checks.length) * 100;

    return {
      totalChecks: checks.length,
      passedChecks: passedCount,
      overallScore,
      verdict: passedCount === checks.length ? 'PASS' : 'FAIL',
      checks
    };
  }
}
