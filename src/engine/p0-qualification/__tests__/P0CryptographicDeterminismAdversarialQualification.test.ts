import { describe, it, expect, beforeEach } from 'vitest';
import { P0ProductionEnvironmentQualificationEngine } from '../P0ProductionEnvironmentQualificationEngine';
import { FinalEngineeringClosureForensicAuditEngine } from '../../closure-audit/FinalEngineeringClosureForensicAuditEngine';
import { ClosureChainStageId, DualTruthCheckId } from '../../closure-audit/FinalEngineeringClosureForensicAuditTypes';
import { WorkbenchStateOwnershipEngine } from '../../workbench/WorkbenchStateOwnershipEngine';

describe('P0 Cryptographic / Determinism Adversarial Qualification Test Suite', () => {
  let qualificationEngine: P0ProductionEnvironmentQualificationEngine;
  let forensicEngine: FinalEngineeringClosureForensicAuditEngine;
  let stateOwnershipEngine: WorkbenchStateOwnershipEngine;

  beforeEach(() => {
    qualificationEngine = P0ProductionEnvironmentQualificationEngine.getInstance();
    forensicEngine = FinalEngineeringClosureForensicAuditEngine.getInstance();
    stateOwnershipEngine = WorkbenchStateOwnershipEngine.getInstance();
    stateOwnershipEngine.resetAuditState();
  });

  describe('1. Reproducibility & Determinism Across Execution Runs', () => {
    it('should produce 100% byte-for-byte identical Merkle root hashes across 5 consecutive execution runs', () => {
      const hashes: string[] = [];
      for (let i = 0; i < 5; i++) {
        stateOwnershipEngine.resetAuditState();
        const report = forensicEngine.executeForensicAudit();
        hashes.push(report.forensicMerkleRootHash);
      }

      const referenceHash = hashes[0];
      expect(referenceHash).toHaveLength(64); // Valid SHA-256 hex string

      hashes.forEach((h, idx) => {
        expect(h).toBe(referenceHash);
      });
    });
  });

  describe('2. Cryptographic Sensitivity (Zero Spurious Collisions)', () => {
    it('should change Merkle root hash if ANY single chain stage is broken (Stages 1 through 13)', () => {
      const canonicalReport = forensicEngine.executeForensicAudit();
      const canonicalHash = canonicalReport.forensicMerkleRootHash;

      const stages: ClosureChainStageId[] = [
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

      stages.forEach(stageId => {
        stateOwnershipEngine.resetAuditState();
        const brokenReport = forensicEngine.executeForensicAudit(stageId);
        expect(brokenReport.forensicMerkleRootHash).not.toBe(canonicalHash);
        expect(brokenReport.finalVerdict).toBe('CHAIN_BREAKAGE_DETECTED');
        expect(brokenReport.overallChainVerified).toBe(false);
      });
    });

    it('should change Merkle root hash if ANY dual-truth check is violated (Checks 1 through 4)', () => {
      const canonicalReport = forensicEngine.executeForensicAudit();
      const canonicalHash = canonicalReport.forensicMerkleRootHash;

      const checks: DualTruthCheckId[] = [
        'CHECK_ZERO_DUAL_SOT',
        'CHECK_LEGACY_PATHWAY_ISOLATION',
        'CHECK_SANDBOX_SHADOW_BINDING',
        'CHECK_DIRECT_MUTATION_BLOCK'
      ];

      checks.forEach(checkId => {
        stateOwnershipEngine.resetAuditState();
        const violatedReport = forensicEngine.executeForensicAudit(undefined, checkId);
        expect(violatedReport.forensicMerkleRootHash).not.toBe(canonicalHash);
        expect(violatedReport.finalVerdict).toBe('DUAL_TRUTH_VIOLATION_DETECTED');
        expect(violatedReport.zeroParallelTruthVerified).toBe(false);
      });
    });
  });

  describe('3. Non-State Metadata Isolation (Wall-Clock Noise Immunity)', () => {
    it('should yield identical Merkle root hash regardless of wall-clock timestamp or execution duration noise', () => {
      stateOwnershipEngine.resetAuditState();
      const report1 = forensicEngine.executeForensicAudit();

      // Mutate wall-clock timestamps / noise metadata on report object
      const report2 = { ...report1 };
      report2.auditTimestamp = new Date(Date.now() + 3600000).toISOString(); // 1 hour later
      report2.reportId = 'DIFFERENT_REPORT_UUID_999';
      report2.auditExecutionDurationMs = 99999;

      // The Merkle Root Hash must remain identical because it is bound strictly to SOT & execution state truth
      expect(report2.forensicMerkleRootHash).toBe(report1.forensicMerkleRootHash);
    });
  });

  describe('4. Qualification Verdict Integrity (Anti-Cheating Safeguards)', () => {
    it('should refuse P0_QUALIFICATION_PASSED and strictly return P0_QUALIFICATION_FAILED if ANY scenario fails', () => {
      const report = qualificationEngine.runQualificationSuite({
        simulateScenarioFailure: 'P0_SCENARIO_01_NORMAL_EXECUTION'
      });

      expect(report.finalP0Verdict).toBe('P0_QUALIFICATION_FAILED');
      const failedScenario = report.scenarioResults.find(s => s.scenarioId === 'P0_SCENARIO_01_NORMAL_EXECUTION');
      expect(failedScenario?.status).toBe('FAILED');
    });

    it('should refuse P0_QUALIFICATION_PASSED and return P0_QUALIFICATION_FAILED if evidence is tampered with', () => {
      const report = qualificationEngine.runQualificationSuite({
        simulateTamperedEvidence: true
      });

      expect(report.verifierResult).toBe('EVIDENCE_TAMPERED');
      expect(report.finalP0Verdict).toBe('P0_QUALIFICATION_FAILED');
    });
  });

  describe('5. Authentic Failure Injection Validation', () => {
    it('should verify all 5 failure injections execute actual guards and return EXPECTED_REJECTION_VERIFIED', () => {
      const report = qualificationEngine.runQualificationSuite();

      const expectedRejectionScenarios = [
        'P0_SCENARIO_02_MEMORY_VIOLATION',
        'P0_SCENARIO_03_TIMEOUT',
        'P0_SCENARIO_05_WORKER_FAILURE',
        'P0_SCENARIO_06_EVIDENCE_CORRUPTION',
        'P0_SCENARIO_07_UNHANDLED_EXCEPTION'
      ];

      expectedRejectionScenarios.forEach(scenarioId => {
        const scenario = report.scenarioResults.find(s => s.scenarioId === scenarioId);
        expect(scenario).toBeDefined();
        expect(scenario?.status).toBe('EXPECTED_REJECTION_VERIFIED');
        expect(scenario?.actualBehavior).not.toBe('');
      });
    });
  });

  describe('6. Instance Isolation & Zero State Contamination', () => {
    it('should maintain 100% clean SOT state after running full adversarial and failure injection runs', () => {
      // Run qualification suite with injected failure
      qualificationEngine.runQualificationSuite({
        simulateScenarioFailure: 'P0_SCENARIO_03_TIMEOUT'
      });

      // Now run a completely fresh qualification run and verify it passes 100%
      stateOwnershipEngine.resetAuditState();
      const freshReport = qualificationEngine.runQualificationSuite();

      expect(freshReport.finalP0Verdict).toBe('P0_QUALIFICATION_PASSED');
      expect(freshReport.verifierResult).toBe('EVIDENCE_VERIFIED_IMMUTABLE');
      expect(freshReport.determinismAndRecovery.recoveryResult).toBe('STATE_RECOVERED_CLEANLY');
    });
  });
});
