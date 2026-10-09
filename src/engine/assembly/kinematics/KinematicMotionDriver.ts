/**
 * PATCH-SECP-229 — Kinematic Motion Drivers
 * 
 * Manages driving inputs for kinematic mechanism joints:
 *  - q(t), v(t), a(t) driving functions
 *  - Constant Velocity, Constant Acceleration, Harmonic Oscillation, Ramp, Custom Expression
 *  - Driver binding to joint DOFs
 */

import { KinematicMotionDriver, DriverMotionType } from './KinematicModelTypes';

export interface MotionDriverEvaluation {
  position: number;    // rad or mm
  velocity: number;    // rad/s or mm/s
  acceleration: number;// rad/s² or mm/s²
}

export class KinematicMotionDriverEngine {

  /**
   * Evaluates driver position, velocity, and acceleration at time t
   */
  public static evaluateDriver(driver: KinematicMotionDriver, timeSeconds: number): MotionDriverEvaluation {
    if (!driver.enabled) {
      return { position: 0, velocity: 0, acceleration: 0 };
    }

    switch (driver.motionType) {
      case 'CONSTANT_VELOCITY': {
        const v = driver.targetVelocity ?? ((driver.targetRPM ?? 60) * (2 * Math.PI / 60));
        return {
          position: v * timeSeconds,
          velocity: v,
          acceleration: 0
        };
      }

      case 'CONSTANT_ACCELERATION':
      case 'RAMP': {
        const a = driver.constantAcceleration ?? 10.0;
        return {
          position: 0.5 * a * timeSeconds * timeSeconds,
          velocity: a * timeSeconds,
          acceleration: a
        };
      }

      case 'HARMONIC_OSCILLATION': {
        const amp = driver.amplitude ?? 1.0;
        const freq = driver.frequencyHz ?? 1.0;
        const phase = driver.phaseOffsetRad ?? 0.0;
        const omega = 2 * Math.PI * freq;

        return {
          position: amp * Math.sin(omega * timeSeconds + phase),
          velocity: amp * omega * Math.cos(omega * timeSeconds + phase),
          acceleration: -amp * omega * omega * Math.sin(omega * timeSeconds + phase)
        };
      }

      case 'CUSTOM_EXPRESSION':
      default: {
        const v = driver.targetVelocity ?? 1.0;
        return {
          position: v * timeSeconds,
          velocity: v,
          acceleration: 0
        };
      }
    }
  }

  /**
   * Factory constructor for creating motor driver inputs
   */
  public static createDriver(
    id: string,
    name: string,
    targetJointId: string,
    motionType: DriverMotionType,
    params: {
      targetRPM?: number;
      targetVelocity?: number;
      amplitude?: number;
      frequencyHz?: number;
      constantAcceleration?: number;
    }
  ): KinematicMotionDriver {
    return {
      id,
      name,
      targetJointId,
      dofIndex: 0,
      motionType,
      targetRPM: params.targetRPM,
      targetVelocity: params.targetVelocity,
      amplitude: params.amplitude,
      frequencyHz: params.frequencyHz,
      constantAcceleration: params.constantAcceleration,
      enabled: true
    };
  }
}
