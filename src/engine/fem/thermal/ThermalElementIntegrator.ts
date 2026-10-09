import { Matrix } from "../core/MathUtils";
import { ThermalMaterial } from "./ThermalMaterial";

export class ThermalElementIntegrator {
  /**
   * Computes element conductivity matrix: Ke = integral( B^T * k * B ) dV
   * @param dNdX Shape function derivatives w.r.t coordinates [nodeCount][dim]
   * @param volume Element volume/area
   * @param k Thermal conductivity
   */
  static computeConductivityMatrix(
    dNdX: number[][],
    volume: number,
    k: number
  ): Matrix {
    const nodeCount = dNdX.length;
    const dim = dNdX[0].length;
    const Ke = Matrix.zeros(nodeCount, nodeCount);

    for (let a = 0; a < nodeCount; a++) {
      for (let b = 0; b < nodeCount; b++) {
        let sum = 0;
        for (let i = 0; i < dim; i++) {
          sum += dNdX[a][i] * dNdX[b][i];
        }
        Ke.set(a, b, sum * k * volume);
      }
    }

    return Ke;
  }

  /**
   * Computes element capacity matrix: Ce = integral( N^T * rho * cp * N ) dV
   * Standard lumped version for stability.
   */
  static computeCapacityMatrix(
    nodeCount: number,
    volume: number,
    rho: number,
    cp: number,
    lumped: boolean = true
  ): Matrix {
    const Ce = Matrix.zeros(nodeCount, nodeCount);
    const totalCapacity = rho * cp * volume;

    if (lumped) {
      const perNode = totalCapacity / nodeCount;
      for (let i = 0; i < nodeCount; i++) {
        Ce.set(i, i, perNode);
      }
    } else {
      // Consistent matrix placeholder - for simplicity we use lumped by default in industrial OS
      const perNode = totalCapacity / nodeCount;
      for (let i = 0; i < nodeCount; i++) {
        Ce.set(i, i, perNode);
      }
    }

    return Ce;
  }

  /**
   * Computes element load vector due to internal heat generation Q
   */
  static computeHeatSourceVector(
    nodeCount: number,
    volume: number,
    Q: number
  ): number[] {
    const fe = new Array(nodeCount).fill(0);
    const totalQ = Q * volume;
    const perNode = totalQ / nodeCount;
    for (let i = 0; i < nodeCount; i++) {
      fe[i] = perNode;
    }
    return fe;
  }
}
