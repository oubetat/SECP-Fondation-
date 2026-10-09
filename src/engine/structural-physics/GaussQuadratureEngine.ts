/**
 * PATCH-SECP-073.2: Gauss Quadrature Engine
 * Provides integration points and weights for numerical integration
 * over isoparametric elements (1D, 2D Quads, 3D Hexes).
 * Fully implements standard Gauss-Legendre quadrature rules for orders 1, 2, and 3.
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
   * - Order 1: 1-point reduced integration (1 point, weight 4.0).
   * - Order 2: 2x2 standard full integration (4 points, weights 1.0), exact up to degree 3.
   * - Order 3: 3x3 high-order integration (9 points), exact up to degree 5.
   */
  public static getQuadPoints(order: number = 2): GaussPoint[] {
    if (order === 1) {
      return [{ xi: 0, eta: 0, zeta: 0, weight: 4.0 }];
    }

    if (order === 2) {
      const pt = 1.0 / Math.sqrt(3.0);
      return [
        { xi: -pt, eta: -pt, zeta: 0, weight: 1.0 },
        { xi:  pt, eta: -pt, zeta: 0, weight: 1.0 },
        { xi:  pt, eta:  pt, zeta: 0, weight: 1.0 },
        { xi: -pt, eta:  pt, zeta: 0, weight: 1.0 }
      ];
    }

    if (order === 3) {
      const pt = Math.sqrt(3.0 / 5.0);
      const coords = [-pt, 0, pt];
      const weights = [5.0 / 9.0, 8.0 / 9.0, 5.0 / 9.0];
      const points: GaussPoint[] = [];

      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          points.push({
            xi: coords[i],
            eta: coords[j],
            zeta: 0,
            weight: weights[i] * weights[j]
          });
        }
      }
      return points;
    }

    throw new Error(`Quad Gauss rule for order ${order} not supported. Valid orders are 1, 2, or 3.`);
  }

  /**
   * Returns integration points for a 3D Hexahedral element.
   * - Order 1: 1-point reduced integration (1 point, weight 8.0).
   * - Order 2: 2x2x2 standard full integration (8 points, weights 1.0), exact up to degree 3.
   * - Order 3: 3x3x3 high-order integration (27 points), exact up to degree 5.
   */
  public static getHexPoints(order: number = 2): GaussPoint[] {
    if (order === 1) {
      return [{ xi: 0, eta: 0, zeta: 0, weight: 8.0 }];
    }

    if (order === 2) {
      const pt = 1.0 / Math.sqrt(3.0);
      const points: GaussPoint[] = [];
      for (const xi of [-pt, pt]) {
        for (const eta of [-pt, pt]) {
          for (const zeta of [-pt, pt]) {
            points.push({ xi, eta, zeta, weight: 1.0 });
          }
        }
      }
      return points;
    }

    if (order === 3) {
      const pt = Math.sqrt(3.0 / 5.0);
      const coords = [-pt, 0, pt];
      const weights = [5.0 / 9.0, 8.0 / 9.0, 5.0 / 9.0];
      const points: GaussPoint[] = [];

      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          for (let k = 0; k < 3; k++) {
            points.push({
              xi: coords[i],
              eta: coords[j],
              zeta: coords[k],
              weight: weights[i] * weights[j] * weights[k]
            });
          }
        }
      }
      return points;
    }

    throw new Error(`Hex Gauss rule for order ${order} not supported. Valid orders are 1, 2, or 3.`);
  }
}
