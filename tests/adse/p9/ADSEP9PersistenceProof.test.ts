import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP9CommunicationEngine } from '../../../src/engine/adse/p9/ADSEP9CommunicationEngine';
import { RevisionEngine } from '../../../src/engine/revision/RevisionEngine';
import { CoreExecutionAuthority } from '../../../src/engine/execution/CoreExecutionAuthority';
import { DigitalThreadRegistry } from '../../../src/engine/adse/p4/DigitalThreadRegistry';
import { MBSEElementRegistry } from '../../../src/engine/adse/p2/MBSEElementRegistry';
import { MBSEBehavioralEngine } from '../../../src/engine/adse/p2/MBSEBehavioralEngine';
import { RevisionEntityType, RevisionLifecycleState } from '../../../src/engine/revision/types';

describe('ADSE-P9 Communications Persistence & Reconstruction Proof', () => {
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

  it('PROVES: CREATE -> MUTATE -> PERSIST -> DESTROY -> RELOAD -> RECONSTRUCT -> COMPARE', async () => {
    // 1. CREATE
    const sys = await p9.authorizeCommunicationSystem({
      systemId: 'SYS-PERST-01',
      architectureId: 'arch:valid-perst',
      p4NodeId: 'thread:node:sys-perst-01',
      configId: 'CONF-01'
    });

    const node1 = p9.registry.registerNode({
      id: 'NODE-P-1',
      systemId: 'SYS-PERST-01',
      communicationSystemId: sys.id,
      p3ComponentId: 'comp:p-1',
      p4NodeId: 'thread:node:node-p-1',
      nodeName: 'Node 1',
      processingDelayMs: 1.0,
      bufferCapacityBytes: 10000,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    // 2. MUTATE (Change processing delay)
    p9.registry.updateNode(node1.id, { processingDelayMs: 2.5 });

    // 3. PERSIST (Create cryptographic snapshot)
    const snapshotId = 'SNAPSHOT-PERSISTENCE-PROOF';
    const snapshot = p9.persistence.createSnapshot({
      snapshotId,
      communicationSystemId: sys.id,
      persistedByAuthority: 'SECP_PERSISTENCE_AUTHORITY'
    });

    expect(snapshot.id).toBe(snapshotId);
    expect(snapshot.merkleRootHash).toBeDefined();

    // 4. DESTROY INSTANCE (Clear in-memory registry)
    p9.registry.clear();
    expect(p9.registry.getSystem(sys.id)).toBeUndefined();
    expect(p9.registry.getNode(node1.id)).toBeUndefined();

    // 5. RELOAD & RECONSTRUCT
    const restoreResult = p9.persistence.restoreFromSnapshot(snapshotId);
    expect(restoreResult.isValid).toBe(true);

    // 6. VERIFY & COMPARE
    const restoredSys = p9.registry.getSystem(sys.id);
    const restoredNode = p9.registry.getNode(node1.id);

    expect(restoredSys).toBeDefined();
    expect(restoredNode).toBeDefined();
    expect(restoredNode?.processingDelayMs).toBe(2.5); // Mutated value persisted and restored!
    expect(restoredNode?.provenance?.originHash).toBe(node1.provenance?.originHash); // Bit-exact parity!
  });

  it('PROVES: Forensic Gate V34 fails if snapshot is corrupted or incomplete', async () => {
    const sys = await p9.authorizeCommunicationSystem({
      systemId: 'SYS-CORRUPT-01',
      architectureId: 'arch:valid-corrupt',
      p4NodeId: 'thread:node:sys-corrupt-01',
      configId: 'CONF-01'
    });

    const snapshotId = 'SNAPSHOT-CORRUPTION-TEST';
    const snapshot = p9.persistence.createSnapshot({
      snapshotId,
      communicationSystemId: sys.id,
      persistedByAuthority: 'SECP_PERSISTENCE_AUTHORITY'
    });

    // Deliberately corrupt the snapshot registry state in persistence storage
    // We can do this by retrieving the snapshot and modifying its internal array property
    const snapshotRecord = (p9.persistence as any).snapshots.get(snapshotId);
    if (snapshotRecord) {
      snapshotRecord.systems = [...snapshotRecord.systems];
      snapshotRecord.systems[0] = { ...snapshotRecord.systems[0], displayName: 'MUTATED SYSTEM NAME' };
    }

    // Attempt reload should fail or mark restore as invalid
    const restoreResult = p9.persistence.restoreFromSnapshot(snapshotId);
    expect(restoreResult.isValid).toBe(false); // Validated corruption detection!

    // Gate V34 must FAIL or show failure since snapshot reconstruction is invalid/corrupted
    // Let's assert that restoreResult.isValid is false upon any Merkle root or checksum mismatch!
    expect(restoreResult.error).toContain('SNAPSHOT_CORRUPTED');
  });
});
