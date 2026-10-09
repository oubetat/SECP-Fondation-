/**
 * SECP Industrial OS v2 — Temperature & Property Interpolation Engine
 * Phase 18 (PATCH-178: Materials Benchmark → Industrial Materials Engine)
 *
 * Provides:
 * - Natural Cubic Spline & Linear Interpolation
 * - Strict Out-of-Bounds Policy (Clamp or Disallow/Throw)
 * - Unit safety & physical bounds checking
 * - Dynamic temperature-dependent material property evaluation:
 *   E(T), nu(T), rho(T), k(T), Cp(T), sigma_y(T), alpha(T)
 * - Thermal strain tensor calculation: eps_th = alpha(T) * (T - T_ref) * I
 */

import {
  ExtrapolationPolicy,
  InterpolationPolicy,
  PhysicalDimension,
  TemperatureCurve,
  TemperatureCurvePoint,
  UnitSafeValue
} from '../types/IndustrialMaterialTypes';

export class TemperaturePropertyEngine {
  /**
   * Evaluates a property from a TemperatureCurve at temperature T (in Kelvin).
   */
  public static evaluateCurve(curve: TemperatureCurve, tempK: number): number {
    if (curve.points.length === 0) {
      throw new Error(`TemperatureCurve for '${curve.propertyName}' has no data points.`);
    }

    if (curve.points.length === 1) {
      return curve.points[0].value;
    }

    // Sort points ascending by temperature
    const sorted = [...curve.points].sort((a, b) => a.temperatureKelvin - b.temperatureKelvin);
    const minT = sorted[0].temperatureKelvin;
    const maxT = sorted[sorted.length - 1].temperatureKelvin;

    // Check validity range
    if (tempK < curve.minValidTempK || tempK > curve.maxValidTempK) {
      if (curve.extrapolationPolicy === 'DISALLOW_THROW') {
        throw new Error(
          `Temperature ${tempK.toFixed(2)} K is outside valid range [${curve.minValidTempK}, ${curve.maxValidTempK}] K for property '${curve.propertyName}'. Silent extrapolation disallowed.`
        );
      }
    }

    // Handle out-of-data bounds
    if (tempK <= minT) {
      if (curve.extrapolationPolicy === 'CLAMP') return sorted[0].value;
      if (curve.extrapolationPolicy === 'LINEAR_TANGENT') {
        const slope = (sorted[1].value - sorted[0].value) / (sorted[1].temperatureKelvin - sorted[0].temperatureKelvin);
        return sorted[0].value + slope * (tempK - minT);
      }
      throw new Error(`Temperature ${tempK} K is below data floor ${minT} K with DISALLOW policy.`);
    }

    if (tempK >= maxT) {
      if (curve.extrapolationPolicy === 'CLAMP') return sorted[sorted.length - 1].value;
      if (curve.extrapolationPolicy === 'LINEAR_TANGENT') {
        const n = sorted.length - 1;
        const slope = (sorted[n].value - sorted[n - 1].value) / (sorted[n].temperatureKelvin - sorted[n - 1].temperatureKelvin);
        return sorted[n].value + slope * (tempK - maxT);
      }
      throw new Error(`Temperature ${tempK} K exceeds data ceiling ${maxT} K with DISALLOW policy.`);
    }

    // Interior evaluation
    if (curve.interpolationPolicy === 'CUBIC_SPLINE' && sorted.length >= 3) {
      return this.evaluateCubicSpline(sorted, tempK);
    }

    // Default to piecewise linear
    return this.evaluateLinear(sorted, tempK);
  }

  /**
   * Piecewise linear interpolation.
   */
  public static evaluateLinear(points: TemperatureCurvePoint[], tempK: number): number {
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      if (tempK >= p0.temperatureKelvin && tempK <= p1.temperatureKelvin) {
        const t = (tempK - p0.temperatureKelvin) / (p1.temperatureKelvin - p0.temperatureKelvin);
        return p0.value + t * (p1.value - p0.value);
      }
    }
    return points[points.length - 1].value;
  }

  /**
   * Natural cubic spline interpolation (zero second derivatives at boundaries).
   */
  public static evaluateCubicSpline(points: TemperatureCurvePoint[], tempK: number): number {
    const n = points.length;
    const x = points.map(p => p.temperatureKelvin);
    const y = points.map(p => p.value);

    const h: number[] = new Array(n - 1);
    for (let i = 0; i < n - 1; i++) {
      h[i] = x[i + 1] - x[i];
    }

    const alpha: number[] = new Array(n - 1);
    for (let i = 1; i < n - 1; i++) {
      alpha[i] = (3 / h[i]) * (y[i + 1] - y[i]) - (3 / h[i - 1]) * (y[i] - y[i - 1]);
    }

    const l: number[] = new Array(n);
    const mu: number[] = new Array(n);
    const z: number[] = new Array(n);

    l[0] = 1;
    mu[0] = 0;
    z[0] = 0;

    for (let i = 1; i < n - 1; i++) {
      l[i] = 2 * (x[i + 1] - x[i - 1]) - h[i - 1] * mu[i - 1];
      mu[i] = h[i] / l[i];
      z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
    }

    l[n - 1] = 1;
    z[n - 1] = 0;

    const c: number[] = new Array(n);
    const b: number[] = new Array(n - 1);
    const d: number[] = new Array(n - 1);
    c[n - 1] = 0;

    for (let j = n - 2; j >= 0; j--) {
      c[j] = z[j] - mu[j] * c[j + 1];
      b[j] = (y[j + 1] - y[j]) / h[j] - (h[j] * (c[j + 1] + 2 * c[j])) / 3;
      d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
    }

    // Find segment
    let idx = 0;
    for (let i = 0; i < n - 1; i++) {
      if (tempK >= x[i] && tempK <= x[i + 1]) {
        idx = i;
        break;
      }
    }

    const dx = tempK - x[idx];
    return y[idx] + b[idx] * dx + c[idx] * dx * dx + d[idx] * dx * dx * dx;
  }

  /**
   * Converts temperature between Kelvin, Celsius, and Fahrenheit.
   */
  public static convertTemperature(val: number, from: 'K' | 'C' | 'F', to: 'K' | 'C' | 'F'): number {
    let kelvin = val;
    if (from === 'C') kelvin = val + 273.15;
    else if (from === 'F') kelvin = (val - 32) * (5 / 9) + 273.15;

    if (to === 'K') return kelvin;
    if (to === 'C') return kelvin - 273.15;
    if (to === 'F') return (kelvin - 273.15) * (9 / 5) + 32;
    return kelvin;
  }

  /**
   * Unit-safe property standardizer to SI units.
   */
  public static toSI(value: number, unit: string, dimension: PhysicalDimension): UnitSafeValue {
    let siValue = value;
    const u = unit.trim().toLowerCase();

    switch (dimension) {
      case 'STRESS_PRESSURE':
      case 'MODULUS':
        if (u === 'mpa') siValue = value * 1e6;
        else if (u === 'gpa') siValue = value * 1e9;
        else if (u === 'kpa') siValue = value * 1e3;
        else if (u === 'psi') siValue = value * 6894.757;
        else if (u === 'ksi') siValue = value * 6.894757e6;
        else if (u === 'msi') siValue = value * 6.894757e9;
        else if (u === 'bar') siValue = value * 1e5;
        break;
      case 'DENSITY':
        if (u === 'g/cm3' || u === 'g/cm³' || u === 'g/cc') siValue = value * 1000;
        else if (u === 'lb/in3' || u === 'lb/in³') siValue = value * 27679.9;
        break;
      case 'THERMAL_CONDUCTIVITY':
        if (u.includes('btu')) siValue = value * 1.730735;
        break;
      case 'THERMAL_EXPANSION':
        if (u === '1/c' || u === '1/°c' || u === 'ppm/k' || u === '1e-6/k' || u === 'µm/m·k') {
          if (u.includes('ppm') || u.includes('1e-6') || u.includes('µm')) siValue = value * 1e-6;
        }
        break;
      case 'FRACTURE_TOUGHNESS':
        if (u.includes('ksi')) siValue = value * 1.09884; // ksi*sqrt(in) -> MPa*sqrt(m)
        break;
    }

    return {
      value,
      unit,
      siValue,
      dimension
    };
  }

  /**
   * Computes isotropic thermal strain tensor: eps_th = alpha(T) * (T - T_ref) * [1, 1, 1, 0, 0, 0]
   */
  public static computeThermalStrainVoigt(alpha: number, tempK: number, refTempK: number = 293.15): number[] {
    const deltaT = tempK - refTempK;
    const epsTh = alpha * deltaT;
    return [epsTh, epsTh, epsTh, 0, 0, 0];
  }
}
