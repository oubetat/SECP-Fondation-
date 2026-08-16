import { HardAcceptanceGate102_4 } from './src/engine/validation/HardAcceptanceGate102_4';

async function main() {
  console.log('=== SECP-102.4 MANUFACTURING, QUALITY & RENDERING CLOSURE GATE ===\n');

  const evidence = await HardAcceptanceGate102_4.evaluate();

  console.log('--- Verification Checks ---');
  for (const c of evidence.checks) {
    console.log(`  [${c.passed ? 'PASS' : 'FAIL'}] ${c.name}: ${c.details}`);
  }

  console.log('\n--- Domain Results Summary ---');
  console.log(`  CAM Kinematics (RPM/Feed/MRR): ${evidence.camValidationResults.spindleRpm} RPM, ${evidence.camValidationResults.feedRateMmMin} mm/min, ${evidence.camValidationResults.materialRemovalRateCm3Min.toFixed(2)} cm3/min`);
  console.log(`  CAM G-Code & Points:           ${evidence.camValidationResults.gCodeLineCount} lines, ${evidence.camValidationResults.toolpathPointCount} points`);
  console.log(`  Rendering Assembly Instances:  ${evidence.renderingValidationResults.totalInstances} instances (${evidence.renderingValidationResults.vramSavingsPct.toFixed(2)}% VRAM savings)`);
  console.log(`  Scene Graph Nodes Evaluated:   ${evidence.renderingValidationResults.sceneGraphNodesEvaluated} nodes`);
  console.log(`  SPC Defect Probability:        ${(evidence.spcQualityResults.defectProbability * 100).toFixed(1)}% (${evidence.spcQualityResults.confidenceLevel} confidence)`);
  console.log(`  Gateway State & Packets:       Normalized: ${evidence.gatewayValidationResults.totalNormalized}`);

  console.log('\n--- Regression Audit ---');
  console.log(`  SECP-096 -> 100:  ${evidence.regressionResults.secp096}`);
  console.log(`  SECP-101.1:       ${evidence.regressionResults.secp101_1}`);
  console.log(`  SECP-101.5:       ${evidence.regressionResults.secp101_5}`);
  console.log(`  SECP-102.1:       ${evidence.regressionResults.secp102_1}`);
  console.log(`  SECP-102.2:       ${evidence.regressionResults.secp102_2}`);
  console.log(`  SECP-102.3:       ${evidence.regressionResults.secp102_3}`);
  console.log(`  All Regressions:  ${evidence.regressionResults.allPassed ? 'PASS' : 'FAIL'}`);

  console.log('\n------------------------------------------------');
  console.log(`[1] Zero Forbidden Tokens ....... ${evidence.forbiddenTokenScan.passed ? 'PASS' : 'FAIL'}`);
  console.log(`[2] CAM Kinematics & Toolpaths .. ${evidence.camValidationResults.passed ? 'PASS' : 'FAIL'}`);
  console.log(`[3] Assembly & Scene Graph ...... ${evidence.renderingValidationResults.passed ? 'PASS' : 'FAIL'}`);
  console.log(`[4] SPC Quality Prediction ...... ${evidence.spcQualityResults.passed ? 'PASS' : 'FAIL'}`);
  console.log(`[5] Gateway Pipeline ............ ${evidence.gatewayValidationResults.passed ? 'PASS' : 'FAIL'}`);
  console.log(`[6] Adversarial Suite (18) ...... ${evidence.adversarialResults.passed ? 'PASS' : 'FAIL'}`);
  console.log(`[7] Deterministic Replay ........ ${evidence.deterministicReplay.passed ? 'PASS' : 'FAIL'}`);
  console.log(`[8] Provenance Hash ............. ${evidence.provenanceSHA256 ? 'PASS' : 'FAIL'}`);
  console.log(`[9] Zero Regression ............. ${evidence.regressionResults.allPassed ? 'PASS' : 'FAIL'}`);
  console.log(`[10] Blocker Closure (0 rem) .... ${evidence.remainingBlockers === 0 ? 'PASS' : 'FAIL'}`);

  console.log(`\nResolved Blockers: ${evidence.resolvedBlockers}/15`);
  console.log(`Remaining Blockers: ${evidence.remainingBlockers}/15`);

  console.log(`\nFinal Provenance SHA-256: ${evidence.provenanceSHA256}`);

  console.log('\n================================================');
  console.log(`FINAL SECP-102.4 DECISION: ${evidence.finalDecision}`);
  console.log('================================================\n');

  if (evidence.finalDecision !== 'PASS') {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error executing SECP-102.4:', err);
  process.exit(1);
});
