/**
 * SECP Industrial OS - PATCH-326 Mechanical MCAD Enclosure Fit Verifier
 * Rigorously checks PCB & Component fit against a PRE-EXISTING, FIXED mechanical enclosure:
 * Verifies internal cavity boundaries, lid vertical clearance, and mounting standoff alignment.
 */

import {
  PcbCanonicalModel,
  MechanicalTargetEnclosure
} from './PcbCanonicalModel';

export interface MechanicalViolation {
  code: 'PCB-MEC-001' | 'PCB-MEC-002' | 'PCB-MEC-003';
  severity: 'ERROR' | 'WARNING';
  message: string;
  location?: { x: number; y: number; z?: number };
  affectedEntities: string[];
}

export interface MechanicalReport {
  passed: boolean;
  enclosureId: string;
  enclosureName: string;
  boardFitStatus: 'FIT_VERIFIED' | 'CLASH_DETECTED';
  minWallClearanceMm: number;
  minVerticalClearanceMm: number;
  matchedStandoffsCount: number;
  unmatchedStandoffsCount: number;
  violations: MechanicalViolation[];
  timestamp: string;
}

export class PcbMechanicalVerifier {
  private static readonly MOUNTING_ALIGNMENT_TOLERANCE_MM = 0.5;
  private static readonly MIN_RECOMMENDED_LID_CLEARANCE_MM = 1.0;

  /**
   * Main mechanical fit verification entry point
   */
  public static verify(
    model: PcbCanonicalModel,
    overrideEnclosure?: MechanicalTargetEnclosure
  ): MechanicalReport {
    const enclosure = overrideEnclosure || model.targetEnclosure;
    const violations: MechanicalViolation[] = [];

    if (!enclosure) {
      return {
        passed: false,
        enclosureId: 'NONE',
        enclosureName: 'No Target Enclosure Specified',
        boardFitStatus: 'CLASH_DETECTED',
        minWallClearanceMm: 0,
        minVerticalClearanceMm: 0,
        matchedStandoffsCount: 0,
        unmatchedStandoffsCount: 0,
        violations: [{
          code: 'PCB-MEC-001',
          severity: 'ERROR',
          message: 'No mechanical enclosure specified for physical fit audit.',
          affectedEntities: ['enclosure']
        }],
        timestamp: new Date().toISOString()
      };
    }

    // 1. PCB-MEC-001: Board substrate dimensions vs internal cavity
    const xClearance = (enclosure.internalWidthMm - model.boardWidthMm) / 2;
    const yClearance = (enclosure.internalLengthMm - model.boardHeightMm) / 2;
    const minWallClearance = Math.min(xClearance, yClearance);

    if (model.boardWidthMm > enclosure.internalWidthMm || model.boardHeightMm > enclosure.internalLengthMm) {
      violations.push({
        code: 'PCB-MEC-001',
        severity: 'ERROR',
        message: `Board substrate collision with enclosure internal walls: Board (${model.boardWidthMm}x${model.boardHeightMm}mm) exceeds cavity (${enclosure.internalWidthMm}x${enclosure.internalLengthMm}mm).`,
        affectedEntities: ['board_outline', enclosure.id]
      });
    }

    // Check component envelope against internal cavity walls
    for (const comp of model.placements) {
      const compMinX = comp.xMm - comp.widthMm / 2;
      const compMaxX = comp.xMm + comp.widthMm / 2;
      const compMinY = comp.yMm - comp.heightMm / 2;
      const compMaxY = comp.yMm + comp.heightMm / 2;

      if (
        compMinX < 0 || compMaxX > enclosure.internalWidthMm ||
        compMinY < 0 || compMaxY > enclosure.internalLengthMm
      ) {
        violations.push({
          code: 'PCB-MEC-001',
          severity: 'ERROR',
          message: `Component '${comp.refDes}' collides with internal enclosure walls at position (${comp.xMm}, ${comp.yMm}).`,
          location: { x: comp.xMm, y: comp.yMm },
          affectedEntities: [comp.refDes, enclosure.id]
        });
      }
    }

    // 2. PCB-MEC-002: Vertical lid clearance
    // Vertical Stack = Standoff Height + Board Thickness + Component 3D Height
    let minVerticalClearance = enclosure.internalHeightMm;

    for (const comp of model.placements) {
      const totalStackHeight = enclosure.standoffHeightMm + model.thicknessMm + comp.height3dMm;
      const clearanceToLid = enclosure.internalHeightMm - totalStackHeight;
      if (clearanceToLid < minVerticalClearance) {
        minVerticalClearance = clearanceToLid;
      }

      if (clearanceToLid < 0) {
        // Physical vertical clash with lid
        violations.push({
          code: 'PCB-MEC-002',
          severity: 'ERROR',
          message: `Vertical clash with enclosure lid: Component '${comp.refDes}' height (${comp.height3dMm}mm) + stack (${enclosure.standoffHeightMm + model.thicknessMm}mm) = ${totalStackHeight.toFixed(1)}mm exceeds internal height (${enclosure.internalHeightMm}mm) by ${Math.abs(clearanceToLid).toFixed(1)}mm.`,
          location: { x: comp.xMm, y: comp.yMm, z: totalStackHeight },
          affectedEntities: [comp.refDes, 'lid']
        });
      } else if (clearanceToLid < this.MIN_RECOMMENDED_LID_CLEARANCE_MM) {
        violations.push({
          code: 'PCB-MEC-002',
          severity: 'WARNING',
          message: `Tight vertical lid clearance: Component '${comp.refDes}' has only ${clearanceToLid.toFixed(2)}mm clearance to enclosure lid (minimum recommended is ${this.MIN_RECOMMENDED_LID_CLEARANCE_MM}mm).`,
          location: { x: comp.xMm, y: comp.yMm, z: totalStackHeight },
          affectedEntities: [comp.refDes, 'lid']
        });
      }
    }

    // 3. PCB-MEC-003: Standoff mounting hole alignment and diameter matching
    let matchedStandoffsCount = 0;
    let unmatchedStandoffsCount = 0;

    for (const post of enclosure.standoffPosts) {
      // Find matching PCB mounting hole
      const matchingHole = model.mountingHoles.find(hole => {
        const dist = Math.hypot(hole.x - post.x, hole.y - post.y);
        return dist <= this.MOUNTING_ALIGNMENT_TOLERANCE_MM;
      });

      if (!matchingHole) {
        unmatchedStandoffsCount++;
        violations.push({
          code: 'PCB-MEC-003',
          severity: 'ERROR',
          message: `Enclosure standoff '${post.id}' at (${post.x}, ${post.y}) has no matching mounting hole on the PCB.`,
          location: { x: post.x, y: post.y },
          affectedEntities: [post.id]
        });
      } else {
        matchedStandoffsCount++;
        // Check diameter compatibility
        if (matchingHole.diameterMm < enclosure.screwDiameterMm) {
          violations.push({
            code: 'PCB-MEC-003',
            severity: 'ERROR',
            message: `Mounting hole '${matchingHole.id}' diameter (${matchingHole.diameterMm}mm) is smaller than required screw diameter (${enclosure.screwDiameterMm}mm).`,
            location: { x: matchingHole.x, y: matchingHole.y },
            affectedEntities: [matchingHole.id, post.id]
          });
        }
      }
    }

    // Check for components colliding with standoff pillar keepouts on the board
    for (const post of enclosure.standoffPosts) {
      const standoffRadius = post.diameterMm / 2 + 0.5; // keepout margin
      for (const comp of model.placements) {
        const halfW = comp.widthMm / 2;
        const halfH = comp.heightMm / 2;
        // Check if standoff coordinate is inside component bounding box
        if (
          post.x >= comp.xMm - halfW - standoffRadius &&
          post.x <= comp.xMm + halfW + standoffRadius &&
          post.y >= comp.yMm - halfH - standoffRadius &&
          post.y <= comp.yMm + halfH + standoffRadius
        ) {
          violations.push({
            code: 'PCB-MEC-003',
            severity: 'ERROR',
            message: `Component '${comp.refDes}' encroaches on mounting standoff post '${post.id}' keepout area at (${post.x}, ${post.y}).`,
            location: { x: post.x, y: post.y },
            affectedEntities: [comp.refDes, post.id]
          });
        }
      }
    }

    const passed = violations.filter(v => v.severity === 'ERROR').length === 0;

    return {
      passed,
      enclosureId: enclosure.id,
      enclosureName: enclosure.name,
      boardFitStatus: passed ? 'FIT_VERIFIED' : 'CLASH_DETECTED',
      minWallClearanceMm: Math.max(0, minWallClearance),
      minVerticalClearanceMm: Math.max(0, minVerticalClearance),
      matchedStandoffsCount,
      unmatchedStandoffsCount,
      violations,
      timestamp: new Date().toISOString()
    };
  }
}
