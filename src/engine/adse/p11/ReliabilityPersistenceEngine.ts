import { createHash } from 'crypto';
import { FailureRegistry } from './FailureRegistry';
import { P11Snapshot, FailureMode, FaultTree, ReliabilityModel } from './types';

export class ReliabilityPersistenceEngine {
  private registry: FailureRegistry;

  constructor(registry: FailureRegistry) {
    this.registry = registry;
  }

  /**
   * P11.10: Serializes all Reliability, Failure Mode and Risk entities into a 
   * Merkle Snapshot for deterministic snapshot integrity and reconstruction parity.
   */
  public createSnapshot(persistedBy: string): P11Snapshot {
    const failureModes = this.registry.getAllFailureModes();
    const faultTrees = this.registry.getAllFaultTrees();
    const reliabilityModels = this.registry.getAllReliabilityModels();

    // Generate Merkle leaf hashes for all stored entities
    const leafHashes: string[] = [];
    failureModes.forEach(fm => {
      leafHashes.push(createHash('sha256').update(`fm:${fm.failureModeId}:${fm.status}`).digest('hex'));
    });
    faultTrees.forEach(ft => {
      leafHashes.push(createHash('sha256').update(`ft:${ft.treeId}:${ft.topEvent.probability}`).digest('hex'));
    });
    reliabilityModels.forEach(rm => {
      leafHashes.push(createHash('sha256').update(`rm:${rm.modelId}:${rm.availability}`).digest('hex'));
    });

    if (leafHashes.length === 0) {
      leafHashes.push(createHash('sha256').update('EMPTY_P11_REGISTRY').digest('hex'));
    }

    // Combine sorted leaves into Merkle root hash
    const sortedLeaves = leafHashes.sort();
    const merkleRootHash = createHash('sha256').update(sortedLeaves.join('|')).digest('hex');

    return {
      id: `snap:p11:${Date.now()}`,
      failureModes: JSON.parse(JSON.stringify(failureModes)),
      faultTrees: JSON.parse(JSON.stringify(faultTrees)),
      reliabilityModels: JSON.parse(JSON.stringify(reliabilityModels)),
      merkleRootHash,
      persistedAt: new Date().toISOString(),
      persistedByAuthority: persistedBy
    };
  }

  /**
   * P11.10: Rehydrates the reliability state from a snapshot, 
   * verifying reconstruction parity using Merkle root hash matching.
   */
  public restoreFromSnapshot(snapshot: P11Snapshot): { isValid: boolean; error?: string } {
    try {
      this.registry.clear();

      // Restore failure modes
      snapshot.failureModes.forEach(fm => this.registry.registerFailureMode(fm));

      // Restore fault trees
      snapshot.faultTrees.forEach(ft => this.registry.registerFaultTree(ft));

      // Restore reliability models
      snapshot.reliabilityModels.forEach(rm => this.registry.registerReliabilityModel(rm));

      // Compute verification snapshot
      const verificationSnap = this.createSnapshot(snapshot.persistedByAuthority);
      if (verificationSnap.merkleRootHash !== snapshot.merkleRootHash) {
        throw new Error(`PERSISTENCE_INTEGRITY_VIOLATION: Merkle Root Hash Mismatch! Snapshot corrupted or tampered with.`);
      }

      return { isValid: true };
    } catch (e: any) {
      return { isValid: false, error: e.message };
    }
  }
}
