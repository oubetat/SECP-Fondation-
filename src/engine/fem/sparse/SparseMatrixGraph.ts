import { CSRStorage } from "./CSRStorage";

export interface NodeConnectivityInfo {
  nodeIndex: number;
  degree: number;
  neighbors: number[];
}

export class SparseMatrixGraph {
  readonly numNodes: number;
  readonly adjacency: number[][];

  constructor(numNodes: number, adjacency: number[][]) {
    this.numNodes = numNodes;
    this.adjacency = adjacency;
  }

  /**
   * Constructs graph from CSR matrix structure (ignoring diagonal self-loops)
   */
  static fromCSR(csr: CSRStorage): SparseMatrixGraph {
    const numNodes = csr.rows;
    const adjacency: number[][] = Array.from({ length: numNodes }, () => []);

    for (let r = 0; r < numNodes; r++) {
      const start = csr.rowPointers[r];
      const end = csr.rowPointers[r + 1];
      for (let idx = start; idx < end; idx++) {
        const c = csr.columnIndices[idx];
        if (c !== r && c < numNodes) {
          adjacency[r].push(c);
        }
      }
    }

    return new SparseMatrixGraph(numNodes, adjacency);
  }

  getNodeInfo(nodeIndex: number): NodeConnectivityInfo {
    if (nodeIndex < 0 || nodeIndex >= this.numNodes) {
      throw new Error(`Invalid node index: ${nodeIndex}`);
    }
    return {
      nodeIndex,
      degree: this.adjacency[nodeIndex].length,
      neighbors: [...this.adjacency[nodeIndex]]
    };
  }

  /**
   * Calculates maximum and average node degree
   */
  getDegreeStatistics(): { maxDegree: number; minDegree: number; avgDegree: number } {
    let maxDegree = 0;
    let minDegree = Infinity;
    let sumDegree = 0;

    for (let i = 0; i < this.numNodes; i++) {
      const deg = this.adjacency[i].length;
      if (deg > maxDegree) maxDegree = deg;
      if (deg < minDegree) minDegree = deg;
      sumDegree += deg;
    }

    return {
      maxDegree,
      minDegree: minDegree === Infinity ? 0 : minDegree,
      avgDegree: this.numNodes > 0 ? sumDegree / this.numNodes : 0
    };
  }

  /**
   * Computes connected components using BFS
   */
  getConnectedComponents(): number[][] {
    const visited = new Uint8Array(this.numNodes);
    const components: number[][] = [];

    for (let i = 0; i < this.numNodes; i++) {
      if (visited[i]) continue;
      const comp: number[] = [];
      const queue: number[] = [i];
      visited[i] = 1;

      while (queue.length > 0) {
        const curr = queue.shift()!;
        comp.push(curr);
        for (const neighbor of this.adjacency[curr]) {
          if (!visited[neighbor]) {
            visited[neighbor] = 1;
            queue.push(neighbor);
          }
        }
      }
      components.push(comp);
    }

    return components;
  }
}
