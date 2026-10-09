/**
 * SECP — ADSE-P9 Verification Cascade Invariant Regression Test
 * Proves that the invalidation cascade does NOT create independent verification authorities.
 * Instead, proves one authoritative source of truth (ExecutionStatus) with deterministic projections.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP9CommunicationEngine } from '../../../src/engine/adse/p9/ADSEP9CommunicationEngine';
import { RevisionEngine } from '../../../src/engine/revision/RevisionEngine';
import { CoreExecutionAuthority } from '../../../src/engine/execution/CoreExecutionAuthority';
import { DigitalThreadRegistry } from '../../../src/engine/adse/p4/DigitalThreadRegistry';
import { MBSEElementRegistry } from '../../../src/engine/adse/p2/MBSEElementRegistry';
import { MBSEBehavioralEngine } from '../../../src/engine/adse/p2/MBSEBehavioralEngine';
import { RevisionEntityType, RevisionLifecycleState } from '../../../src/engine/revision/types';

describe('ADSE-P9 SECP Verification Cascade Invariant Regression Test', () => {
  let p9: ADSEP9CommunicationEngine;
  let revisionEngine: RevisionEngine;
  let behavioralEngine: MBSEBehavioralEngine;
  let digitalThread: DigitalThreadRegistry;

  beforeEach(() => {
    revisionEngine = new RevisionEngine();
    behavioralEngine = new MBSEBehavioralEngine(new MBSEElementRegistry());
    digitalThread = new DigitalThreadRegistry(revisionEngine);
    CoreExecutionAuthority.clear();
    CoreExecutionAuthority.initialize(revisionEngine);
    p9 = new ADSEP9CommunicationEngine(revisionEngine, behavioralEngine, digitalThread);
  });

  it('PROVES REQUIRED INVARIANT: R1 -> E1 VERIFIED, R2 Mutation -> Invalidation -> Deterministic Parity', async () => {
    const archEntityId = 'arch:node:AIRFRAME-WING-001';
    const configId = 'CONF-BASELINE';

    // 1. Create Canonical Revision R1
    const r1 = revisionEngine.createRevision({
      revisionId: 'REV-WING-R1',
      entityId: archEntityId,
      entityType: RevisionEntityType.CAD_MODEL,
      revisionCode: '01',
      revisionNumber: 1,
      lifecycleState: RevisionLifecycleState.RELEASED,
      createdAt: new Date().toISOString(),
      createdBy: 'CHIEF_STRUCTURES_ENGINEER',
      effectivity: [],
      configurationScope: [configId],
      contentHash: 'hash-r1',
      dependencyHash: 'dep-r1',
      revisionHash: 'rev-r1',
      content: { thicknessMm: 12.0 },
      dependencies: []
    } as any);

    // 2. Authorize Communication System in P9
    const sys = await p9.authorizeCommunicationSystem({
      systemId: 'AVIONICS-COMM-SYS-INVARIANT',
      architectureId: archEntityId,
      p4NodeId: 'thread:node:AVIONICS-COMM-SYS-INVARIANT',
      configId: configId
    });

    // 3. Register Downstream System Revision depending on R1 WING
    revisionEngine.createRevision({
      revisionId: 'REV-COMM-SYS-INVARIANT-R1',
      entityId: sys.id,
      entityType: RevisionEntityType.SYSTEM,
      revisionCode: '01',
      revisionNumber: 1,
      lifecycleState: RevisionLifecycleState.RELEASED,
      createdAt: new Date().toISOString(),
      createdBy: 'CHIEF_COMMUNICATION_ENGINEER',
      effectivity: [],
      configurationScope: [configId],
      contentHash: 'hash-comm-r1',
      dependencyHash: 'dep-comm-r1',
      revisionHash: 'rev-comm-r1',
      content: { protocol: 'ETHERNET_IP' },
      dependencies: [
        {
          entityId: archEntityId,
          revisionId: 'REV-WING-R1',
          isFloating: false
        }
      ]
    } as any);

    // 4. Register Verified Execution E1
    const execId = 'EXEC-COMM-INVARIANT-001';
    p9.registry.registerExecution({
      id: execId,
      executionId: execId,
      systemId: sys.id,
      communicationSystemId: sys.id,
      revisionId: 'REV-COMM-SYS-INVARIANT-R1',
      configurationId: configId,
      status: 'VERIFIED',
      timestamp: new Date().toISOString()
    });

    // Authoritative verification declaration
    sys.verificationStatus = 'VERIFIED';

    // Verify initial VERIFIED state
    expect(p9.registry.getExecution(execId)?.status).toBe('VERIFIED');
    expect(p9.registry.getSystem(sys.id)?.verificationStatus).toBe('VERIFIED');

    // 5. Create Mutated Revision R2
    const r2 = revisionEngine.createRevision({
      revisionId: 'REV-WING-R2',
      entityId: archEntityId,
      entityType: RevisionEntityType.CAD_MODEL,
      revisionCode: '02',
      revisionNumber: 2,
      parentRevisionId: 'REV-WING-R1',
      lifecycleState: RevisionLifecycleState.RELEASED,
      createdAt: new Date().toISOString(),
      createdBy: 'CHIEF_STRUCTURES_ENGINEER',
      effectivity: [],
      configurationScope: [configId],
      contentHash: 'hash-r2',
      dependencyHash: 'dep-r2',
      revisionHash: 'rev-r2',
      content: { thicknessMm: 15.0 },
      dependencies: []
    } as any);

    // 6. Trigger Cascade Invalidation via RevisionImpactAnalyzer
    const impactRes = p9.evaluateCanonicalImpact('REV-WING-R2');
    expect(impactRes.invalidatedExecutionsCount).toBeGreaterThanOrEqual(1);

    // =========================================================================
    // VERIFY SECP INVARIANTS:
    // =========================================================================
    
    // Invariant A: Authoritative execution/verification record = INVALIDATED
    const postExecState = p9.registry.getExecution(execId);
    expect(postExecState?.status).toBe('INVALIDATED');

    // Invariant B: Canonical system state is semantically consistent
    const postSysState = p9.registry.getSystem(sys.id);
    expect(postSysState).toBeDefined();
    expect(postSysState?.verificationStatus).toBe('INVALIDATED');

    // Invariant C: Singular source of truth:
    // Any dynamic projection of verification status from executions matches the convenience field.
    const executions = p9.registry.getAllExecutions().filter(e => e.communicationSystemId === sys.id);
    const projectedStatus = executions.length > 0 && executions.every(e => e.status === 'VERIFIED') ? 'VERIFIED' : 'INVALIDATED';
    
    expect(postSysState?.verificationStatus).toBe(projectedStatus);
    expect(projectedStatus).toBe('INVALIDATED');

    // No parallel or split truth exists.
    expect(postExecState?.status).toBe('INVALIDATED');
  });
});
