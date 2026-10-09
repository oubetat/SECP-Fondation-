import { describe, it, expect, beforeAll } from 'vitest';
import {
  ProductionConsumerEnforcementSuite,
  ProductionEnforcementSuiteResult
} from './ProductionConsumerEnforcementSuite';

describe('SECP-POST-TOPOLOGY-002: Real Production Consumer Enforcement Suite', () => {
  let suiteResult: ProductionEnforcementSuiteResult;

  beforeAll(async () => {
    suiteResult = await ProductionConsumerEnforcementSuite.runSuite();
  });

  it('should run all production consumer enforcement tests with 0 failures', () => {
    expect(suiteResult.failedCount).toBe(0);
    expect(suiteResult.passedCount).toBe(suiteResult.totalTests);
    expect(suiteResult.totalTests).toBeGreaterThanOrEqual(18);
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
