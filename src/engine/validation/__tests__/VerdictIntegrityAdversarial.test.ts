import { describe, test, expect } from 'vitest';
import { VerdictEvaluator } from '../VerdictEvaluator';
import { VerdictEvidence, VerdictCriterion } from '../VerdictContract';

describe('Verdict Integrity Adversarial Tests', () => {
  const baseEvidence: VerdictEvidence = { evidenceId: 'ev1', source: 'calc', observedValue: 5, expectedValue: 5 };
  
  test('TEST 01 - Valid Input -> PASS', () => {
    const criteria: VerdictCriterion[] = [{ criterionId: 'c1', mandatory: true, satisfied: true, evidenceIds: ['ev1'], reason: '' }];
    const result = VerdictEvaluator.evaluate('gate1', criteria, [baseEvidence]);
    expect(result.verdict).toBe('PASS');
  });

  test('TEST 02 - Metric exceeds threshold -> FAIL', () => {
    const criteria: VerdictCriterion[] = [{ criterionId: 'c1', mandatory: true, satisfied: false, evidenceIds: ['ev1'], reason: 'exceeds threshold' }];
    const result = VerdictEvaluator.evaluate('gate1', criteria, [baseEvidence]);
    expect(result.verdict).toBe('FAIL');
    expect(result.failures).toContain('c1');
  });

  test('TEST 03 - Missing Required Evidence -> UNPROVEN', () => {
    const criteria: VerdictCriterion[] = [{ criterionId: 'c1', mandatory: true, satisfied: true, evidenceIds: ['ev1'], reason: '' }];
    // Provide empty evidence list
    const result = VerdictEvaluator.evaluate('gate1', criteria, []);
    expect(result.verdict).toBe('UNPROVEN');
    expect(result.unresolved).toContain('c1');
  });

  test('TEST 04 - Conflicting Evidence / Cannot Establish Truth -> INCONCLUSIVE', () => {
    // satisfied = null represents a state where evidence exists but conflicting or unclear
    const criteria: VerdictCriterion[] = [{ criterionId: 'c1', mandatory: true, satisfied: null, evidenceIds: ['ev1'], reason: 'conflict' }];
    const result = VerdictEvaluator.evaluate('gate1', criteria, [baseEvidence]);
    expect(result.verdict).toBe('INCONCLUSIVE');
  });

  test('TEST 05/06 - NaN or Infinity observed value -> FAIL (Handled at Criterion logic level)', () => {
    const obs = NaN;
    const satisfied = !Number.isNaN(obs) && obs < 10;
    const criteria: VerdictCriterion[] = [{ criterionId: 'c1', mandatory: true, satisfied, evidenceIds: ['ev1'], reason: 'NaN detected' }];
    const result = VerdictEvaluator.evaluate('gate1', criteria, [baseEvidence]);
    expect(result.verdict).toBe('FAIL');
  });

  test('TEST 07 - Constant output attack -> FAIL', () => {
    const spoofedEvaluator = () => 'PASS'; // Adversarial attempt
    expect(spoofedEvaluator()).toBe('PASS'); // But Evaluator itself will not allow this if given bad criteria
    const criteria: VerdictCriterion[] = [{ criterionId: 'c1', mandatory: true, satisfied: false, evidenceIds: ['ev1'], reason: '' }];
    const realResult = VerdictEvaluator.evaluate('gate1', criteria, [baseEvidence]);
    expect(realResult.verdict).toBe('FAIL');
  });

  test('TEST 08 - Change expectedValue without rationale -> UNPROVEN/FAIL', () => {
    // If expected changes but criterion fails
    const criteria: VerdictCriterion[] = [{ criterionId: 'c1', mandatory: true, satisfied: false, evidenceIds: ['ev1'], reason: 'mismatch' }];
    const result = VerdictEvaluator.evaluate('gate1', criteria, [{...baseEvidence, expectedValue: 10}]);
    expect(result.verdict).toBe('FAIL');
  });

  test('TEST 09 - forcePass attempt -> Evaluator ignores external forces', () => {
    const forcePass = true; 
    const criteria: VerdictCriterion[] = [{ criterionId: 'c1', mandatory: true, satisfied: false, evidenceIds: ['ev1'], reason: 'bad' }];
    // The evaluator takes criteria, not force variables
    const result = VerdictEvaluator.evaluate('gate1', criteria, [baseEvidence]);
    expect(result.verdict).toBe('FAIL');
    expect(result.verdict).not.toBe(forcePass ? 'PASS' : 'FAIL');
  });
  
  test('TEST 12 - Composite Verdicts', () => {
    const criteria: VerdictCriterion[] = [
      { criterionId: 'Numerical', mandatory: true, satisfied: true, evidenceIds: ['ev1'], reason: '' },
      { criterionId: 'Physical', mandatory: true, satisfied: true, evidenceIds: ['ev2'], reason: '' },
      { criterionId: 'Integrity', mandatory: true, satisfied: false, evidenceIds: ['ev3'], reason: 'hash mismatch' }
    ];
    const ev = [
      { evidenceId: 'ev1', source: 'a' },
      { evidenceId: 'ev2', source: 'b' },
      { evidenceId: 'ev3', source: 'c' }
    ];
    const result = VerdictEvaluator.evaluate('Composite', criteria, ev);
    expect(result.verdict).toBe('FAIL'); // Integrity failed
  });
});
