import { describe, it, expect } from 'vitest';
import { HardAcceptanceGate195 } from '../HardAcceptanceGate195';

describe('PATCH-195 Hard Acceptance Gate', () => {
  it('should pass all 30 strict verification checks with 30/30 score', async () => {
    const result = await HardAcceptanceGate195.evaluate();
    console.log(`Gate 195 execution score: ${result.totalScore}/${result.maxScore}`);

    // Print any failing checks if any exist
    const failedChecks = result.checks.filter(c => !c.passed);
    if (failedChecks.length > 0) {
      console.error('Failed Gate 195 Checks:', JSON.stringify(failedChecks, null, 2));
    }

    expect(result.passed).toBe(true);
    expect(result.totalScore).toBe(30);
    expect(result.maxScore).toBe(30);
    expect(failedChecks.length).toBe(0);
  }, 60000);
});
