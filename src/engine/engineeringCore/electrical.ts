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
}
