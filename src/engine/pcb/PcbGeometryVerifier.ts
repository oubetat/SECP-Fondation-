/**
 * SECP Industrial OS - PATCH-326 PCB Geometry & Design Rule Check (DRC) Verifier
 * Validates board boundary containment, component clearance & collisions,
 * multi-layer trace clearances, minimum trace widths, and coordinate validity.
 */

import {
  PcbCanonicalModel,
  PcbCanonicalModelValidator,
  PcbLayer,
  ComponentLayer
} from './PcbCanonicalModel';

export interface GeometryViolation {
  code:
    | 'PCB-GEO-001'
    | 'PCB-GEO-002'
    | 'PCB-GEO-003'
    | 'PCB-GEO-004'
    | 'PCB-GEO-005'
    | 'PCB-GEO-006'
    | 'PCB-GEO-007'
    | 'PCB-GEO-008'
    | 'PCB-GEO-009';
  severity: 'ERROR' | 'WARNING';
  message: string;
  location?: { x: number; y: number };
  affectedEntities: string[];
}

export interface GeometryReport {
  passed: boolean;
  violationsCount: number;
  warningsCount: number;
  violations: GeometryViolation[];
  safeCrossLayerBypassesCount: number;
  timestamp: string;
}

export class PcbGeometryVerifier {
  /**
   * Distance between a 2D point and a line segment
   */
  private static distPointToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  /**
   * Distance between two line segments
   */
  private static distBetweenSegments(
    p1: { x: number; y: number }, p2: { x: number; y: number },
    p3: { x: number; y: number }, p4: { x: number; y: number }
  ): number {
    // If segments intersect, distance is 0
    if (this.segmentsIntersect(p1, p2, p3, p4)) return 0;
    return Math.min(
      this.distPointToSegment(p1.x, p1.y, p3.x, p3.y, p4.x, p4.y),
      this.distPointToSegment(p2.x, p2.y, p3.x, p3.y, p4.x, p4.y),
      this.distPointToSegment(p3.x, p3.y, p1.x, p1.y, p2.x, p2.y),
      this.distPointToSegment(p4.x, p4.y, p1.x, p1.y, p2.x, p2.y)
    );
  }

  /**
   * Check if two line segments cross
   */
  private static segmentsIntersect(
    a1: { x: number; y: number }, a2: { x: number; y: number },
    b1: { x: number; y: number }, b2: { x: number; y: number }
  ): boolean {
    const ccw = (p1: { x: number; y: number }, p2: { x: number; y: number }, p3: { x: number; y: number }) =>
      (p3.y - p1.y) * (p2.x - p1.x) > (p2.y - p1.y) * (p3.x - p1.x);

    return (ccw(a1, b1, b2) !== ccw(a2, b1, b2)) && (ccw(a1, a2, b1) !== ccw(a1, a2, b2));
  }

  /**
   * Check axis-aligned bounding box intersection with optional margin
   */
  private static aabbOverlap(
    x1: number, y1: number, w1: number, h1: number,
    x2: number, y2: number, w2: number, h2: number,
    clearance: number = 0
  ): boolean {
    const minX1 = x1 - w1 / 2 - clearance;
    const maxX1 = x1 + w1 / 2 + clearance;
    const minY1 = y1 - h1 / 2 - clearance;
    const maxY1 = y1 + h1 / 2 + clearance;

    const minX2 = x2 - w2 / 2;
    const maxX2 = x2 + w2 / 2;
    const minY2 = y2 - h2 / 2;
    const maxY2 = y2 + h2 / 2;

    return !(maxX1 <= minX2 || minX1 >= maxX2 || maxY1 <= minY2 || minY1 >= maxY2);
  }

  /**
   * Main geometry verification
   */
  public static verify(model: PcbCanonicalModel): GeometryReport {
    const violations: GeometryViolation[] = [];
    const minClearance = model.rules?.minClearanceMm ?? 0.2;
    const minTraceWidth = model.rules?.minTraceWidthMm ?? 0.15;
    const boardMargin = model.rules?.boardMarginMm ?? 1.0;
    let safeCrossLayerBypassesCount = 0;

    // 1. PCB-GEO-009: Invalid/unbounded/negative coordinates and dimensions
    if (
      !Number.isFinite(model.boardWidthMm) || model.boardWidthMm <= 0 ||
      !Number.isFinite(model.boardHeightMm) || model.boardHeightMm <= 0 ||
      !Number.isFinite(model.thicknessMm) || model.thicknessMm <= 0
    ) {
      violations.push({
        code: 'PCB-GEO-009',
        severity: 'ERROR',
        message: `Invalid board dimensions: width=${model.boardWidthMm}, height=${model.boardHeightMm}, thickness=${model.thicknessMm}`,
        affectedEntities: ['board_outline']
      });
    }

    // Check placements coordinates
    for (const p of model.placements) {
      if (
        !Number.isFinite(p.xMm) || !Number.isFinite(p.yMm) ||
        !Number.isFinite(p.widthMm) || p.widthMm <= 0 ||
        !Number.isFinite(p.heightMm) || p.heightMm <= 0 ||
        !Number.isFinite(p.height3dMm) || p.height3dMm < 0
      ) {
        violations.push({
          code: 'PCB-GEO-009',
          severity: 'ERROR',
          message: `Placement '${p.refDes}' has non-finite or negative geometry: x=${p.xMm}, y=${p.yMm}, w=${p.widthMm}, h=${p.heightMm}, h3d=${p.height3dMm}`,
          location: { x: p.xMm, y: p.yMm },
          affectedEntities: [p.refDes]
        });
      }
    }

    // Check traces coordinates
    for (const tr of model.traces) {
      if (!Number.isFinite(tr.widthMm) || tr.widthMm <= 0) {
        violations.push({
          code: 'PCB-GEO-009',
          severity: 'ERROR',
          message: `Trace '${tr.id}' has invalid width: ${tr.widthMm}`,
          affectedEntities: [tr.id]
        });
      }
      for (const pt of tr.path) {
        if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) {
          violations.push({
            code: 'PCB-GEO-009',
            severity: 'ERROR',
            message: `Trace '${tr.id}' has invalid non-finite coordinates: (${pt.x}, ${pt.y})`,
            affectedEntities: [tr.id]
          });
          break;
        }
      }
    }

    // 2. PCB-GEO-001: Component placed outside or breaching board boundary
    for (const p of model.placements) {
      const halfW = p.widthMm / 2;
      const halfH = p.heightMm / 2;
      const left = p.xMm - halfW;
      const right = p.xMm + halfW;
      const bottom = p.yMm - halfH;
      const top = p.yMm + halfH;

      if (
        left < boardMargin ||
        right > model.boardWidthMm - boardMargin ||
        bottom < boardMargin ||
        top > model.boardHeightMm - boardMargin
      ) {
        violations.push({
          code: 'PCB-GEO-001',
          severity: 'ERROR',
          message: `Component '${p.refDes}' breaches board boundary margin (${boardMargin}mm). Envelope: [${left.toFixed(1)}, ${bottom.toFixed(1)}] to [${right.toFixed(1)}, ${top.toFixed(1)}] vs board [0, 0] to [${model.boardWidthMm}, ${model.boardHeightMm}].`,
          location: { x: p.xMm, y: p.yMm },
          affectedEntities: [p.refDes]
        });
      }
    }

    // 3. PCB-GEO-002: Trace segment outside board boundary
    for (const tr of model.traces) {
      for (const pt of tr.path) {
        if (
          pt.x < boardMargin ||
          pt.x > model.boardWidthMm - boardMargin ||
          pt.y < boardMargin ||
          pt.y > model.boardHeightMm - boardMargin
        ) {
          violations.push({
            code: 'PCB-GEO-002',
            severity: 'ERROR',
            message: `Trace '${tr.id}' (${tr.netName}) breaches board margin at coordinate (${pt.x.toFixed(2)}, ${pt.y.toFixed(2)}).`,
            location: { x: pt.x, y: pt.y },
            affectedEntities: [tr.id, tr.netName]
          });
          break;
        }
      }
    }

    // 4. PCB-GEO-003: Mounting hole breaches board boundary
    for (const mh of model.mountingHoles) {
      const radius = mh.diameterMm / 2;
      if (
        mh.x - radius < 0 ||
        mh.x + radius > model.boardWidthMm ||
        mh.y - radius < 0 ||
        mh.y + radius > model.boardHeightMm
      ) {
        violations.push({
          code: 'PCB-GEO-003',
          severity: 'ERROR',
          message: `Mounting hole '${mh.id}' (diameter ${mh.diameterMm}mm) extends beyond the board physical edges at (${mh.x}, ${mh.y}).`,
          location: { x: mh.x, y: mh.y },
          affectedEntities: [mh.id]
        });
      }
    }

    // 5. PCB-GEO-004: Component-to-component collision on same layer
    for (let i = 0; i < model.placements.length; i++) {
      const p1 = model.placements[i];
      for (let j = i + 1; j < model.placements.length; j++) {
        const p2 = model.placements[j];
        if (p1.layer !== p2.layer) continue; // Opposing layers do not collide in 2D

        if (this.aabbOverlap(p1.xMm, p1.yMm, p1.widthMm, p1.heightMm, p2.xMm, p2.yMm, p2.widthMm, p2.heightMm, 0.1)) {
          violations.push({
            code: 'PCB-GEO-004',
            severity: 'ERROR',
            message: `Component body collision between '${p1.refDes}' and '${p2.refDes}' on layer ${p1.layer}.`,
            location: { x: (p1.xMm + p2.xMm) / 2, y: (p1.yMm + p2.yMm) / 2 },
            affectedEntities: [p1.refDes, p2.refDes]
          });
        }
      }
    }

    // 6. PCB-GEO-006: Trace width rule compliance
    for (const tr of model.traces) {
      const netDef = model.schematicNets.find(n => n.name === tr.netName);
      const reqWidth = netDef?.requiredWidthMm ?? minTraceWidth;
      if (tr.widthMm < reqWidth) {
        violations.push({
          code: 'PCB-GEO-006',
          severity: 'ERROR',
          message: `Trace '${tr.id}' for net '${tr.netName}' has width ${tr.widthMm}mm, violating required minimum ${reqWidth}mm.`,
          affectedEntities: [tr.id, tr.netName]
        });
      }
    }

    // 7. PCB-GEO-007 & PCB-GEO-008: Trace crossings (Same Layer vs Different Layers)
    for (let i = 0; i < model.traces.length; i++) {
      const t1 = model.traces[i];
      for (let j = i + 1; j < model.traces.length; j++) {
        const t2 = model.traces[j];
        if (t1.netName === t2.netName) continue; // Branching permitted

        for (let s1 = 0; s1 < t1.path.length - 1; s1++) {
          for (let s2 = 0; s2 < t2.path.length - 1; s2++) {
            const crosses = this.segmentsIntersect(t1.path[s1], t1.path[s1 + 1], t2.path[s2], t2.path[s2 + 1]);
            if (crosses) {
              if (t1.layer === t2.layer) {
                // PCB-GEO-007: Illegal same-layer crossing
                violations.push({
                  code: 'PCB-GEO-007',
                  severity: 'ERROR',
                  message: `Illegal trace intersection on same layer (${t1.layer}) between different nets '${t1.netName}' and '${t2.netName}'.`,
                  location: { x: t1.path[s1].x, y: t1.path[s1].y },
                  affectedEntities: [t1.id, t2.id]
                });
              } else {
                // PCB-GEO-008: Allowed crossing on different copper layers (e.g. TOP vs BOTTOM)
                safeCrossLayerBypassesCount++;
              }
            }
          }
        }
      }
    }

    // 8. PCB-GEO-005: Clearance between traces of different nets on same layer
    for (let i = 0; i < model.traces.length; i++) {
      const t1 = model.traces[i];
      for (let j = i + 1; j < model.traces.length; j++) {
        const t2 = model.traces[j];
        if (t1.netName === t2.netName) continue;
        if (t1.layer !== t2.layer) continue;

        for (let s1 = 0; s1 < t1.path.length - 1; s1++) {
          for (let s2 = 0; s2 < t2.path.length - 1; s2++) {
            const dist = this.distBetweenSegments(t1.path[s1], t1.path[s1 + 1], t2.path[s2], t2.path[s2 + 1]);
            const copperDistance = dist - (t1.widthMm / 2 + t2.widthMm / 2);
            if (copperDistance >= 0 && copperDistance < minClearance) {
              violations.push({
                code: 'PCB-GEO-005',
                severity: 'ERROR',
                message: `Insufficient electrical clearance on ${t1.layer} between net '${t1.netName}' and '${t2.netName}': ${copperDistance.toFixed(3)}mm < minimum rule ${minClearance}mm.`,
                location: { x: t1.path[s1].x, y: t1.path[s1].y },
                affectedEntities: [t1.id, t2.id]
              });
              break;
            }
          }
        }
      }
    }

    return {
      passed: violations.filter(v => v.severity === 'ERROR').length === 0,
      violationsCount: violations.filter(v => v.severity === 'ERROR').length,
      warningsCount: violations.filter(v => v.severity === 'WARNING').length,
      violations,
      safeCrossLayerBypassesCount,
      timestamp: new Date().toISOString()
    };
  }
}
