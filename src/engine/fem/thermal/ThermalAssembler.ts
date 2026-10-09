import { Matrix } from "../core/MathUtils";

export class ThermalAssembler {
  static assembleGlobalMatrix(
    nodeCount: number,
    elements: { nodes: number[], matrix: Matrix }[]
  ): Matrix {
    const K = Matrix.zeros(nodeCount, nodeCount);

    for (const el of elements) {
      for (let i = 0; i < el.nodes.length; i++) {
        for (let j = 0; j < el.nodes.length; j++) {
          const globalI = el.nodes[i];
          const globalJ = el.nodes[j];
          K.set(globalI, globalJ, K.get(globalI, globalJ) + el.matrix.get(i, j));
        }
      }
    }

    return K;
  }

  static assembleGlobalVector(
    nodeCount: number,
    elements: { nodes: number[], vector: number[] }[]
  ): number[] {
    const f = new Array(nodeCount).fill(0);

    for (const el of elements) {
      for (let i = 0; i < el.nodes.length; i++) {
        const globalI = el.nodes[i];
        f[globalI] += el.vector[i];
      }
    }

    return f;
  }
}
