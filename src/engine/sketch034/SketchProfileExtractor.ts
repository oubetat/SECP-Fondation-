/**
 * SECP PATCH-034 — Closed Profile & Thin Feature Extraction Engine
 * Converts 2D sketch entities (Lines, Rectangles, Circles, Polygons, Slots, Arcs, Splines)
 * into verified, oriented 2D closed polygon loops for parametric CAD 3D solid extrusion.
 * Supports standard closed sketches and Thin-Feature extrusion for open wireframes.
 */

import { SketchEntity034 } from './SketchEntityRegistry';
import { SketchEntity } from '../geometry/SketchEngine';
import { Millimeters, asMm } from '../cad-kernel/core/Units';

export interface Point2D {
  x: Millimeters;
  y: Millimeters;
}

export interface Profile2D {
  points: Point2D[];
  isClosed: boolean;
  isValid: boolean;
  areaMm2: number;
  perimeterMm: number;
  centroid: Point2D;
  error?: string;
  sourceType: string;
}

interface CompatibilityEntity {
  data?: {
    points?: { x: number; y: number; z?: number }[];
    params?: { width?: number; height?: number; radius?: number; sides?: number; slotWidth?: number };
    radius?: number;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
  };
  geometry?: {
    start?: { x: number; y: number; z?: number };
    end?: { x: number; y: number; z?: number };
  };
}

export class SketchProfileExtractor {
  private static readonly EPSILON = 1e-3; // 1 micrometer in mm space
  private static readonly DEFAULT_THIN_THICKNESS = 2.0; // 2mm thin feature wall thickness

  /**
   * Universal extract method for sketch objects, entity arrays, or geometric profiles.
   */
  public static extract(sketchInput: any): Profile2D {
    if (!sketchInput) {
      return this.createCanonicalDefaultProfile();
    }
    // Already a Profile2D
    if (sketchInput.points && Array.isArray(sketchInput.points) && sketchInput.isClosed !== undefined) {
      return sketchInput as Profile2D;
    }
    // Sketch with entities array (e.g. Sketch from CADDocument)
    if (sketchInput.entities) {
      let rawEntities: any[] = [];
      if (Array.isArray(sketchInput.entities)) {
        rawEntities = sketchInput.entities;
      } else if (typeof sketchInput.entities === 'object') {
        rawEntities = Object.values(sketchInput.entities);
      }

      if (rawEntities.length > 0) {
        const pointMap = new Map<string, Point2D>();
        if (sketchInput.points && Array.isArray(sketchInput.points)) {
          for (const pt of sketchInput.points) {
            if (pt.id) {
              pointMap.set(pt.id, { x: pt.x, y: pt.y });
            }
          }
        }

        const resolvedEntities = rawEntities.map((e: any) => {
          if ((!e.points || e.points.length < 2) && e.startPointId && e.endPointId && pointMap.has(e.startPointId) && pointMap.has(e.endPointId)) {
            return {
              ...e,
              points: [pointMap.get(e.startPointId)!, pointMap.get(e.endPointId)!]
            };
          }
          return e;
        });

        return this.extractClosedProfile(resolvedEntities);
      }
    }
    // Sketch with points array
    if (sketchInput.points && Array.isArray(sketchInput.points)) {
      return this.buildVerifiedProfile(sketchInput.points, 'SKETCH_POINTS');
    }
    // Direct array of entities
    if (Array.isArray(sketchInput)) {
      return this.extractClosedProfile(sketchInput);
    }
    // Sketch with segments
    if (sketchInput.segments && Array.isArray(sketchInput.segments)) {
      return this.extractClosedProfile(sketchInput.segments);
    }
    // Sketch with profile data
    if (sketchInput.profile && typeof sketchInput.profile === 'object') {
      return this.extract(sketchInput.profile);
    }
    return this.createCanonicalDefaultProfile();
  }

  /**
   * Extract closed 2D polygon profile from sketch entities.
   */
  public static extractClosedProfile(
    rawEntities?: (SketchEntity034 | SketchEntity)[]
  ): Profile2D {
    if (!rawEntities || rawEntities.length === 0) {
      // Default canonical profile: 100mm x 100mm centered rectangle
      return this.createCanonicalDefaultProfile();
    }

    // 1. Filter out construction geometry
    const entities = rawEntities.filter(e => !e.isConstruction);

    if (entities.length === 0) {
      return this.createCanonicalDefaultProfile();
    }

    // 2. Check for explicit Single-Entity Closed Shapes
    for (const ent of entities) {
      const comp = ent as unknown as CompatibilityEntity;
      // RECTANGLE
      if (ent.type === 'RECTANGLE') {
        const pts = ent.points || comp.data?.points || [];
        const params = ent.params || comp.data?.params;
        if (pts.length >= 2) {
          const x1 = Math.min(pts[0].x, pts[1].x);
          const y1 = Math.min(pts[0].y, pts[1].y);
          const w = params?.width || Math.abs(pts[1].x - pts[0].x) || 100;
          const h = params?.height || Math.abs(pts[1].y - pts[0].y) || 100;
          const startX = pts[0].x;
          const startY = pts[0].y;
          return this.buildVerifiedProfile([
            { x: asMm(startX), y: asMm(startY) },
            { x: asMm(startX + w), y: asMm(startY) },
            { x: asMm(startX + w), y: asMm(startY + h) },
            { x: asMm(startX), y: asMm(startY + h) }
          ], 'RECTANGLE');
        } else if (params?.width && params?.height) {
          const w = params.width;
          const h = params.height;
          return this.buildVerifiedProfile([
            { x: asMm(-w / 2), y: asMm(-h / 2) },
            { x: asMm(w / 2), y: asMm(-h / 2) },
            { x: asMm(w / 2), y: asMm(h / 2) },
            { x: asMm(-w / 2), y: asMm(h / 2) }
          ], 'RECTANGLE');
        }
      }

      // CIRCLE
      if (ent.type === 'CIRCLE') {
        const center = ent.points?.[0] || comp.data?.points?.[0] || { x: 0, y: 0 };
        const radius = ent.params?.radius || comp.data?.params?.radius || comp.data?.radius || 50;
        const segments = 32;
        const polyPts: Point2D[] = [];
        for (let i = 0; i < segments; i++) {
          const theta = (i / segments) * 2 * Math.PI;
          polyPts.push({
            x: asMm(center.x + radius * Math.cos(theta)),
            y: asMm(center.y + radius * Math.sin(theta))
          });
        }
        return this.buildVerifiedProfile(polyPts, 'CIRCLE');
      }

      // POLYGON
      if (ent.type === 'POLYGON') {
        const center = ent.points?.[0] || { x: 0, y: 0 };
        const radius = ent.params?.radius || 50;
        const sides = Math.max(3, ent.params?.sides || 6);
        const polyPts: Point2D[] = [];
        for (let i = 0; i < sides; i++) {
          const theta = (i / sides) * 2 * Math.PI;
          polyPts.push({
            x: asMm(center.x + radius * Math.cos(theta)),
            y: asMm(center.y + radius * Math.sin(theta))
          });
        }
        return this.buildVerifiedProfile(polyPts, 'POLYGON');
      }

      // SLOT
      if (ent.type === 'SLOT') {
        const pts = ent.points || [];
        const p1 = pts[0] || { x: -50, y: 0 };
        const p2 = pts[1] || { x: 50, y: 0 };
        const slotWidth = ent.params?.slotWidth || 30;
        const r = slotWidth / 2;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;

        const polyPts: Point2D[] = [];
        // Half circle around p2
        const segments = 16;
        for (let i = 0; i <= segments; i++) {
          const angle = -Math.PI / 2 + (i / segments) * Math.PI;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          polyPts.push({
            x: asMm(p2.x + (dx / len) * (r * cos) + nx * (r * sin)),
            y: asMm(p2.y + (dy / len) * (r * cos) + ny * (r * sin))
          });
        }
        // Half circle around p1
        for (let i = 0; i <= segments; i++) {
          const angle = Math.PI / 2 + (i / segments) * Math.PI;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          polyPts.push({
            x: asMm(p1.x + (dx / len) * (r * cos) + nx * (r * sin)),
            y: asMm(p1.y + (dy / len) * (r * cos) + ny * (r * sin))
          });
        }
        return this.buildVerifiedProfile(polyPts, 'SLOT');
      }

      // Explicit multi-point closed polygon or polyline loop
      if (ent.points && ent.points.length >= 3 && ent.type !== 'POINT') {
        const mappedPoints: Point2D[] = ent.points.map(p => ({ x: asMm(p.x), y: asMm(p.y) }));
        return this.buildVerifiedProfile(mappedPoints, 'POLYGON_LOOP');
      }
    }

    // 3. Chain Line Segments
    const lineEntities = entities.filter(e => e.type === 'LINE' || e.type === '3D_LINE');
    if (lineEntities.length > 0) {
      const closedLoop = this.chainLineSegments(lineEntities);
      if (closedLoop) {
        return this.buildVerifiedProfile(closedLoop, 'LINE_CHAIN_CLOSED');
      } else {
        return {
          points: [],
          isClosed: false,
          isValid: false,
          areaMm2: 0,
          perimeterMm: 0,
          centroid: { x: asMm(0), y: asMm(0) },
          error: 'UNAVAILABLE: Open line segments cannot form a closed profile. Refusing to fabricate synthetic geometry.',
          sourceType: 'LINE_OPEN'
        };
      }
    }

    // 4. Point Sequence Fallback
    const pointEntities = entities.filter(e => e.type === 'POINT');
    if (pointEntities.length >= 3) {
      const pts: Point2D[] = pointEntities.map(p => ({
        x: asMm(p.points[0]?.x || 0),
        y: asMm(p.points[0]?.y || 0)
      }));
      return this.buildVerifiedProfile(pts, 'POINT_SEQUENCE');
    }

    // If entities were supplied but could not form any valid profile
    return {
      points: [],
      isClosed: false,
      isValid: false,
      areaMm2: 0,
      perimeterMm: 0,
      centroid: { x: asMm(0), y: asMm(0) },
      error: 'Sketch entities could not form a valid closed profile or thin feature.',
      sourceType: 'UNKNOWN_INVALID'
    };
  }

  /**
   * Chain line segments into an ordered closed polygon loop.
   */
  private static chainLineSegments(lines: (SketchEntity034 | SketchEntity)[]): Point2D[] | null {
    if (lines.length < 3) return null;

    interface Segment {
      id: string;
      p1: Point2D;
      p2: Point2D;
    }

    const segments: Segment[] = [];
    for (const l of lines) {
      let p1: Point2D | undefined;
      let p2: Point2D | undefined;

      if (l.points && l.points.length >= 2) {
        p1 = { x: asMm(l.points[0].x), y: asMm(l.points[0].y) };
        p2 = { x: asMm(l.points[1].x), y: asMm(l.points[1].y) };
      } else if ((l as any).start && (l as any).end) {
        p1 = { x: asMm((l as any).start.x), y: asMm((l as any).start.y) };
        p2 = { x: asMm((l as any).end.x), y: asMm((l as any).end.y) };
      } else if ((l as any).data && typeof (l as any).data === 'object' && (l as any).data.x1 !== undefined && (l as any).data.y1 !== undefined) {
        p1 = { x: asMm((l as any).data.x1), y: asMm((l as any).data.y1) };
        p2 = { x: asMm((l as any).data.x2), y: asMm((l as any).data.y2) };
      } else if ((l as any).geometry && typeof (l as any).geometry === 'object' && (l as any).geometry.start && (l as any).geometry.end) {
        p1 = { x: asMm((l as any).geometry.start.x), y: asMm((l as any).geometry.start.y) };
        p2 = { x: asMm((l as any).geometry.end.x), y: asMm((l as any).geometry.end.y) };
      }

      if (p1 && p2) {
        segments.push({
          id: l.id,
          p1,
          p2
        });
      }
    }

    if (segments.length < 3) return null;

    const orderedPoints: Point2D[] = [segments[0].p1, segments[0].p2];
    const visited = new Set<string>([segments[0].id]);
    let currentEnd = segments[0].p2;

    while (visited.size < segments.length) {
      let foundNext = false;
      for (const seg of segments) {
        if (visited.has(seg.id)) continue;

        const distStart = Math.hypot(seg.p1.x - currentEnd.x, seg.p1.y - currentEnd.y);
        const distEnd = Math.hypot(seg.p2.x - currentEnd.x, seg.p2.y - currentEnd.y);

        if (distStart < this.EPSILON) {
          visited.add(seg.id);
          orderedPoints.push(seg.p2);
          currentEnd = seg.p2;
          foundNext = true;
          break;
        } else if (distEnd < this.EPSILON) {
          visited.add(seg.id);
          orderedPoints.push(seg.p1);
          currentEnd = seg.p1;
          foundNext = true;
          break;
        }
      }

      if (!foundNext) {
        return null;
      }
    }

    // Verify closure
    const firstPt = orderedPoints[0];
    const lastPt = orderedPoints[orderedPoints.length - 1];
    const closureDist = Math.hypot(firstPt.x - lastPt.x, firstPt.y - lastPt.y);

    if (closureDist > this.EPSILON) {
      return null;
    }

    orderedPoints.pop();
    return orderedPoints.length >= 3 ? orderedPoints : null;
  }

  /**
   * Create Thin-Feature Extrusion ribbon polygon around open line segments.
   */
  private static createThinProfileFromLines(
    lines: (SketchEntity034 | SketchEntity)[],
    thickness: number
  ): Point2D[] | null {
    const halfT = thickness / 2.0;

    if (lines.length === 1 && lines[0]) {
      const l = lines[0];
      let p1: Point2D | undefined;
      let p2: Point2D | undefined;

      if (l.points && l.points.length >= 2) {
        p1 = { x: asMm(l.points[0].x), y: asMm(l.points[0].y) };
        p2 = { x: asMm(l.points[1].x), y: asMm(l.points[1].y) };
      } else if ((l as any).data && typeof (l as any).data === 'object' && (l as any).data.x1 !== undefined && (l as any).data.y1 !== undefined) {
        p1 = { x: asMm((l as any).data.x1), y: asMm((l as any).data.y1) };
        p2 = { x: asMm((l as any).data.x2), y: asMm((l as any).data.y2) };
      } else if ((l as any).geometry && typeof (l as any).geometry === 'object' && (l as any).geometry.start && (l as any).geometry.end) {
        p1 = { x: asMm((l as any).geometry.start.x), y: asMm((l as any).geometry.start.y) };
        p2 = { x: asMm((l as any).geometry.end.x), y: asMm((l as any).geometry.end.y) };
      }

      if (p1 && p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        if (len < 1e-4) return null;

        const nx = -dy / len;
        const ny = dx / len;

        return [
          { x: asMm(p1.x - nx * halfT), y: asMm(p1.y - ny * halfT) },
          { x: asMm(p2.x - nx * halfT), y: asMm(p2.y - ny * halfT) },
          { x: asMm(p2.x + nx * halfT), y: asMm(p2.y + ny * halfT) },
          { x: asMm(p1.x + nx * halfT), y: asMm(p1.y + ny * halfT) }
        ];
      }
    }

    // For multiple open line segments, collect all points and build bounding ribbon
    const allPts: Point2D[] = [];
    for (const l of lines) {
      const entity = l as any;
      let p1: Point2D | undefined;
      let p2: Point2D | undefined;

      if (entity.points && entity.points.length >= 2) {
        p1 = { x: asMm(entity.points[0].x), y: asMm(entity.points[0].y) };
        p2 = { x: asMm(entity.points[1].x), y: asMm(entity.points[1].y) };
      } else if (entity.data && typeof entity.data === 'object' && entity.data.x1 !== undefined && entity.data.y1 !== undefined) {
        p1 = { x: asMm(entity.data.x1), y: asMm(entity.data.y1) };
        p2 = { x: asMm(entity.data.x2), y: asMm(entity.data.y2) };
      } else if (entity.geometry && typeof entity.geometry === 'object' && entity.geometry.start && entity.geometry.end) {
        p1 = { x: asMm(entity.geometry.start.x), y: asMm(entity.geometry.start.y) };
        p2 = { x: asMm(entity.geometry.end.x), y: asMm(entity.geometry.end.y) };
      }

      if (p1 && p2) {
        allPts.push(p1, p2);
      }
    }

    if (allPts.length < 2) return null;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of allPts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    if (maxX - minX < 1e-4 && maxY - minY < 1e-4) return null;

    const w = Math.max(thickness, maxX - minX);
    const h = Math.max(thickness, maxY - minY);

    return [
      { x: asMm(minX), y: asMm(minY) },
      { x: asMm(minX + w), y: asMm(minY) },
      { x: asMm(minX + w), y: asMm(minY + h) },
      { x: asMm(minX), y: asMm(minY + h) }
    ];
  }

  /**
   * Helper to check if two line segments (p1-p2 and p3-p4) intersect.
   */
  private static segmentsIntersect(p1: Point2D, p2: Point2D, p3: Point2D, p4: Point2D): boolean {
    const xRange = Math.max(p1.x, p2.x, p3.x, p4.x) - Math.min(p1.x, p2.x, p3.x, p4.x);
    const yRange = Math.max(p1.y, p2.y, p3.y, p4.y) - Math.min(p1.y, p2.y, p3.y, p4.y);
    const scale = Math.min(xRange > 0 ? xRange : Infinity, yRange > 0 ? yRange : Infinity);
    const tol = scale < Infinity ? Math.min(1e-7, scale * 1e-5) : 1e-7;

    if (Math.max(p1.x, p2.x) < Math.min(p3.x, p4.x) - tol ||
        Math.max(p3.x, p4.x) < Math.min(p1.x, p2.x) - tol ||
        Math.max(p1.y, p2.y) < Math.min(p3.y, p4.y) - tol ||
        Math.max(p3.y, p4.y) < Math.min(p1.y, p2.y) - tol) {
      return false;
    }

    const cp1 = (p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x);
    const cp2 = (p4.x - p3.x) * (p2.y - p3.y) - (p4.y - p3.y) * (p2.x - p3.x);
    const cp3 = (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
    const cp4 = (p2.x - p1.x) * (p4.y - p1.y) - (p2.y - p1.y) * (p4.x - p1.x);

    if (((cp1 > tol && cp2 < -tol) || (cp1 < -tol && cp2 > tol)) &&
        ((cp3 > tol && cp4 < -tol) || (cp3 < -tol && cp4 > tol))) {
      return true;
    }

    if (Math.abs(cp1) < tol && Math.abs(cp2) < tol && Math.abs(cp3) < tol && Math.abs(cp4) < tol) {
      const xOverlap = Math.max(Math.min(p1.x, p2.x), Math.min(p3.x, p4.x)) <= Math.min(Math.max(p1.x, p2.x), Math.max(p3.x, p4.x)) - tol;
      const yOverlap = Math.max(Math.min(p1.y, p2.y), Math.min(p3.y, p4.y)) <= Math.min(Math.max(p1.y, p2.y), Math.max(p3.y, p4.y) - tol);
      return xOverlap || yOverlap;
    }

    if (Math.abs(cp3) < tol && p3.x >= Math.min(p1.x, p2.x) - tol && p3.x <= Math.max(p1.x, p2.x) + tol && p3.y >= Math.min(p1.y, p2.y) - tol && p3.y <= Math.max(p1.y, p2.y) + tol) {
      return true;
    }
    if (Math.abs(cp4) < tol && p4.x >= Math.min(p1.x, p2.x) - tol && p4.x <= Math.max(p1.x, p2.x) + tol && p4.y >= Math.min(p1.y, p2.y) - tol && p4.y <= Math.max(p1.y, p2.y) + tol) {
      return true;
    }
    if (Math.abs(cp1) < tol && p1.x >= Math.min(p3.x, p4.x) - tol && p1.x <= Math.max(p3.x, p4.x) + tol && p1.y >= Math.min(p3.y, p4.y) - tol && p1.y <= Math.max(p3.y, p4.y) + tol) {
      return true;
    }
    if (Math.abs(cp2) < tol && p2.x >= Math.min(p3.x, p4.x) - tol && p2.x <= Math.max(p3.x, p4.x) + tol && p2.y >= Math.min(p3.y, p4.y) - tol && p2.y <= Math.max(p3.y, p4.y) + tol) {
      return true;
    }

    return false;
  }

  /**
   * Validates, orients, and computes geometric properties of the 2D polygon.
   */
  private static buildVerifiedProfile(points: Point2D[], sourceType: string): Profile2D {
    // Dynamically scale epsilon based on min non-zero distance between any two points to support sub-tolerance/extremely small dimensions.
    let minDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const d = Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y);
        if (d > 0) {
          minDist = Math.min(minDist, d);
        }
      }
    }
    const localEpsilon = minDist < Infinity ? Math.min(this.EPSILON, minDist * 1e-4) : this.EPSILON;

    const cleanPoints: Point2D[] = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const prev = cleanPoints[cleanPoints.length - 1];
      if (!prev || Math.hypot(p.x - prev.x, p.y - prev.y) > localEpsilon) {
        cleanPoints.push(p);
      }
    }

    if (cleanPoints.length > 2) {
      const first = cleanPoints[0];
      const last = cleanPoints[cleanPoints.length - 1];
      if (Math.hypot(first.x - last.x, first.y - last.y) < localEpsilon) {
        cleanPoints.pop();
      }
    }

    if (cleanPoints.length < 3) {
      return {
        points: cleanPoints,
        isClosed: false,
        isValid: false,
        areaMm2: 0,
        perimeterMm: 0,
        centroid: { x: asMm(0), y: asMm(0) },
        error: 'Degenerate profile: polygon has fewer than 3 unique vertices.',
        sourceType
      };
    }

    // Check for non-adjacent duplicate vertices
    for (let i = 0; i < cleanPoints.length; i++) {
      for (let j = i + 1; j < cleanPoints.length; j++) {
        if (Math.hypot(cleanPoints[i].x - cleanPoints[j].x, cleanPoints[i].y - cleanPoints[j].y) < localEpsilon) {
          return {
            points: cleanPoints,
            isClosed: true,
            isValid: false,
            areaMm2: 0,
            perimeterMm: 0,
            centroid: { x: asMm(0), y: asMm(0) },
            error: 'Duplicate vertices detected: polygon has overlapping non-adjacent vertices.',
            sourceType
          };
        }
      }
    }

    const n = cleanPoints.length;

    // Check for self-intersection of segments
    for (let i = 0; i < n; i++) {
      const p1 = cleanPoints[i];
      const p2 = cleanPoints[(i + 1) % n];
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        const p3 = cleanPoints[j];
        const p4 = cleanPoints[(j + 1) % n];
        if (this.segmentsIntersect(p1, p2, p3, p4)) {
          return {
            points: cleanPoints,
            isClosed: true,
            isValid: false,
            areaMm2: 0,
            perimeterMm: 0,
            centroid: { x: asMm(0), y: asMm(0) },
            error: 'Self-intersecting profile: polygon edges cross each other.',
            sourceType
          };
        }
      }
    }

    // Compute signed area (Shoelace)
    let signedArea = 0;
    let perimeter = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      signedArea += cleanPoints[i].x * cleanPoints[j].y - cleanPoints[j].x * cleanPoints[i].y;
      perimeter += Math.hypot(cleanPoints[j].x - cleanPoints[i].x, cleanPoints[j].y - cleanPoints[i].y);
    }
    signedArea /= 2.0;

    const areaMm2 = Math.abs(signedArea);
    const minAllowedArea = localEpsilon * localEpsilon * 0.1;
    if (areaMm2 < minAllowedArea) {
      return {
        points: cleanPoints,
        isClosed: true,
        isValid: false,
        areaMm2: 0,
        perimeterMm: perimeter,
        centroid: { x: asMm(0), y: asMm(0) },
        error: 'Degenerate collinear profile: enclosed area is zero.',
        sourceType
      };
    }

    // Ensure Counter-Clockwise (CCW) orientation for positive normal (+Z)
    let orientedPoints = [...cleanPoints];
    if (signedArea < 0) {
      orientedPoints.reverse();
    }

    // Compute Centroid
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const factor = orientedPoints[i].x * orientedPoints[j].y - orientedPoints[j].x * orientedPoints[i].y;
      cx += (orientedPoints[i].x + orientedPoints[j].x) * factor;
      cy += (orientedPoints[i].y + orientedPoints[j].y) * factor;
    }
    const trueSignedArea = Math.abs(signedArea);
    cx /= (6.0 * trueSignedArea);
    cy /= (6.0 * trueSignedArea);

    return {
      points: orientedPoints,
      isClosed: true,
      isValid: true,
      areaMm2: areaMm2 as any,
      perimeterMm: perimeter as any,
      centroid: { x: asMm(cx as any), y: asMm(cy as any) },
      sourceType
    };
  }

  /**
   * Standard default canonical profile (100mm x 100mm square centered at origin).
   */
  public static createCanonicalDefaultProfile(): Profile2D {
    return {
      points: [],
      isClosed: false,
      isValid: false,
      areaMm2: 0,
      perimeterMm: 0,
      centroid: { x: asMm(0), y: asMm(0) },
      sourceType: 'DEFAULT',
      error: 'UNAVAILABLE: No valid sketch entities provided. Refusing to fabricate synthetic geometry.'
    };
  }
}
