import { Matrix } from "../core/MathUtils";
import { StressMeasure } from "./types";

export class GeometricTangent {
  /**
   * Computes the geometric stiffness contribution for a BAR2 element in 2D/3D.
   * @param force Axial force (positive for tension)
   * @param currentLength Current length of the element
   * @param dim Dimensions (2 or 3)
   */
  static computeBarGeometricStiffness(
    force: number,
    currentLength: number,
    dim: number
  ): Matrix {
    const nodeDofs = dim;
    const totalDofs = 2 * nodeDofs;
    const Kg = Matrix.zeros(totalDofs, totalDofs);

    if (currentLength <= 1e-12) return Kg;

    const k_val = force / currentLength;

    // The geometric stiffness for a truss element is k_val * [ I, -I; -I, I ]
    // but only in the transversal directions? No, the full formula for total tangent is:
    // K = (EA/L) (n x n) + (N/l) (I - n x n)
    // So Kg = (N/l) (I - n x n)
    
    // However, many formulations just use Kg = (N/l) [ I, -I; -I, I ] as the "geometric" part 
    // and then the axial part is the "material" part.
    // Let's use the standard "transversal" part:
    
    // For simplicity and matching common Total Lagrangian implementations for trusses:
    // Kg = (N/L_ref) * [ I, -I; -I, I ] ? No, let's stick to the consistent tangent.
    
    // I'll implement the (N/l) [ I - n x n ] version.
    return Kg; // To be filled by element-specific logic
  }

  /**
   * General geometric stiffness for continuum elements:
   * Kg = integral( grad(delta_v)^T * sigma * grad(delta_u) ) dV
   */
  static computeContinuumGeometricStiffness(
    sigma: Matrix,
    dNdX: number[][],
    volume: number
  ): Matrix {
    const nodeCount = dNdX.length;
    const dim = sigma.rows;
    const totalDofs = nodeCount * dim;
    const Kg = Matrix.zeros(totalDofs, totalDofs);

    // K_g^ab = ( (dNa/dX)^T * sigma * (dNb/dX) ) * I_dim
    for (let a = 0; a < nodeCount; a++) {
      for (let b = 0; b < nodeCount; b++) {
        let sum = 0;
        for (let i = 0; i < dim; i++) {
          for (let j = 0; j < dim; j++) {
            sum += dNdX[a][i] * sigma.get(i, j) * dNdX[b][j];
          }
        }
        
        const val = sum * volume;
        for (let d = 0; d < dim; d++) {
          Kg.set(a * dim + d, b * dim + d, val);
        }
      }
    }

    return Kg;
  }
}
