/**
 * PATCH-SECP-073.1: Shape Function Engine
 * Computes shape functions (N), Jacobian determinants, and strain-displacement matrices [B].
 * Currently implements CST (Constant Strain Triangle) for 2D linear elastic problems.
 */

import { MeshNode } from './StructuralPhysicsTypes';

export class ShapeFunctionEngine {
  /**
   * Calculates the area and the [B] matrix for a 3-node Constant Strain Triangle (CST).
   * Nodes must be provided in counter-clockwise order.
   */
  public static formulateCSTTriangle(
    node1: MeshNode,
    node2: MeshNode,
    node3: MeshNode
  ): { area: number; B: number[][] } {
    const x1 = node1.x, y1 = node1.y;
    const x2 = node2.x, y2 = node2.y;
    const x3 = node3.x, y3 = node3.y;

    // Jacobian determinant (2 * Area)
    const detJ = (x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1);
    const area = Math.abs(detJ) / 2.0;

    if (area < 1e-12) {
      throw new Error(`Degenerate triangle element detected with nodes [${node1.id}, ${node2.id}, ${node3.id}]`);
    }

    // Shape function derivatives (Beta and Gamma)
    const b1 = y2 - y3;
    const b2 = y3 - y1;
    const b3 = y1 - y2;

    const c1 = x3 - x2;
    const c2 = x1 - x3;
    const c3 = x2 - x1;

    // Strain-Displacement Matrix [B] (3 x 6) for 2D
    const B = [
      [b1,  0, b2,  0, b3,  0].map(val => val / detJ),
      [ 0, c1,  0, c2,  0, c3].map(val => val / detJ),
      [c1, b1, c2, b2, c3, b3].map(val => val / detJ)
    ];

    return { area, B };
  }
}
