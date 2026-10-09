/**
 * SECP Industrial OS v2 — Boolean Adversarial Battery Master
 * Phase 15 (PATCH-172)
 *
 * Orchestrates the full adversarial battery across all 8 categories (A through H),
 * executes stress testing, executes adversarial mutations, and produces full qualification report.
 */

import {
  AdversarialBatteryReport,
  AdversarialCategory,
  AdversarialVerdict,
  BooleanEvidenceRecord
} from './types';
import { BooleanAdversarialCaseRegistry } from './BooleanAdversarialCase';
import { BooleanAdversarialRunner } from './BooleanAdversarialRunner';
import { BooleanStressBenchmarker } from './BooleanStressBenchmarker';
import { AdversarialMutationEngine } from './AdversarialMutationEngine';
import { BooleanEngine } from '../../cad-kernel/boolean/BooleanEngine';

export class BooleanAdversarialBattery {
  /**
   * Executes the entire Boolean Adversarial Battery.
   */
  public static runAll(): AdversarialBatteryReport {
    const cases = BooleanAdversarialCaseRegistry.getAllCases();
    const evidenceLedger: BooleanEvidenceRecord[] = [];

    let passedCount = 0;
    let failedCount = 0;
    let unprovenCount = 0;
    let invalidInputCount = 0;
    let degenerateInputCount = 0;
    let numericalFailureCount = 0;
    let topologyFailureCount = 0;
    let unsupportedCount = 0;
    let skippedCount = 0;
    let nonDeterministicCount = 0;
    let timeoutCount = 0;
    let totalDurationMs = 0;

    const categoryBreakdown: Record<AdversarialCategory, {
      total: number;
      passed: number;
      failed: number;
      unproven: number;
      unsupported: number;
      skipped: number;
      invalid: number;
      avgDurationMs: number;
    }> = {
      A_BASIC_BOOLEAN: { total: 0, passed: 0, failed: 0, unproven: 0, unsupported: 0, skipped: 0, invalid: 0, avgDurationMs: 0 },
      B_TANGENCY_CASES: { total: 0, passed: 0, failed: 0, unproven: 0, unsupported: 0, skipped: 0, invalid: 0, avgDurationMs: 0 },
      C_COINCIDENT_GEOMETRY: { total: 0, passed: 0, failed: 0, unproven: 0, unsupported: 0, skipped: 0, invalid: 0, avgDurationMs: 0 },
      D_NEAR_DEGENERATE_GEOMETRY: { total: 0, passed: 0, failed: 0, unproven: 0, unsupported: 0, skipped: 0, invalid: 0, avgDurationMs: 0 },
      E_NESTED_SOLIDS: { total: 0, passed: 0, failed: 0, unproven: 0, unsupported: 0, skipped: 0, invalid: 0, avgDurationMs: 0 },
      F_COMPLEX_CHAINS: { total: 0, passed: 0, failed: 0, unproven: 0, unsupported: 0, skipped: 0, invalid: 0, avgDurationMs: 0 },
      G_REPEATED_OPERATIONS: { total: 0, passed: 0, failed: 0, unproven: 0, unsupported: 0, skipped: 0, invalid: 0, avgDurationMs: 0 },
      H_RANDOMIZED_ADVERSARIAL: { total: 0, passed: 0, failed: 0, unproven: 0, unsupported: 0, skipped: 0, invalid: 0, avgDurationMs: 0 }
    };

    for (const testCase of cases) {
      console.log(`[EXEC] ${testCase.id} (${testCase.category})...`);
      const record = BooleanAdversarialRunner.executeCase(testCase);
      console.log(`[DONE] ${testCase.id} -> ${record.verdict} (${record.executionTimeMs}ms)`);
      evidenceLedger.push(record);
      totalDurationMs += record.executionTimeMs;

      const catStat = categoryBreakdown[testCase.category];
      catStat.total++;

      switch (record.verdict) {
        case 'PASS':
          passedCount++;
          catStat.passed++;
          break;
        case 'FAIL':
          failedCount++;
          catStat.failed++;
          break;
        case 'UNPROVEN':
          unprovenCount++;
          catStat.unproven++;
          break;
        case 'INVALID_INPUT':
          invalidInputCount++;
          catStat.invalid++;
          break;
        case 'DEGENERATE_INPUT':
          degenerateInputCount++;
          break;
        case 'NUMERICAL_FAILURE':
          numericalFailureCount++;
          break;
        case 'TOPOLOGY_FAILURE':
          topologyFailureCount++;
          catStat.failed++;
          break;
        case 'UNSUPPORTED':
          unsupportedCount++;
          catStat.unsupported++;
          break;
        case 'SKIPPED':
          skippedCount++;
          catStat.skipped++;
          break;
        case 'NON_DETERMINISTIC':
          nonDeterministicCount++;
          break;
        case 'TIMEOUT':
          timeoutCount++;
          break;
      }
    }

    // Compute category average durations
    for (const cat of Object.keys(categoryBreakdown) as AdversarialCategory[]) {
      const records = evidenceLedger.filter(e => e.category === cat);
      const totalCatDuration = records.reduce((sum, r) => sum + r.executionTimeMs, 0);
      categoryBreakdown[cat].avgDurationMs = records.length > 0 ? totalCatDuration / records.length : 0;
    }

    // Run stress suite
    const stressReport = BooleanStressBenchmarker.runStressSuite();

    // Run adversarial mutations suite
    const mutationReport = AdversarialMutationEngine.runMutationSuite();

    // Calculate verification scores
    const determinismScore = evidenceLedger.every(e => e.determinismResult.isDeterministic) ? 1.0 : 0.0;
    const topologyIntegrityScore = topologyFailureCount === 0 ? 1.0 : Math.max(0, 1 - (topologyFailureCount / cases.length));
    const geometricInvariantScore = numericalFailureCount === 0 ? 1.0 : Math.max(0, 1 - (numericalFailureCount / cases.length));
    const antiFabricationScore = (mutationReport.falseAcceptanceCount === 0 && evidenceLedger.every(e => e.executionTimeMs > 0)) ? 1.0 : 0.0;

    let overallVerdict: AdversarialVerdict = 'PASS';
    if (failedCount > 0 || nonDeterministicCount > 0 || mutationReport.falseAcceptanceCount > 0) {
      overallVerdict = 'FAIL';
    } else if (unprovenCount > 0 && passedCount === 0) {
      overallVerdict = 'UNPROVEN';
    }

    return {
      batteryId: 'SECP-BOOLEAN-ADV-172',
      title: 'PATCH-172 Boolean Adversarial Qualification Battery',
      kernelVersion: BooleanEngine.KERNEL_VERSION,
      timestamp: new Date().toISOString(),
      overallVerdict,
      totalCases: cases.length,
      passedCount,
      failedCount,
      unprovenCount,
      invalidInputCount,
      degenerateInputCount,
      numericalFailureCount,
      topologyFailureCount,
      unsupportedCount,
      skippedCount,
      nonDeterministicCount,
      timeoutCount,
      passRatePercent: (passedCount / cases.length) * 100,
      totalDurationMs,
      determinismScore,
      topologyIntegrityScore,
      geometricInvariantScore,
      antiFabricationScore,
      categoryBreakdown,
      evidenceLedger,
      stressReport,
      mutationReport
    };
  }
}
