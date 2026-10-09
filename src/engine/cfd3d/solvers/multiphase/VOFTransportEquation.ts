/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-252 — Volume of Fluid (VOF) Transport Equation Solver
 */

export interface VOFTransportResult {
  readonly alphaNew: number[];
  readonly overshoots: number;
  readonly undershoots: number;
  readonly totalClippedVolume: number; // Volume lost/gained by clipping
  readonly phaseResidual: number;
}

export class VOFTransportEquation {
  /**
   * Numerically solves the VOF transport equation for a single time step:
   * d(alpha)/dt + div(alpha * U) = S_alpha
   * Using upwind scheme with algebraic interface compression and boundedness limiters.
   */
  public static solveAdvection(
    alpha: number[],
    velocity: [number, number, number][],
    dx: number,
    dt: number,
    nx: number,
    ny: number,
    nz: number,
    neighborsList: number[][],
    compressionFactor: number = 1.0 // Interface sharpening strength
  ): VOFTransportResult {
    const size = alpha.length;
    const alphaNew = [...alpha];
    const volume = dx * dx * dx;
    const faceArea = dx * dx;

    let overshoots = 0;
    let undershoots = 0;
    let totalClippedVolume = 0;

    // Standard SOR or Explicit donor-acceptor flux integration
    const fluxes = new Array(size).fill(0.0);

    // Compute cell-to-cell fluxes
    for (let i = 0; i < size; i++) {
      const z = Math.floor(i / (nx * ny));
      const y = Math.floor((i % (nx * ny)) / nx);
      const x = i % nx;

      const vel = velocity[i] || [0.0, 0.0, 0.0];
      const neighs = neighborsList[i];

      // Integrate fluxes through faces
      let netFlux = 0;

      for (const n of neighs) {
        // Find direction vector from i to n
        const z_n = Math.floor(n / (nx * ny));
        const y_n = Math.floor((n % (nx * ny)) / nx);
        const x_n = n % nx;

        const normal = [x_n - x, y_n - y, z_n - z];
        const mag = Math.sqrt(normal[0]*normal[0] + normal[1]*normal[1] + normal[2]*normal[2]) || 1;
        const normHat = normal.map(v => v / mag);

        // Project velocity onto face normal
        const un = vel[0]*normHat[0] + vel[1]*normHat[1] + vel[2]*normHat[2];

        // 1. Upwind scheme donor phase fraction
        let alphaFace = un > 0 ? alpha[i] : alpha[n];

        // 2. Interface Compression (MULES-like sharpening):
        // Adds compressive velocity term u_r = compressionFactor * |u_f| * normal
        if (compressionFactor > 0) {
          const alphaComp = alphaFace * (1.0 - alphaFace);
          const ur = compressionFactor * Math.abs(un);
          const compressionFlux = ur * alphaComp;
          alphaFace += compressionFlux * (un > 0 ? 1 : -1);
        }

        // Convective flux = alphaFace * un * faceArea
        const flux = alphaFace * un * faceArea;
        netFlux += flux;
      }

      fluxes[i] = netFlux;
    }

    // Update phase fraction: alpha_new = alpha_old - (dt/volume) * netFlux
    let l2Diff = 0.0;
    for (let i = 0; i < size; i++) {
      const delta = -(dt / volume) * fluxes[i];
      let val = alpha[i] + delta;

      // Detect & log out-of-bounds (overshoot/undershoot) for the audit
      if (val > 1.0) {
        overshoots++;
        totalClippedVolume += (val - 1.0) * volume;
        val = 1.0;
      } else if (val < 0.0) {
        undershoots++;
        totalClippedVolume += Math.abs(val) * volume;
        val = 0.0;
      }

      alphaNew[i] = val;
      const diff = val - alpha[i];
      l2Diff += diff * diff;
    }

    const phaseResidual = Math.sqrt(l2Diff / size);

    return {
      alphaNew,
      overshoots,
      undershoots,
      totalClippedVolume,
      phaseResidual
    };
  }
}
