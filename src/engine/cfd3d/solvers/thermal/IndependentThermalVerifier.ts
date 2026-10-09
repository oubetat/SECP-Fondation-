/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-327: Independent Thermal Physical Invariant Verifier
 */

import { ThermalState } from './ThermalTypes';
import { ThermalStateValidator, ThermalFailureCode } from './ThermalStateValidator';

export interface ThermalVerificationReport {
  isValid: boolean;
  temperaturePositivityPassed: boolean;
  propertiesPositivityPassed: boolean;
  fourierConsistencyPassed: boolean;
  energyConservationPassed: boolean;
  details: string[];
  maxDiscrepancy: number;
}

export interface AnalyticalConductionProof {
  passed: boolean;
  maxAbsoluteError: number;
  maxRelativeError: number;
  l2ErrorNorm: number;
  analyticalFlux: number;
  simulatedFlux: number;
  fluxError: number;
  details: string[];
}

export interface AnalyticalVolumetricProof {
  passed: boolean;
  maxAbsoluteError: number;
  maxRelativeError: number;
  simulatedPeakT: number;
  analyticalPeakT: number;
  details: string[];
}

export class IndependentThermalVerifier {
  /**
   * Independently audits a solved ThermalState for physical invariants.
   * Recalculates Fourier law and verifies positive temperature & properties.
   */
  public static verify(state: ThermalState): ThermalVerificationReport {
    const details: string[] = [];

    // 1. Audit State Validity
    const stateCheck = ThermalStateValidator.validate(
      state.temperature,
      state.thermalConductivity,
      state.specificHeat,
      state.density
    );

    const temperaturePositivityPassed = stateCheck.error !== ThermalFailureCode.NEGATIVE_TEMPERATURE &&
      stateCheck.error !== ThermalFailureCode.NAN_DETECTED &&
      stateCheck.error !== ThermalFailureCode.INFINITY_DETECTED;

    const propertiesPositivityPassed = stateCheck.valid;

    if (!temperaturePositivityPassed) {
      details.push(`Temperature positivity failed: ${stateCheck.message}`);
    }
    if (!propertiesPositivityPassed) {
      details.push(`Thermal properties positivity failed: ${stateCheck.message}`);
    }

    // 2. Independent Fourier Heat Flux Recalculation
    let fourierConsistencyPassed = true;
    let maxFourierError = 0.0;
    const n = state.temperature.length;

    for (let i = 0; i < n; i++) {
      const k = state.thermalConductivity[i];
      const g = state.gradT[i];
      if (k !== undefined && g !== undefined) {
        const expectedQx = -k * g[0];
        const expectedQy = -k * g[1];
        const expectedQz = -k * g[2];

        const errX = Math.abs((state.heatFluxX[i] ?? 0) - expectedQx);
        const errY = Math.abs((state.heatFluxY[i] ?? 0) - expectedQy);
        const errZ = Math.abs((state.heatFluxZ[i] ?? 0) - expectedQz);

        const localMaxErr = Math.max(errX, errY, errZ);
        if (localMaxErr > maxFourierError) {
          maxFourierError = localMaxErr;
        }

        if (localMaxErr > 1e-4) {
          fourierConsistencyPassed = false;
          details.push(`Fourier law discrepancy at cell ${i}: error=${localMaxErr.toExponential(3)} W/m^2`);
          break;
        }
      }
    }

    // 3. Diffusivity Invariant Recalculation
    let diffusivityPassed = true;
    for (let i = 0; i < n; i++) {
      const k = state.thermalConductivity[i];
      const rho = state.density[i];
      const cp = state.specificHeat[i];
      const alpha = state.thermalDiffusivity[i];
      if (k > 0 && rho > 0 && cp > 0 && alpha > 0) {
        const expectedAlpha = k / (rho * cp);
        if (Math.abs(alpha - expectedAlpha) > 1e-7) {
          diffusivityPassed = false;
          details.push(`Thermal diffusivity mismatch at cell ${i}: expected ${expectedAlpha}, got ${alpha}`);
          break;
        }
      }
    }

    const energyConservationPassed = (state.energyResidual ?? 0) < 1.0;
    const isValid = temperaturePositivityPassed && propertiesPositivityPassed && fourierConsistencyPassed && diffusivityPassed;

    return {
      isValid,
      temperaturePositivityPassed,
      propertiesPositivityPassed,
      fourierConsistencyPassed,
      energyConservationPassed,
      details,
      maxDiscrepancy: maxFourierError
    };
  }

  /**
   * Independent Energy Conservation Auditor:
   * Net Energy = Sum(Q_in) + Q_source - Sum(Q_out) - dE_storage/dt ≈ 0
   */
  public static verifyEnergyConservation(params: {
    totalHeatIn: number;
    totalHeatOut: number;
    totalSource: number;
    totalStorageRate?: number;
    tolerance?: number;
  }): {
    isConservative: boolean;
    imbalanceWatts: number;
    relativeImbalance: number;
  } {
    const { totalHeatIn, totalHeatOut, totalSource, totalStorageRate = 0.0, tolerance = 0.02 } = params;
    const netImbalance = Math.abs((totalHeatIn + totalSource) - (totalHeatOut + totalStorageRate));
    const scale = Math.max(Math.abs(totalHeatIn), Math.abs(totalHeatOut), Math.abs(totalSource), 1.0);
    const relativeImbalance = netImbalance / scale;
    const isConservative = relativeImbalance <= tolerance;

    return {
      isConservative,
      imbalanceWatts: netImbalance,
      relativeImbalance
    };
  }

  /**
   * Independent Analytical Oracle — 1D Steady Conduction
   * Exact solution: T(x) = T_hot + (T_cold - T_hot) * (x / L)
   * Exact heat flux: q = -k * (T_cold - T_hot) / L = k * (T_hot - T_cold) / L
   */
  public static verify1DAnalyticalConduction(
    L: number,
    k: number,
    T_hot: number,
    T_cold: number,
    simulatedProfile: number[],
    coordsX: number[]
  ): AnalyticalConductionProof {
    const details: string[] = [];
    let maxAbsoluteError = 0.0;
    let sumSqError = 0.0;
    const n = Math.min(simulatedProfile.length, coordsX.length);

    for (let i = 0; i < n; i++) {
      const x = coordsX[i];
      const T_exact = T_hot + (T_cold - T_hot) * (x / L);
      const T_sim = simulatedProfile[i];
      const absErr = Math.abs(T_sim - T_exact);

      if (absErr > maxAbsoluteError) {
        maxAbsoluteError = absErr;
      }
      sumSqError += absErr * absErr;
    }

    const l2ErrorNorm = Math.sqrt(sumSqError / Math.max(n, 1));
    const deltaT = Math.abs(T_hot - T_cold);
    const maxRelativeError = maxAbsoluteError / Math.max(deltaT, 1.0);

    const analyticalFlux = (k * (T_hot - T_cold)) / L;
    const simulatedFlux = n > 1 ? -k * (simulatedProfile[n - 1] - simulatedProfile[0]) / (coordsX[n - 1] - coordsX[0]) : analyticalFlux;
    const fluxError = Math.abs(simulatedFlux - analyticalFlux) / Math.max(Math.abs(analyticalFlux), 1.0);

    const passed = maxRelativeError < 0.02; // Within 2% of exact analytical solution
    details.push(`1D Conduction Oracle: Max Absolute Error = ${maxAbsoluteError.toFixed(5)} K (${(maxRelativeError * 100).toFixed(3)}%)`);
    details.push(`Analytical Heat Flux = ${analyticalFlux.toFixed(4)} W/m^2, Simulated = ${simulatedFlux.toFixed(4)} W/m^2 (Error: ${(fluxError * 100).toFixed(3)}%)`);

    return {
      passed,
      maxAbsoluteError,
      maxRelativeError,
      l2ErrorNorm,
      analyticalFlux,
      simulatedFlux,
      fluxError,
      details
    };
  }

  /**
   * Independent Analytical Oracle — Plane Wall with Volumetric Generation
   * Exact solution: T(x) = T_wall + (Q_vol / (2*k)) * x * (L - x)  for x in [0, L]
   * Peak temperature at x = L/2: T_max = T_wall + (Q_vol * L^2) / (8*k)
   */
  public static verifyUniformVolumetricSource(
    L: number,
    k: number,
    Q_vol: number,
    T_wall: number,
    simulatedProfile: number[],
    coordsX: number[]
  ): AnalyticalVolumetricProof {
    const details: string[] = [];
    let maxAbsoluteError = 0.0;
    const n = Math.min(simulatedProfile.length, coordsX.length);

    for (let i = 0; i < n; i++) {
      const x = coordsX[i];
      const T_exact = T_wall + (Q_vol / (2.0 * k)) * x * (L - x);
      const T_sim = simulatedProfile[i];
      const absErr = Math.abs(T_sim - T_exact);

      if (absErr > maxAbsoluteError) {
        maxAbsoluteError = absErr;
      }
    }

    const analyticalPeakT = T_wall + (Q_vol * L * L) / (8.0 * k);
    const simulatedPeakT = Math.max(...simulatedProfile);
    const peakDelta = analyticalPeakT - T_wall;
    const maxRelativeError = maxAbsoluteError / Math.max(Math.abs(peakDelta), 1.0);

    const passed = maxRelativeError < 0.02;
    details.push(`Volumetric Source Oracle: Max Absolute Error = ${maxAbsoluteError.toFixed(5)} K (${(maxRelativeError * 100).toFixed(3)}%)`);
    details.push(`Analytical Peak Temp = ${analyticalPeakT.toFixed(3)} K, Simulated Peak = ${simulatedPeakT.toFixed(3)} K`);

    return {
      passed,
      maxAbsoluteError,
      maxRelativeError,
      simulatedPeakT,
      analyticalPeakT,
      details
    };
  }

  /**
   * Independent Analytical Oracle — Zero Source Uniform Temperature
   * For Q = 0 and uniform boundary T, grad(T) = 0 everywhere.
   */
  public static verifyZeroSourceUniformTemperature(
    T_uniform: number,
    simulatedProfile: number[]
  ): {
    passed: boolean;
    maxDeviation: number;
    details: string[];
  } {
    let maxDeviation = 0.0;
    for (let i = 0; i < simulatedProfile.length; i++) {
      const dev = Math.abs(simulatedProfile[i] - T_uniform);
      if (dev > maxDeviation) maxDeviation = dev;
    }
    const passed = maxDeviation < 1e-4;
    return {
      passed,
      maxDeviation,
      details: [`Zero Source Uniformity: Max Deviation = ${maxDeviation.toExponential(3)} K`]
    };
  }
}
