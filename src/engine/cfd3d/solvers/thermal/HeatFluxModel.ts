/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-327: Fourier Heat Flux Model
 */

export interface HeatFluxVector {
  x: number;
  y: number;
  z: number;
  magnitude: number;
}

export class HeatFluxModel {
  /**
   * Computes Fourier heat flux vector: q = -k * grad(T)
   */
  public static calculateFourierFlux(
    conductivity: number,
    gradT: [number, number, number] | { x: number; y: number; z: number }
  ): HeatFluxVector {
    const gx = Array.isArray(gradT) ? gradT[0] : gradT.x;
    const gy = Array.isArray(gradT) ? gradT[1] : gradT.y;
    const gz = Array.isArray(gradT) ? gradT[2] : gradT.z;

    const qx = -conductivity * gx;
    const qy = -conductivity * gy;
    const qz = -conductivity * gz;
    const magnitude = Math.sqrt(qx * qx + qy * qy + qz * qz);

    return { x: qx, y: qy, z: qz, magnitude };
  }

  /**
   * Computes heat flux field across an array of control volumes
   */
  public static calculateFieldFlux(
    conductivity: number[],
    gradT: [number, number, number][]
  ): {
    x: number[];
    y: number[];
    z: number[];
    magnitude: number[];
  } {
    const n = Math.min(conductivity.length, gradT.length);
    const x = new Array<number>(n);
    const y = new Array<number>(n);
    const z = new Array<number>(n);
    const magnitude = new Array<number>(n);

    for (let i = 0; i < n; i++) {
      const k = conductivity[i];
      const g = gradT[i];
      const qx = -k * g[0];
      const qy = -k * g[1];
      const qz = -k * g[2];

      x[i] = qx;
      y[i] = qy;
      z[i] = qz;
      magnitude[i] = Math.sqrt(qx * qx + qy * qy + qz * qz);
    }

    return { x, y, z, magnitude };
  }
}
