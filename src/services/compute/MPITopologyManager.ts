import { MPIProcessTopology } from '../../engine/engineering_hpc/mpi_types';

export class MPITopologyManager {
  public static discoverTopology(worldSize: number): MPIProcessTopology[] {
    const topology: MPIProcessTopology[] = [];
    const nodes = ['node-01', 'node-02', 'node-03', 'node-04'];
    
    for (let i = 0; i < worldSize; i++) {
      const nodeIndex = Math.floor(i / (worldSize / nodes.length));
      topology.push({
        worldSize,
        rank: i,
        localRank: i % (worldSize / nodes.length),
        nodeId: nodes[nodeIndex] || nodes[0],
        cpuSet: [i * 2, i * 2 + 1],
        numaNode: nodeIndex % 2,
        gpuId: `gpu-${i % 2}`
      });
    }
    
    return topology;
  }

  public static getRankAffinity(rank: number, topology: MPIProcessTopology[]): MPIProcessTopology | undefined {
    return topology.find(t => t.rank === rank);
  }
}
