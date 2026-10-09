/**
 * SECP Industrial OS v2 — CAM Production Engine
 * PATCH-256 — Toolpath Validator & Safety Checker
 */

import {
  Toolpath,
  CuttingTool,
  MachiningSetup,
  ToolpathValidationReport,
  MotionType,
  CollisionEvent,
  GougeEvent,
} from './ToolpathTypes';
import { SafetyClearanceEngine } from './SafetyClearanceEngine';

export class ToolpathValidator {
  /**
   * Comprehensive validation of generated toolpath against physics, boundaries, and geometry
   */
  public static validateToolpath(
    toolpath: Toolpath,
    tool: CuttingTool,
    setup: MachiningSetup,
    maxAllowedStepdownMm: number,
    targetFloorZ?: number
  ): ToolpathValidationReport {
    const diagnostics: string[] = [];
    let isValid = true;
    let nanCount = 0;
    let maxStepdownExceeded = false;
    let boundaryViolations = 0;
    let safeRetractVerified = true;

    if (!toolpath || toolpath.positions.length === 0) {
      return {
        isValid: false,
        operationId: toolpath ? toolpath.operationId : 'UNKNOWN',
        totalSegments: 0,
        rapidSegments: 0,
        cuttingSegments: 0,
        collisions: [],
        gouges: [],
        diagnostics: ['FATAL: Toolpath contains zero tool positions or segments'],
        maxStepdownExceeded: false,
        boundaryViolations: 0,
        nanCoordinatesCount: 0,
        safeRetractVerified: false,
      };
    }

    let rapidCount = 0;
    let cuttingCount = 0;

    // 1. Numerical Sanitization: Check for NaN/Infinity
    for (let i = 0; i < toolpath.positions.length; i++) {
      const p = toolpath.positions[i];
      if (
        isNaN(p.x) || isNaN(p.y) || isNaN(p.z) ||
        !isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z)
      ) {
        nanCount++;
        isValid = false;
        diagnostics.push(`CRITICAL: NaN/Infinity coordinate found at index ${i}`);
      }
    }

    // 2. Segment Analysis & Max Stepdown Check
    for (const seg of toolpath.segments) {
      if (seg.motionType === MotionType.RAPID || seg.motionType === MotionType.RETRACT) {
        rapidCount++;
      } else {
        cuttingCount++;
      }

      // Check vertical plunge/stepdown distance in single feed move
      if (seg.motionType === MotionType.FEED) {
        const deltaZ = Math.abs(seg.endPoint.z - seg.startPoint.z);
        if (deltaZ > maxAllowedStepdownMm * 1.05 && deltaZ > 0.01) {
          maxStepdownExceeded = true;
          diagnostics.push(
            `WARNING: Single-pass cutting stepdown of ${deltaZ.toFixed(2)}mm exceeds maximum allowed stepdown of ${maxAllowedStepdownMm.toFixed(2)}mm`
          );
        }
      }

      // 3. Stock Boundary Containment Check
      const stock = setup.stock.boundsMm;
      const margin = tool.diameterMm * 2.0; // Allow reasonable lead-in/lead-out margin
      if (
        seg.endPoint.x < stock.minX - margin ||
        seg.endPoint.x > stock.maxX + margin ||
        seg.endPoint.y < stock.minY - margin ||
        seg.endPoint.y > stock.maxY + margin
      ) {
        boundaryViolations++;
        diagnostics.push(
          `BOUNDARY_VIOLATION: Toolpath point [${seg.endPoint.x.toFixed(1)}, ${seg.endPoint.y.toFixed(1)}] exceeds machine workspace limits`
        );
      }
    }

    // 4. Safe Retract Verification (Initial and final points must be at or above Retract plane)
    const firstPos = toolpath.positions[0];
    const lastPos = toolpath.positions[toolpath.positions.length - 1];

    if (firstPos.z < setup.retractPlaneZMm - 0.01 || lastPos.z < setup.retractPlaneZMm - 0.01) {
      safeRetractVerified = false;
      diagnostics.push(
        `SAFETY: Entry or exit motion did not respect retract plane Z=${setup.retractPlaneZMm}mm (Entry Z=${firstPos.z}, Exit Z=${lastPos.z})`
      );
    }

    // 5. Collision & Gouge Detection
    const collisions = SafetyClearanceEngine.checkCollisions(
      toolpath.segments,
      tool,
      setup.safePlaneZMm,
      setup.stock.boundsMm,
      setup.fixtureBounds
    );

    let gouges: GougeEvent[] = [];
    if (targetFloorZ !== undefined) {
      gouges = SafetyClearanceEngine.checkGouging(
        toolpath.segments,
        targetFloorZ,
        tool,
        0.0
      );
    }

    if (collisions.length > 0) {
      isValid = false;
      diagnostics.push(`COLLISION: ${collisions.length} collision event(s) detected during toolpath simulation`);
    }

    if (gouges.length > 0) {
      isValid = false;
      diagnostics.push(`GOUGE: ${gouges.length} part gouge event(s) detected below specified floor level`);
    }

    if (nanCount > 0 || boundaryViolations > 0) {
      isValid = false;
    }

    if (isValid) {
      diagnostics.push('VALIDATION_PASSED: Toolpath conforms to 3-axis geometric, kinematic, and clearance requirements');
    }

    return {
      isValid,
      operationId: toolpath.operationId,
      totalSegments: toolpath.segments.length,
      rapidSegments: rapidCount,
      cuttingSegments: cuttingCount,
      collisions,
      gouges,
      diagnostics,
      maxStepdownExceeded,
      boundaryViolations,
      nanCoordinatesCount: nanCount,
      safeRetractVerified,
    };
  }
}
