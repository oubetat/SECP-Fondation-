/**
 * SECP Industrial OS v2 — Real CAM Kernel
 * PATCH-257 — Rotary Unwind & Angular Continuity Manager
 */

import { FourAxisMachineModel, FourAxisDiagnostic, FourAxisFailureCode } from './FourAxisTypes';

export interface UnwindResult {
  unwoundAngleDeg: number;
  normalizedAngleDeg: number; // [0, 360) or [-180, 180)
  totalRotaryTravelDeg: number;
  requiresRewindCycle: boolean;
  isLimitViolated: boolean;
  diagnostic?: FourAxisDiagnostic;
}

export class RotaryUnwindManager {
  private currentUnwoundAngleDeg: number = 0;
  private totalAccumulatedTravelDeg: number = 0;

  constructor(initialAngleDeg: number = 0) {
    this.currentUnwoundAngleDeg = initialAngleDeg;
    this.totalAccumulatedTravelDeg = 0;
  }

  public reset(initialAngleDeg: number = 0): void {
    this.currentUnwoundAngleDeg = initialAngleDeg;
    this.totalAccumulatedTravelDeg = 0;
  }

  /**
   * Process a requested target angle, maintaining continuous unwinding (avoiding 359° -> 1° jumps).
   * Calculates unwound angle that minimizes angular delta or enforces continuous tool engagement.
   */
  public processAngle(
    targetAngleDeg: number,
    machine: FourAxisMachineModel,
    enforceContinuous: boolean = true
  ): UnwindResult {
    const rawTarget = targetAngleDeg;
    let targetUnwound = rawTarget;

    if (enforceContinuous) {
      // Find the equivalent angle (rawTarget + k * 360) that is closest to currentUnwoundAngleDeg
      const diff = rawTarget - (this.currentUnwoundAngleDeg % 360);
      let delta = ((diff + 180) % 360 + 360) % 360 - 180;
      targetUnwound = this.currentUnwoundAngleDeg + delta;
    }

    const deltaAngle = Math.abs(targetUnwound - this.currentUnwoundAngleDeg);
    this.totalAccumulatedTravelDeg += deltaAngle;
    this.currentUnwoundAngleDeg = targetUnwound;

    // Check Machine Limits
    const minLimit = machine.rotaryLimitsDeg[0];
    const maxLimit = machine.rotaryLimitsDeg[1];
    let isLimitViolated = false;
    let requiresRewindCycle = false;
    let diagnostic: FourAxisDiagnostic | undefined = undefined;

    if (!machine.isContinuousRotation) {
      if (targetUnwound < minLimit || targetUnwound > maxLimit) {
        isLimitViolated = true;
        requiresRewindCycle = true;
        diagnostic = {
          code: 'ROTARY_AXIS_LIMIT_EXCEEDED',
          severity: 'ERROR',
          rotaryAngleDeg: targetUnwound,
          message: `Rotary angle ${targetUnwound.toFixed(2)}° exceeds machine travel limits [${minLimit}°, ${maxLimit}°].`,
          timestamp: new Date().toISOString(),
        };
      }
    }

    const normalized = ((targetUnwound % 360) + 360) % 360;

    return {
      unwoundAngleDeg: targetUnwound,
      normalizedAngleDeg: normalized,
      totalRotaryTravelDeg: this.totalAccumulatedTravelDeg,
      requiresRewindCycle,
      isLimitViolated,
      diagnostic,
    };
  }

  /**
   * Normalize an angle to [0, 360) degrees
   */
  public static normalize360(angleDeg: number): number {
    return ((angleDeg % 360) + 360) % 360;
  }

  /**
   * Normalize an angle to [-180, +180) degrees
   */
  public static normalize180(angleDeg: number): number {
    let a = this.normalize360(angleDeg);
    if (a >= 180) a -= 360;
    return a;
  }

  /**
   * Compute shortest angular distance between two angles (returns value in [-180, 180])
   */
  public static shortestAngularDistance(fromDeg: number, toDeg: number): number {
    const diff = toDeg - fromDeg;
    return ((diff + 180) % 360 + 360) % 360 - 180;
  }

  /**
   * Detect sudden angular discontinuities (> 120° in a single cutting step without rapid positioning)
   */
  public static checkAngularDiscontinuity(
    prevAngleDeg: number,
    currentAngleDeg: number,
    isCuttingMotion: boolean,
    maxAllowedStepDeg: number = 90
  ): FourAxisDiagnostic | null {
    if (!isCuttingMotion) return null;
    const delta = Math.abs(currentAngleDeg - prevAngleDeg);
    if (delta > maxAllowedStepDeg) {
      return {
        code: 'ROTARY_DISCONTINUITY',
        severity: 'ERROR',
        rotaryAngleDeg: currentAngleDeg,
        message: `Angular step discontinuity detected during cutting: delta = ${delta.toFixed(2)}° (limit = ${maxAllowedStepDeg}°).`,
        timestamp: new Date().toISOString(),
      };
    }
    return null;
  }

  public getCurrentAngle(): number {
    return this.currentUnwoundAngleDeg;
  }

  public getTotalTravel(): number {
    return this.totalAccumulatedTravelDeg;
  }
}
