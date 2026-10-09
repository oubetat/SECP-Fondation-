/**
 * SECP Industrial OS v2 — Real CAM Kernel
 * PATCH-257 — 4-Axis Toolpath Safety, Collision & Gouge Validator
 */

import { Vector3D, MotionType } from '../toolpath/ToolpathTypes';
import {
  FourAxisToolPosition,
  FourAxisToolpathSegment,
  FourAxisSetup,
  FourAxisMachineModel,
  FourAxisDiagnostic,
  FourAxisFailureCode,
  FourAxisOperation
} from './FourAxisTypes';
import { FourAxisKinematics } from './FourAxisKinematics';

export interface ValidationReport {
  isValid: boolean;
  diagnostics: FourAxisDiagnostic[];
  axisLimitViolationsCount: number;
  rotaryLimitViolationsCount: number;
  rotaryFeedViolationsCount: number;
  rapidPlungesCount: number;
  gougesCount: number;
  holderCollisionsCount: number;
  fixtureCollisionsCount: number;
  singularityCount: number;
}

export class FourAxisToolpathValidator {
  /**
   * Validates the generated 4-axis toolpath against machine limits, kinematic bounds, fixture clearance, and gouging.
   */
  public static validateToolpath(
    positions: FourAxisToolPosition[],
    segments: FourAxisToolpathSegment[],
    setup: FourAxisSetup,
    operations: FourAxisOperation[]
  ): ValidationReport {
    const diagnostics: FourAxisDiagnostic[] = [];
    const machine = setup.machine;
    const stockRadius = setup.stockDimensions.outerDiameterMm 
      ? setup.stockDimensions.outerDiameterMm / 2.0 
      : setup.wcs.wrapRadiusMm;
    const fixture = setup.fixtureModel;

    let axisLimitViolationsCount = 0;
    let rotaryLimitViolationsCount = 0;
    let rotaryFeedViolationsCount = 0;
    let rapidPlungesCount = 0;
    let gougesCount = 0;
    let holderCollisionsCount = 0;
    let fixtureCollisionsCount = 0;
    let singularityCount = 0;

    // 1. Validate Positions
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];

      // Check Linear Machine Travel Limits
      if (
        pos.x < machine.xLimitsMm[0] || pos.x > machine.xLimitsMm[1] ||
        pos.y < machine.yLimitsMm[0] || pos.y > machine.yLimitsMm[1] ||
        pos.z < machine.zLimitsMm[0] || pos.z > machine.zLimitsMm[1]
      ) {
        axisLimitViolationsCount++;
        diagnostics.push({
          code: 'FOUR_AXIS_VALIDATION_FAILED',
          severity: 'ERROR',
          segmentIndex: i,
          machinePosition: { x: pos.x, y: pos.y, z: pos.z },
          rotaryAngleDeg: pos.rotaryAngleDeg,
          message: `Linear machine limit exceeded at position (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}).`,
          timestamp: new Date().toISOString(),
        });
      }

      // Check Rotary Angle Limits
      if (!machine.isContinuousRotation) {
        if (pos.rotaryAngleDeg < machine.rotaryLimitsDeg[0] || pos.rotaryAngleDeg > machine.rotaryLimitsDeg[1]) {
          rotaryLimitViolationsCount++;
          diagnostics.push({
            code: 'ROTARY_AXIS_LIMIT_EXCEEDED',
            severity: 'ERROR',
            segmentIndex: i,
            rotaryAngleDeg: pos.rotaryAngleDeg,
            message: `Rotary angle ${pos.rotaryAngleDeg.toFixed(2)}° exceeds limits [${machine.rotaryLimitsDeg[0]}°, ${machine.rotaryLimitsDeg[1]}°].`,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Check Fixture (Chuck / Jaws) Interference
      if (fixture) {
        // Chuck is located at X <= clampingLengthMm
        const distFromChuckFace = pos.partContactPoint.x - fixture.clampingLengthMm;
        if (distFromChuckFace < 2.0 && Math.hypot(pos.partContactPoint.y, pos.partContactPoint.z) < fixture.jawClearanceRadiusMm) {
          fixtureCollisionsCount++;
          diagnostics.push({
            code: 'FIXTURE_COLLISION',
            severity: 'ERROR',
            segmentIndex: i,
            partPosition: pos.partContactPoint,
            message: `Tool/holder collision with chuck jaws at X=${pos.partContactPoint.x.toFixed(1)} mm.`,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Check Tool Holder Clearance
      const currentOp = operations.find(o => o.id === pos.operationId);
      if (currentOp && currentOp.tool.holderDiameterMm) {
        const holderRadius = currentOp.tool.holderDiameterMm / 2.0;
        const toolStickout = currentOp.tool.stickoutMm ?? 40.0;
        const holderZInMachine = pos.z + toolStickout;
        
        // Holder should not dive inside the raw stock radius
        if (holderZInMachine < stockRadius + 2.0 && Math.hypot(pos.y, pos.z) < stockRadius + holderRadius) {
          holderCollisionsCount++;
          diagnostics.push({
            code: 'HOLDER_COLLISION',
            severity: 'ERROR',
            segmentIndex: i,
            message: `Tool holder collision detected: Holder enters stock clearance boundary.`,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    // 2. Validate Segments
    for (let s = 0; s < segments.length; s++) {
      const seg = segments[s];

      // Check Rotary Feed Limits
      if (seg.rotaryFeedDegMin > machine.maxRotaryFeedDegMin + 1e-2) {
        rotaryFeedViolationsCount++;
        diagnostics.push({
          code: 'ROTARY_FEED_LIMIT_EXCEEDED',
          severity: 'WARNING',
          segmentIndex: s,
          rotaryAngleDeg: seg.endPoint.rotaryAngleDeg,
          message: `Rotary feed rate ${seg.rotaryFeedDegMin.toFixed(1)} deg/min exceeds max ${machine.maxRotaryFeedDegMin} deg/min.`,
          timestamp: new Date().toISOString(),
        });
      }

      // Check Rapid Plunge into Stock
      if (seg.motionType === MotionType.RAPID) {
        const endRad = Math.hypot(seg.endPoint.partContactPoint.y, seg.endPoint.partContactPoint.z);
        if (endRad < stockRadius - 0.1 && seg.endPoint.partContactPoint.z < stockRadius - 0.1) {
          rapidPlungesCount++;
          diagnostics.push({
            code: 'TOOL_COLLISION',
            severity: 'ERROR',
            segmentIndex: s,
            message: `Rapid motion G0 plunges into raw stock envelope (Radius: ${endRad.toFixed(2)} mm vs Stock: ${stockRadius.toFixed(2)} mm).`,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Check Gouge against CAD Target Core
      const targetMinRadius = setup.wcs.wrapRadiusMm - 12.0; // Target core floor
      const currentCutRad = Math.hypot(seg.endPoint.partContactPoint.y, seg.endPoint.partContactPoint.z);
      if (seg.isCutting && currentCutRad < targetMinRadius - 0.05) {
        gougesCount++;
        diagnostics.push({
          code: 'GOUGE_DETECTED',
          severity: 'ERROR',
          segmentIndex: s,
          message: `Tool gouges below design floor datum (Cut Radius: ${currentCutRad.toFixed(2)} mm < Min: ${targetMinRadius.toFixed(2)} mm).`,
          timestamp: new Date().toISOString(),
        });
      }
    }

    const isValid = (
      axisLimitViolationsCount === 0 &&
      rotaryLimitViolationsCount === 0 &&
      rapidPlungesCount === 0 &&
      gougesCount === 0 &&
      holderCollisionsCount === 0 &&
      fixtureCollisionsCount === 0
    );

    return {
      isValid,
      diagnostics,
      axisLimitViolationsCount,
      rotaryLimitViolationsCount,
      rotaryFeedViolationsCount,
      rapidPlungesCount,
      gougesCount,
      holderCollisionsCount,
      fixtureCollisionsCount,
      singularityCount,
    };
  }
}
