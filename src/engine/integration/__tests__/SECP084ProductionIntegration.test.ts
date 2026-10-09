import { describe, test, expect } from 'vitest';
import { HardAcceptanceGate084 } from '../../validation/HardAcceptanceGate084';
import { SECP084ProductionIntegrationTests } from '../../verification/ProductionIntegrationVerifier';

describe('SECP084 Production Integration Test Suite', () => {
  test('All production integration tests pass', async () => {
    const report = await SECP084ProductionIntegrationTests.runAllTests();
    if (!report.passed) {
      console.log('=== SECP084 FAILURES ===');
      report.details.filter(d => d.includes('Gate 084 Failed') || d.startsWith('FAIL')).forEach(d => console.log(d));
      // Also execute HardAcceptanceGate084 directly to log its invariant checks
      const gate084 = await HardAcceptanceGate084.executeGate();
      console.log('=== GATE 084 INVARIANT CHECKS ===');
      gate084.invariantChecks.forEach(c => console.log(`${c.id} [${c.passed ? 'PASS' : 'FAIL'}]: ${c.name} - ${c.details}`));
    }
    expect(report.passed).toBe(true);
  });
});
