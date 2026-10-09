import { describe, test, expect } from 'vitest';
import { VerdictEvaluator } from '../VerdictEvaluator';

describe('Verdict Replay and Tampering Tests', () => {
  const originalCriteria = [{ criterionId: 'c1', mandatory: true, satisfied: true, evidenceIds: ['ev1'], reason: '' }];
  const originalEvidence = [{ evidenceId: 'ev1', source: 'sensor', observedValue: 10 }];

  test('PHASE 15 - Replay Test', () => {
    const run1 = VerdictEvaluator.evaluate('gate1', originalCriteria, originalEvidence);
    const run2 = VerdictEvaluator.evaluate('gate1', originalCriteria, originalEvidence);
    
    expect(run1.verdict).toBe(run2.verdict);
    expect(run1.decisionTrace).toEqual(run2.decisionTrace);
  });

  test('PHASE 16 - Verdict Tampering Test', () => {
    const run1 = VerdictEvaluator.evaluate('gate1', originalCriteria, originalEvidence);
    
    // Tamper with evidence after calculation
    const tamperedEvidence = [{ evidenceId: 'ev1', source: 'sensor', observedValue: 999 }];
    // Re-evaluating with tampered criteria (suppose we change satisfied to false based on new 999)
    const tamperedCriteria = [{ criterionId: 'c1', mandatory: true, satisfied: false, evidenceIds: ['ev1'], reason: 'tampered' }];
    const run2 = VerdictEvaluator.evaluate('gate1', tamperedCriteria, tamperedEvidence);
    
    expect(run1.verdict).not.toBe(run2.verdict);
    expect(run2.verdict).toBe('FAIL');
  });
});
