import { describe, it, expect, beforeEach } from 'vitest';
import { CoreExecutionAuthority } from '../../execution/CoreExecutionAuthority';
import { GenericExecutionRegistry } from '../../execution/GenericExecutionRegistry';
import { RevisionEngine } from '../../revision/RevisionEngine';
import { RevisionLifecycleState } from '../../revision/types';
import { CrossDomainWorkflowEngine } from '../CrossDomainWorkflowEngine';
import { EngineeringDomain } from '../CrossDomainTypes';

describe('M9 Real End-to-End Cross-Domain Workflow', () => {
  let revisionEngine: RevisionEngine;
  const objectId = 'WORKFLOW-ENG-OBJ-001';

  beforeEach(() => {
    GenericExecutionRegistry.clear();
    CoreExecutionAuthority.clear();
    CrossDomainWorkflowEngine.clear();

    revisionEngine = new RevisionEngine();
    CoreExecutionAuthority.initialize(revisionEngine);
  });

  it('Executes authoritative Robotics -> Aerospace -> Decision -> R2 workflow', async () => {
    // 1. Establish Canonical Revision R1
    const r1Draft = revisionEngine.createRevision({
      revisionId: 'REV-R1',
      entityId: objectId,
      entityType: 'CAD_MODEL' as any,
      revisionCode: 'A',
      revisionNumber: 1,
      lifecycleState: RevisionLifecycleState.DRAFT,
      createdBy: 'CHIEF_ENGINEER',
      content: { design: 'Initial System' },
      snapshot: { geometryState: { geometryHash: 'GEOM-R1' } }
    } as any);

    revisionEngine.transitionState(r1Draft.revisionId, RevisionLifecycleState.IN_REVIEW, 'BYPASS_ADMIN', 'Review');
    
    revisionEngine.addApproval(r1Draft.revisionId, {
      approvalId: 'APP-R1',
      revisionId: r1Draft.revisionId,
      role: 'ENGINEER',
      actorId: 'LEAD_APPROVER',
      decision: 'APPROVED',
      timestamp: new Date().toISOString(),
      reason: 'Approved'
    });

    revisionEngine.setValidationState(r1Draft.revisionId, 'SIMULATED');
    revisionEngine.transitionState(r1Draft.revisionId, RevisionLifecycleState.APPROVED, 'BYPASS_ADMIN', 'Approve');
    const r1 = revisionEngine.releaseRevision(r1Draft.revisionId, 'BYPASS_ADMIN', 'Released');

    // 2. Robotics Execution (Domain A)
    const roboticsReq = {
      requestId: 'REQ-ROB-001',
      engineeringObjectId: objectId,
      revisionId: 'REV-R1',
      pluginId: 'secp-plugin-robotics',
      pluginVersion: '1.5.0',
      executionKind: 'joint-torque',
      parameters: { payloadMassKg: 10 }
    };

    const roboticsEnvelope = await CoreExecutionAuthority.execute(roboticsReq);
    expect(roboticsEnvelope.verificationResult.overallVerdict).toBe('PASS');

    // 3. Cross-Domain Handoff (Robotics -> Aerospace)
    // Extract dynamic torque to feed into Aerospace wing load analysis
    const handoff = await CoreExecutionAuthority.performCrossDomainHandoff({
      sourceExecutionId: roboticsEnvelope.executionId,
      targetDomain: EngineeringDomain.AEROSPACE,
      targetParameterKey: 'externalAppliedLoadNm',
      extractedValue: roboticsEnvelope.solverResult.rawResults.totalShoulderTorqueNm
    });

    expect(handoff.status).toBe('VALID');
    expect(handoff.sourceRevisionHash).toBe(r1.revisionHash);

    // 4. Aerospace Execution (Domain B) consuming Domain A results
    const aerospaceReq = {
      requestId: 'REQ-AER-001',
      engineeringObjectId: objectId,
      revisionId: 'REV-R1',
      pluginId: 'secp-plugin-aerospace',
      pluginVersion: '1.4.0',
      executionKind: 'mach-flow',
      parameters: { 
        altitudeM: 11000, 
        velocityMs: 250,
        // Consuming the handoff value
        [handoff.targetParameterKey]: handoff.targetParameterValue 
      },
      consumedHandoffIds: [handoff.handoffId]
    };

    const aerospaceEnvelope = await CoreExecutionAuthority.execute(aerospaceReq);
    expect(aerospaceEnvelope.verificationResult.overallVerdict).toBe('PASS');

    // 5. Engineering Decision leading to Revision R2
    const r2 = revisionEngine.createRevision({
      revisionId: 'REV-R2',
      entityId: objectId,
      entityType: 'CAD_MODEL' as any,
      revisionCode: 'B',
      revisionNumber: 2,
      parentRevisionId: r1.revisionId,
      lifecycleState: RevisionLifecycleState.DRAFT,
      createdBy: 'CHIEF_ENGINEER',
      content: { design: 'Improved System' },
      snapshot: { geometryState: { geometryHash: 'GEOM-R2' } }
    } as any);

    // 6. Verify R1 Handoff is STALE for R2 context (FAIL CLOSED)
    const staleValidation = CrossDomainWorkflowEngine.validateHandoffForConsumption(
      handoff.handoffId,
      r2.revisionId,
      r2.revisionHash,
      r2.snapshot?.geometryState?.geometryHash!
    );

    expect(staleValidation.isValid).toBe(false);
    expect(staleValidation.status).toBe('STALE');
    
    // 7. Verify Provenance Continuity
    const graph = CoreExecutionAuthority.getProvenanceGraph();
    expect(graph.hasNode(`REV-NODE-${r1.revisionHash}`)).toBe(true);
    expect(graph.hasNode(`EXEC-NODE-${roboticsEnvelope.executionId}`)).toBe(true);
    expect(graph.hasNode(`EXEC-NODE-${aerospaceEnvelope.executionId}`)).toBe(true);
    expect(graph.hasEdge(`EDGE-XD-DEP-${handoff.handoffId}-${aerospaceEnvelope.executionId}`)).toBe(true);
  });
});
