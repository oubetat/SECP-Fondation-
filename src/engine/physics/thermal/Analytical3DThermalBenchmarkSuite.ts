/**
 * SECP Industrial OS — Engineering Truth OS
 * Analytical3DThermalBenchmarkSuite.ts
 *
 * SECP-PHYSICS-EXPANSION-004C: Independent 3D Thermal Flux Verification & Oracle Independence Audit.
 *
 * Standalone 3D Analytical Thermal Conduction Benchmark Reference Suite.
 * Provides three closed-form, mathematically rigorous 3D reference solutions:
 *
 * 1. Benchmark Case 1: Pure 1D Linear Temperature Field in 3D Domain (Zero Source q_vol = 0)
 *    T(x,y,z) = T_in + (T_out - T_in) * (x / Lx)
 *    q(x,y,z) = -k * (T_out - T_in) / Lx * i
 *
 * 2. Benchmark Case 2: 3D Nonuniform Quadratic Heating with Mixed BCs
 *    T(x,y,z) = T_0 + (q_vol / (2*k)) * (2*Lx*x - x^2)
 *    q(x,y,z) = -q_vol * (Lx - x) * i
 *
 * 3. Benchmark Case 3: 3D Harmonic Temperature Box with Opposite Outward Fluxes (q_vol = 0)
 *    T(x,y,z) = T_0 + Cx*x + Cy*y + Cz*z
 *    q(x,y,z) = -k * (Cx*i + Cy*j + Cz*k)
 *
 * CRITICAL RULE:
 * This suite MUST NOT import any production solver, auditor, or FE engine code.
 * All analytical derivations are standalone, self-contained, and mathematically pure.
 */

export interface BenchmarkCaseParams {
  lengthXM: number;            // Lx [m]
  lengthYM: number;            // Ly [m]
  lengthZM: number;            // Lz [m]
  conductivityW_mK: number;     // k [W/(m*K)]
  volumetricHeatW_m3: number;  // q_vol [W/m^3]
  boundaryTempInletC: number;  // T_in [C]
  boundaryTempOutletC: number; // T_out [C]
  gradCoeffs?: { Cx: number; Cy: number; Cz: number }; // For 3D multi-directional linear case
}

export interface AnalyticalPointEvaluation3D {
  x: number;
  y: number;
  z: number;
  analyticalTempC: number;
  analyticalGradTC_per_m: [number, number, number];
  analyticalHeatFluxW_per_m2: [number, number, number];
}

export interface SurfaceFluxDetail {
  faceName: string;
  outwardUnitNormal: [number, number, number];
  areaM2: number;
  outwardFluxRateWatts: number;
}

export interface AnalyticalBenchmark3DResult {
  caseId: string;
  caseDescription: string;
  params: BenchmarkCaseParams;
  volumeM3: number;
  totalVolumetricHeatWatts: number;
  surfaceFluxDetails: SurfaceFluxDetail[];
  totalOutwardBoundaryFluxWatts: number;
  totalDirichletReactionWatts: number;
  globalEnergyBalanceResidualWatts: number;
  maxTemperatureC: number;
  maxTemperatureLocationM: [number, number, number];
}

export interface FEVerificationEvaluation {
  meshLevel: number;
  meshSizeH: number;
  elementCount: number;
  nodeCount: number;
  rawL2NodalTempErrorC: number;
  rawLInfNodalTempErrorC: number;
  rawDirectSurfaceFluxErrorWatts: number;
  rawDirectSurfaceFluxRelativeError: number;
  rawReactionSumErrorWatts: number;
  rawReactionSumRelativeError: number;
  rawGlobalEnergyResidualWatts: number;
  empiricalFluxConvergenceRate?: number;
  empiricalTempConvergenceRate?: number;
}

export class Analytical3DThermalBenchmarkSuite {

  /**
   * Benchmark Case 1: Pure Linear Temperature Field in 3D Domain (q_vol = 0).
   */
  public static evaluateCase1_Linear1DIn3D(
    params: BenchmarkCaseParams
  ): AnalyticalBenchmark3DResult {
    const { lengthXM: Lx, lengthYM: Ly, lengthZM: Lz, conductivityW_mK: k, boundaryTempInletC: Tin, boundaryTempOutletC: Tout } = params;
    const volumeM3 = Lx * Ly * Lz;
    const totalVolumetricHeatWatts = 0.0;

    const gradX = (Tout - Tin) / Lx;
    const fluxX = -k * gradX; // q_x = -k * dT/dx

    const areaX = Ly * Lz;
    const areaY = Lx * Lz;
    const areaZ = Lx * Ly;

    // Outward flux on each face:
    // x=0 face: n = (-1, 0, 0) => q_n = fluxX * (-1) = k*(Tin - Tout)/Lx
    const fluxFaceX0 = fluxX * (-1.0) * areaX;
    // x=Lx face: n = (+1, 0, 0) => q_n = fluxX * (+1) = -k*(Tin - Tout)/Lx
    const fluxFaceXLx = fluxX * (+1.0) * areaX;

    const surfaceFluxDetails: SurfaceFluxDetail[] = [
      { faceName: "X_INLET (x=0)", outwardUnitNormal: [-1, 0, 0], areaM2: areaX, outwardFluxRateWatts: fluxFaceX0 },
      { faceName: "X_OUTLET (x=Lx)", outwardUnitNormal: [1, 0, 0], areaM2: areaX, outwardFluxRateWatts: fluxFaceXLx },
      { faceName: "Y_MIN (y=0)", outwardUnitNormal: [0, -1, 0], areaM2: areaY, outwardFluxRateWatts: 0 },
      { faceName: "Y_MAX (y=Ly)", outwardUnitNormal: [0, 1, 0], areaM2: areaY, outwardFluxRateWatts: 0 },
      { faceName: "Z_MIN (z=0)", outwardUnitNormal: [0, 0, -1], areaM2: areaZ, outwardFluxRateWatts: 0 },
      { faceName: "Z_MAX (z=Lz)", outwardUnitNormal: [0, 0, 1], areaM2: areaZ, outwardFluxRateWatts: 0 }
    ];

    const totalOutwardBoundaryFluxWatts = fluxFaceX0 + fluxFaceXLx; // = 0
    const totalDirichletReactionWatts = fluxFaceX0; // Heat entering domain at x=0

    return {
      caseId: "BENCHMARK_3D_CASE_1",
      caseDescription: "3D Linear Temperature Conduction (Zero Source, Constant Flux)",
      params,
      volumeM3,
      totalVolumetricHeatWatts,
      surfaceFluxDetails,
      totalOutwardBoundaryFluxWatts,
      totalDirichletReactionWatts,
      globalEnergyBalanceResidualWatts: Math.abs(totalVolumetricHeatWatts - totalOutwardBoundaryFluxWatts),
      maxTemperatureC: Math.max(Tin, Tout),
      maxTemperatureLocationM: Tin >= Tout ? [0, 0, 0] : [Lx, 0, 0]
    };
  }

  /**
   * Benchmark Case 2: 3D Quadratic Joule Heating with Insulated End and Side Walls.
   */
  public static evaluateCase2_QuadraticJouleHeating(
    params: BenchmarkCaseParams
  ): AnalyticalBenchmark3DResult {
    const { lengthXM: Lx, lengthYM: Ly, lengthZM: Lz, conductivityW_mK: k, volumetricHeatW_m3: q_vol, boundaryTempInletC: T0 } = params;
    const volumeM3 = Lx * Ly * Lz;
    const totalVolumetricHeatWatts = q_vol * volumeM3;

    const areaX = Ly * Lz;
    const areaY = Lx * Lz;
    const areaZ = Lx * Ly;

    // At x=0: q_x(0) = -q_vol * Lx. n = (-1, 0, 0) => q_n = (-q_vol * Lx) * (-1) = q_vol * Lx.
    // Integrated outward flux rate at x=0 = q_vol * Lx * Ly * Lz = Q_vol
    const fluxFaceX0 = q_vol * volumeM3;
    // At x=Lx: q_x(Lx) = 0.
    const fluxFaceXLx = 0.0;

    const surfaceFluxDetails: SurfaceFluxDetail[] = [
      { faceName: "DIRICHLET_BASE (x=0)", outwardUnitNormal: [-1, 0, 0], areaM2: areaX, outwardFluxRateWatts: fluxFaceX0 },
      { faceName: "ADIABATIC_END (x=Lx)", outwardUnitNormal: [1, 0, 0], areaM2: areaX, outwardFluxRateWatts: fluxFaceXLx },
      { faceName: "LATERAL_Y0 (y=0)", outwardUnitNormal: [0, -1, 0], areaM2: areaY, outwardFluxRateWatts: 0 },
      { faceName: "LATERAL_YMAX (y=Ly)", outwardUnitNormal: [0, 1, 0], areaM2: areaY, outwardFluxRateWatts: 0 },
      { faceName: "LATERAL_Z0 (z=0)", outwardUnitNormal: [0, 0, -1], areaM2: areaZ, outwardFluxRateWatts: 0 },
      { faceName: "LATERAL_ZMAX (z=Lz)", outwardUnitNormal: [0, 0, 1], areaM2: areaZ, outwardFluxRateWatts: 0 }
    ];

    const maxTempC = T0 + (q_vol * Lx * Lx) / (2.0 * k);

    return {
      caseId: "BENCHMARK_3D_CASE_2",
      caseDescription: "3D Nonuniform Quadratic Thermal Source with Dirichlet & Adiabatic BCs",
      params,
      volumeM3,
      totalVolumetricHeatWatts,
      surfaceFluxDetails,
      totalOutwardBoundaryFluxWatts: fluxFaceX0,
      totalDirichletReactionWatts: fluxFaceX0,
      globalEnergyBalanceResidualWatts: Math.abs(totalVolumetricHeatWatts - fluxFaceX0),
      maxTemperatureC: maxTempC,
      maxTemperatureLocationM: [Lx, Ly / 2, Lz / 2]
    };
  }

  /**
   * Benchmark Case 3: Multi-Directional 3D Harmonic Box with Opposite Outward Fluxes.
   */
  public static evaluateCase3_MultiDirectionalHarmonicBox(
    params: BenchmarkCaseParams
  ): AnalyticalBenchmark3DResult {
    const { lengthXM: Lx, lengthYM: Ly, lengthZM: Lz, conductivityW_mK: k, boundaryTempInletC: T0 } = params;
    const { Cx, Cy, Cz } = params.gradCoeffs ?? { Cx: 100, Cy: 200, Cz: 300 };

    const volumeM3 = Lx * Ly * Lz;
    const totalVolumetricHeatWatts = 0.0;

    const areaX = Ly * Lz;
    const areaY = Lx * Lz;
    const areaZ = Lx * Ly;

    // q = -k * (Cx*i + Cy*j + Cz*k)
    // Outward flux on each face:
    const fluxX0 = (-k * Cx) * (-1.0) * areaX;  // +k * Cx * areaX
    const fluxXLx = (-k * Cx) * (+1.0) * areaX; // -k * Cx * areaX
    const fluxY0 = (-k * Cy) * (-1.0) * areaY;  // +k * Cy * areaY
    const fluxYLy = (-k * Cy) * (+1.0) * areaY; // -k * Cy * areaY
    const fluxZ0 = (-k * Cz) * (-1.0) * areaZ;  // +k * Cz * areaZ
    const fluxZLz = (-k * Cz) * (+1.0) * areaZ; // -k * Cz * areaZ

    const surfaceFluxDetails: SurfaceFluxDetail[] = [
      { faceName: "FACE_X0 (x=0)", outwardUnitNormal: [-1, 0, 0], areaM2: areaX, outwardFluxRateWatts: fluxX0 },
      { faceName: "FACE_XLx (x=Lx)", outwardUnitNormal: [1, 0, 0], areaM2: areaX, outwardFluxRateWatts: fluxXLx },
      { faceName: "FACE_Y0 (y=0)", outwardUnitNormal: [0, -1, 0], areaM2: areaY, outwardFluxRateWatts: fluxY0 },
      { faceName: "FACE_YLy (y=Ly)", outwardUnitNormal: [0, 1, 0], areaM2: areaY, outwardFluxRateWatts: fluxYLy },
      { faceName: "FACE_Z0 (z=0)", outwardUnitNormal: [0, 0, -1], areaM2: areaZ, outwardFluxRateWatts: fluxZ0 },
      { faceName: "FACE_ZLz (z=Lz)", outwardUnitNormal: [0, 0, 1], areaM2: areaZ, outwardFluxRateWatts: fluxZLz }
    ];

    const totalOutwardBoundaryFluxWatts = fluxX0 + fluxXLx + fluxY0 + fluxYLy + fluxZ0 + fluxZLz; // 0.0
    // Total Dirichlet reaction force sum for all prescribed nodes = sum of heat entering domain = sum of positive inward fluxes
    const totalDirichletReactionWatts = (Math.max(0, fluxX0) + Math.max(0, fluxXLx) +
                                           Math.max(0, fluxY0) + Math.max(0, fluxYLy) +
                                           Math.max(0, fluxZ0) + Math.max(0, fluxZLz));

    const maxTempC = T0 + Cx * Lx + Cy * Ly + Cz * Lz;

    return {
      caseId: "BENCHMARK_3D_CASE_3",
      caseDescription: "3D Multi-Directional Harmonic Conduction Box with Opposite Wall Fluxes",
      params,
      volumeM3,
      totalVolumetricHeatWatts,
      surfaceFluxDetails,
      totalOutwardBoundaryFluxWatts,
      totalDirichletReactionWatts,
      globalEnergyBalanceResidualWatts: Math.abs(totalVolumetricHeatWatts - totalOutwardBoundaryFluxWatts),
      maxTemperatureC: maxTempC,
      maxTemperatureLocationM: [Lx, Ly, Lz]
    };
  }

  /**
   * Point evaluation helper for Case 1.
   */
  public static evaluatePointCase1(x: number, y: number, z: number, params: BenchmarkCaseParams): AnalyticalPointEvaluation3D {
    const { lengthXM: Lx, conductivityW_mK: k, boundaryTempInletC: Tin, boundaryTempOutletC: Tout } = params;
    const gradX = (Tout - Tin) / Lx;
    const tempC = Tin + gradX * Math.max(0, Math.min(Lx, x));
    return {
      x, y, z,
      analyticalTempC: tempC,
      analyticalGradTC_per_m: [gradX, 0, 0],
      analyticalHeatFluxW_per_m2: [-k * gradX, 0, 0]
    };
  }

  /**
   * Point evaluation helper for Case 2.
   */
  public static evaluatePointCase2(x: number, y: number, z: number, params: BenchmarkCaseParams): AnalyticalPointEvaluation3D {
    const { lengthXM: Lx, conductivityW_mK: k, volumetricHeatW_m3: q_vol, boundaryTempInletC: T0 } = params;
    const xc = Math.max(0, Math.min(Lx, x));
    const tempC = T0 + (q_vol / (2.0 * k)) * (2.0 * Lx * xc - xc * xc);
    const gradX = (q_vol / k) * (Lx - xc);
    return {
      x, y, z,
      analyticalTempC: tempC,
      analyticalGradTC_per_m: [gradX, 0, 0],
      analyticalHeatFluxW_per_m2: [-k * gradX, 0, 0]
    };
  }

  /**
   * Point evaluation helper for Case 3.
   */
  public static evaluatePointCase3(x: number, y: number, z: number, params: BenchmarkCaseParams): AnalyticalPointEvaluation3D {
    const { conductivityW_mK: k, boundaryTempInletC: T0 } = params;
    const { Cx, Cy, Cz } = params.gradCoeffs ?? { Cx: 100, Cy: 200, Cz: 300 };
    const tempC = T0 + Cx * x + Cy * y + Cz * z;
    return {
      x, y, z,
      analyticalTempC: tempC,
      analyticalGradTC_per_m: [Cx, Cy, Cz],
      analyticalHeatFluxW_per_m2: [-k * Cx, -k * Cy, -k * Cz]
    };
  }

  /**
   * Calculates empirical convergence rates p = ln(E1 / E2) / ln(h1 / h2) directly from raw error array.
   */
  public static calculateEmpiricalConvergenceRates(
    meshSizesH: number[],
    rawErrors: number[]
  ): number[] {
    const rates: number[] = [];
    for (let i = 1; i < meshSizesH.length; i++) {
      const h1 = meshSizesH[i - 1];
      const h2 = meshSizesH[i];
      const e1 = rawErrors[i - 1];
      const e2 = rawErrors[i];

      if (e1 > 0 && e2 > 0 && h1 !== h2) {
        const rate = Math.log(e1 / e2) / Math.log(h1 / h2);
        rates.push(rate);
      } else {
        rates.push(0);
      }
    }
    return rates;
  }
}
