import { describe, it, expect, beforeAll } from 'vitest';
import {
  SimulationConsumerEnforcementSuite,
  SimulationEnforcementSuiteResult
} from './SimulationConsumerEnforcementSuite';

describe('SECP Industrial OS — Simulation Truth Consumer Enforcement Suite', () => {
  let suiteResult: SimulationEnforcementSuiteResult;

  beforeAll(async () => {
    suiteResult = await SimulationConsumerEnforcementSuite.runSuite();
  });

  it('should run all simulation consumer enforcement tests with 0 failures', () => {
    expect(suiteResult.failedCount).toBe(0);
    expect(suiteResult.passedCount).toBe(suiteResult.totalTests);
    expect(suiteResult.totalTests).toBe(15); // P1-P5 + S1-S10
  });

  it('should verify all individual test criteria pass', () => {
    for (const testCase of suiteResult.details) {
      if (!testCase.passed) {
        console.error(`FAILED TEST: ${testCase.testId} - ${testCase.description}`, testCase.details);
      }
      expect(testCase.passed, `Test ${testCase.testId}: ${testCase.description}`).toBe(true);
    }
  });
});
