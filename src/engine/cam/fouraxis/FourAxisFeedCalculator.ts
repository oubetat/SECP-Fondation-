/**
 * SECP Industrial OS v2 — Real CAM Kernel
 * PATCH-257 — 4-Axis Feedrate & Rotary Dynamics Calculator
 */

import { Vector3D } from '../toolpath/ToolpathTypes';
import {
  FourAxisMachineModel,
  FeedrateMode,
  FourAxisDiagnostic,
  FourAxisFailureCode
} from './FourAxisTypes';

export interface FeedCalculationResult {
  linearFeedMmMin: number;
  rotaryFeedDegMin: number;
  inverseTimeFeedMinInv: number; // G93 value (1 / timeInMinutes)
  segmentDurationSec: number;
  effectiveSurfaceSpeedMMin: number;
  feedrateMode: FeedrateMode;
  isFeedLimitExceeded: boolean;
  diagnostic?: FourAxisDiagnostic;
}

export class FourAxisFeedCalculator {
  /**
   * Calculates true multi-axis feedrates, considering tool contact radius and rotary table speed.
   */
  public static calculateSegmentFeed(
    startPos: Vector3D,
    endPos: Vector3D,
    startAngleDeg: number,
    endAngleDeg: number,
    programmedFeedMmMin: number,
    spindleRpm: number,
    toolDiameterMm: number,
    activeRadiusMm: number,
    machine: FourAxisMachineModel,
    isRapid: boolean = false
  ): FeedCalculationResult {
    const dx = endPos.x - startPos.x;
    const dy = endPos.y - startPos.y;
    const dz = endPos.z - startPos.z;
    const linearDistMm = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const angularDistDeg = Math.abs(endAngleDeg - startAngleDeg);

    // If it's a pure rapid motion
    if (isRapid) {
      const linearDuration = linearDistMm / (machine.maxRapidFeedMmMin / 60.0);
      const rotaryDuration = angularDistDeg / (machine.maxRotaryFeedDegMin / 60.0);
      const durationSec = Math.max(0.001, Math.max(linearDuration, rotaryDuration));

      return {
        linearFeedMmMin: machine.maxRapidFeedMmMin,
        rotaryFeedDegMin: machine.maxRotaryFeedDegMin,
        inverseTimeFeedMinInv: 60.0 / durationSec,
        segmentDurationSec: durationSec,
        effectiveSurfaceSpeedMMin: 0,
        feedrateMode: FeedrateMode.UNITS_PER_MINUTE,
        isFeedLimitExceeded: false,
      };
    }

    // Effective tangential arc length for the rotary motion at active cutting radius
    const effRadius = Math.max(1.0, activeRadiusMm);
    const rotaryArcMm = (angularDistDeg * Math.PI / 180.0) * effRadius;

    // Combined 3D + Rotary path length
    const total3DCombinedDistMm = Math.sqrt(linearDistMm * linearDistMm + rotaryArcMm * rotaryArcMm);

    // Desired cutting feed in mm/min
    const targetLinearFeed = Math.min(programmedFeedMmMin, machine.maxLinearFeedMmMin);

    let durationSec = 0.001;
    let rotaryFeedDegMin = 0;
    let isFeedLimitExceeded = false;
    let diagnostic: FourAxisDiagnostic | undefined = undefined;

    if (total3DCombinedDistMm > 1e-6) {
      durationSec = (total3DCombinedDistMm / targetLinearFeed) * 60.0;
    } else if (angularDistDeg > 1e-6) {
      // Pure rotary motion with zero linear distance
      rotaryFeedDegMin = (targetLinearFeed / (effRadius * Math.PI)) * 180.0;
      if (rotaryFeedDegMin > machine.maxRotaryFeedDegMin) {
        rotaryFeedDegMin = machine.maxRotaryFeedDegMin;
      }
      durationSec = (angularDistDeg / rotaryFeedDegMin) * 60.0;
    }

    // Compute required rotary feed in deg/min for this duration
    if (durationSec > 1e-6) {
      rotaryFeedDegMin = (angularDistDeg / durationSec) * 60.0;
    }

    // Clamp and check rotary limits
    if (rotaryFeedDegMin > machine.maxRotaryFeedDegMin + 1e-3) {
      isFeedLimitExceeded = true;
      // Adjust duration to respect machine rotary velocity limit
      durationSec = (angularDistDeg / machine.maxRotaryFeedDegMin) * 60.0;
      rotaryFeedDegMin = machine.maxRotaryFeedDegMin;

      diagnostic = {
        code: 'ROTARY_FEED_LIMIT_EXCEEDED',
        severity: 'WARNING',
        rotaryAngleDeg: endAngleDeg,
        message: `Rotary feed ${rotaryFeedDegMin.toFixed(1)} deg/min clamped to machine maximum ${machine.maxRotaryFeedDegMin} deg/min.`,
        timestamp: new Date().toISOString(),
      };
    }

    // Inverse time feed (1/min) = 60 / durationSec (used in standard G93 multi-axis mode)
    const inverseTimeFeedMinInv = durationSec > 1e-6 ? 60.0 / durationSec : 1000.0;

    // Cutting Surface Speed Vc (m/min) = (PI * D_tool * RPM) / 1000
    const surfaceSpeedMMin = (Math.PI * toolDiameterMm * spindleRpm) / 1000.0;

    const mode = angularDistDeg > 1e-4 && linearDistMm > 1e-4 
      ? FeedrateMode.INVERSE_TIME 
      : (angularDistDeg > 1e-4 ? FeedrateMode.DEGREES_PER_MINUTE : FeedrateMode.UNITS_PER_MINUTE);

    return {
      linearFeedMmMin: targetLinearFeed,
      rotaryFeedDegMin,
      inverseTimeFeedMinInv,
      segmentDurationSec: durationSec,
      effectiveSurfaceSpeedMMin: surfaceSpeedMMin,
      feedrateMode: mode,
      isFeedLimitExceeded,
      diagnostic,
    };
  }

  /**
   * Convert linear surface feed (mm/min) to rotary angular feed (deg/min) at radius R
   */
  public static linearToRotaryFeed(linearFeedMmMin: number, radiusMm: number): number {
    const r = Math.max(0.1, radiusMm);
    return (linearFeedMmMin / (Math.PI * r)) * 180.0;
  }

  /**
   * Convert rotary angular feed (deg/min) to linear surface feed (mm/min) at radius R
   */
  public static rotaryToLinearFeed(rotaryFeedDegMin: number, radiusMm: number): number {
    const r = Math.max(0.1, radiusMm);
    return (rotaryFeedDegMin * Math.PI * r) / 180.0;
  }
}
