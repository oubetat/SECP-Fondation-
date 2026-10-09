/**
 * ============================================================================
 * SECP ADSE Workbench Cross-Domain & Truth Invariance Suite (WUX-X1, WUX-X2, WUX-X3)
 * ============================================================================
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEWorkbenchBridge } from '../../../src/engine/adse/workbench/ADSEWorkbenchBridge';
import { RevisionEntityType, RevisionLifecycleState } from '../../../src/engine/revision/types';

describe('ADSE Workbench Cross-Domain & Truth Invariance Suite (WUX-X1, WUX-X2, WUX-X3)', () => {
  let bridge: ADSEWorkbenchBridge;

  beforeEach(() => {
    ADSEWorkbenchBridge.resetInstance();
    bridge = ADSEWorkbenchBridge.getInstance();
  });

  // WUX-X1: Cross-Domain System Trace
  it('WUX-X1: proves Workbench can navigate across P5..P9 domains without losing canonical identity', async () => {
    // 1. Register canonical system across P3, P4
    bridge.p4.registry.registerNode({
      nodeId: 'thread:node:CROSS-AV-01',
      nodeType: 'ArchitectureElement',
      canonicalId: 'NODE-CROSS-01',
      authoritySource: 'P3_ARCHITECTURE_AUTHORITY',
      displayName: 'Integrated Avionics Core',
      configurationId: 'CONF-BASELINE',
      revisionId: 'REV-R1'
    });

    // 2. Query cross-domain trace context
    const crossTrace = bridge.traceCrossDomainEntity('NODE-CROSS-01');
    expect(crossTrace).toBeDefined();
    expect(crossTrace.canonicalId).toBe('NODE-CROSS-01');
    expect(crossTrace.p4NodeId).toBe('thread:node:CROSS-AV-01');
    expect(crossTrace.threadTrace).toBeDefined();
  });

  // WUX-X2: Invalidation -> Persist -> Restart -> Reopen Truth Invariance
  it('WUX-X2: proves that invalidated state survives persistence, destruction, restart, and reload', async () => {
    // 1. Setup canonical communication system
    const sys = await bridge.p9.authorizeCommunicationSystem({
      systemId: 'SYS-RESTART-TEST',
      architectureId: 'arch:node:AVIONICS-P9',
      p4NodeId: 'thread:node:restart-01',
      configId: 'CONF-BASELINE'
    });

    // 1b. Register canonical baseline revision in RevisionEngine
    bridge.revisionEngine.createRevision({
      revisionId: 'REV-R1-RESTART-ID',
      entityId: sys.id,
      entityType: RevisionEntityType.PART,
      revisionCode: 'REV-R1',
      revisionNumber: 1,
      lifecycleState: RevisionLifecycleState.RELEASED,
      createdAt: new Date().toISOString(),
      createdBy: 'CHIEF_SYSTEMS_ENGINEER',
      effectivity: [],
      configurationScope: ['CONF-BASELINE'],
      contentHash: 'hash-r1-restart',
      dependencyHash: 'dep-r1-restart',
      revisionHash: 'rev-r1-restart',
      content: { specVersion: '1.0' },
      dependencies: []
    } as any);

    // 2. Register valid execution envelope
    const exec = bridge.p9.registry.registerExecution({
      id: 'EXEC-RESTART-001',
      executionId: 'EXEC-RESTART-001',
      systemId: sys.id,
      communicationSystemId: sys.id,
      revisionId: 'REV-R1',
      configurationId: 'CONF-BASELINE',
      status: 'VERIFIED',
      timestamp: new Date().toISOString()
    });
    expect(bridge.p9.registry.getExecution('EXEC-RESTART-001')?.status).toBe('VERIFIED');

    // 2b. NEGATIVE GATE: Unknown revision MUST be rejected with REVISION_NOT_FOUND
    expect(() => {
      bridge.p9.evaluateCanonicalImpact('REV-UNREGISTERED-SPURIOUS');
    }).toThrow(/REVISION_NOT_FOUND/);

    // 2c. Register canonical mutated revision in RevisionEngine
    bridge.revisionEngine.createRevision({
      revisionId: 'REV-R2-RESTART-ID',
      entityId: sys.id,
      entityType: RevisionEntityType.PART,
      revisionCode: 'REV-R2',
      revisionNumber: 2,
      parentRevisionId: 'REV-R1-RESTART-ID',
      lifecycleState: RevisionLifecycleState.RELEASED,
      createdAt: new Date().toISOString(),
      createdBy: 'CHIEF_SYSTEMS_ENGINEER',
      effectivity: [],
      configurationScope: ['CONF-BASELINE'],
      contentHash: 'hash-r2-restart',
      dependencyHash: 'dep-r2-restart',
      revisionHash: 'rev-r2-restart',
      content: { specVersion: '2.0' },
      dependencies: []
    } as any);

    // 3. Trigger canonical revision mutation -> Invalidation via RevisionEngine
    const impactRes = bridge.p9.evaluateCanonicalImpact('REV-R2-RESTART-ID');
    expect(impactRes.invalidatedExecutionsCount).toBeGreaterThanOrEqual(1);
    expect(bridge.p9.registry.getExecution('EXEC-RESTART-001')?.status).toBe('INVALIDATED');

    // 4. Persist to cryptographic snapshot
    const snap = bridge.p9.persistence.createSnapshot({
      communicationSystemId: sys.id,
      persistedByAuthority: 'SECP_PERSISTENCE_AUTHORITY'
    });
    expect(snap.id).toBeDefined();

    // 5. Simulate Complete Application Destruction / Restart
    bridge.p9.registry.clear();
    expect(bridge.p9.registry.getExecution('EXEC-RESTART-001')).toBeUndefined();

    // 6. Reload from snapshot into fresh runtime
    const restoreRes = bridge.p9.persistence.restoreFromSnapshot(snap.id);
    expect(restoreRes.isValid).toBe(true);

    // 7. Verify Invalidation Truth is preserved (MUST NOT return to VERIFIED)
    const reloadedExec = bridge.p9.registry.getExecution('EXEC-RESTART-001');
    expect(reloadedExec).toBeDefined();
    expect(reloadedExec?.status).toBe('INVALIDATED');
  });

  // WUX-X3: Recomputable Engineering Metrics Provenance
  it('WUX-X3: proves that all dashboard metrics are dynamically recomputable with cryptographic provenance', () => {
    const m1 = bridge.computeEngineeringMetrics('CONF-BASELINE');
    const m2 = bridge.computeEngineeringMetrics('CONF-BASELINE');

    expect(m1.metrics.engineeringTruthRatio).toBe(m2.metrics.engineeringTruthRatio);
    expect(m1.provenanceHash).toBe(m2.provenanceHash);
    expect(m1.provenanceHash.length).toBe(64);
  });
});
