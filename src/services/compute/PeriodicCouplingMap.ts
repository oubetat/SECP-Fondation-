import { PeriodicPairIdentity, PeriodicCouplingMap as IPeriodicCouplingMap } from './distributed_cfd_types';

export class PeriodicCouplingMap implements IPeriodicCouplingMap {
  public periodicCouplingHash: string;
  public pairs: PeriodicPairIdentity[];
  public isRestartStable: boolean = true;
  public isRankDeterministic: boolean = true;
  public isPartitionIndependent: boolean = true;

  constructor(pairs: PeriodicPairIdentity[]) {
    // Ensure deterministic ordering by sorting the pairs by their periodicPairId
    this.pairs = [...pairs].sort((a, b) => a.periodicPairId.localeCompare(b.periodicPairId));
    this.periodicCouplingHash = this.calculateHash();
  }

  /**
   * 194. PERIODIC MAP HASH
   * Calculates a unique, partition-independent, restart-stable hash of the coupling.
   */
  private calculateHash(): string {
    const pairStrings = this.pairs.map(p => 
      `${p.periodicPairId}:${p.sourceGlobalId}->${p.targetGlobalId}`
    );
    const content = pairStrings.join(';');
    
    // Simple deterministic string hashing algorithm
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32bit integer
    }
    return `hash-periodic-coupling-${Math.abs(hash)}`;
  }

  /**
   * 195. HALO TOPOLOGY INTEGRATION
   * Integrates the periodic coupling hash into the standard halo topology hash.
   */
  public integrateWithHaloHash(baseHaloHash: string): string {
    return `${baseHaloHash}-periodic-${this.periodicCouplingHash}`;
  }

  /**
   * 196. PERIODIC EXCHANGE ORDER
   * Determines a strict, deterministic sequence for periodic boundary synchronization.
   * Forces sends, receives, and local boundary updates to execute in a sorted order to avoid deadlocks.
   */
  public getDeterministicExchangeSchedule(rank: number): {
    sends: PeriodicPairIdentity[];
    receives: PeriodicPairIdentity[];
    updates: PeriodicPairIdentity[];
  } {
    const sends: PeriodicPairIdentity[] = [];
    const receives: PeriodicPairIdentity[] = [];
    const updates: PeriodicPairIdentity[] = [];

    for (const pair of this.pairs) {
      if (pair.sourceRank === rank && pair.targetRank !== rank) {
        sends.push(pair);
      } else if (pair.targetRank === rank && pair.sourceRank !== rank) {
        receives.push(pair);
      } else if (pair.sourceRank === rank && pair.targetRank === rank) {
        updates.push(pair); // intra-partition local periodic copy
      }
    }

    // Sort deterministically to maintain invariant execution order across all ranks
    const sortFn = (a: PeriodicPairIdentity, b: PeriodicPairIdentity) => 
      a.periodicPairId.localeCompare(b.periodicPairId);

    return {
      sends: sends.sort(sortFn),
      receives: receives.sort(sortFn),
      updates: updates.sort(sortFn)
    };
  }

  /**
   * 197. PERIODIC RESTART VALIDATION & 198. PERIODIC INTEGRITY FAILURE
   * Validates the coupling map hash during restarts against a checkpoint's reference.
   */
  public static validateRestart(
    currentHash: string,
    checkpointHash: string
  ): { isValid: boolean; error?: string } {
    if (currentHash !== checkpointHash) {
      return {
        isValid: false,
        error: 'PERIODIC_COUPLING_INTEGRITY_FAILURE: Periodic coupling map hash does not match checkpoint reference state!'
      };
    }
    return { isValid: true };
  }
}
