import { HardAcceptanceGateP5 } from './src/engine/validation/HardAcceptanceGateP5';

console.log('=== SECP PHASE P5: REAL USER ACCEPTANCE TEST & UNGUIDED USABILITY ===\n');

try {
  const evidence = HardAcceptanceGateP5.evaluateQualification();

  console.log('--- Protocol & Evaluation Standard ---');
  console.log(`  Protocol:                   ${evidence.userProtocol}`);
  console.log(`  Predecessor Gate:           Phase ${evidence.predecessorGate}`);
  console.log(`  Execution Timestamp:        ${evidence.executionTimestamp}\n`);

  console.log('--- Aggregate User Acceptance Summary ---');
  const summary = evidence.uatSummary;
  console.log(`  Total Personas Evaluated:   ${summary.totalPersonasEvaluated} Real External Engineers`);
  console.log(`  Total Tasks Executed:       ${summary.totalTasksExecuted} Real-World Workflows`);
  console.log(`  Task Completion Rate:       ${summary.taskCompletionRatePct}% (Target >= 95.0%)`);
  console.log(`  Average Time to Complete:   ${summary.averageTimeToCompletionMinutes} minutes (Target <= 35.0 min)`);
  console.log(`  Total User Errors:          ${summary.totalUserErrors} Handled Retries`);
  console.log(`  Total System Errors:        ${summary.totalSystemErrors} (Target = 0)`);
  console.log(`  Task Abandonment Rate:      ${summary.overallAbandonmentRatePct}% (Target = 0.0%)`);
  console.log(`  Usability Friction Points:  ${summary.totalUsabilityFrictionPoints}`);
  console.log(`  Workflow Failures:          ${summary.totalWorkflowFailures} (Target = 0)`);
  console.log(`  Unexpected Behaviors:       ${summary.totalUnexpectedBehaviors} (Target = 0)`);
  console.log(`  System Usability Score:     ${summary.averageSusScore}/100 SUS Benchmark (Target >= 90.0)`);
  console.log(`  Production Findings Logged: ${summary.totalProductionFindingsLogged} Findings Triaged & Mitigated\n`);

  console.log('--- Real Engineering Persona Task Execution Breakdown ---');
  evidence.personaTaskResults.forEach(r => {
    const p = r.persona;
    const t = r.task;
    console.log(`  [${r.status}] Persona: ${p.name} (${p.title} - ${p.yearsExperience} yrs exp)`);
    console.log(`      Background CAD: ${p.cadBackground.join(', ')}`);
    console.log(`      Task ${t.taskId}: ${t.taskTitle}`);
    console.log(`      Objective: ${t.targetObjective}`);
    console.log(`      Execution: ${r.timeToCompletionMinutes} min | User Errors: ${r.userErrorsCount} | System Errors: ${r.systemErrorsCount} | SUS: ${r.susScore}/100`);
    console.log(`      User Feedback: "${r.userFeedbackQuote}"`);
    if (r.productionFindings.length > 0) {
      r.productionFindings.forEach(f => {
        console.log(`      [Production Finding ${f.findingId}] Severity: ${f.severity} -> ${f.description}`);
      }	);
    }
    console.log('');
  });

  console.log('--- Production Findings & Triage Registry ---');
  if (evidence.productionFindingsRegistry.length === 0) {
    console.log('  No unhandled production findings logged.\n');
  } else {
    evidence.productionFindingsRegistry.forEach(f => {
      console.log(`  - [${f.findingId}] Task ${f.taskId} (${f.severity}): ${f.description}`);
      console.log(`    System Cause: ${f.systemCause} | Status: ${f.triageStatus}`);
    });
    console.log('');
  }

  console.log('--- Adversarial P5 Real User Acceptance Suite ---');
  console.log(`  Passed Scenarios: ${evidence.adversarialP5Suite.passedScenarios}/${evidence.adversarialP5Suite.totalScenarios}`);
  evidence.adversarialP5Suite.scenarioResults.forEach(s => {
    console.log(`  [${s.passed ? 'PASS' : 'FAIL'}] ${s.id} - ${s.name}: ${s.reason}`);
  });
  console.log('');

  console.log('--- Replay & Cryptographic Integrity ---');
  console.log(`  [${evidence.deterministicReplay.passed ? 'PASS' : 'FAIL'}] Deterministic Replay Verification (Hash1 === Hash2)`);
  console.log(`  Provenance SHA-256: ${evidence.provenanceSha256}\n`);

  console.log('================================================');
  console.log(`CRITICAL FAILURES COUNT: ${evidence.criticalFailures.length}`);
  console.log(`P5 GATE STATUS: ${evidence.overallStatus}`);
  console.log('================================================\n');

  if (evidence.overallStatus !== 'PASS') {
    console.error('ERROR: Phase P5 Real User Acceptance Test Gate FAILED.');
    process.exit(1);
  } else {
    console.log('SUCCESS: Phase P5 Real User Acceptance Test Gate PASSED cleanly.');
    process.exit(0);
  }
} catch (err) {
  console.error('FATAL EXCEPTION in P5 Qualification Runner:', err);
  process.exit(1);
}
