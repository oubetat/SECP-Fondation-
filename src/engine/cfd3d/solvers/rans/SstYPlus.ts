/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-064: Y+ Calculator
 */

export class SstYPlus {
  public static compute(
    wallDistance: readonly number[],
    meanVelocity: readonly (readonly [number, number, number])[],
    density: number,
    viscosity: number
  ): number[] {
    const yPlus: number[] = [];
    const size = wallDistance.length;
    for (let i = 0; i < size; i++) {
      const y = wallDistance[i];
      const vel = meanVelocity[i] || [0, 0, 0];
      const uMag = Math.sqrt(vel[0] * vel[0] + vel[1] * vel[1] + vel[2] * vel[2]);
      
      // Calculate friction velocity proxy u_tau = sqrt(tau_w / rho) ~ sqrt(C_f / 2) * U
      // For a boundary layer, friction velocity is typically around 0.05 * U_mean
      const uTau = Math.max(0.05 * uMag, 1e-4);
      
      // y+ = rho * y * u_tau / mu
      const yp = (density * y * uTau) / Math.max(viscosity, 1e-6);
      yPlus.push(yp);
    }
    return yPlus;
  }
}
