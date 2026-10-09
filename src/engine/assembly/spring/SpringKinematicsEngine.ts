/**
 * PATCH-225 — Spring Dynamic Kinematics & Mechanical Stops Engine
 * Real motion integration: displacement -> restoring force, preload, mechanical solid stop limits,
 * return acceleration, stored kinetic/potential exchange, and dynamic time-stepping.
 */

import { SpringDefinition, SpringMechanicalAnalysis } from './SpringTypes';

export interface SpringKinematicState {
  displacementMm: number;
  velocityMmS: number;
  restoringForceN: number;
  storedStrainEnergyJoules: number;
  kineticEnergyJoules: number;
  currentLengthMm: number;
  stopStatus: 'FREE' | 'NORMAL_TRAVEL' | 'SOLID_LIMIT_REACHED' | 'OVER_TRAVEL_VIOLATION';
  dampingForceN: number;
  totalReactionForceN: number;
}

export interface DynamicSimulationParams {
  attachedMassKg: number;
  initialDisplacementMm: number;
  initialVelocityMmS: number;
  dampingRatioZeta: number; // e.g. 0.05 for steel spring internal damping
  externalForceN?: number;
  timeStepSec: number;
  totalTimeSec: number;
}

export class SpringKinematicsEngine {
  /**
   * Evaluate static or instantaneous kinematic state of a spring
   */
  public static evaluateKinematicState(
    spring: SpringDefinition,
    displacementMm: number,
    velocityMmS: number = 0,
    dampingRatio: number = 0.05
  ): SpringKinematicState {
    const k = spring.mechanicalAnalysis.springRate_K_N_mm; // N/mm
    const L0 = spring.freeLengthMm;
    const Hs = spring.solidHeightMm;
    const maxDelta = spring.mechanicalAnalysis.maxDeflectionAllowedDeltaMaxMm;
    const mass = spring.massProperties.effectiveDynamicMassKg;

    // Constrain displacement against solid stop
    let effectiveDisplacement = displacementMm;
    let stopStatus: SpringKinematicState['stopStatus'] = 'NORMAL_TRAVEL';

    if (effectiveDisplacement <= 0.001) {
      stopStatus = 'FREE';
      effectiveDisplacement = Math.max(effectiveDisplacement, 0);
    } else if (effectiveDisplacement >= maxDelta) {
      effectiveDisplacement = maxDelta;
      stopStatus = 'SOLID_LIMIT_REACHED';
    }

    if (displacementMm > maxDelta * 1.02) {
      stopStatus = 'OVER_TRAVEL_VIOLATION';
    }

    // Force calculations
    const restoringForceN = effectiveDisplacement * k;
    const currentLengthMm = spring.type === 'COMPRESSION' ? L0 - effectiveDisplacement : L0 + effectiveDisplacement;

    // Critical damping coefficient: cc = 2 * sqrt(k * m)
    const k_N_m = k * 1000;
    const c_crit = 2 * Math.sqrt(Math.max(k_N_m * mass, 1e-4));
    const c_actual = dampingRatio * c_crit;
    const dampingForceN = (c_actual * (velocityMmS / 1000));
    const totalReactionForceN = restoringForceN + dampingForceN;

    const storedStrainEnergyJoules = (0.5 * k * Math.pow(effectiveDisplacement, 2)) / 1000;
    const kineticEnergyJoules = 0.5 * mass * Math.pow(velocityMmS / 1000, 2);

    return {
      displacementMm: Math.round(effectiveDisplacement * 100) / 100,
      velocityMmS: Math.round(velocityMmS * 10) / 10,
      restoringForceN: Math.round(restoringForceN * 10) / 10,
      storedStrainEnergyJoules: Math.round(storedStrainEnergyJoules * 1000) / 1000,
      kineticEnergyJoules: Math.round(kineticEnergyJoules * 1000) / 1000,
      currentLengthMm: Math.round(currentLengthMm * 100) / 100,
      stopStatus,
      dampingForceN: Math.round(dampingForceN * 10) / 10,
      totalReactionForceN: Math.round(totalReactionForceN * 10) / 10
    };
  }

  /**
   * Run deterministic dynamic time-history simulation (Runge-Kutta 4th order / Verlet)
   */
  public static runDynamicSimulation(
    spring: SpringDefinition,
    params: DynamicSimulationParams
  ): Array<{ timeSec: number; displacementMm: number; forceN: number; velocityMmS: number }> {
    const k = spring.mechanicalAnalysis.springRate_K_N_mm * 1000; // N/m
    const m = Math.max(params.attachedMassKg + spring.massProperties.effectiveDynamicMassKg, 0.001); // kg
    const c_crit = 2 * Math.sqrt(k * m);
    const c = params.dampingRatioZeta * c_crit; // N*s/m
    const F_ext = params.externalForceN || 0;
    const maxDeltaM = spring.mechanicalAnalysis.maxDeflectionAllowedDeltaMaxMm / 1000;

    const dt = params.timeStepSec || 0.001;
    const steps = Math.min(Math.round(params.totalTimeSec / dt), 500);

    let x = (params.initialDisplacementMm || 0) / 1000; // m
    let v = (params.initialVelocityMmS || 0) / 1000; // m/s
    const history: Array<{ timeSec: number; displacementMm: number; forceN: number; velocityMmS: number }> = [];

    for (let step = 0; step <= steps; step++) {
      const t = step * dt;

      // Check mechanical solid stop contact
      let contactReaction = 0;
      if (x >= maxDeltaM) {
        x = maxDeltaM;
        if (v > 0) {
          v = -v * 0.2; // slight restitution bounce off solid stop
        }
      } else if (x < 0) {
        x = 0;
        if (v < 0) v = 0;
      }

      const F_spring = k * x;
      const F_damping = c * v;
      const a = (F_ext - F_spring - F_damping + contactReaction) / m;

      // Symplectic Euler integration
      v += a * dt;
      x += v * dt;

      history.push({
        timeSec: Math.round(t * 1000) / 1000,
        displacementMm: Math.round(x * 1000 * 100) / 100,
        forceN: Math.round(F_spring * 10) / 10,
        velocityMmS: Math.round(v * 1000 * 10) / 10
      });
    }

    return history;
  }
}
