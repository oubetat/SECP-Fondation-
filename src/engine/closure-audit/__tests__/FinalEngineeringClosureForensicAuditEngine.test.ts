import { describe, it, expect, beforeEach } from 'vitest';
import { FinalEngineeringClosureForensicAuditEngine } from '../FinalEngineeringClosureForensicAuditEngine';

describe('Final Engineering Closure Forensic Audit Engine Test Suite', () => {
  let engine: FinalEngineeringClosureForensicAuditEngine;

  beforeEach(() => {
    engine = FinalEngineeringClosureForensicAuditEngine.getInstance();
  });

  it('should execute full 13-stage forensic chain audit and verify 100% chain closure', () => {
    const report = engine.executeForensicAudit();

    expect(report.chainStageResults).toHaveLength(13);
    expect(report.overallChainVerified).toBe(true);
    expect(report.zeroParallelTruthVerified).toBe(true);
    expect(report.finalVerdict).toBe('FORENSIC_CLOSURE_VERIFIED');
    expect(report.forensicMerkleRootHash).not.toBe('');
    expect(report.totalAssertionsPassed).toBe(85); // (13 * 5) + (4 * 5)
  });

  it('should audit all 13 stages in exact sequential order', () => {
    const report = engine.executeForensicAudit();

    const stageIds = report.chainStageResults.map(s => s.stageId);
    expect(stageIds).toEqual([
      'STAGE_01_ENGINEERING_DOCUMENT',
      'STAGE_02_MUTATION',
      'STAGE_03_REVISION',
      'STAGE_04_EVALUATION',
      'STAGE_05_BREP',
      'STAGE_06_MESH',
      'STAGE_07_RENDERING',
      'STAGE_08_PICKING',
      'STAGE_09_SELECTION_LIFECYCLE',
      'STAGE_10_WORKBENCH_SWITCHING',
      'STAGE_11_INVALIDATION_REVALIDATION',
      'STAGE_12_DOWNSTREAM_ENGINEERING',
      'STAGE_13_EVIDENCE'
    ]);
  });

  it('should detect simulated chain breakage at any stage and set verdict to CHAIN_BREAKAGE_DETECTED', () => {
    const report = engine.executeForensicAudit('STAGE_05_BREP');

    expect(report.overallChainVerified).toBe(false);
    expect(report.finalVerdict).toBe('CHAIN_BREAKAGE_DETECTED');

    const stage5 = report.chainStageResults.find(s => s.stageId === 'STAGE_05_BREP');
    expect(stage5?.status).toBe('FAILED');
    expect(stage5?.assertionsPassed).toBeLessThan(5);
  });

  it('should detect simulated dual-truth violation and set verdict to DUAL_TRUTH_VIOLATION_DETECTED', () => {
    const report = engine.executeForensicAudit(undefined, 'CHECK_ZERO_DUAL_SOT');

    expect(report.zeroParallelTruthVerified).toBe(false);
    expect(report.finalVerdict).toBe('DUAL_TRUTH_VIOLATION_DETECTED');

    const dualTruthCheck = report.dualTruthResults.find(d => d.checkId === 'CHECK_ZERO_DUAL_SOT');
    expect(dualTruthCheck?.status).toBe('VIOLATION_PARALLEL_TRUTH');
  });
});
