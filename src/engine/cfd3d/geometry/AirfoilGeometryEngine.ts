/**
 * SECP Industrial OS v2 — CFD Geometry Engine
 * PATCH-070: Deterministic Airfoil Geometry (NACA 4-Digit)
 */

export interface AirfoilPoint {
  x: number;
  yUpper: number;
  yLower: number;
  thickness: number;
  camber: number;
  nxUpper: number;
  nyUpper: number;
  nxLower: number;
  nyLower: number;
}

export interface AirfoilGeometry {
  designation: string;
  chord: number;
  points: AirfoilPoint[];
  hash: string;
  discreteHash: string;
}

export class AirfoilGeometryEngine {
  /**
   * Generates NACA 4-digit airfoil coordinates with cosine spacing.
   * Standard analytical distribution:
   * y_t = 5t * (0.2969*sqrt(x) - 0.1260*x - 0.3516*x^2 + 0.2843*x^3 - 0.1015*x^4)
   */
  public static generateNaca4(
    designation: string,
    chord: number = 1.0,
    numPoints: number = 100
  ): AirfoilGeometry {
    if (designation.length !== 4) {
      throw new Error(`INVALID_NACA_DESIGNATION: Expected 4 digits, found "${designation}"`);
    }

    const m = parseInt(designation[0]) / 100.0; // Max camber
    const p = parseInt(designation[1]) / 10.0;  // Position of max camber
    const t = parseInt(designation.substring(2)) / 100.0; // Max thickness

    const points: AirfoilPoint[] = [];

    for (let i = 0; i <= numPoints; i++) {
      // Cosine spacing for better resolution at LE and TE
      const theta = (i * Math.PI) / numPoints;
      const x = 0.5 * chord * (1.0 - Math.cos(theta));
      const xc = x / chord;

      // Thickness distribution
      const yt = 5.0 * t * chord * (
        0.2969 * Math.sqrt(xc) -
        0.1260 * xc -
        0.3516 * Math.pow(xc, 2) +
        0.2843 * Math.pow(xc, 3) -
        0.1015 * Math.pow(xc, 4)
      );

      // Camber line and gradient
      let yc = 0;
      let dyc_dx = 0;

      if (p > 0) {
        if (xc <= p) {
          yc = (m / (p * p)) * (2.0 * p * xc - xc * xc);
          dyc_dx = (2.0 * m / (p * p)) * (p - xc);
        } else {
          yc = (m / Math.pow(1.0 - p, 2)) * ((1.0 - 2.0 * p) + 2.0 * p * xc - xc * xc);
          dyc_dx = (2.0 * m / Math.pow(1.0 - p, 2)) * (p - xc);
        }
      }

      const zeta = Math.atan(dyc_dx);

      // Surface coordinates
      const xUpper = x - yt * Math.sin(zeta);
      const yUpper = yc + yt * Math.cos(zeta);
      const xLower = x + yt * Math.sin(zeta);
      const yLower = yc - yt * Math.cos(zeta);

      // Normals
      // Upper normal points "up" and "out"
      const nxUpper = -Math.sin(zeta);
      const nyUpper = Math.cos(zeta);
      // Lower normal points "down" and "out"
      const nxLower = Math.sin(zeta);
      const nyLower = -Math.cos(zeta);

      points.push({
        x,
        yUpper,
        yLower,
        thickness: 2.0 * yt,
        camber: yc,
        nxUpper,
        nyUpper,
        nxLower,
        nyLower
      });
    }

    return {
      designation,
      chord,
      points,
      hash: `naca-${designation}-${chord}-analytical-hash`,
      discreteHash: `naca-${designation}-${chord}-${numPoints}-discrete-hash`
    };
  }

  public static verifySymmetry(geo: AirfoilGeometry): boolean {
    const isSymmetricDesignation = geo.designation.startsWith('00');
    if (!isSymmetricDesignation) return false;

    for (const p of geo.points) {
      if (Math.abs(p.yUpper + p.yLower) > 1e-10) return false;
      if (Math.abs(p.camber) > 1e-10) return false;
    }
    return true;
  }
}
