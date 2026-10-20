/**
 * SECP Industrial OS — SECP-PCB-PHASE-2-001
 * Comprehensive 2D PCB Computational Geometry Kernel:
 * Exact geometric primitives for PCB traces (swept capsules), pads (RECT, ROUND, OVAL/OBLONG, POLYGON),
 * coordinate transforms, true physical clearance, contact and intersection detection.
 */

export type PadShapeType = 'RECT' | 'ROUND' | 'OVAL' | 'POLYGON';

export interface Point2D {
  x: number;
  y: number;
}

export interface BoundingBox2D {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface GeometricPad {
  refDes: string;
  pinNumber: number;
  netName?: string;
  layer: 'TOP' | 'BOTTOM';
  shape: PadShapeType;
  center: Point2D;
  widthMm: number;
  heightMm: number;
  rotationDeg: number;
  // Polygon vertices (if shape === 'POLYGON') in global coordinates
  polygonVertices?: Point2D[];
}

export interface GeometricTraceSegment {
  id: string;
  netName: string;
  layer: string;
  p1: Point2D;
  p2: Point2D;
  widthMm: number;
  radiusMm: number;
}

export interface GeometricVia {
  id: string;
  netName: string;
  center: Point2D;
  drillDiameterMm: number;
  padDiameterMm: number;
  padRadiusMm: number;
  startLayer: string;
  endLayer: string;
}

export class PcbGeometryKernel {
  /**
   * Transforms a local offset by component translation and rotation.
   */
  public static transformPoint(
    localX: number,
    localY: number,
    originX: number,
    originY: number,
    rotationDeg: number
  ): Point2D {
    const rad = (rotationDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return {
      x: originX + (localX * cos - localY * sin),
      y: originY + (localX * sin + localY * cos)
    };
  }

  /**
   * Distance from 2D point to line segment [p1, p2].
   */
  public static distPointToSegment(p: Point2D, p1: Point2D, p2: Point2D): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(p.x - p1.x, p.y - p1.y);

    let t = ((p.x - p1.x) * dx + (p.y - p1.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (p1.x + t * dx), p.y - (p1.y + t * dy));
  }

  /**
   * Shortest distance between two line segments [a1, a2] and [b1, b2].
   */
  public static distBetweenSegments(a1: Point2D, a2: Point2D, b1: Point2D, b2: Point2D): number {
    if (this.segmentsIntersect(a1, a2, b1, b2)) return 0;
    return Math.min(
      this.distPointToSegment(a1, b1, b2),
      this.distPointToSegment(a2, b1, b2),
      this.distPointToSegment(b1, a1, a2),
      this.distPointToSegment(b2, a1, a2)
    );
  }

  /**
   * Evaluates if two 1D segments cross in 2D (strict or touching intersection).
   */
  public static segmentsIntersect(a1: Point2D, a2: Point2D, b1: Point2D, b2: Point2D): boolean {
    const ccw = (p1: Point2D, p2: Point2D, p3: Point2D) =>
      (p3.y - p1.y) * (p2.x - p1.x) - (p2.y - p1.y) * (p3.x - p1.x);

    const cp1 = ccw(a1, b1, b2);
    const cp2 = ccw(a2, b1, b2);
    const cp3 = ccw(a1, a2, b1);
    const cp4 = ccw(a1, a2, b2);

    if (((cp1 > 0 && cp2 < 0) || (cp1 < 0 && cp2 > 0)) &&
        ((cp3 > 0 && cp4 < 0) || (cp3 < 0 && cp4 > 0))) {
      return true;
    }

    // Collinear or endpoint checks
    if (Math.abs(cp1) < 1e-9 && this.isPointOnSegment(a1, b1, b2)) return true;
    if (Math.abs(cp2) < 1e-9 && this.isPointOnSegment(a2, b1, b2)) return true;
    if (Math.abs(cp3) < 1e-9 && this.isPointOnSegment(b1, a1, a2)) return true;
    if (Math.abs(cp4) < 1e-9 && this.isPointOnSegment(b2, a1, a2)) return true;

    return false;
  }

  public static isPointOnSegment(p: Point2D, a: Point2D, b: Point2D): boolean {
    const minX = Math.min(a.x, b.x) - 1e-6;
    const maxX = Math.max(a.x, b.x) + 1e-6;
    const minY = Math.min(a.y, b.y) - 1e-6;
    const maxY = Math.max(a.y, b.y) + 1e-6;
    return p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;
  }

  /**
   * Computes the 4 corners of a rotated rectangle in global coordinates.
   */
  public static getRotatedRectCorners(
    center: Point2D,
    width: number,
    height: number,
    rotationDeg: number
  ): Point2D[] {
    const hw = width / 2;
    const hh = height / 2;
    const rad = (rotationDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const localCorners = [
      { x: -hw, y: -hh },
      { x:  hw, y: -hh },
      { x:  hw, y:  hh },
      { x: -hw, y:  hh }
    ];

    return localCorners.map(lc => ({
      x: center.x + (lc.x * cos - lc.y * sin),
      y: center.y + (lc.x * sin + lc.y * cos)
    }));
  }

  /**
   * Distance between a point and a rotated rectangle.
   */
  public static distPointToRotatedRect(
    p: Point2D,
    center: Point2D,
    width: number,
    height: number,
    rotationDeg: number
  ): number {
    // Transform point into rectangle's local unrotated coordinate space
    const rad = (-rotationDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const tx = p.x - center.x;
    const ty = p.y - center.y;

    const localX = tx * cos - ty * sin;
    const localY = tx * sin + ty * cos;

    const hw = width / 2;
    const hh = height / 2;

    const dx = Math.max(0, Math.abs(localX) - hw);
    const dy = Math.max(0, Math.abs(localY) - hh);

    return Math.hypot(dx, dy);
  }

  /**
   * Exact physical copper distance between a trace segment (swept capsule) and a pad.
   */
  public static distSegmentToPad(
    p1: Point2D,
    p2: Point2D,
    traceRadius: number,
    pad: GeometricPad
  ): number {
    if (pad.shape === 'ROUND') {
      const padRadius = Math.max(pad.widthMm, pad.heightMm) / 2;
      const centerDist = this.distPointToSegment(pad.center, p1, p2);
      return Math.max(0, centerDist - (traceRadius + padRadius));
    }

    if (pad.shape === 'OVAL') {
      // Oval/Oblong is a stadium shape: a line segment connecting the two centers + rounded cap radius
      const isHorizontal = pad.widthMm >= pad.heightMm;
      const capRadius = isHorizontal ? pad.heightMm / 2 : pad.widthMm / 2;
      const coreHalfLen = isHorizontal ? (pad.widthMm / 2 - capRadius) : (pad.heightMm / 2 - capRadius);

      const rad = (pad.rotationDeg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      const c1Local = isHorizontal ? { x: -coreHalfLen, y: 0 } : { x: 0, y: -coreHalfLen };
      const c2Local = isHorizontal ? { x:  coreHalfLen, y: 0 } : { x: 0, y:  coreHalfLen };

      const c1 = {
        x: pad.center.x + (c1Local.x * cos - c1Local.y * sin),
        y: pad.center.y + (c1Local.x * sin + c1Local.y * cos)
      };
      const c2 = {
        x: pad.center.x + (c2Local.x * cos - c2Local.y * sin),
        y: pad.center.y + (c2Local.x * sin + c2Local.y * cos)
      };

      const segToSegDist = this.distBetweenSegments(p1, p2, c1, c2);
      return Math.max(0, segToSegDist - (traceRadius + capRadius));
    }

    if (pad.shape === 'POLYGON' && pad.polygonVertices && pad.polygonVertices.length >= 3) {
      // Distance from segment to convex/concave polygon
      return Math.max(0, this.distSegmentToPolygon(p1, p2, pad.polygonVertices) - traceRadius);
    }

    // Default: RECT (rotated rectangle)
    // Distance from capsule centerline to rectangle, minus trace radius
    const distCenterlineToRect = this.distSegmentToRotatedRect(p1, p2, pad.center, pad.widthMm, pad.heightMm, pad.rotationDeg);
    return Math.max(0, distCenterlineToRect - traceRadius);
  }

  /**
   * Distance between a line segment and a rotated rectangle.
   */
  public static distSegmentToRotatedRect(
    s1: Point2D,
    s2: Point2D,
    rectCenter: Point2D,
    width: number,
    height: number,
    rotationDeg: number
  ): number {
    const corners = this.getRotatedRectCorners(rectCenter, width, height, rotationDeg);

    // If either segment endpoint is inside the rectangle, distance is 0
    if (this.isPointInsideRotatedRect(s1, rectCenter, width, height, rotationDeg) ||
        this.isPointInsideRotatedRect(s2, rectCenter, width, height, rotationDeg)) {
      return 0;
    }

    // Check intersection with any of the 4 edges
    let minDist = Infinity;
    for (let i = 0; i < 4; i++) {
      const e1 = corners[i];
      const e2 = corners[(i + 1) % 4];
      if (this.segmentsIntersect(s1, s2, e1, e2)) {
        return 0;
      }
      minDist = Math.min(minDist, this.distBetweenSegments(s1, s2, e1, e2));
    }

    return minDist;
  }

  /**
   * Distance between a line segment and a polygon.
   */
  public static distSegmentToPolygon(s1: Point2D, s2: Point2D, vertices: Point2D[]): number {
    if (this.isPointInPolygon(s1, vertices) || this.isPointInPolygon(s2, vertices)) {
      return 0;
    }
    let minDist = Infinity;
    const n = vertices.length;
    for (let i = 0; i < n; i++) {
      const e1 = vertices[i];
      const e2 = vertices[(i + 1) % n];
      if (this.segmentsIntersect(s1, s2, e1, e2)) {
        return 0;
      }
      minDist = Math.min(minDist, this.distBetweenSegments(s1, s2, e1, e2));
    }
    return minDist;
  }

  /**
   * Point in polygon (ray-casting algorithm).
   */
  public static isPointInPolygon(p: Point2D, vertices: Point2D[]): boolean {
    let inside = false;
    const n = vertices.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = vertices[i].x, yi = vertices[i].y;
      const xj = vertices[j].x, yj = vertices[j].y;
      const intersect = ((yi > p.y) !== (yj > p.y)) &&
        (p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * Determines if a point is inside a rotated rectangle.
   */
  public static isPointInsideRotatedRect(
    p: Point2D,
    center: Point2D,
    width: number,
    height: number,
    rotationDeg: number
  ): boolean {
    const rad = (-rotationDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const tx = p.x - center.x;
    const ty = p.y - center.y;

    const localX = tx * cos - ty * sin;
    const localY = tx * sin + ty * cos;

    return Math.abs(localX) <= width / 2 && Math.abs(localY) <= height / 2;
  }

  /**
   * Exact physical clearance between two swept trace segments on the same layer.
   * Subtracts (r1 + r2) from centerline distance.
   */
  public static traceToTraceClearance(
    t1_p1: Point2D,
    t1_p2: Point2D,
    t1_width: number,
    t2_p1: Point2D,
    t2_p2: Point2D,
    t2_width: number
  ): number {
    const centerlineDist = this.distBetweenSegments(t1_p1, t1_p2, t2_p1, t2_p2);
    const r1 = t1_width / 2;
    const r2 = t2_width / 2;
    return Math.max(0, centerlineDist - (r1 + r2));
  }

  /**
   * Physical clearance between two geometric pads.
   */
  public static padToPadClearance(pad1: GeometricPad, pad2: GeometricPad): number {
    if (pad1.shape === 'ROUND' && pad2.shape === 'ROUND') {
      const r1 = Math.max(pad1.widthMm, pad1.heightMm) / 2;
      const r2 = Math.max(pad2.widthMm, pad2.heightMm) / 2;
      const d = Math.hypot(pad1.center.x - pad2.center.x, pad1.center.y - pad2.center.y);
      return Math.max(0, d - (r1 + r2));
    }

    // Rotated Rect to Rotated Rect clearance
    const c1 = this.getRotatedRectCorners(pad1.center, pad1.widthMm, pad1.heightMm, pad1.rotationDeg);
    const c2 = this.getRotatedRectCorners(pad2.center, pad2.widthMm, pad2.heightMm, pad2.rotationDeg);

    // Check if overlap exists (SAT or edge intersections)
    for (let i = 0; i < 4; i++) {
      const a1 = c1[i], a2 = c1[(i + 1) % 4];
      for (let j = 0; j < 4; j++) {
        const b1 = c2[j], b2 = c2[(j + 1) % 4];
        if (this.segmentsIntersect(a1, a2, b1, b2)) return 0;
      }
    }

    if (this.isPointInsideRotatedRect(pad1.center, pad2.center, pad2.widthMm, pad2.heightMm, pad2.rotationDeg) ||
        this.isPointInsideRotatedRect(pad2.center, pad1.center, pad1.widthMm, pad1.heightMm, pad1.rotationDeg)) {
      return 0;
    }

    let minDist = Infinity;
    for (let i = 0; i < 4; i++) {
      const a1 = c1[i], a2 = c1[(i + 1) % 4];
      for (let j = 0; j < 4; j++) {
        const b1 = c2[j], b2 = c2[(j + 1) % 4];
        minDist = Math.min(minDist, this.distBetweenSegments(a1, a2, b1, b2));
      }
    }
    return minDist;
  }
}
