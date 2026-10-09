/**
 * PHASE 28 — ENGINEERING AI
 * PATCH-314 — Engineering Copilot
 * Hard Acceptance Gate 314 — Test Battery & Verification
 * 
 * Tests all mandatory acceptance criteria, no-hallucination guards,
 * Evidence Bus grounding rules, and gate assertions.
 */

import { EngineeringCopilotService } from './EngineeringCopilotService';
import { EvidenceBus314 } from './EvidenceBus314';

export interface GateTestResult314 {
  assertionId: number;
  description: string;
  passed: boolean;
  details: string;
}

export class HardAcceptanceGate314 {
  private copilot: EngineeringCopilotService;
  private evidenceBus: EvidenceBus314;

  constructor() {
    this.copilot = EngineeringCopilotService.getInstance();
    this.evidenceBus = EvidenceBus314.getInstance();
  }

  public runAllAssertions(): {
    passed: boolean;
    totalAssertions: number;
    passedCount: number;
    failedCount: number;
    results: GateTestResult314[];
  } {
    const results: GateTestResult314[] = [];

    const test = (id: number, desc: string, condition: boolean, details: string) => {
      results.push({
        assertionId: id,
        description: desc,
        passed: condition,
        details
      });
    };

    // Reset store before tests
    this.evidenceBus.clearStore();
    this.evidenceBus.setAvailable(true);

    // 1. Session Creation with Context
    let session = this.copilot.createSession('ENG-USER-01', {
      projectId: 'PROJ-TURBINE-2026',
      projectName: 'Main Turbine Housing',
      currentRevisionId: 'REV-B-BASELINE',
      userRole: 'ENGINEER'
    });
    test(1, 'Session Initialization & Context Binding', session !== null && session.sessionId.startsWith('COPILOT-SESS-'), `Session created with ID: ${session.sessionId}`);

    // 2. Rule 7: Context Required Exception Test
    let contextErrCaught = false;
    try {
      this.copilot.createSession('ENG-USER-01', {});
    } catch (err: any) {
      if (err.message.includes('CONTEXT_REQUIRED')) contextErrCaught = true;
    }
    test(2, 'Context Required Guard (Rule 7)', contextErrCaught, 'Exception thrown when mandatory project context is missing.');

    // 3. Intent Understanding - Simulation Request
    const simIntent = this.copilot.parseIntent('Test bracket under 5 kN load and measure stress');
    test(3, 'Structured Intent Classification (SIMULATION_REQUEST)', simIntent.intentType === 'SIMULATION_REQUEST', `Intent classified as ${simIntent.intentType}`);

    // 4. Intent Understanding - Design Review
    const revIntent = this.copilot.parseIntent('Review this design before manufacturing');
    test(4, 'Structured Intent Classification (DESIGN_REVIEW)', revIntent.intentType === 'DESIGN_REVIEW', `Intent classified as ${revIntent.intentType}`);

    // 5. Ambiguous Intent Handling (Rule 11)
    const ambIntent = this.copilot.parseIntent('Optimize design.');
    test(5, 'Ambiguous Request Objective Detection (Rule 11)', ambIntent.ambiguous && (ambIntent.missingInputs?.length || 0) > 0, 'Ambiguous request flagged missing objective inputs.');

    // 6. Action Planning
    const plan = this.copilot.createActionPlan(simIntent, 'TRACE-GATE-314-01');
    test(6, 'Engineering Action Plan Creation', plan.steps.length >= 2, `Generated ${plan.steps.length} sequential action steps.`);

    // 7. Evidence Bus Registration & Hashing
    const ev1 = this.evidenceBus.registerEvidence(
      'FEM_SOLVER',
      'RUN-FEA-GATE-01',
      'REV-B-BASELINE',
      'FEA Structural Validator',
      'VALIDATED',
      { maxVonMisesStressMPa: 310, yieldSafetyFactorFoS: 2.55 }
    );
    test(7, 'Evidence Bus Registration & Hash Generation', ev1.evidenceHash.startsWith('HASH-FEM_SOLVER-'), `Evidence recorded with Hash: ${ev1.evidenceHash}`);

    // 8. Evidence Bus Query API (Rule 86)
    const queriedEv = this.evidenceBus.queryEvidence({ revisionId: 'REV-B-BASELINE' });
    test(8, 'Evidence Bus Query API (Rule 86)', queriedEv.length === 1 && queriedEv[0].evidenceId === ev1.evidenceId, `Query returned ${queriedEv.length} record.`);

    // 9. Stale Evidence Detection (Rule 90 & Rule 193)
    const isFreshOldRev = this.evidenceBus.isEvidenceFresh(ev1.evidenceId, 'REV-A-SUPERSEDED');
    test(9, 'Stale Evidence Protection (Rule 193)', !isFreshOldRev, 'Evidence from older revision correctly flagged non-fresh (STALE).');

    // 10. No-Hallucination Test (Rule 190) - Asking for stress without FEM solver output
    this.evidenceBus.clearStore(); // Clear evidence
    const noEvResp = this.copilot.processEngineerRequest('What is the maximum stress in the design?', session, { simulateNoEvidence: true });
    const numericClaimWithoutEv = noEvResp.claims.find(c => c.text.includes('Maximum stress value is unknown'));
    test(10, 'No-Hallucination Guard for Missing Solver Evidence (Rule 190)', noEvResp.validationStatus === 'NO_RESULT' && numericClaimWithoutEv !== undefined, 'Copilot returned NO_RESULT / UNKNOWN instead of inventing a stress value.');

    // 11. Evidence Grounded Execution Test (Rule 191)
    const groundedResp = this.copilot.processEngineerRequest('Test bracket under 5 kN load', session);
    test(11, 'Evidence Grounded Execution (Rule 191)', groundedResp.validationStatus === 'PASS' && groundedResp.evidenceReferences.length > 0, `Grounded response linked ${groundedResp.evidenceReferences.length} evidence records.`);

    // 12. Non-Converged Solver Test (Rule 84 & Rule 192)
    const unconvergedResp = this.copilot.processEngineerRequest('Run FEA stress simulation', session, { simulateUnconverged: true });
    test(12, 'Non-Converged Solver Handling (Rule 192)', unconvergedResp.validationStatus === 'UNCONVERGED' && unconvergedResp.claims.some(c => c.text.includes('did not achieve validated convergence')), 'Non-converged run flagged UNCONVERGED without granting PASS.');

    // 13. Evidence Bus Failure Test (Rule 195)
    this.evidenceBus.setAvailable(false);
    let busErrCaught = false;
    try {
      this.evidenceBus.queryEvidence({});
    } catch (err: any) {
      if (err.message.includes('EVIDENCE_UNAVAILABLE')) busErrCaught = true;
    }
    this.evidenceBus.setAvailable(true); // Restore
    test(13, 'Evidence Bus Offline Failure Isolation (Rule 195)', busErrCaught, 'EVIDENCE_UNAVAILABLE error raised when Evidence Bus is offline.');

    // 14. Tool Failure Test (Rule 196)
    let toolFailedCaught = false;
    try {
      this.copilot.processEngineerRequest('Test bracket with highest accuracy', session, { simulateToolFailure: true });
    } catch (err: any) {
      if (err.message.includes('TOOL_FAILED')) toolFailedCaught = true;
    }
    test(14, 'Tool Execution Failure Handling (Rule 196)', toolFailedCaught, 'TOOL_FAILED reported faithfully on hardware memory exception.');

    // 15. Permission Denied Test (Rule 194)
    const viewerSession = this.copilot.createSession('VIEWER-USER-02', {
      projectId: 'PROJ-TURBINE-2026',
      currentRevisionId: 'REV-B-BASELINE',
      userRole: 'VIEWER'
    });

    const releasePlan: EngineeringActionPlan = {
      planId: 'PLAN-RELEASE-01',
      intentId: 'INTENT-REL',
      traceId: 'TRACE-REL',
      steps: [{
        stepId: 1,
        toolCategory: 'VALIDATOR',
        toolName: 'Release Gate',
        description: 'Publish and release design to production',
        riskLevel: 'RELEASE_ACTION',
        requiresConfirmation: true,
        status: 'PENDING'
      }],
      status: 'PROPOSED',
      createdAt: new Date().toISOString()
    };

    let permDeniedCaught = false;
    try {
      this.copilot.executeActionPlan(releasePlan, viewerSession);
    } catch (err: any) {
      if (err.message.includes('PERMISSION_DENIED')) permDeniedCaught = true;
    }
    test(15, 'Role-Based Access Control Permission Guard (Rule 194)', permDeniedCaught, 'PERMISSION_DENIED thrown when VIEWER attempts RELEASE_ACTION.');

    // 16. Digital Thread Full Trace Test (Rule 199)
    const traceResp = this.copilot.processEngineerRequest('Review design and test it', session);
    test(16, 'Digital Thread Trace ID Propagation (Rule 199)', traceResp.traceId.startsWith('TRACE-314-') && session.traceHistory.includes(traceResp.traceId), `Digital Thread Trace ID ${traceResp.traceId} logged in session history.`);

    // 17-20. Additional Security & Claim Classification Assertions
    test(17, 'Claim Classification FACT vs UNKNOWN', traceResp.claims.every(c => c.classification !== undefined), 'All claims classified using standard taxonomy.');
    test(18, 'Action Plan Step Risk Levels Bounded', plan.steps.every(s => s.riskLevel !== undefined), 'Action plan steps assigned risk levels.');
    test(19, 'Unit Safety Normalization', simIntent.constraints.some(c => c.includes('MPa') || c.includes('kN')), 'Units normalized in constraints.');
    test(20, 'End-to-End Real Copilot Scenario', traceResp.responseId.startsWith('RESP-') && traceResp.plan !== undefined, 'End-to-end multi-step Copilot scenario executed successfully.');

    const passedCount = results.filter(r => r.passed).length;
    const failedCount = results.filter(r => !r.passed).length;

    return {
      passed: failedCount === 0,
      totalAssertions: results.length,
      passedCount,
      failedCount,
      results
    };
  }
}
