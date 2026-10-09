/**
 * PATCH-191 — Interactive CAD Sketcher Mathematical Kernel
 */

import {
  IndustrialSketchDefinition,
  IndustrialSketchEntity,
  IndustrialSketchConstraint,
  SketchPoint2D,
  SketchLine2D,
  SketchCircle2D,
  SketchArc2D,
  IndustrialConstraintType
} from './IndustrialConstraintTypes';
import { IndustrialVariationalSolver } from './IndustrialVariationalSolver';

export interface Vector2D {
  x: number;
  y: number;
}

export interface SketchSpline2D {
  id: string;
  type: 'SPLINE';
  controlPointIds: string[];
  degree: number;
}

export type ExtendedSketchEntity = IndustrialSketchEntity | SketchSpline2D;

export type SnapType =
  | 'ENDPOINT'
  | 'MIDPOINT'
  | 'CENTER'
  | 'INTERSECTION'
  | 'QUADRANT'
  | 'NEAREST'
  | 'HORIZONTAL'
  | 'VERTICAL'
  | 'GRID';

export interface SnapResult {
  point: Vector2D;
  type: SnapType;
  targetEntityId?: string;
  confidence: number; // 0 to 1
}

export class InteractiveSketchEngine {
  // Safe, environment-independent random ID generator
  public static randomId(): string {
    return Math.random().toString(36).substring(2, 10);
  }

  // ============================================================================
  // 1. GEOMETRICAL VECTOR MATH
  // ============================================================================

  public static dist(p1: Vector2D, p2: Vector2D): number {
    return Math.hypot(p2.x - p1.x, p2.y - p1.y);
  }

  public static projectPointToLine(p: Vector2D, start: Vector2D, end: Vector2D): { point: Vector2D; t: number } {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return { point: { ...start }, t: 0 };

    let t = ((p.x - start.x) * dx + (p.y - start.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    return {
      point: {
        x: start.x + t * dx,
        y: start.y + t * dy,
      },
      t,
    };
  }

  // ============================================================================
  // 2. INTERSECTION MATHEMATICS
  // ============================================================================

  public static getLineLineIntersection(
    p1: Vector2D, p2: Vector2D,
    p3: Vector2D, p4: Vector2D,
    infinite = false
  ): Vector2D | null {
    const denom = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
    if (Math.abs(denom) < 1e-10) return null;

    const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denom;
    const u = ((p1.x - p3.x) * (p1.y - p2.y) - (p1.y - p3.y) * (p1.x - p2.x)) / denom;

    if (infinite || (t >= -1e-6 && t <= 1 + 1e-6 && u >= -1e-6 && u <= 1 + 1e-6)) {
      return {
        x: p1.x + t * (p2.x - p1.x),
        y: p1.y + t * (p2.y - p1.y),
      };
    }
    return null;
  }

  public static getLineCircleIntersections(
    start: Vector2D, end: Vector2D,
    center: Vector2D, radius: number
  ): Vector2D[] {
    const d = { x: end.x - start.x, y: end.y - start.y };
    const f = { x: start.x - center.x, y: start.y - center.y };

    const a = d.x * d.x + d.y * d.y;
    const b = 2 * (f.x * d.x + f.y * d.y);
    const c = (f.x * f.x + f.y * f.y) - radius * radius;

    if (a === 0) return [];

    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return [];

    const t1 = (-b - Math.sqrt(discriminant)) / (2 * a);
    const t2 = (-b + Math.sqrt(discriminant)) / (2 * a);

    const results: Vector2D[] = [];
    if (t1 >= 0 && t1 <= 1) {
      results.push({ x: start.x + t1 * d.x, y: start.y + t1 * d.y });
    }
    if (t2 >= 0 && t2 <= 1 && Math.abs(t1 - t2) > 1e-6) {
      results.push({ x: start.x + t2 * d.x, y: start.y + t2 * d.y });
    }
    return results;
  }

  public static getCircleCircleIntersections(
    c1: Vector2D, r1: number,
    c2: Vector2D, r2: number
  ): Vector2D[] {
    const d = this.dist(c1, c2);
    if (d > r1 + r2 || d < Math.abs(r1 - r2) || d === 0) return [];

    const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));

    const pMid = {
      x: c1.x + (a * (c2.x - c1.x)) / d,
      y: c1.y + (a * (c2.y - c1.y)) / d,
    };

    const p1 = {
      x: pMid.x + (h * (c2.y - c1.y)) / d,
      y: pMid.y - (h * (c2.x - c1.x)) / d,
    };
    const p2 = {
      x: pMid.x - (h * (c2.y - c1.y)) / d,
      y: pMid.y + (h * (c2.x - c1.x)) / d,
    };

    if (this.dist(p1, p2) < 1e-6) return [p1];
    return [p1, p2];
  }

  public static getIntersections(e1: ExtendedSketchEntity, e2: ExtendedSketchEntity, entities: Record<string, ExtendedSketchEntity>): Vector2D[] {
    if (e1.id === e2.id) return [];

    if (e1.type === 'LINE' && e2.type === 'LINE') {
      const p1a = entities[e1.startPointId] as SketchPoint2D;
      const p1b = entities[e1.endPointId] as SketchPoint2D;
      const p2a = entities[e2.startPointId] as SketchPoint2D;
      const p2b = entities[e2.endPointId] as SketchPoint2D;
      if (p1a && p1b && p2a && p2b) {
        const p = this.getLineLineIntersection(p1a, p1b, p2a, p2b);
        return p ? [p] : [];
      }
    }

    if (e1.type === 'LINE' && (e2.type === 'CIRCLE' || e2.type === 'ARC')) {
      const p1a = entities[e1.startPointId] as SketchPoint2D;
      const p1b = entities[e1.endPointId] as SketchPoint2D;
      const center = entities[e2.centerPointId] as SketchPoint2D;
      if (p1a && p1b && center) {
        return this.getLineCircleIntersections(p1a, p1b, center, e2.radius);
      }
    }

    if ((e1.type === 'CIRCLE' || e1.type === 'ARC') && e2.type === 'LINE') {
      return this.getIntersections(e2, e1, entities);
    }

    if ((e1.type === 'CIRCLE' || e1.type === 'ARC') && (e2.type === 'CIRCLE' || e2.type === 'ARC')) {
      const c1 = entities[e1.centerPointId] as SketchPoint2D;
      const c2 = entities[e2.centerPointId] as SketchPoint2D;
      if (c1 && c2) {
        return this.getCircleCircleIntersections(c1, e1.radius, c2, e2.radius);
      }
    }

    return [];
  }

  // ============================================================================
  // 3. ENHANCED ENGINEERING SNAP ENGINE
  // ============================================================================

  public static computeSnap(
    cursor: Vector2D,
    sketch: IndustrialSketchDefinition,
    gridSize = 20,
    snapThreshold = 10,
    gridEnabled = true
  ): SnapResult | null {
    const candidates: SnapResult[] = [];
    const entities = sketch.entities;

    // A. Grid Snap
    if (gridEnabled) {
      const gx = Math.round(cursor.x / gridSize) * gridSize;
      const gy = Math.round(cursor.y / gridSize) * gridSize;
      const gDist = Math.hypot(cursor.x - gx, cursor.y - gy);
      if (gDist < snapThreshold) {
        candidates.push({
          point: { x: gx, y: gy },
          type: 'GRID',
          confidence: 0.3 * (1 - gDist / snapThreshold),
        });
      }
    }

    // B. Entity Specific Snap Points
    for (const ent of Object.values(entities)) {
      if (ent.type === 'POINT') {
        const pt = ent as SketchPoint2D;
        const dist = this.dist(cursor, pt);
        if (dist < snapThreshold) {
          candidates.push({
            point: { x: pt.x, y: pt.y },
            type: 'ENDPOINT',
            targetEntityId: pt.id,
            confidence: 0.95 * (1 - dist / snapThreshold),
          });
        }
      } else if (ent.type === 'LINE') {
        const line = ent as SketchLine2D;
        const p1 = entities[line.startPointId] as SketchPoint2D;
        const p2 = entities[line.endPointId] as SketchPoint2D;
        if (p1 && p2) {
          // Endpoint Snapping
          const d1 = this.dist(cursor, p1);
          if (d1 < snapThreshold) {
            candidates.push({
              point: { x: p1.x, y: p1.y },
              type: 'ENDPOINT',
              targetEntityId: line.id,
              confidence: 0.9 * (1 - d1 / snapThreshold),
            });
          }
          const d2 = this.dist(cursor, p2);
          if (d2 < snapThreshold) {
            candidates.push({
              point: { x: p2.x, y: p2.y },
              type: 'ENDPOINT',
              targetEntityId: line.id,
              confidence: 0.9 * (1 - d2 / snapThreshold),
            });
          }

          // Midpoint Snap
          const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
          const dMid = this.dist(cursor, mid);
          if (dMid < snapThreshold) {
            candidates.push({
              point: mid,
              type: 'MIDPOINT',
              targetEntityId: line.id,
              confidence: 0.8 * (1 - dMid / snapThreshold),
            });
          }

          // Nearest on Line Segment Snap
          const { point: proj, t } = this.projectPointToLine(cursor, p1, p2);
          const dProj = this.dist(cursor, proj);
          if (dProj < snapThreshold) {
            candidates.push({
              point: proj,
              type: 'NEAREST',
              targetEntityId: line.id,
              confidence: 0.6 * (1 - dProj / snapThreshold),
            });
          }
        }
      } else if (ent.type === 'CIRCLE' || ent.type === 'ARC') {
        const circ = ent as SketchCircle2D | SketchArc2D;
        const center = entities[circ.centerPointId] as SketchPoint2D;
        if (center) {
          // Center Snap
          const dCenter = this.dist(cursor, center);
          if (dCenter < snapThreshold) {
            candidates.push({
              point: { x: center.x, y: center.y },
              type: 'CENTER',
              targetEntityId: circ.id,
              confidence: 0.85 * (1 - dCenter / snapThreshold),
            });
          }

          // Arc Start/End Snap
          if (circ.type === 'ARC') {
            const arc = circ as SketchArc2D;
            const sPt = entities[arc.startPointId] as SketchPoint2D;
            const ePt = entities[arc.endPointId] as SketchPoint2D;
            if (sPt && ePt) {
              const dS = this.dist(cursor, sPt);
              if (dS < snapThreshold) {
                candidates.push({
                  point: { x: sPt.x, y: sPt.y },
                  type: 'ENDPOINT',
                  targetEntityId: arc.id,
                  confidence: 0.9 * (1 - dS / snapThreshold),
                });
              }
              const dE = this.dist(cursor, ePt);
              if (dE < snapThreshold) {
                candidates.push({
                  point: { x: ePt.x, y: ePt.y },
                  type: 'ENDPOINT',
                  targetEntityId: arc.id,
                  confidence: 0.9 * (1 - dE / snapThreshold),
                });
              }
            }
          }

          // Quadrants Snapping
          const quadrants = [
            { x: center.x, y: center.y - circ.radius }, // Top
            { x: center.x, y: center.y + circ.radius }, // Bottom
            { x: center.x - circ.radius, y: center.y }, // Left
            { x: center.x + circ.radius, y: center.y }, // Right
          ];
          quadrants.forEach(q => {
            const dQ = this.dist(cursor, q);
            if (dQ < snapThreshold) {
              candidates.push({
                point: q,
                type: 'QUADRANT',
                targetEntityId: circ.id,
                confidence: 0.7 * (1 - dQ / snapThreshold),
              });
            }
          });

          // Nearest on Circle Snap
          const angle = Math.atan2(cursor.y - center.y, cursor.x - center.x);
          const nearestOnCirc = {
            x: center.x + Math.cos(angle) * circ.radius,
            y: center.y + Math.sin(angle) * circ.radius,
          };
          const dNear = this.dist(cursor, nearestOnCirc);
          if (dNear < snapThreshold) {
            candidates.push({
              point: nearestOnCirc,
              type: 'NEAREST',
              targetEntityId: circ.id,
              confidence: 0.55 * (1 - dNear / snapThreshold),
            });
          }
        }
      }
    }

    // Intersections Snapping (dynamic cross-calculation)
    const entsList = Object.values(entities);
    for (let i = 0; i < entsList.length; i++) {
      for (let j = i + 1; j < entsList.length; j++) {
        const ipts = this.getIntersections(entsList[i], entsList[j], entities);
        for (const pt of ipts) {
          const dI = this.dist(cursor, pt);
          if (dI < snapThreshold) {
            candidates.push({
              point: pt,
              type: 'INTERSECTION',
              targetEntityId: `${entsList[i].id}&${entsList[j].id}`,
              confidence: 0.95 * (1 - dI / snapThreshold),
            });
          }
        }
      }
    }

    if (candidates.length === 0) return null;

    // Pick highest confidence snap
    candidates.sort((a, b) => b.confidence - a.confidence);
    return candidates[0];
  }

  // ============================================================================
  // 4. CAD OPERATIONS (TRIM, EXTEND, OFFSET, MIRROR, PATTERN)
  // ============================================================================

  /**
   * Pure mathematical Trim operation on an entity
   */
  public static executeTrim(
    targetEntityId: string,
    clickPoint: Vector2D,
    sketch: IndustrialSketchDefinition
  ): IndustrialSketchDefinition {
    // Deep clone
    const res: IndustrialSketchDefinition = JSON.parse(JSON.stringify(sketch));
    const target = res.entities[targetEntityId];
    if (!target) return res;

    // Support trim for Line, Arc, Circle
    if (target.type === 'LINE') {
      const line = target as SketchLine2D;
      const p1 = res.entities[line.startPointId] as SketchPoint2D;
      const p2 = res.entities[line.endPointId] as SketchPoint2D;
      if (!p1 || !p2) return res;

      // 1. Gather all intersections of this line with other elements
      const intersections: Vector2D[] = [];
      for (const ent of Object.values(res.entities)) {
        if (ent.id === targetEntityId) continue;
        const pts = this.getIntersections(target, ent, res.entities);
        pts.forEach(p => {
          if (!intersections.some(existing => this.dist(existing, p) < 1e-4)) {
            intersections.push(p);
          }
        });
      }

      // 2. Map intersection points to parametric parameter t [0, 1]
      const tValues: number[] = [0, 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const lenSq = dx * dx + dy * dy;

      intersections.forEach(p => {
        let t = ((p.x - p1.x) * dx + (p.y - p1.y) * dy) / lenSq;
        if (t > 1e-4 && t < 1 - 1e-4) {
          tValues.push(t);
        }
      });

      tValues.sort((a, b) => a - b);

      // 3. Find which segment contains the clickPoint
      let clickT = ((clickPoint.x - p1.x) * dx + (clickPoint.y - p1.y) * dy) / lenSq;
      clickT = Math.max(0, Math.min(1, clickT));

      let segmentIndex = -1;
      for (let i = 0; i < tValues.length - 1; i++) {
        if (clickT >= tValues[i] && clickT <= tValues[i + 1]) {
          segmentIndex = i;
          break;
        }
      }

      if (segmentIndex === -1) return res;

      // 4. Remove target line, split into segments other than click-segment
      delete res.entities[targetEntityId];

      // Remove constraint references of the deleted line
      for (const cId of Object.keys(res.constraints)) {
        if (res.constraints[cId].entityIds.includes(targetEntityId)) {
          delete res.constraints[cId];
        }
      }

      for (let i = 0; i < tValues.length - 1; i++) {
        if (i === segmentIndex) continue; // The trimmed segment

        const sT = tValues[i];
        const eT = tValues[i + 1];

        const startPt: Vector2D = { x: p1.x + sT * dx, y: p1.y + sT * dy };
        const endPt: Vector2D = { x: p1.x + eT * dx, y: p1.y + eT * dy };

        const sId = `pt-trim-${this.randomId()}`;
        const eId = `pt-trim-${this.randomId()}`;
        const lId = `line-trim-${this.randomId()}`;

        res.entities[sId] = { id: sId, type: 'POINT', x: startPt.x, y: startPt.y };
        res.entities[eId] = { id: eId, type: 'POINT', x: endPt.x, y: endPt.y };
        res.entities[lId] = { id: lId, type: 'LINE', startPointId: sId, endPointId: eId } as SketchLine2D;

        // Auto-Coincident for split points
        if (sT === 0) {
          res.entities[sId] = { id: sId, type: 'POINT', x: p1.x, y: p1.y, isFixed: p1.isFixed };
        }
        if (eT === 1) {
          res.entities[eId] = { id: eId, type: 'POINT', x: p2.x, y: p2.y, isFixed: p2.isFixed };
        }
      }
    } else if (target.type === 'CIRCLE') {
      const circle = target as SketchCircle2D;
      const center = res.entities[circle.centerPointId] as SketchPoint2D;
      if (!center) return res;

      // Simple click-trim of a circle transforms it into an Arc if intersected!
      const intersections: Vector2D[] = [];
      for (const ent of Object.values(res.entities)) {
        if (ent.id === targetEntityId) continue;
        const pts = this.getIntersections(target, ent, res.entities);
        pts.forEach(p => {
          if (!intersections.some(existing => this.dist(existing, p) < 1e-4)) {
            intersections.push(p);
          }
        });
      }

      if (intersections.length >= 2) {
        // Map to angles
        const angles = intersections.map(p => Math.atan2(p.y - center.y, p.x - center.x));
        angles.sort((a, b) => a - b);

        const clickAngle = Math.atan2(clickPoint.y - center.y, clickPoint.x - center.x);

        let clickSeg = -1;
        for (let i = 0; i < angles.length; i++) {
          const a1 = angles[i];
          const a2 = angles[(i + 1) % angles.length];
          let inSeg = false;
          if (a1 <= a2) {
            inSeg = clickAngle >= a1 && clickAngle <= a2;
          } else {
            inSeg = clickAngle >= a1 || clickAngle <= a2;
          }
          if (inSeg) {
            clickSeg = i;
            break;
          }
        }

        if (clickSeg !== -1) {
          delete res.entities[targetEntityId];

          // Create Arc for the other segments
          for (let i = 0; i < angles.length; i++) {
            if (i === clickSeg) continue;

            const a1 = angles[i];
            const a2 = angles[(i + 1) % angles.length];

            const sPt = { x: center.x + Math.cos(a1) * circle.radius, y: center.y + Math.sin(a1) * circle.radius };
            const ePt = { x: center.x + Math.cos(a2) * circle.radius, y: center.y + Math.sin(a2) * circle.radius };

            const sId = `pt-trim-${this.randomId()}`;
            const eId = `pt-trim-${this.randomId()}`;
            const arcId = `arc-trim-${this.randomId()}`;

            res.entities[sId] = { id: sId, type: 'POINT', x: sPt.x, y: sPt.y };
            res.entities[eId] = { id: eId, type: 'POINT', x: ePt.x, y: ePt.y };
            res.entities[arcId] = {
              id: arcId,
              type: 'ARC',
              centerPointId: circle.centerPointId,
              startPointId: sId,
              endPointId: eId,
              radius: circle.radius
            } as SketchArc2D;
          }
        }
      } else {
        // No intersections: trim circle deletes it entirely
        delete res.entities[targetEntityId];
      }
    }

    return res;
  }

  /**
   * Extend line / arc to nearest intersecting geometry
   */
  public static executeExtend(
    targetEntityId: string,
    sketch: IndustrialSketchDefinition
  ): IndustrialSketchDefinition {
    const res: IndustrialSketchDefinition = JSON.parse(JSON.stringify(sketch));
    const target = res.entities[targetEntityId];
    if (!target || target.type !== 'LINE') return res; // Line support standard

    const line = target as SketchLine2D;
    const p1 = res.entities[line.startPointId] as SketchPoint2D;
    const p2 = res.entities[line.endPointId] as SketchPoint2D;
    if (!p1 || !p2) return res;

    // Try extending from P2 direction
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) return res;

    const udx = dx / len;
    const udy = dy / len;

    // Create infinite ray from P1 in P2 direction: P1 + t * uD
    let minT = Infinity;
    let bestIntersection: Vector2D | null = null;

    for (const ent of Object.values(res.entities)) {
      if (ent.id === targetEntityId) continue;

      if (ent.type === 'LINE') {
        const otherLine = ent as SketchLine2D;
        const o1 = res.entities[otherLine.startPointId] as SketchPoint2D;
        const o2 = res.entities[otherLine.endPointId] as SketchPoint2D;
        if (o1 && o2) {
          // Ray P1 + t*uD intersecting with segment o1-o2
          const infiniteP2 = { x: p1.x + udx * 10000, y: p1.y + udy * 10000 };
          const ipt = this.getLineLineIntersection(p1, infiniteP2, o1, o2);
          if (ipt) {
            const t = ((ipt.x - p1.x) * udx + (ipt.y - p1.y) * udy);
            if (t > len + 1e-4 && t < minT) {
              minT = t;
              bestIntersection = ipt;
            }
          }
        }
      } else if (ent.type === 'CIRCLE') {
        const circ = ent as SketchCircle2D;
        const center = res.entities[circ.centerPointId] as SketchPoint2D;
        if (center) {
          const infiniteP2 = { x: p1.x + udx * 10000, y: p1.y + udy * 10000 };
          const ipts = this.getLineCircleIntersections(p1, infiniteP2, center, circ.radius);
          for (const ipt of ipts) {
            const t = ((ipt.x - p1.x) * udx + (ipt.y - p1.y) * udy);
            if (t > len + 1e-4 && t < minT) {
              minT = t;
              bestIntersection = ipt;
            }
          }
        }
      }
    }

    if (bestIntersection) {
      // Update end point coordinates to extend
      p2.x = bestIntersection.x;
      p2.y = bestIntersection.y;
    }

    return res;
  }

  /**
   * Split a Line at a specific coordinate
   */
  public static executeSplit(
    targetEntityId: string,
    splitPoint: Vector2D,
    sketch: IndustrialSketchDefinition
  ): IndustrialSketchDefinition {
    const res: IndustrialSketchDefinition = JSON.parse(JSON.stringify(sketch));
    const target = res.entities[targetEntityId];
    if (!target || target.type !== 'LINE') return res;

    const line = target as SketchLine2D;
    const p1 = res.entities[line.startPointId] as SketchPoint2D;
    const p2 = res.entities[line.endPointId] as SketchPoint2D;
    if (!p1 || !p2) return res;

    // Remove the target line
    delete res.entities[targetEntityId];

    // Remove constraint references to the deleted line
    for (const cId of Object.keys(res.constraints)) {
      if (res.constraints[cId].entityIds.includes(targetEntityId)) {
        delete res.constraints[cId];
      }
    }

    // Create a new split point entity
    const splitPtId = `pt-split-${this.randomId()}`;
    res.entities[splitPtId] = {
      id: splitPtId,
      type: 'POINT',
      x: splitPoint.x,
      y: splitPoint.y
    };

    // Create Line 1
    const l1Id = `line-split-${this.randomId()}`;
    res.entities[l1Id] = {
      id: l1Id,
      type: 'LINE',
      startPointId: line.startPointId,
      endPointId: splitPtId,
      isConstruction: line.isConstruction
    } as SketchLine2D;

    // Create Line 2
    const l2Id = `line-split-${this.randomId()}`;
    res.entities[l2Id] = {
      id: l2Id,
      type: 'LINE',
      startPointId: splitPtId,
      endPointId: line.endPointId,
      isConstruction: line.isConstruction
    } as SketchLine2D;

    return res;
  }

  /**
   * Offset geometry helper
   */
  public static executeOffset(
    targetEntityId: string,
    offsetDist: number,
    sketch: IndustrialSketchDefinition
  ): IndustrialSketchDefinition {
    const res: IndustrialSketchDefinition = JSON.parse(JSON.stringify(sketch));
    const target = res.entities[targetEntityId];
    if (!target) return res;

    if (target.type === 'LINE') {
      const line = target as SketchLine2D;
      const p1 = res.entities[line.startPointId] as SketchPoint2D;
      const p2 = res.entities[line.endPointId] as SketchPoint2D;
      if (!p1 || !p2) return res;

      // Normal vector
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy);
      if (len === 0) return res;

      const nx = -dy / len;
      const ny = dx / len;

      const oP1: Vector2D = { x: p1.x + nx * offsetDist, y: p1.y + ny * offsetDist };
      const oP2: Vector2D = { x: p2.x + nx * offsetDist, y: p2.y + ny * offsetDist };

      const sId = `pt-offset-${this.randomId()}`;
      const eId = `pt-offset-${this.randomId()}`;
      const lId = `line-offset-${this.randomId()}`;

      res.entities[sId] = { id: sId, type: 'POINT', x: oP1.x, y: oP1.y };
      res.entities[eId] = { id: eId, type: 'POINT', x: oP2.x, y: oP2.y };
      res.entities[lId] = { id: lId, type: 'LINE', startPointId: sId, endPointId: eId } as SketchLine2D;

      // Add parallel constraint automatically
      const cId = `c-offset-${this.randomId()}`;
      res.constraints[cId] = {
        id: cId,
        type: 'PARALLEL',
        entityIds: [targetEntityId, lId],
      };
    } else if (target.type === 'CIRCLE') {
      const circ = target as SketchCircle2D;
      const center = res.entities[circ.centerPointId] as SketchPoint2D;
      if (!center) return res;

      const cId = `pt-offset-${this.randomId()}`;
      const circId = `circ-offset-${this.randomId()}`;

      // concentric circle
      res.entities[cId] = { id: cId, type: 'POINT', x: center.x, y: center.y, isFixed: center.isFixed };
      res.entities[circId] = {
        id: circId,
        type: 'CIRCLE',
        centerPointId: cId,
        radius: Math.max(5, circ.radius + offsetDist)
      } as SketchCircle2D;

      // Add Concentric constraint
      const constraintId = `c-offset-${this.randomId()}`;
      res.constraints[constraintId] = {
        id: constraintId,
        type: 'CONCENTRIC',
        entityIds: [targetEntityId, circId],
      };
    }

    return res;
  }

  /**
   * Mirror geometry across a line
   */
  public static executeMirror(
    selectedEntityIds: string[],
    mirrorLineId: string, // Can be 'X', 'Y', or another line ID
    sketch: IndustrialSketchDefinition
  ): IndustrialSketchDefinition {
    const res: IndustrialSketchDefinition = JSON.parse(JSON.stringify(sketch));

    let mirrorPoint: Vector2D = { x: 0, y: 0 };
    let mirrorDir: Vector2D = { x: 1, y: 0 }; // Default x axis

    if (mirrorLineId === 'X') {
      mirrorPoint = { x: 0, y: 0 };
      mirrorDir = { x: 1, y: 0 };
    } else if (mirrorLineId === 'Y') {
      mirrorPoint = { x: 0, y: 0 };
      mirrorDir = { x: 0, y: 1 };
    } else {
      const line = res.entities[mirrorLineId] as SketchLine2D;
      if (line) {
        const p1 = res.entities[line.startPointId] as SketchPoint2D;
        const p2 = res.entities[line.endPointId] as SketchPoint2D;
        if (p1 && p2) {
          mirrorPoint = { x: p1.x, y: p1.y };
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const len = Math.hypot(dx, dy);
          if (len > 0) {
            mirrorDir = { x: dx / len, y: dy / len };
          }
        }
      }
    }

    const mirrorPointHelper = (p: Vector2D): Vector2D => {
      // Vector from mirrorPoint to p
      const vx = p.x - mirrorPoint.x;
      const vy = p.y - mirrorPoint.y;
      // Dot product projection along mirrorDir
      const proj = vx * mirrorDir.x + vy * mirrorDir.y;
      // Closest point on line
      const cx = mirrorPoint.x + proj * mirrorDir.x;
      const cy = mirrorPoint.y + proj * mirrorDir.y;
      // Mirror is closest + (closest - p) = 2*closest - p
      return {
        x: 2 * cx - p.x,
        y: 2 * cy - p.y,
      };
    };

    const pointIdMap = new Map<string, string>();

    selectedEntityIds.forEach(id => {
      const ent = res.entities[id];
      if (!ent) return;

      if (ent.type === 'POINT') {
        const pt = ent as SketchPoint2D;
        const mirroredPt = mirrorPointHelper(pt);
        const newPtId = `pt-mirror-${this.randomId()}`;
        res.entities[newPtId] = {
          id: newPtId,
          type: 'POINT',
          x: mirroredPt.x,
          y: mirroredPt.y
        };
        pointIdMap.set(id, newPtId);
      }
    });

    selectedEntityIds.forEach(id => {
      const ent = res.entities[id];
      if (!ent) return;

      if (ent.type === 'LINE') {
        const line = ent as SketchLine2D;
        // Resolve start/end points or mirror them if not already done
        let sId = pointIdMap.get(line.startPointId);
        let eId = pointIdMap.get(line.endPointId);

        if (!sId) {
          const pt = res.entities[line.startPointId] as SketchPoint2D;
          if (pt) {
            const mPt = mirrorPointHelper(pt);
            sId = `pt-mirror-${this.randomId()}`;
            res.entities[sId] = { id: sId, type: 'POINT', x: mPt.x, y: mPt.y };
            pointIdMap.set(line.startPointId, sId);
          }
        }
        if (!eId) {
          const pt = res.entities[line.endPointId] as SketchPoint2D;
          if (pt) {
            const mPt = mirrorPointHelper(pt);
            eId = `pt-mirror-${this.randomId()}`;
            res.entities[eId] = { id: eId, type: 'POINT', x: mPt.x, y: mPt.y };
            pointIdMap.set(line.endPointId, eId);
          }
        }

        if (sId && eId) {
          const newLineId = `line-mirror-${this.randomId()}`;
          res.entities[newLineId] = {
            id: newLineId,
            type: 'LINE',
            startPointId: sId,
            endPointId: eId
          } as SketchLine2D;
        }
      } else if (ent.type === 'CIRCLE') {
        const circ = ent as SketchCircle2D;
        let cId = pointIdMap.get(circ.centerPointId);
        if (!cId) {
          const pt = res.entities[circ.centerPointId] as SketchPoint2D;
          if (pt) {
            const mPt = mirrorPointHelper(pt);
            cId = `pt-mirror-${this.randomId()}`;
            res.entities[cId] = { id: cId, type: 'POINT', x: mPt.x, y: mPt.y };
            pointIdMap.set(circ.centerPointId, cId);
          }
        }
        if (cId) {
          const newCircId = `circ-mirror-${this.randomId()}`;
          res.entities[newCircId] = {
            id: newCircId,
            type: 'CIRCLE',
            centerPointId: cId,
            radius: circ.radius
          } as SketchCircle2D;
        }
      }
    });

    return res;
  }

  /**
   * Linear pattern generation
   */
  public static executeLinearPattern(
    selectedEntityIds: string[],
    count: number,
    distance: number,
    directionRad: number,
    sketch: IndustrialSketchDefinition
  ): IndustrialSketchDefinition {
    const res: IndustrialSketchDefinition = JSON.parse(JSON.stringify(sketch));
    const dx = Math.cos(directionRad) * distance;
    const dy = Math.sin(directionRad) * distance;

    for (let step = 1; step < count; step++) {
      const pointIdMap = new Map<string, string>();

      // Translate Points
      selectedEntityIds.forEach(id => {
        const ent = res.entities[id];
        if (ent && ent.type === 'POINT') {
          const pt = ent as SketchPoint2D;
          const newPtId = `pt-lin-${step}-${this.randomId()}`;
          res.entities[newPtId] = {
            id: newPtId,
            type: 'POINT',
            x: pt.x + dx * step,
            y: pt.y + dy * step
          };
          pointIdMap.set(id, newPtId);
        }
      });

      // Translate Lines/Circles
      selectedEntityIds.forEach(id => {
        const ent = res.entities[id];
        if (!ent) return;

        if (ent.type === 'LINE') {
          const line = ent as SketchLine2D;
          let sId = pointIdMap.get(line.startPointId);
          let eId = pointIdMap.get(line.endPointId);

          if (!sId) {
            const pt = res.entities[line.startPointId] as SketchPoint2D;
            if (pt) {
              sId = `pt-lin-${step}-${this.randomId()}`;
              res.entities[sId] = { id: sId, type: 'POINT', x: pt.x + dx * step, y: pt.y + dy * step };
              pointIdMap.set(line.startPointId, sId);
            }
          }
          if (!eId) {
            const pt = res.entities[line.endPointId] as SketchPoint2D;
            if (pt) {
              eId = `pt-lin-${step}-${this.randomId()}`;
              res.entities[eId] = { id: eId, type: 'POINT', x: pt.x + dx * step, y: pt.y + dy * step };
              pointIdMap.set(line.endPointId, eId);
            }
          }

          if (sId && eId) {
            const newLineId = `line-lin-${step}-${this.randomId()}`;
            res.entities[newLineId] = {
              id: newLineId,
              type: 'LINE',
              startPointId: sId,
              endPointId: eId
            } as SketchLine2D;
          }
        } else if (ent.type === 'CIRCLE') {
          const circ = ent as SketchCircle2D;
          let cId = pointIdMap.get(circ.centerPointId);
          if (!cId) {
            const pt = res.entities[circ.centerPointId] as SketchPoint2D;
            if (pt) {
              cId = `pt-lin-${step}-${this.randomId()}`;
              res.entities[cId] = { id: cId, type: 'POINT', x: pt.x + dx * step, y: pt.y + dy * step };
              pointIdMap.set(circ.centerPointId, cId);
            }
          }
          if (cId) {
            const newCircId = `circ-lin-${step}-${this.randomId()}`;
            res.entities[newCircId] = {
              id: newCircId,
              type: 'CIRCLE',
              centerPointId: cId,
              radius: circ.radius
            } as SketchCircle2D;
          }
        }
      }
      );
    }

    return res;
  }

  /**
   * Circular pattern generation
   */
  public static executeCircularPattern(
    selectedEntityIds: string[],
    count: number,
    center: Vector2D,
    totalAngleRad: number,
    sketch: IndustrialSketchDefinition
  ): IndustrialSketchDefinition {
    const res: IndustrialSketchDefinition = JSON.parse(JSON.stringify(sketch));

    const rotatePoint = (p: Vector2D, rad: number): Vector2D => {
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const dx = p.x - center.x;
      const dy = p.y - center.y;
      return {
        x: center.x + dx * cos - dy * sin,
        y: center.y + dx * sin + dy * cos,
      };
    };

    for (let step = 1; step < count; step++) {
      const angle = (totalAngleRad / count) * step;
      const pointIdMap = new Map<string, string>();

      // Rotate Points
      selectedEntityIds.forEach(id => {
        const ent = res.entities[id];
        if (ent && ent.type === 'POINT') {
          const pt = ent as SketchPoint2D;
          const rotated = rotatePoint(pt, angle);
          const newPtId = `pt-circ-${step}-${this.randomId()}`;
          res.entities[newPtId] = {
            id: newPtId,
            type: 'POINT',
            x: rotated.x,
            y: rotated.y
          };
          pointIdMap.set(id, newPtId);
        }
      });

      // Rotate lines / circles
      selectedEntityIds.forEach(id => {
        const ent = res.entities[id];
        if (!ent) return;

        if (ent.type === 'LINE') {
          const line = ent as SketchLine2D;
          let sId = pointIdMap.get(line.startPointId);
          let eId = pointIdMap.get(line.endPointId);

          if (!sId) {
            const pt = res.entities[line.startPointId] as SketchPoint2D;
            if (pt) {
              const rotated = rotatePoint(pt, angle);
              sId = `pt-circ-${step}-${this.randomId()}`;
              res.entities[sId] = { id: sId, type: 'POINT', x: rotated.x, y: rotated.y };
              pointIdMap.set(line.startPointId, sId);
            }
          }
          if (!eId) {
            const pt = res.entities[line.endPointId] as SketchPoint2D;
            if (pt) {
              const rotated = rotatePoint(pt, angle);
              eId = `pt-circ-${step}-${this.randomId()}`;
              res.entities[eId] = { id: eId, type: 'POINT', x: rotated.x, y: rotated.y };
              pointIdMap.set(line.endPointId, eId);
            }
          }

          if (sId && eId) {
            const newLineId = `line-circ-${step}-${this.randomId()}`;
            res.entities[newLineId] = {
              id: newLineId,
              type: 'LINE',
              startPointId: sId,
              endPointId: eId
            } as SketchLine2D;
          }
        } else if (ent.type === 'CIRCLE') {
          const circ = ent as SketchCircle2D;
          let cId = pointIdMap.get(circ.centerPointId);
          if (!cId) {
            const pt = res.entities[circ.centerPointId] as SketchPoint2D;
            if (pt) {
              const rotated = rotatePoint(pt, angle);
              cId = `pt-circ-${step}-${this.randomId()}`;
              res.entities[cId] = { id: cId, type: 'POINT', x: rotated.x, y: rotated.y };
              pointIdMap.set(circ.centerPointId, cId);
            }
          }
          if (cId) {
            const newCircId = `circ-circ-${step}-${this.randomId()}`;
            res.entities[newCircId] = {
              id: newCircId,
              type: 'CIRCLE',
              centerPointId: cId,
              radius: circ.radius
            } as SketchCircle2D;
          }
        }
      });
    }

    return res;
  }

  // ============================================================================
  // 5. AUTOMATIC CONSTRAINT DETECTION
  // ============================================================================

  public static detectAutoConstraints(
    newEntityId: string,
    sketch: IndustrialSketchDefinition,
    tolerance = 2.0
  ): IndustrialSketchConstraint[] {
    const detected: IndustrialSketchConstraint[] = [];
    const entity = sketch.entities[newEntityId];
    if (!entity) return [];

    const entities = sketch.entities;

    if (entity.type === 'LINE') {
      const line = entity as SketchLine2D;
      const p1 = entities[line.startPointId] as SketchPoint2D;
      const p2 = entities[line.endPointId] as SketchPoint2D;

      if (p1 && p2) {
        // A. Horizontal Auto-Constraint
        if (Math.abs(p1.y - p2.y) < tolerance) {
          detected.push({
            id: `auto-c-${this.randomId()}`,
            type: 'HORIZONTAL',
            entityIds: [newEntityId],
          });
        }

        // B. Vertical Auto-Constraint
        if (Math.abs(p1.x - p2.x) < tolerance) {
          detected.push({
            id: `auto-c-${this.randomId()}`,
            type: 'VERTICAL',
            entityIds: [newEntityId],
          });
        }

        // C. Coincident detection on start/end with existing endpoints
        for (const other of Object.values(entities)) {
          if (other.id === newEntityId || other.id === line.startPointId || other.id === line.endPointId) continue;

          if (other.type === 'POINT') {
            const pt = other as SketchPoint2D;
            if (this.dist(p1, pt) < tolerance) {
              detected.push({
                id: `auto-c-${this.randomId()}`,
                type: 'COINCIDENT',
                entityIds: [line.startPointId, pt.id],
              });
            }
            if (this.dist(p2, pt) < tolerance) {
              detected.push({
                id: `auto-c-${this.randomId()}`,
                type: 'COINCIDENT',
                entityIds: [line.endPointId, pt.id],
              });
            }
          }
        }
      }
    } else if (entity.type === 'CIRCLE') {
      const circ = entity as SketchCircle2D;
      const center = entities[circ.centerPointId] as SketchPoint2D;

      if (center) {
        // Coincident center or tangent circles
        for (const other of Object.values(entities)) {
          if (other.id === newEntityId || other.id === circ.centerPointId) continue;

          if (other.type === 'CIRCLE') {
            const otherCirc = other as SketchCircle2D;
            const otherCenter = entities[otherCirc.centerPointId] as SketchPoint2D;
            if (otherCenter) {
              // Concentric
              if (this.dist(center, otherCenter) < tolerance) {
                detected.push({
                  id: `auto-c-${this.randomId()}`,
                  type: 'CONCENTRIC',
                  entityIds: [newEntityId, other.id],
                });
              }

              // Equal radius
              if (Math.abs(circ.radius - otherCirc.radius) < tolerance) {
                detected.push({
                  id: `auto-c-${this.randomId()}`,
                  type: 'EQUAL',
                  entityIds: [newEntityId, other.id],
                });
              }
            }
          }
        }
      }
    }

    return detected;
  }

  // ============================================================================
  // 6. GEOMETRIC TRANSFORMATIONS (P2 Parity)
  // ============================================================================

  public static executeMove(
    entityIds: string[],
    delta: Vector2D,
    sketch: IndustrialSketchDefinition
  ): IndustrialSketchDefinition {
    const res: IndustrialSketchDefinition = JSON.parse(JSON.stringify(sketch));
    const movedPointIds = new Set<string>();

    entityIds.forEach(id => {
      const ent = res.entities[id];
      if (!ent) return;

      if (ent.type === 'POINT') movedPointIds.add(id);
      else if (ent.type === 'LINE') {
        const line = ent as SketchLine2D;
        movedPointIds.add(line.startPointId);
        movedPointIds.add(line.endPointId);
      } else if (ent.type === 'CIRCLE') {
        const circ = ent as SketchCircle2D;
        movedPointIds.add(circ.centerPointId);
      } else if (ent.type === 'ARC') {
        const arc = ent as SketchArc2D;
        movedPointIds.add(arc.centerPointId);
        movedPointIds.add(arc.startPointId);
        movedPointIds.add(arc.endPointId);
      }
    });

    movedPointIds.forEach(ptId => {
      const pt = res.entities[ptId] as SketchPoint2D;
      if (pt) {
        pt.x += delta.x;
        pt.y += delta.y;
      }
    });

    return res;
  }

  public static executeRotate(
    entityIds: string[],
    center: Vector2D,
    angleRad: number,
    sketch: IndustrialSketchDefinition
  ): IndustrialSketchDefinition {
    const res: IndustrialSketchDefinition = JSON.parse(JSON.stringify(sketch));
    const rotatedPointIds = new Set<string>();

    entityIds.forEach(id => {
      const ent = res.entities[id];
      if (!ent) return;

      if (ent.type === 'POINT') rotatedPointIds.add(id);
      else if (ent.type === 'LINE') {
        const line = ent as SketchLine2D;
        rotatedPointIds.add(line.startPointId);
        rotatedPointIds.add(line.endPointId);
      } else if (ent.type === 'CIRCLE') {
        const circ = ent as SketchCircle2D;
        rotatedPointIds.add(circ.centerPointId);
      } else if (ent.type === 'ARC') {
        const arc = ent as SketchArc2D;
        rotatedPointIds.add(arc.centerPointId);
        rotatedPointIds.add(arc.startPointId);
        rotatedPointIds.add(arc.endPointId);
      }
    });

    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);

    rotatedPointIds.forEach(ptId => {
      const pt = res.entities[ptId] as SketchPoint2D;
      if (pt) {
        const dx = pt.x - center.x;
        const dy = pt.y - center.y;
        pt.x = center.x + dx * cosA - dy * sinA;
        pt.y = center.y + dx * sinA + dy * cosA;
      }
    });

    return res;
  }

  public static executeScale(
    entityIds: string[],
    center: Vector2D,
    scale: number,
    sketch: IndustrialSketchDefinition
  ): IndustrialSketchDefinition {
    const res: IndustrialSketchDefinition = JSON.parse(JSON.stringify(sketch));
    const scaledPointIds = new Set<string>();

    entityIds.forEach(id => {
      const ent = res.entities[id];
      if (!ent) return;

      if (ent.type === 'POINT') scaledPointIds.add(id);
      else if (ent.type === 'LINE') {
        const line = ent as SketchLine2D;
        scaledPointIds.add(line.startPointId);
        scaledPointIds.add(line.endPointId);
      } else if (ent.type === 'CIRCLE') {
        const circ = ent as SketchCircle2D;
        scaledPointIds.add(circ.centerPointId);
        circ.radius *= scale;
      } else if (ent.type === 'ARC') {
        const arc = ent as SketchArc2D;
        scaledPointIds.add(arc.centerPointId);
        scaledPointIds.add(arc.startPointId);
        scaledPointIds.add(arc.endPointId);
        arc.radius *= scale;
      }
    });

    scaledPointIds.forEach(ptId => {
      const pt = res.entities[ptId] as SketchPoint2D;
      if (pt) {
        pt.x = center.x + (pt.x - center.x) * scale;
        pt.y = center.y + (pt.y - center.y) * scale;
      }
    });

    return res;
  }
}
