import { HardAcceptanceGate056 } from './src/engine/validation/HardAcceptanceGate056';

async function diagnose() {
  console.log('--- PROMPT-056 DIAGNOSTIC START ---');
  try {
    const report = await HardAcceptanceGate056.executeGate();
    console.log('VERDICT:', report.verdict);
    console.log('SCORE:', report.score);
    console.log('CRITICAL FAILURES:', JSON.stringify(report.criticalFailuresDetected, null, 2));
    
    const failingMatrix = report.matrix.filter(m => m.finalVerdict === 'FAIL');
    console.log('FAILING MATRIX TOOLS:', JSON.stringify(failingMatrix.map(m => ({
      toolId: m.toolId,
      stages: m.stages,
      details: m.stageDetails
    })), null, 2));

    const failingNeg = report.negativeProofs.filter(p => !p.passed);
    console.log('FAILING NEGATIVE PROOFS:', JSON.stringify(failingNeg, null, 2));

    const failingPos = report.positiveProofs.filter(p => !p.passed);
    console.log('FAILING POSITIVE PROOFS:', JSON.stringify(failingPos, null, 2));

  } catch (e) {
    console.error('DIAGNOSTIC EXCEPTION:', e);
  }
  console.log('--- PROMPT-056 DIAGNOSTIC END ---');
}

diagnose();
