import { CFDRepartitionCost, CFDPartitionRecord } from './distributed_cfd_types';

export class CFDRepartitionCostEstimator {
  /**
   * Estimates the cost-benefit analysis metrics of a potential repartitioning step.
   * All outputs are workload-qualified and scale dynamically with mesh size, world size, and imbalance.
   */
  public static estimateCost(
    cellCount: number,
    worldSize: number,
    currentPartition: CFDPartitionRecord,
    proposedPartitionQuality: { loadImbalance: number; communicationFraction: number }
  ): CFDRepartitionCost {
    // Migration time is proportional to cells that need to move across ranks.
    // In a world of size N, typically (1 - 1/N) of the imbalanced fraction moves.
    const imbalanceFraction = Math.max(0, currentPartition.loadBalance - 1.0);
    const cellsToMigrate = cellCount * imbalanceFraction * (1 - 1 / worldSize);
    
    // Assume 10 microseconds transfer per cell in a distributed network.
    const estimatedMigrationTime = (cellsToMigrate * 10e-6) * 1000; // in milliseconds
    
    // Synchronization costs increase with more ranks and boundary/halo volume.
    const baseSyncCost = worldSize * Math.log2(worldSize) * 0.15; // log complexity
    const estimatedSynchronizationCost = baseSyncCost + (currentPartition.haloVolume * 5e-6 * 1000); // in ms
    
    // Repartitioning algorithms (like METIS or geometric) take time based on local node compute.
    const estimatedRepartitionCost = (cellCount * 2e-6 * 1000) * (worldSize * 0.1); // in ms

    // Projected load balance gain = current imbalance minus proposed imbalance times baseline compute fraction.
    const currentImbalance = currentPartition.loadBalance;
    const proposedImbalance = proposedPartitionQuality.loadImbalance;
    const projectedLoadBalanceGain = Math.max(0, (currentImbalance - proposedImbalance) * 50.0); // estimated gain index in ms
    
    // Projected communication gain = current halo fraction minus proposed communication fraction.
    const currentCommFraction = currentPartition.haloVolume / (cellCount || 1);
    const proposedCommFraction = proposedPartitionQuality.communicationFraction;
    const projectedCommunicationGain = Math.max(0, (currentCommFraction - proposedCommFraction) * 25.0); // gain index in ms

    return {
      estimatedMigrationTime,
      estimatedSynchronizationCost,
      estimatedRepartitionCost,
      projectedLoadBalanceGain,
      projectedCommunicationGain
    };
  }
}
