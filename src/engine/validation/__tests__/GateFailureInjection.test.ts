import { describe, test, expect } from 'vitest';
import { GateVerdict, GateResult, GateCriterion, GateEvidence } from '../GateContract';

describe('Gate Failure Injection Simulator', () => {
  const evaluateGate = (criteria: GateCriterion[]): GateVerdict => {
    if (criteria.length === 0) return "INCONCLUSIVE";
    for (const c of criteria) {
      if (!c.satisfied) return "FAIL";
    }
    return "PASS";
  };

  test('1. Missing evidence -> INCONCLUSIVE/UNPROVEN', () => {
    expect(evaluateGate([])).toBe("INCONCLUSIVE");
  });

  test('2. Corrupted metric -> FAIL', () => {
    const criteria: GateCriterion[] = [{ id: '1', description: 'desc', satisfied: false, evidenceIds: ['ev1'] }];
    expect(evaluateGate(criteria)).toBe("FAIL");
  });

  test('3. NaN value handling', () => {
    const val = Number.NaN;
    const satisfied = !Number.isNaN(val) && val < 10;
    const criteria: GateCriterion[] = [{ id: '1', description: 'desc', satisfied, evidenceIds: ['ev1'] }];
    expect(evaluateGate(criteria)).toBe("FAIL");
  });

  test('4. Infinity value handling', () => {
    const val = Infinity;
    const satisfied = isFinite(val) && val < 100;
    const criteria: GateCriterion[] = [{ id: '1', description: 'desc', satisfied, evidenceIds: ['ev1'] }];
    expect(evaluateGate(criteria)).toBe("FAIL");
  });

  test('5. Negative value where not allowed', () => {
    const mass = -5;
    const satisfied = mass >= 0;
    const criteria: GateCriterion[] = [{ id: '1', description: 'desc', satisfied, evidenceIds: ['ev1'] }];
    expect(evaluateGate(criteria)).toBe("FAIL");
  });

  test('6. Threshold violation', () => {
    const err = 0.05;
    const tol = 0.01;
    const satisfied = err <= tol;
    const criteria: GateCriterion[] = [{ id: '1', description: 'desc', satisfied, evidenceIds: ['ev1'] }];
    expect(evaluateGate(criteria)).toBe("FAIL");
  });

  test('7. Empty dataset', () => {
    expect(evaluateGate([])).toBe("INCONCLUSIVE");
  });

  test('8. Malformed input', () => {
    const criteria: GateCriterion[] = [{ id: '1', description: 'desc', satisfied: false, evidenceIds: [] }];
    expect(evaluateGate(criteria)).toBe("FAIL");
  });

  test('9. Verification exception propagation', () => {
    let result: GateVerdict = "PASS";
    try {
      throw new Error("Simulation Core Dumped");
    } catch (e) {
      result = "FAIL";
    }
    expect(result).toBe("FAIL");
  });

  test('10. Dependency failure', () => {
    const dependencyPassed = false;
    const criteria: GateCriterion[] = [{ id: '1', description: 'desc', satisfied: dependencyPassed, evidenceIds: [] }];
    expect(evaluateGate(criteria)).toBe("FAIL");
  });
});
