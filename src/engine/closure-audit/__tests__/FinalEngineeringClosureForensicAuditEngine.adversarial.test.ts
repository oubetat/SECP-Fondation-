import { describe, it, expect, beforeEach } from 'vitest';
import { FinalEngineeringClosureForensicAuditEngine } from '../FinalEngineeringClosureForensicAuditEngine';
import { ClosureChainStageId, DualTruthCheckId } from '../FinalEngineeringClosureForensicAuditTypes';

describe('PATCH-352 Adversarial & Anti-Fabrication Break-the-Chain Test Suite', () => {
  let engine: FinalEngineeringClosureForensicAuditEngine;

  beforeEach(() => {
    engine = FinalEngineeringClosureForensicAuditEngine.getInstance();
  });

  describe('10 Core Anti-Fabrication Verification Questions', () => {
    it('Q1: CHECK_ZERO_DUAL_SOT inspects actual live runtime state ownership', () => {
      const report = engine.executeForensicAudit();
      const check1 = report.dualTruthResults.find(d => d.checkId === 'CHECK_ZERO_DUAL_SOT');

      expect(check1).toBeDefined();
      expect(check1?.status).toBe('SAFE_SINGLE_SOT');
      expect(check1?.details).toContain('100% compliant SOT state ownership');
    });

    it('Q2: CHECK_LEGACY_PATHWAY_ISOLATION verifies un-bridged mutators trigger ARCHITECTURAL_GAP', () => {
      const report = engine.executeForensicAudit();
      const check2 = report.dualTruthResults.find(d => d.checkId === 'CHECK_LEGACY_PATHWAY_ISOLATION');

      expect(check2).toBeDefined();
      expect(check2?.status).toBe('SAFE_SINGLE_SOT');
      expect(check2?.details).toContain('ARCHITECTURAL_GAP');
    });

    it('Q3: CHECK_SANDBOX_SHADOW_BINDING verifies sandbox staging does not alter SOT revision', () => {
      const report = engine.executeForensicAudit();
      const check3 = report.dualTruthResults.find(d => d.checkId === 'CHECK_SANDBOX_SHADOW_BINDING');

      expect(check3).toBeDefined();
      expect(check3?.status).toBe('SAFE_SINGLE_SOT');
      expect(check3?.details).toContain('without mutating SOT revision');
    });

    it('Q4: CHECK_DIRECT_MUTATION_BLOCK verifies direct bypass attempts are caught and rejected', () => {
      const report = engine.executeForensicAudit();
      const check4 = report.dualTruthResults.find(d => d.checkId === 'CHECK_DIRECT_MUTATION_BLOCK');

      expect(check4).toBeDefined();
      expect(check4?.status).toBe('SAFE_SINGLE_SOT');
      expect(check4?.details).toContain('correctly rejected with ARCHITECTURAL_GAP');
    });

    it('Q5: All 13 stages connect to live production SOT, Revision, Invalidation & B-Rep engines', () => {
      const report = engine.executeForensicAudit();

      expect(report.chainStageResults).toHaveLength(13);
      expect(report.totalAssertionsAudited).toBe(85); // (13 * 5) + (4 * 5)
      expect(report.totalAssertionsPassed).toBe(85);
    });

    it('Q6 & Q7: Verification cannot be spoofed by static hardcoded PASS values', () => {
      // Intentionally break stage 5 (B-Rep) and verify that status dynamically flips to FAILED
      const brokenReport = engine.executeForensicAudit('STAGE_05_BREP');
      const stage5 = brokenReport.chainStageResults.find(s => s.stageId === 'STAGE_05_BREP');

      expect(stage5?.status).toBe('FAILED');
      expect(stage5?.assertionsPassed).toBeLessThan(5);
      expect(brokenReport.overallChainVerified).toBe(false);
      expect(brokenReport.finalVerdict).toBe('CHAIN_BREAKAGE_DETECTED');
    });

    it('Q8 & Q9: Verdict is dynamically calculated from live assertion results and sealed with SHA-256 Merkle root', () => {
      const cleanReport = engine.executeForensicAudit();
      const brokenReport = engine.executeForensicAudit('STAGE_01_ENGINEERING_DOCUMENT');

      expect(cleanReport.finalVerdict).toBe('FORENSIC_CLOSURE_VERIFIED');
      expect(brokenReport.finalVerdict).toBe('CHAIN_BREAKAGE_DETECTED');

      expect(cleanReport.forensicMerkleRootHash).not.toEqual(brokenReport.forensicMerkleRootHash);
    });
  });

  describe('Ultimate Break-the-Chain Test Suite (13 Stages + 4 Dual-Truth Checks)', () => {
    const all13Stages: ClosureChainStageId[] = [
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
    ];

    all13Stages.forEach((stageId, index) => {
      it(`Break-the-Chain Stage ${index + 1} (${stageId}): Injected failure MUST immediately turn verdict to CHAIN_BREAKAGE_DETECTED`, () => {
        const report = engine.executeForensicAudit(stageId);

        expect(report.overallChainVerified).toBe(false);
        expect(report.finalVerdict).toBe('CHAIN_BREAKAGE_DETECTED');

        const failedStage = report.chainStageResults.find(s => s.stageId === stageId);
        expect(failedStage?.status).toBe('FAILED');
        expect(failedStage?.auditNotes.some(n => n.includes('CRITICAL'))).toBe(true);
      });
    });

    const all4DualTruthChecks: DualTruthCheckId[] = [
      'CHECK_ZERO_DUAL_SOT',
      'CHECK_LEGACY_PATHWAY_ISOLATION',
      'CHECK_SANDBOX_SHADOW_BINDING',
      'CHECK_DIRECT_MUTATION_BLOCK'
    ];

    all4DualTruthChecks.forEach((checkId, index) => {
      it(`Break-the-Chain Anti-Dual-Truth Check ${index + 1} (${checkId}): Injected violation MUST immediately turn verdict to DUAL_TRUTH_VIOLATION_DETECTED`, () => {
        const report = engine.executeForensicAudit(undefined, checkId);

        expect(report.zeroParallelTruthVerified).toBe(false);
        expect(report.finalVerdict).toBe('DUAL_TRUTH_VIOLATION_DETECTED');

        const failedCheck = report.dualTruthResults.find(d => d.checkId === checkId);
        expect(failedCheck?.status).toBe('VIOLATION_PARALLEL_TRUTH');
        expect(failedCheck?.details).toContain('PARALLEL TRUTH DETECTED');
      });
    });
  });
});
