
import { ForensicCadExchangeValidator } from '../cad/ForensicCadExchangeValidator';
import { AP242TestFixtures } from './AP242TestFixtures';
import { STEPAP242Translator } from './STEPAP242Translator';
import { AP242SemanticModel } from './AP242Types';
import { InteropFidelityReport } from './InteropFidelityTypes';

export class InteropAdversarialSuite {
  
  public async runSuite(): Promise<any> {
    console.log('--- SECP-097 Adversarial Interop Suite Execution ---\n');
    
    const results = {
      roundTripPasses: [] as string[],
      rejectionProofs: [] as string[],
      fidelityAnomalies: [] as any[],
      overall: 'PASS'
    };

    // 1. Valid Round-Trip Coverage (Fixtures A, B, C, D, E, G)
    const fixtures = ['A', 'B', 'C', 'D', 'E', 'G'];
    for (const f of fixtures) {
      const model = (AP242TestFixtures as any)[`getFixture${f}`]();
      const report = await ForensicCadExchangeValidator.verifyRoundTrip(model, 'STEP');
      if (report.isValid && report.overallFidelityScore >= 95) {
        results.roundTripPasses.push(f);
        console.log(`[PASS] Fixture ${f} Round-Trip Fidelity: ${report.overallFidelityScore}%`);
      } else {
        console.error(`[FAIL] Fixture ${f} failed fidelity gate. Score: ${report.overallFidelityScore}`);
        results.overall = 'FAIL';
      }
    }

    // 2. Negative Test: Corrupted Part 21 String (Fixture F)
    try {
      const corruptStep = AP242TestFixtures.getFixtureF();
      STEPAP242Translator.importFromStepPart21(corruptStep);
      console.error('[FAIL] Fixture F (Corrupt) was not rejected by parser.');
      results.overall = 'FAIL';
    } catch (e) {
      results.rejectionProofs.push('F');
      console.log('[PASS] Fixture F (Corrupt) successfully rejected by parser.');
    }

    // 3. Adversarial PMI Mutation Rejection
    const modelA = AP242TestFixtures.getFixtureA();
    const stepA = STEPAP242Translator.exportToStepPart21(modelA);
    // Manually corrupt the reconstructed model by shifting a dimension value
    const reconstructed = STEPAP242Translator.importFromStepPart21(stepA);
    if (reconstructed.dimensions[0]) {
      reconstructed.dimensions[0].nominalValue += 5.0; // Significant drift
    }
    
    // We need a way to compare the mutated reconstructed with the original
    const comparisonReport = await (ForensicCadExchangeValidator as any).compareModels(modelA, reconstructed);
    if (!comparisonReport.isValid && comparisonReport.violations.some((v: any) => v.type === 'PMI_VALUE_DRIFT')) {
      results.rejectionProofs.push('PMI_MUTATION');
      console.log('[PASS] Adversarial PMI Mutation detected and rejected.');
    } else {
      console.error('[FAIL] Adversarial PMI Mutation went undetected.');
      results.overall = 'FAIL';
    }

    return results;
  }
}
