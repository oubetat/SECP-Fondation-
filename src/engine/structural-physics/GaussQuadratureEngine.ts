/**
 * PATCH-SECP-073.2: Gauss Quadrature Engine
 * Provides integration points and weights for numerical integration
 * over isoparametric elements (1D, 2D Quads, 3D Hexes).
 */

export interface GaussPoint {
  xi: number;
  eta: number;
  zeta: number;
  weight: number;
}

export class GaussQuadratureEngine {
  /**
   * Returns integration points for a 2D Quad element.
   * Order 2 yields a 2x2 rule (4 points), exact for polynomials up to degree 3.
   */
  public static getQuadPoints(order: number = 2): GaussPoint[] {
    if (order === 2) {
      const pt = 1.0 / Math.sqrt(3.0);
      return [
        { xi: -pt, eta: -pt, zeta: 0, weight: 1.0 },
        { xi:  pt, eta: -pt, zeta: 0, weight: 1.0 },
        { xi:  pt, eta:  pt, zeta: 0, weight: 1.0 },
        { xi: -pt, eta:  pt, zeta: 0, weight: 1.0 }
      ];
    }
    throw new Error(`Quad Gauss rule for order ${order} not implemented.`);
  }

  /**
   * Returns integration points for a 3D Hexahedral element (2x2x2 = 8 points).
   */
  public static getHexPoints(order: number = 2): GaussPoint[] {
    if (order === 2) {
      const pt = 1.0 / Math.sqrt(3.0);
      const points: GaussPoint[] = [];
      for (const xi of [-pt, pt]) {
        for (const eta of [-pt, pt]) {
          for (const zeta of [-pt, pt]) {
            points.push({ xi, eta, zeta, weight: 1.0 }); // 1 * 1 * 1
          }
        }
      }
      return points;
    }
    throw new Error(`Hex Gauss rule for order ${order} not implemented.`);
  }
}
