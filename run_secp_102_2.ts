import { HardAcceptanceGate102_2 } from './src/engine/validation/HardAcceptanceGate102_2';

async function main() {
  console.log('=== SECP-102.2 FEATURE & GEOMETRY GENERATION');
  console.log('    MATHEMATICAL INTEGRITY CLOSURE GATE ===\n');

  const evidence = await HardAcceptanceGate102_2.evaluate();

  console.log('--- Verification Checks ---');
  for (const c of evidence.checks) {
    console.log(`  [${c.passed ? 'PASS' : 'FAIL'}] ${c.name}: ${c.details}`);
  }

  console.log('\n--- NURBS & Trimming Summary ---');
  console.log(`  Partition of Unity Max Residual: ${evidence.nurbsResults.partitionOfUnityMaxResidual.toExponential(4)}`);
  console.log(`  Cox-de Boor Consistency:         ${evidence.nurbsResults.coxDeBoorConsistencyResidual.toExponential(4)}`);
  console.log(`  Knot Insertion Invariance:       ${evidence.nurbsResults.knotInsertionInvarianceResidual.toExponential(4)}`);
  console.log(`  Surface Max Closure Residual:    ${evidence.surfaceTrimmingResults.maxClosureResidual}`);
  console.log(`  Trimming Fingerprint:            ${evidence.surfaceTrimmingResults.fingerprint}`);

  console.log('\n--- Regression Audit ---');
  console.log(`  SECP-096 -> 100:  ${evidence.regressionResults.secp096}`);
  console.log(`  SECP-101.1:       ${evidence.regressionResults.secp101_1}`);
  console.log(`  SECP-101.5:       ${evidence.regressionResults.secp101_5}`);
  console.log(`  SECP-102.1:       ${evidence.regressionResults.secp102_1}`);
  console.log(`  All Regressions:  ${evidence.regressionResults.allPassed ? 'PASS' : 'FAIL'}`);

  console.log('\n------------------------------------------------');
  console.log(`[1] Feature Regeneration ........ ${evidence.featureRegenerationResults.passed ? 'PASS' : 'FAIL'}`);
  console.log(`[2] NURBS Mathematical Integrity  ${evidence.nurbsResults.passed ? 'PASS' : 'FAIL'}`);
  console.log(`[3] Surface Trimming Integrity    ${evidence.surfaceTrimmingResults.passed ? 'PASS' : 'FAIL'}`);
  console.log(`[4] Adversarial Suite             ${evidence.adversarialResults.passed ? 'PASS' : 'FAIL'}`);
  console.log(`[5] Deterministic Replay          ${evidence.deterministicReplay.passed ? 'PASS' : 'FAIL'}`);
  console.log(`[6] Provenance                    ${evidence.provenanceSHA256 ? 'PASS' : 'FAIL'}`);
  console.log(`[7] Zero Regression               ${evidence.regressionResults.allPassed ? 'PASS' : 'FAIL'}`);
  console.log(`[8] Scope Integrity               ${evidence.remainingBlockers === 12 ? 'PASS' : 'FAIL'}`);

  console.log(`\nResolved Blockers: ${evidence.resolvedBlockers}`);
  console.log(`Remaining Blockers: ${evidence.remainingBlockers}`);

  console.log(`\nFinal Provenance SHA-256: ${evidence.provenanceSHA256}`);

  console.log('\n================================================');
  console.log(`FINAL SECP-102.2 DECISION: ${evidence.finalDecision}`);
  console.log('================================================\n');

  if (evidence.finalDecision !== 'PASS') {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error executing SECP-102.2:', err);
  process.exit(1);
});
