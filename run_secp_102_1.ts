import { Gate102_1Evaluator } from './src/engine/validation/HardAcceptanceGate102_1';

async function main() {
  console.log('=== EXECUTING SECP-102.1 CAD EXCHANGE & INTEROPERABILITY CLOSURE GATE ===\n');

  const evidence = await Gate102_1Evaluator.evaluate();

  console.log('--- Verification Checks ---');
  for (const c of evidence.checks) {
    console.log(`  [${c.passed ? 'PASS' : 'FAIL'}] ${c.name}: ${c.details}`);
  }

  console.log('\n--- CAD Fixtures Fidelity Summary ---');
  for (const r of evidence.cadValidationResults) {
    console.log(`  [${r.passed ? 'PASS' : 'FAIL'}] Fixture ${r.fixtureId} (${r.format}): Fidelity ${r.fidelityScore}%, VolErr=${r.volumeError}, CogDrift=${r.cogDrift}`);
  }

  console.log('\n--- Regression Audit ---');
  console.log(`  SECP-096 -> 100:  ${evidence.regressionAudit.secp096}`);
  console.log(`  SECP-101.1:       ${evidence.regressionAudit.secp101_1}`);
  console.log(`  SECP-101.5:       ${evidence.regressionAudit.secp101_5}`);
  console.log(`  All Regressions:  ${evidence.regressionAudit.allPassed ? 'PASS' : 'FAIL'}`);

  console.log('\n======================================================');
  console.log(`Gate ID:                         ${evidence.gateId}`);
  console.log(`Final Decision:                  ${evidence.finalDecision}`);
  console.log(`Domain:                          ${evidence.scope.domain}`);
  console.log(`Blockers Resolved:               ${evidence.scope.blockersResolved} (ForensicCadExchangeValidator, STEPAP242Translator)`);
  console.log(`Remaining Blockers:              ${evidence.scope.remainingOutOfScopeBlockers} / 17`);
  console.log(`Provenance SHA-256:              ${evidence.provenanceSHA256}`);
  console.log('======================================================\n');

  if (evidence.finalDecision !== 'PASS') {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error executing SECP-102.1:', err);
  process.exit(1);
});
