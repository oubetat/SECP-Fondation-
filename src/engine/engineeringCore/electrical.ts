/**
 * SECP Engineering Calculation Core — Electrical Engine
 * Ohm's Law, DC/AC Power, Voltage Drop, Resistance vs Temperature.
 */

export class ElectricalCoreEngine {
  /** Ohm's Law V = I * R (Volts) */
  public static calculateVoltage(currentAmps: number, resistanceOhms: number): number {
    return currentAmps * resistanceOhms;
  }

  /** Ohm's Law I = V / R (Amps) */
  public static calculateCurrent(voltageVolts: number, resistanceOhms: number): number {
    if (resistanceOhms <= 0) return 0;
    return voltageVolts / resistanceOhms;
  }

  /** DC Electrical Power P = V * I = I^2 * R (Watts) */
  public static calculateDCPowerWatts(voltageVolts: number, currentAmps: number): number {
    return voltageVolts * currentAmps;
  }

  /** 3-Phase AC Active Power P = sqrt(3) * V_line * I_line * PF (Watts) */
  public static calculate3PhaseACPowerWatts(
    lineVoltageV: number,
    lineCurrentA: number,
    powerFactor: number = 0.85
  ): number {
    return Math.sqrt(3) * lineVoltageV * lineCurrentA * powerFactor;
  }

  /** Wire Voltage Drop DeltaV = 2 * L * I * rho / A (Volts) */
  public static calculateWireVoltageDrop(
    lengthM: number,
    currentAmps: number,
    wireCrossSectionMm2: number,
    resistivityOhmM: number = 1.68e-8 // Copper
  ): number {
    const areaM2 = wireCrossSectionMm2 / 1e6;
    if (areaM2 <= 0) return 0;
    return (2 * lengthM * currentAmps * resistivityOhmM) / areaM2;
  }

  /** Resistance Temperature Dependence R_T = R_0 * [1 + alpha * (T - T_0)] (Ohms) */
  public static calculateResistanceAtTemperature(
    r0Ohms: number,
    tempCelsius: number,
    alphaPerC: number = 0.00393, // Copper
    t0Celsius: number = 20
  ): number {
    return r0Ohms * (1 + alphaPerC * (tempCelsius - t0Celsius));
  }

  /**
   * Thermal voltage V_t = k * T / q (Volts)
   * k = 1.380649e-23 J/K, q = 1.602176634e-19 C
   */
  public static calculateThermalVoltage(tempKelvin: number = 300.0): number {
    const k = 1.380649e-23;
    const q = 1.602176634e-19;
    return (k * tempKelvin) / q;
  }

  /**
   * Shockley Diode Equation with C1 continuous exponential boundary limiting:
   * I_d = I_s * [exp(V_d / (n * V_t)) - 1]
   */
  public static calculateDiodeCurrent(
    vDropVolts: number,
    saturationCurrentAmps: number = 1e-14,
    idealityFactor: number = 1.0,
    thermalVoltageVolts: number = 0.02585199
  ): number {
    const nVt = idealityFactor * thermalVoltageVolts;
    if (nVt <= 0) return 0;

    const normalizedV = vDropVolts / nVt;
    const MAX_EXP_ARG = 40.0;

    if (normalizedV > MAX_EXP_ARG) {
      // Linear extrapolation beyond threshold to prevent floating point overflow
      const expMax = Math.exp(MAX_EXP_ARG);
      const slope = (saturationCurrentAmps / nVt) * expMax;
      const iMax = saturationCurrentAmps * (expMax - 1.0);
      return iMax + slope * (vDropVolts - MAX_EXP_ARG * nVt);
    } else if (normalizedV < -40.0) {
      return -saturationCurrentAmps;
    } else {
      return saturationCurrentAmps * (Math.exp(normalizedV) - 1.0);
    }
  }

  /**
   * Small-signal dynamic conductance g_d = d(I_d) / d(V_d) (Siemens)
   */
  public static calculateDiodeConductance(
    vDropVolts: number,
    saturationCurrentAmps: number = 1e-14,
    idealityFactor: number = 1.0,
    thermalVoltageVolts: number = 0.02585199
  ): number {
    const nVt = idealityFactor * thermalVoltageVolts;
    if (nVt <= 0) return 1e-12;

    const normalizedV = vDropVolts / nVt;
    const MAX_EXP_ARG = 40.0;

    if (normalizedV > MAX_EXP_ARG) {
      return (saturationCurrentAmps / nVt) * Math.exp(MAX_EXP_ARG);
    } else if (normalizedV < -40.0) {
      return 1e-15; // Minimal reverse leakage conductance
    } else {
      return (saturationCurrentAmps / nVt) * Math.exp(normalizedV);
    }
  }

  /**
   * Independent scalar solver for single diode in series with resistor:
   * Finds root of f(V_d) = V_s - V_d - R * I_d(V_d) = 0 via bracketed bisection & Newton method.
   * Serves as independent reference oracle (non-MNA).
   */
  public static solveDiodeCircuitIndependentReference(
    vSourceVolts: number,
    rSeriesOhms: number,
    saturationCurrentAmps: number = 1e-14,
    idealityFactor: number = 1.0,
    tempKelvin: number = 300.0
  ): { diodeVoltageVolts: number; diodeCurrentAmps: number; seriesVoltageDropVolts: number } {
    const vt = this.calculateThermalVoltage(tempKelvin);

    if (vSourceVolts <= 0) {
      // Reverse bias or zero
      const id = this.calculateDiodeCurrent(vSourceVolts, saturationCurrentAmps, idealityFactor, vt);
      return {
        diodeVoltageVolts: vSourceVolts - id * rSeriesOhms,
        diodeCurrentAmps: id,
        seriesVoltageDropVolts: id * rSeriesOhms
      };
    }

    // Bracket root between 0 and vSourceVolts
    let vLow = 0.0;
    let vHigh = vSourceVolts;

    const f = (vd: number) => {
      const id = this.calculateDiodeCurrent(vd, saturationCurrentAmps, idealityFactor, vt);
      return vSourceVolts - vd - rSeriesOhms * id;
    };

    // Bisection to get close
    for (let i = 0; i < 60; i++) {
      const vMid = 0.5 * (vLow + vHigh);
      const fMid = f(vMid);
      if (Math.abs(fMid) < 1e-13) {
        vLow = vMid;
        vHigh = vMid;
        break;
      }
      if (fMid > 0) {
        vLow = vMid;
      } else {
        vHigh = vMid;
      }
    }

    let vd = 0.5 * (vLow + vHigh);

    // Fine Newton Polish
    for (let i = 0; i < 20; i++) {
      const fVal = f(vd);
      if (Math.abs(fVal) < 1e-14) break;
      const gd = this.calculateDiodeConductance(vd, saturationCurrentAmps, idealityFactor, vt);
      const df = -1.0 - rSeriesOhms * gd;
      const step = fVal / df;
      vd = vd - step;
      if (Math.abs(step) < 1e-14) break;
    }

    const finalId = this.calculateDiodeCurrent(vd, saturationCurrentAmps, idealityFactor, vt);
    return {
      diodeVoltageVolts: vd,
      diodeCurrentAmps: finalId,
      seriesVoltageDropVolts: finalId * rSeriesOhms
    };
  }
}
