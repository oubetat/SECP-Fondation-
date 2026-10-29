/**
 * SECP Industrial OS — Engineering Truth OS
 * AnalyticalThermal1DReference.ts
 *
 * Standalone 1D Analytical Steady-State Thermal Conduction Reference.
 *
 * Solves: -k * d2T/dx2 = q_vol  on x in [0, L]
 * BCs:
 *   T(0) = T_0 (Prescribed Dirichlet)
 *   q(L) = -k * dT/dx(L) = 0 (Adiabatic Neumann)
 *
 * Analytical Solutions:
 * 1. Temperature field: T(x) = T_0 + (q_vol / k) * (L*x - x^2 / 2)
 * 2. Temperature gradient: dT/dx(x) = (q_vol / k) * (L - x)
 * 3. Heat flux vector: q(x) = -k * dT/dx = (-q_vol * (L - x), 0, 0)
 * 4. Outward Dirichlet normal flux rate at x=0: Phi_Dirichlet = q_vol * L * W * H = q_vol * Volume
 * 5. Volumetric heat generation: Q_vol = q_vol * L * W * H
 * 6. Variational nodal reaction at x=0: R_sink = -q_vol * Volume
 *
 * CRITICAL RULE:
 * This module MUST NOT import any solver, auditor, or FE engine code.
 * It serves as an uncorrupted, independent ground-truth oracle.
 */

export interface Thermal1DProblemParams {
  lengthM: number;          // L [m]
  widthM: number;           // W [m]
  heightM: number;          // H [m]
  conductivityW_mK: number; // k [W/(m*K)]
  volumetricHeatW_m3: number; // q_vol [W/m^3]
  boundaryTempC: number;    // T_0 [C]
}

export interface AnalyticalThermal1DPointResult {
  x: number;
  y: number;
  z: number;
  analyticalTempC: number;
  analyticalGradTC_per_m: [number, number, number];
  analyticalHeatFluxW_per_m2: [number, number, number];
}

export interface AnalyticalThermal1DGlobalResult {
  params: Thermal1DProblemParams;
  volumeM3: number;
  totalVolumetricHeatWatts: number;
  totalBoundaryReactionHeatWatts: number;
  outwardDirichletFluxWatts: number;
  maxTemperatureC: number;
  maxTemperatureLocationM: number;
}

export class AnalyticalThermal1DReference {
  /**
   * Evaluates exact analytical solution at a specific 3D coordinate (x, y, z).
   */
  public static evaluateAtPoint(
    x: number,
    y: number,
    z: number,
    params: Thermal1DProblemParams
  ): AnalyticalThermal1DPointResult {
    const { lengthM: L, conductivityW_mK: k, volumetricHeatW_m3: q, boundaryTempC: T0 } = params;

    // Clamp or check bounds
    const x_clamped = Math.max(0, Math.min(L, x));

    // Exact T(x)
    const T = T0 + (q / k) * (L * x_clamped - 0.5 * x_clamped * x_clamped);

    // Exact dT/dx = (q/k) * (L - x)
    const gradX = (q / k) * (L - x_clamped);
    const gradT: [number, number, number] = [gradX, 0, 0];

    // Exact q_x = -k * dT/dx = -q * (L - x)
    const fluxX = -k * gradX;
    const flux: [number, number, number] = [fluxX, 0, 0];

    return {
      x,
      y,
      z,
      analyticalTempC: T,
      analyticalGradTC_per_m: gradT,
      analyticalHeatFluxW_per_m2: flux
    };
  }

  /**
   * Evaluates global integrated analytical heat, fluxes, and maximums.
   */
  public static evaluateGlobalResult(params: Thermal1DProblemParams): AnalyticalThermal1DGlobalResult {
    const { lengthM: L, widthM: W, heightM: H, conductivityW_mK: k, volumetricHeatW_m3: q, boundaryTempC: T0 } = params;

    const volumeM3 = L * W * H;
    const totalVolumetricHeatWatts = q * volumeM3;

    // At x=0, outward unit normal n = (-1, 0, 0).
    // q(0) = (-q*L, 0, 0).
    // q_n = q(0) . n = (-q*L)*(-1) = +q*L.
    // Phi_Dirichlet = q_n * Area = (q*L) * (W*H) = q * V.
    const outwardDirichletFluxWatts = q * volumeM3;

    // Variational reaction at x=0 heat sink: R_0 = -q * V (heat leaving domain = +q * V)
    const totalBoundaryReactionHeatWatts = q * volumeM3;

    // Peak temperature occurs at x = L (insulated end): T_max = T_0 + q * L^2 / (2 k)
    const maxTemperatureC = T0 + (q * L * L) / (2.0 * k);

    return {
      params,
      volumeM3,
      totalVolumetricHeatWatts,
      totalBoundaryReactionHeatWatts,
      outwardDirichletFluxWatts,
      maxTemperatureC,
      maxTemperatureLocationM: L
    };
  }
}
