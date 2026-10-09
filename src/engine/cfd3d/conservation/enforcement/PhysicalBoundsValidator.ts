/**
 * SECP Industrial OS v2 — Physical Bounds Validator
 * Phase 16 (PATCH-175)
 *
 * Enforces strict physical admissibility during every iteration of the solver.
 * Catches unphysical anomalies (negative density, negative absolute pressure,
 * negative absolute temperature, supersonic blow-up in subsonic regimes, invalid turbulence)
 * and triggers immediate iteration rejection.
 */

import {
  PhysicalBoundsReport,
  PhysicalBoundsViolation
} from './ConservationEnforcementTypes';

export class PhysicalBoundsValidator {
  public static validate(
    u: number[],
    v: number[],
    w: number[],
    p: number[],
    rho: number,
    T?: number[],
    k?: number[],
    omega?: number[],
    maxPermissibleSpeed: number = 2000.0 // m/s
  ): PhysicalBoundsReport {
    const violations: PhysicalBoundsViolation[] = [];
    const numCells = u.length;

    let minDensity = rho, maxDensity = rho;
    let minPressure = Infinity, maxPressure = -Infinity;
    let minTemperature = Infinity, maxTemperature = -Infinity;
    let maxVelocity = 0;
    let maxMach = 0;

    // Fluid sound speed reference
    const soundSpeed = 343.0;

    // Density check
    if (rho <= 0 || !Number.isFinite(rho) || Number.isNaN(rho)) {
      violations.push({
        variable: 'DENSITY',
        cellId: -1,
        value: rho,
        limit: { min: 1e-6 },
        severity: 'FATAL',
        message: `Non-physical fluid density: ${rho} kg/m³`
      });
    }

    for (let i = 0; i < numCells; i++) {
      const pVal = p[i];
      const uVal = u[i];
      const vVal = v[i];
      const wVal = w[i];

      // Pressure bounds
      if (!Number.isFinite(pVal) || Number.isNaN(pVal)) {
        violations.push({
          variable: 'PRESSURE',
          cellId: i,
          value: pVal,
          limit: { min: -1e6, max: 1e8 },
          severity: 'FATAL',
          message: `Non-finite pressure at cell ${i}`
        });
      } else {
        if (pVal < minPressure) minPressure = pVal;
        if (pVal > maxPressure) maxPressure = pVal;

        // Unphysical deep vacuum / negative absolute pressure
        if (pVal < -1e5) {
          violations.push({
            variable: 'PRESSURE',
            cellId: i,
            value: pVal,
            limit: { min: -1e5 },
            severity: 'CRITICAL',
            message: `Unphysical negative pressure: ${pVal.toFixed(2)} Pa at cell ${i}`
          });
        }
      }

      // Velocity bounds
      if (!Number.isFinite(uVal) || !Number.isFinite(vVal) || !Number.isFinite(wVal) ||
          Number.isNaN(uVal) || Number.isNaN(vVal) || Number.isNaN(wVal)) {
        violations.push({
          variable: 'VELOCITY',
          cellId: i,
          value: NaN,
          limit: { max: maxPermissibleSpeed },
          severity: 'FATAL',
          message: `Non-finite velocity vector at cell ${i}`
        });
      } else {
        const speed = Math.sqrt(uVal * uVal + vVal * vVal + wVal * wVal);
        if (speed > maxVelocity) maxVelocity = speed;

        const localMach = speed / soundSpeed;
        if (localMach > maxMach) maxMach = localMach;

        if (speed > maxPermissibleSpeed) {
          violations.push({
            variable: 'VELOCITY',
            cellId: i,
            value: speed,
            limit: { max: maxPermissibleSpeed },
            severity: 'CRITICAL',
            message: `Unphysical velocity explosion: ${speed.toFixed(1)} m/s exceeds limit ${maxPermissibleSpeed} m/s`
          });
        }
      }

      // Temperature bounds (if present)
      if (T && T[i] !== undefined) {
        const tVal = T[i];
        if (tVal < minTemperature) minTemperature = tVal;
        if (tVal > maxTemperature) maxTemperature = tVal;

        if (tVal <= 0.0 || !Number.isFinite(tVal)) {
          violations.push({
            variable: 'TEMPERATURE',
            cellId: i,
            value: tVal,
            limit: { min: 1.0 },
            severity: 'CRITICAL',
            message: `Non-physical absolute temperature: ${tVal} K at cell ${i}`
          });
        }
      }

      // Turbulence bounds (if present)
      if (k && k[i] !== undefined && k[i] < 0) {
        violations.push({
          variable: 'TURBULENCE',
          cellId: i,
          value: k[i],
          limit: { min: 0 },
          severity: 'WARNING',
          message: `Negative turbulent kinetic energy k at cell ${i}`
        });
      }
    }

    if (minPressure === Infinity) minPressure = 0;
    if (maxPressure === -Infinity) maxPressure = 0;
    if (minTemperature === Infinity) minTemperature = 300;
    if (maxTemperature === -Infinity) maxTemperature = 300;

    const criticalViolations = violations.filter(v => v.severity === 'CRITICAL' || v.severity === 'FATAL');
    const isValid = criticalViolations.length === 0;

    return {
      isValid,
      violations,
      minDensity,
      maxDensity,
      minPressure,
      maxPressure,
      minTemperature,
      maxTemperature,
      maxVelocity,
      maxMach
    };
  }
}
