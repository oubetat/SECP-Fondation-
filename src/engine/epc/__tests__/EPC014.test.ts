/**
 * SECP Industrial OS — EPC-014: Proof Case Score Tests
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { ProofCaseScoreEngine } from '../score/ProofCaseScoreEngine';
import { DEFAULT_SCORE_POLICY } from '../score/ProofCaseScorePolicy';
import { ProofCaseProject } from '../ProofCaseTypes';
import { ScoreBand, ScoreDimensionId } from '../score/ProofCaseScoreTypes';

describe('EPC-014: Proof Case Score Engineering Evaluation', () => {
  let engine: ProofCaseScoreEngine;

  beforeEach(() => {
    engine = new ProofCaseScoreEngine();
  });

  const createBaseProject = (id: string): ProofCaseProject => ({
    caseId: id,
    caseType: 'PRODUCT',
    domain: 'ROBOTICS',
    revision: '1.0.0',
    status: 'ACTIVE',
    owner: 'A. Oubetat',
    requirements: [],
    models: [],
    simulations: [],
    manufacturing: [],
    tests: [],
    evidence: [],
    metadata: {}
  });

  test('TEST 01: All dimensions strong -> High Confidence', () => {
    const project = createBaseProject('STRONG-001');
    
    // Add strong requirements
    (project as any).requirements = [
      { requirementId: 'REQ-01', status: 'VERIFIED' },
      { requirementId: 'REQ-02', status: 'VERIFIED' }
    ];
    (project as any).evidence = [
      { evidenceId: 'EV-01', evidenceType: 'REQUIREMENT' },
      { evidenceId: 'EV-02', evidenceType: 'CAD' },
      { evidenceId: 'EV-03', evidenceType: 'SIMULATION' },
      { evidenceId: 'EV-04', evidenceType: 'TEST' },
      { evidenceId: 'EV-05', evidenceType: 'ASSEMBLY' },
      { evidenceId: 'EV-06', evidenceType: 'PHYSICS' },
      { evidenceId: 'EV-07', evidenceType: 'MANUFACTURING' },
      { evidenceId: 'EV-08', evidenceType: 'BASELINE' }
    ];
    (project as any).models = [
      { modelId: 'CAD-01', modelType: 'CAD', checksum: 'h1', metadata: { verified: true } },
      { modelId: 'ASM-01', modelType: 'ASSEMBLY', metadata: { type: 'ASSEMBLY', verified: true } }
    ];
    (project as any).simulations = [
      { simulationId: 'SIM-01', status: 'COMPLETED', resultHash: 'rh1' }
    ];
    (project as any).tests = [
      { testId: 'T-01', status: 'COMPLETED', result: 'PASS' }
    ];
    (project as any).manufacturing = [
      { definitionId: 'MFG-01', status: 'COMPLETED', metadata: { inspected: true } }
    ];
    (project as any).metadata.traceabilityHash = 'th1';
    (project as any).metadata.baselineVerified = true;
    (project as any).metadata.physicsModel = 'MOD-01';
    (project as any).metadata.physicsVerified = true;

    const score = engine.calculateScore(project, DEFAULT_SCORE_POLICY);
    
    expect(score.overallScore).toBeGreaterThan(70); 
    expect(score.criticalFailures.length).toBe(0);
  });

  test('TEST 02: Critical Requirement Failure -> Score Cap', () => {
    const project = createBaseProject('CRITICAL-FAIL');
    
    // Make it strong otherwise
    (project as any).requirements = [
      { requirementId: 'CRIT-01', status: 'FAILED', metadata: { priority: 'CRITICAL' } },
      { requirementId: 'R2', status: 'VERIFIED' }
    ];
    (project as any).evidence = Array.from({ length: 10 }, (_, i) => ({ evidenceId: `EV-${i}`, evidenceType: 'REQUIREMENT' }));
    
    // Even if other dimensions are perfect (which they aren't here yet, but let's assume), 
    // the critical failure should trigger the cap IF the score was going to be higher.
    // Let's force a high base score for other dimensions.
    (project as any).metadata.traceabilityHash = 'th1'; // Thread = 100
    
    const score = engine.calculateScore(project, DEFAULT_SCORE_POLICY);
    
    expect(score.criticalFailures).toContain('Critical Requirement Failed: CRIT-01');
    // Since we have a critical failure, the score should be capped or reflect the failure
    // In our engine, it caps to policy.criticalRequirementCap (50)
    expect(score.overallScore).toBeLessThanOrEqual(DEFAULT_SCORE_POLICY.criticalRequirementCap);
  });

  test('TEST 03: Feature Count vs Evidence Quality', () => {
    // Project A: Many features (simulated by many items) but no evidence
    const projectA = createBaseProject('MANY-FEATURES-NO-EVIDENCE');
    (projectA as any).requirements = Array.from({ length: 20 }, (_, i) => ({ requirementId: `R-${i}`, status: 'ACTIVE' }));
    (projectA as any).models = Array.from({ length: 10 }, (_, i) => ({ modelId: `M-${i}`, modelType: 'CAD' }));
    
    // Project B: Fewer features but strong evidence and verification
    const projectB = createBaseProject('FEW-FEATURES-STRONG-EVIDENCE');
    (projectB as any).requirements = [
      { requirementId: 'R-1', status: 'VERIFIED' }
    ];
    (projectB as any).evidence = [
      { evidenceId: 'EV-1', evidenceType: 'REQUIREMENT' },
      { evidenceId: 'EV-2', evidenceType: 'CAD' }
    ];
    (projectB as any).models = [
      { modelId: 'M-1', modelType: 'CAD', checksum: 'h1', metadata: { verified: true } }
    ];

    const scoreA = engine.calculateScore(projectA, DEFAULT_SCORE_POLICY);
    const scoreB = engine.calculateScore(projectB, DEFAULT_SCORE_POLICY);

    // Score B should be higher because it has evidence and verification, despite fewer "features"
    expect(scoreB.overallScore).toBeGreaterThan(scoreA.overallScore);
  });

  test('TEST 04: Missing Digital Thread -> Lower Score', () => {
    const project = createBaseProject('NO-THREAD');
    (project as any).requirements = [{ requirementId: 'R1', status: 'VERIFIED' }];
    (project as any).evidence = [{ evidenceId: 'E1', evidenceType: 'REQUIREMENT' }];
    
    const scoreWithNoThread = engine.calculateScore(project, DEFAULT_SCORE_POLICY);
    
    expect(scoreWithNoThread.dimensionScores.find(d => d.dimensionId === ScoreDimensionId.DIGITAL_THREAD)?.score).toBe(0);
  });

  test('TEST 05: Score Invariance (UI/File count changes)', () => {
    const project1 = createBaseProject('INV-1');
    (project1 as any).requirements = [{ requirementId: 'R1', status: 'VERIFIED' }];
    
    const score1 = engine.calculateScore(project1, DEFAULT_SCORE_POLICY);
    
    // Add "Vanity" data that doesn't contribute to engineering truth
    const project2 = { ...project1 };
    (project2 as any).metadata.fileCount = 1000;
    (project2 as any).metadata.uiComponents = 50;
    
    const score2 = engine.calculateScore(project2, DEFAULT_SCORE_POLICY);
    
    expect(score1.overallScore).toBe(score2.overallScore);
  });

  test('TEST 06: Sensitivity to Verification Evidence', () => {
    const project = createBaseProject('SENS-1');
    (project as any).tests = [{ testId: 'T1', status: 'COMPLETED', result: 'PASS' }];
    
    const scoreBefore = engine.calculateScore(project, DEFAULT_SCORE_POLICY);
    
    // Add verification evidence
    (project as any).evidence = [{ evidenceId: 'EV-TEST-1', evidenceType: 'TEST' }];
    
    const scoreAfter = engine.calculateScore(project, DEFAULT_SCORE_POLICY);
    
    expect(scoreAfter.overallScore).toBeGreaterThan(scoreBefore.overallScore);
  });
});
