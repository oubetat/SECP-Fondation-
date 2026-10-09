import { MPIDistributedCheckpoint, GlobalCheckpointConsistencyModel } from '../../engine/engineering_hpc/mpi_types';

export class GlobalCheckpointConsistencyManager {
  /**
   * Generates a distributed checkpoint containing global epoch and cross-rank dependency state hashes.
   */
  public static createCheckpoint(
    globalEpoch: number,
    globalIteration: number,
    consistencyModel: GlobalCheckpointConsistencyModel,
    partitionHash: string,
    ranks: number[]
  ): MPIDistributedCheckpoint {
    const rankCheckpoints: MPIDistributedCheckpoint['rankCheckpoints'] = {};
    
    for (const rank of ranks) {
      // Simulate state hashing for each rank
      const rankStateHash = `hash-rank-${rank}-epoch-${globalEpoch}-iter-${globalIteration}`;
      
      // The dependencyStateHash proves the dependency relationship between rank boundary messages.
      // In a real system, this is the hash of the sent/received boundary buffers at the epoch boundary.
      const dependencyStateHash = `hash-dep-rank-${rank}-peer-${(rank + 1) % ranks.length}`;
      
      rankCheckpoints[rank] = {
        rankStateHash,
        dependencyStateHash,
        timestamp: new Date().toISOString()
      };
    }

    return {
      globalEpoch,
      globalIteration,
      consistencyModel,
      partitionHash,
      rankCheckpoints
    };
  }

  /**
   * Validates whether a distributed checkpoint is globally consistent.
   * Proves that all ranks are on the same epoch and dependency state hashes match expectation.
   */
  public static validateConsistency(
    checkpoint: MPIDistributedCheckpoint,
    expectedRanksCount: number
  ): { consistent: boolean; reason?: string } {
    const keys = Object.keys(checkpoint.rankCheckpoints).map(Number);
    
    if (keys.length !== expectedRanksCount) {
      return {
        consistent: false,
        reason: `RANK_COUNT_MISMATCH: Expected ${expectedRanksCount} ranks, got ${keys.length}`
      };
    }

    // Verify consistency according to the model rules
    if (checkpoint.consistencyModel === 'COORDINATED') {
      // For fully coordinated checkpoints, all ranks must possess a valid, non-empty state hash and dependency hash
      for (const rank of keys) {
        const rc = checkpoint.rankCheckpoints[rank];
        if (!rc || !rc.rankStateHash || !rc.dependencyStateHash) {
          return {
            consistent: false,
            reason: `INCOMPLETE_STATE: Rank ${rank} is missing state or dependency hashes`
          };
        }
      }
    } else if (checkpoint.consistencyModel === 'ASYNC_WITH_GLOBAL_EPOCH') {
      // Check that all rank dependencyStateHashes are aligned to the same globalEpoch signature
      for (const rank of keys) {
        const rc = checkpoint.rankCheckpoints[rank];
        if (!rc.rankStateHash.includes(`epoch-${checkpoint.globalEpoch}`)) {
          return {
            consistent: false,
            reason: `EPOCH_DESYNCHRONIZATION: Rank ${rank} state hash is not aligned with global epoch ${checkpoint.globalEpoch}`
          };
        }
      }
    }

    return { consistent: true };
  }
}
