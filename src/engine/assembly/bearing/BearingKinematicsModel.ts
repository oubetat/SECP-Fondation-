/**
 * PATCH-222 — Bearing Kinematics & Motion Model
 * Implements planetary epicyclic rolling element kinematics, cage orbital speed,
 * ball spin velocity, characteristic defect/vibration frequencies (BPFI, BPFO, BSF, FTF),
 * and dynamic multi-body rotational state updates.
 */

import { BearingDefinition, BearingInstance } from './BearingTypes';

export interface BearingKinematicsState {
  innerRingRpm: number;
  outerRingRpm: number;
  cageRpm: number;
  ballSpinRpm: number;
  cageAngularVelocityRadS: number;
  ballSpinAngularVelocityRadS: number;
  
  // Vibration / characteristic frequencies in Hz (for ISO 13373 condition monitoring)
  frequenciesHz: {
    ftf_cage: number;    // Fundamental Train Frequency
    bpfi_inner: number;  // Ball Pass Frequency Inner Ring
    bpfo_outer: number;  // Ball Pass Frequency Outer Ring
    bsf_ball: number;    // Ball Spin Frequency
  };
}

export class BearingKinematicsModel {
  /**
   * Computes planetary orbital speeds and characteristic frequencies for a bearing
   */
  public static computeKinematics(
    bearing: BearingDefinition,
    innerRingRpm: number = 1500,
    outerRingRpm: number = 0
  ): BearingKinematicsState {
    const dm = bearing.rollingElements.pitchDiameter;
    const Dw = bearing.rollingElements.diameter;
    const Z = bearing.rollingElements.count;
    const alphaRad = (bearing.rollingElements.contactAngleDeg * Math.PI) / 180;
    const cosAlpha = Math.cos(alphaRad);

    const gamma = (Dw * cosAlpha) / dm;

    // Speeds in rad/s
    const omega_i = (innerRingRpm * 2 * Math.PI) / 60;
    const omega_o = (outerRingRpm * 2 * Math.PI) / 60;

    // Cage speed: omega_c = 0.5 * [ omega_i * (1 - gamma) + omega_o * (1 + gamma) ]
    const omega_c = 0.5 * (omega_i * (1 - gamma) + omega_o * (1 + gamma));
    const cageRpm = (omega_c * 60) / (2 * Math.PI);

    // Ball spin speed: omega_b = (dm / (2 * Dw)) * (omega_o - omega_i) * (1 - gamma^2)
    const omega_b = Math.abs((dm / (2 * Dw)) * (omega_o - omega_i) * (1 - Math.pow(gamma, 2)));
    const ballSpinRpm = (omega_b * 60) / (2 * Math.PI);

    // Frequencies (Hz) for rotating inner ring (relative speed n_rel = |ni - no| / 60)
    const n_rel_hz = Math.abs(innerRingRpm - outerRingRpm) / 60;
    const ftf = (1 / 2) * n_rel_hz * (1 - gamma);
    const bpfi = (Z / 2) * n_rel_hz * (1 + gamma);
    const bpfo = (Z / 2) * n_rel_hz * (1 - gamma);
    const bsf = (dm / (2 * Dw)) * n_rel_hz * (1 - Math.pow(gamma, 2));

    return {
      innerRingRpm,
      outerRingRpm,
      cageRpm: parseFloat(cageRpm.toFixed(2)),
      ballSpinRpm: parseFloat(ballSpinRpm.toFixed(2)),
      cageAngularVelocityRadS: parseFloat(omega_c.toFixed(3)),
      ballSpinAngularVelocityRadS: parseFloat(omega_b.toFixed(3)),
      frequenciesHz: {
        ftf_cage: parseFloat(ftf.toFixed(2)),
        bpfi_inner: parseFloat(bpfi.toFixed(2)),
        bpfo_outer: parseFloat(bpfo.toFixed(2)),
        bsf_ball: parseFloat(bsf.toFixed(2))
      }
    };
  }

  /**
   * Advances the rotational simulation step of an active Bearing Instance
   */
  public static stepSimulation(
    instance: BearingInstance,
    bearing: BearingDefinition,
    innerRingRpm: number,
    outerRingRpm: number,
    deltaTimeSeconds: number
  ): BearingInstance {
    const kin = this.computeKinematics(bearing, innerRingRpm, outerRingRpm);
    const deltaDeg = (innerRingRpm * 360 / 60) * deltaTimeSeconds;
    const nextRotation = (instance.currentRotationDeg + deltaDeg) % 360;

    return {
      ...instance,
      currentRotationDeg: parseFloat(nextRotation.toFixed(2)),
      innerRingSpeedRpm: innerRingRpm,
      outerRingSpeedRpm: outerRingRpm,
      cageSpeedRpm: kin.cageRpm,
      ballSpinSpeedRpm: kin.ballSpinRpm
    };
  }
}
