/**
 * PATCH-325 — Sketch Creation Tools Engine
 * Comprehensive parametric creation tools for 2D Industrial CAD Sketches:
 * 1. Line
 * 2. Construction Line
 * 3. Centerline
 * 4. Point
 * 5. Circle (Center-Radius, 3-Point)
 * 6. Arc (Center-Start-End)
 * 7. 3-Point Arc
 * 8. Rectangle (Corner, Center)
 * 9. Polygon (Inscribed, Circumscribed Regular N-gon)
 * 10. Polyline (Connected chain, Open/Closed)
 * 11. Slot (Straight Slot with Tangent Arcs & Centerline Axis)
 * 12. Ellipse (Major/Minor axes & Centerline references)
 */

import {
  IndustrialSketchDefinition,
  IndustrialSketchEntity,
  IndustrialSketchConstraint,
  SketchPoint2D,
  SketchLine2D,
  SketchCircle2D,
  SketchArc2D,
  SketchEllipse2D,
  Vector2D
} from './IndustrialConstraintTypes';

export type RectangleMode = 'CORNER' | 'CENTER';
export type PolygonMode = 'INSCRIBED' | 'CIRCUMSCRIBED';
export type SlotMode = 'STRAIGHT' | 'CENTER_POINT';

export interface SketchCreationResult {
  tool: 
    | 'LINE'
    | 'CONSTRUCTION_LINE'
    | 'CENTERLINE'
    | 'POINT'
    | 'CIRCLE'
    | 'ARC'
    | '3POINT_ARC'
    | 'RECTANGLE'
    | 'POLYGON'
    | 'POLYLINE'
    | 'SLOT'
    | 'ELLIPSE';
  primaryEntityId: string;
  entities: Record<string, IndustrialSketchEntity>;
  constraints: Record<string, IndustrialSketchConstraint>;
  pointIds: string[];
  entityIds: string[];
  metadata: Record<string, any>;
}

export class SketchCreationTools {
  public static randomId(prefix: string = 'ent'): string {
    return `${prefix}-${Math.random().toString(36).substring(2, 9)}`;
  }

  public static dist(p1: Vector2D, p2: Vector2D): number {
    return Math.hypot(p2.x - p1.x, p2.y - p1.y);
  }

  // ============================================================================
  // 1. LINE TOOL
  // ============================================================================
  public static createLine(
    start: Vector2D,
    end: Vector2D,
    options?: {
      id?: string;
      isConstruction?: boolean;
      isCenterline?: boolean;
      autoConstrain?: boolean;
      tolerance?: number;
      groupId?: string;
    }
  ): SketchCreationResult {
    const isConstruction = options?.isConstruction ?? false;
    const isCenterline = options?.isCenterline ?? false;
    const autoConstrain = options?.autoConstrain ?? true;
    const tolerance = options?.tolerance ?? 2.0;

    const startPtId = this.randomId('pt');
    const endPtId = this.randomId('pt');
    const lineId = options?.id ?? this.randomId('line');

    const pStart: SketchPoint2D = {
      id: startPtId,
      type: 'POINT',
      x: start.x,
      y: start.y,
      isConstruction,
      groupId: options?.groupId
    };

    const pEnd: SketchPoint2D = {
      id: endPtId,
      type: 'POINT',
      x: end.x,
      y: end.y,
      isConstruction,
      groupId: options?.groupId
    };

    const line: SketchLine2D = {
      id: lineId,
      type: 'LINE',
      startPointId: startPtId,
      endPointId: endPtId,
      isConstruction,
      isCenterline,
      groupId: options?.groupId,
      tag: isCenterline ? 'CENTERLINE' : (isConstruction ? 'CONSTRUCTION_LINE' : 'LINE')
    };

    const entities: Record<string, IndustrialSketchEntity> = {
      [startPtId]: pStart,
      [endPtId]: pEnd,
      [lineId]: line
    };

    const constraints: Record<string, IndustrialSketchConstraint> = {};

    if (autoConstrain) {
      const dx = Math.abs(end.x - start.x);
      const dy = Math.abs(end.y - start.y);
      if (dy < tolerance) {
        const cId = this.randomId('c-h');
        constraints[cId] = {
          id: cId,
          type: 'HORIZONTAL',
          entityIds: [lineId]
        };
      } else if (dx < tolerance) {
        const cId = this.randomId('c-v');
        constraints[cId] = {
          id: cId,
          type: 'VERTICAL',
          entityIds: [lineId]
        };
      }
    }

    const toolType = isCenterline ? 'CENTERLINE' : (isConstruction ? 'CONSTRUCTION_LINE' : 'LINE');

    return {
      tool: toolType,
      primaryEntityId: lineId,
      entities,
      constraints,
      pointIds: [startPtId, endPtId],
      entityIds: [lineId],
      metadata: {
        length: this.dist(start, end),
        angleDeg: (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI,
        isConstruction,
        isCenterline
      }
    };
  }

  // ============================================================================
  // 2. CONSTRUCTION LINE TOOL
  // ============================================================================
  public static createConstructionLine(
    start: Vector2D,
    end: Vector2D,
    options?: {
      id?: string;
      autoConstrain?: boolean;
      tolerance?: number;
      groupId?: string;
    }
  ): SketchCreationResult {
    return this.createLine(start, end, {
      ...options,
      isConstruction: true,
      isCenterline: false
    });
  }

  // ============================================================================
  // 3. CENTERLINE TOOL
  // ============================================================================
  public static createCenterline(
    start: Vector2D,
    end: Vector2D,
    options?: {
      id?: string;
      autoConstrain?: boolean;
      tolerance?: number;
      groupId?: string;
    }
  ): SketchCreationResult {
    return this.createLine(start, end, {
      ...options,
      isConstruction: true,
      isCenterline: true
    });
  }

  // ============================================================================
  // 4. POINT TOOL
  // ============================================================================
  public static createPoint(
    position: Vector2D,
    options?: {
      id?: string;
      isFixed?: boolean;
      isConstruction?: boolean;
      groupId?: string;
    }
  ): SketchCreationResult {
    const pointId = options?.id ?? this.randomId('pt');
    const point: SketchPoint2D = {
      id: pointId,
      type: 'POINT',
      x: position.x,
      y: position.y,
      isFixed: options?.isFixed ?? false,
      isConstruction: options?.isConstruction ?? false,
      groupId: options?.groupId,
      tag: 'POINT'
    };

    return {
      tool: 'POINT',
      primaryEntityId: pointId,
      entities: { [pointId]: point },
      constraints: {},
      pointIds: [pointId],
      entityIds: [pointId],
      metadata: {
        x: position.x,
        y: position.y,
        isFixed: point.isFixed
      }
    };
  }

  // ============================================================================
  // 5. CIRCLE TOOL (Center-Radius / Perimeter)
  // ============================================================================
  public static createCircle(
    center: Vector2D,
    radiusOrPerimeter: number | Vector2D,
    options?: {
      id?: string;
      isConstruction?: boolean;
      groupId?: string;
    }
  ): SketchCreationResult {
    const radius = typeof radiusOrPerimeter === 'number'
      ? radiusOrPerimeter
      : this.dist(center, radiusOrPerimeter);

    const isConstruction = options?.isConstruction ?? false;
    const centerPtId = this.randomId('pt');
    const circleId = options?.id ?? this.randomId('circ');

    const centerPoint: SketchPoint2D = {
      id: centerPtId,
      type: 'POINT',
      x: center.x,
      y: center.y,
      isConstruction,
      groupId: options?.groupId
    };

    const circle: SketchCircle2D = {
      id: circleId,
      type: 'CIRCLE',
      centerPointId: centerPtId,
      radius: Math.max(1e-4, radius),
      isConstruction,
      groupId: options?.groupId,
      tag: 'CIRCLE'
    };

    return {
      tool: 'CIRCLE',
      primaryEntityId: circleId,
      entities: {
        [centerPtId]: centerPoint,
        [circleId]: circle
      },
      constraints: {},
      pointIds: [centerPtId],
      entityIds: [circleId],
      metadata: {
        radius,
        diameter: radius * 2,
        perimeter: 2 * Math.PI * radius,
        area: Math.PI * radius * radius,
        isConstruction
      }
    };
  }

  // 3-Point Circle calculation
  public static createCircle3Point(
    p1: Vector2D,
    p2: Vector2D,
    p3: Vector2D,
    options?: {
      id?: string;
      isConstruction?: boolean;
      groupId?: string;
    }
  ): SketchCreationResult {
    const circum = this.computeCircumcenter(p1, p2, p3);
    if (!circum) {
      throw new Error('Points are collinear; cannot define a 3-point circle.');
    }

    const res = this.createCircle(circum.center, circum.radius, options);
    return {
      ...res,
      metadata: {
        ...res.metadata,
        mode: '3_POINT',
        p1, p2, p3
      }
    };
  }

  // ============================================================================
  // 6. ARC TOOL (Center-Start-End)
  // ============================================================================
  public static createArc(
    center: Vector2D,
    radius: number,
    startAngleRad: number,
    endAngleRad: number,
    options?: {
      id?: string;
      direction?: 'CW' | 'CCW';
      isConstruction?: boolean;
      groupId?: string;
    }
  ): SketchCreationResult {
    const isConstruction = options?.isConstruction ?? false;
    const direction = options?.direction ?? 'CCW';
    const centerPtId = this.randomId('pt');
    const startPtId = this.randomId('pt');
    const endPtId = this.randomId('pt');
    const arcId = options?.id ?? this.randomId('arc');

    const startX = center.x + radius * Math.cos(startAngleRad);
    const startY = center.y + radius * Math.sin(startAngleRad);
    const endX = center.x + radius * Math.cos(endAngleRad);
    const endY = center.y + radius * Math.sin(endAngleRad);

    const centerPoint: SketchPoint2D = { id: centerPtId, type: 'POINT', x: center.x, y: center.y, isConstruction, groupId: options?.groupId };
    const startPoint: SketchPoint2D = { id: startPtId, type: 'POINT', x: startX, y: startY, isConstruction, groupId: options?.groupId };
    const endPoint: SketchPoint2D = { id: endPtId, type: 'POINT', x: endX, y: endY, isConstruction, groupId: options?.groupId };

    const arc: SketchArc2D = {
      id: arcId,
      type: 'ARC',
      centerPointId: centerPtId,
      startPointId: startPtId,
      endPointId: endPtId,
      radius,
      direction,
      startAngle: startAngleRad,
      endAngle: endAngleRad,
      isConstruction,
      groupId: options?.groupId,
      tag: 'ARC'
    };

    let sweep = endAngleRad - startAngleRad;
    if (direction === 'CCW' && sweep < 0) sweep += 2 * Math.PI;
    if (direction === 'CW' && sweep > 0) sweep -= 2 * Math.PI;

    return {
      tool: 'ARC',
      primaryEntityId: arcId,
      entities: {
        [centerPtId]: centerPoint,
        [startPtId]: startPoint,
        [endPtId]: endPoint,
        [arcId]: arc
      },
      constraints: {},
      pointIds: [centerPtId, startPtId, endPtId],
      entityIds: [arcId],
      metadata: {
        radius,
        startAngleRad,
        endAngleRad,
        sweepRad: Math.abs(sweep),
        arcLength: Math.abs(sweep) * radius,
        direction,
        isConstruction
      }
    };
  }

  // ============================================================================
  // 7. 3-POINT ARC TOOL (Start, End, Point on Arc)
  // ============================================================================
  public static create3PointArc(
    p1: Vector2D, // Start point
    p2: Vector2D, // End point
    p3: Vector2D, // Intermediate point on arc curve
    options?: {
      id?: string;
      isConstruction?: boolean;
      groupId?: string;
    }
  ): SketchCreationResult {
    const circum = this.computeCircumcenter(p1, p3, p2);
    if (!circum) {
      // Degenerate collinear fallback: return a straight line between p1 and p2
      const lineRes = this.createLine(p1, p2, options);
      return {
        ...lineRes,
        tool: '3POINT_ARC',
        metadata: {
          ...lineRes.metadata,
          isDegenerateCollinear: true
        }
      };
    }

    const { center, radius } = circum;
    const isConstruction = options?.isConstruction ?? false;
    const centerPtId = this.randomId('pt');
    const startPtId = this.randomId('pt');
    const endPtId = this.randomId('pt');
    const arcId = options?.id ?? this.randomId('arc');

    const theta1 = Math.atan2(p1.y - center.y, p1.x - center.x);
    const theta3 = Math.atan2(p3.y - center.y, p3.x - center.x);
    const theta2 = Math.atan2(p2.y - center.y, p2.x - center.x);

    // Determine whether CCW or CW traversal passes through p3
    // Normalize angles to [0, 2pi) relative to theta1
    const norm = (a: number) => {
      let d = (a - theta1) % (2 * Math.PI);
      if (d < 0) d += 2 * Math.PI;
      return d;
    };

    const d3 = norm(theta3);
    const d2 = norm(theta2);
    const isCCW = d3 < d2;
    const direction: 'CW' | 'CCW' = isCCW ? 'CCW' : 'CW';

    const centerPoint: SketchPoint2D = { id: centerPtId, type: 'POINT', x: center.x, y: center.y, isConstruction, groupId: options?.groupId };
    const startPoint: SketchPoint2D = { id: startPtId, type: 'POINT', x: p1.x, y: p1.y, isConstruction, groupId: options?.groupId };
    const endPoint: SketchPoint2D = { id: endPtId, type: 'POINT', x: p2.x, y: p2.y, isConstruction, groupId: options?.groupId };

    const arc: SketchArc2D = {
      id: arcId,
      type: 'ARC',
      centerPointId: centerPtId,
      startPointId: startPtId,
      endPointId: endPtId,
      radius,
      direction,
      startAngle: theta1,
      endAngle: theta2,
      isConstruction,
      groupId: options?.groupId,
      tag: '3POINT_ARC'
    };

    return {
      tool: '3POINT_ARC',
      primaryEntityId: arcId,
      entities: {
        [centerPtId]: centerPoint,
        [startPtId]: startPoint,
        [endPtId]: endPoint,
        [arcId]: arc
      },
      constraints: {},
      pointIds: [centerPtId, startPtId, endPtId],
      entityIds: [arcId],
      metadata: {
        center,
        radius,
        direction,
        startAngle: theta1,
        endAngle: theta2,
        throughPoint: p3
      }
    };
  }

  // ============================================================================
  // 8. RECTANGLE TOOL (Corner or Center)
  // ============================================================================
  public static createRectangle(
    p1: Vector2D,
    p2: Vector2D,
    options?: {
      type?: RectangleMode | '3POINT' | '3POINT_CENTER' | 'PARALLELOGRAM';
      p3?: Vector2D;
      id?: string;
      isConstruction?: boolean;
      groupId?: string;
    }
  ): SketchCreationResult {
    const mode = options?.type ?? 'CORNER';
    const isConstruction = options?.isConstruction ?? false;
    const groupId = options?.groupId ?? this.randomId('grp-rect');

    let corners: Vector2D[] = [];
    let centerPt: Vector2D | null = null;

    if (mode === 'CENTER') {
      const cx = p1.x;
      const cy = p1.y;
      const hx = Math.abs(p2.x - cx);
      const hy = Math.abs(p2.y - cy);
      corners = [
        { x: cx - hx, y: cy - hy },
        { x: cx + hx, y: cy - hy },
        { x: cx + hx, y: cy + hy },
        { x: cx - hx, y: cy + hy }
      ];
      centerPt = { x: cx, y: cy };
    } else if (mode === 'CORNER') {
      const minX = Math.min(p1.x, p2.x);
      const maxX = Math.max(p1.x, p2.x);
      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);
      corners = [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY }
      ];
    } else if (mode === '3POINT') {
      // p1, p2 define width and rotation, p3 defines height
      if (!options?.p3) throw new Error('3-Point Rectangle requires p3');
      const p3 = options.p3;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist12 = Math.hypot(dx, dy);
      const ux = dx / dist12;
      const uy = dy / dist12;
      const nx = -uy;
      const ny = ux;
      
      const v13 = { x: p3.x - p1.x, y: p3.y - p1.y };
      const h = v13.x * nx + v13.y * ny; // Projection onto normal
      
      corners = [
        p1,
        p2,
        { x: p2.x + nx * h, y: p2.y + ny * h },
        { x: p1.x + nx * h, y: p1.y + ny * h }
      ];
    } else if (mode === '3POINT_CENTER') {
      if (!options?.p3) throw new Error('3-Point Center Rectangle requires p3');
      const p3 = options.p3;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const ux = dx; // center to mid-edge
      const uy = dy;
      const nx = -uy;
      const ny = ux;
      
      const v13 = { x: p3.x - p1.x, y: p3.y - p1.y };
      const h = v13.x * nx + v13.y * ny;
      
      corners = [
        { x: p1.x + ux - nx, y: p1.y + uy - ny },
        { x: p1.x + ux + nx, y: p1.y + uy + ny },
        { x: p1.x - ux + nx, y: p1.y - uy + ny },
        { x: p1.x - ux - nx, y: p1.y - uy - ny }
      ];
      centerPt = p1;
    } else if (mode === 'PARALLELOGRAM') {
      if (!options?.p3) throw new Error('Parallelogram requires p3');
      const p3 = options.p3;
      corners = [
        p1,
        p2,
        p3,
        { x: p3.x + (p1.x - p2.x), y: p3.y + (p1.y - p2.y) }
      ];
    }

    const ptIds = corners.map(() => this.randomId('pt'));
    const entities: Record<string, IndustrialSketchEntity> = {};
    const constraints: Record<string, IndustrialSketchConstraint> = {};
    const entityIds: string[] = [];

    corners.forEach((c, i) => {
      entities[ptIds[i]] = {
        id: ptIds[i],
        type: 'POINT',
        x: c.x,
        y: c.y,
        isConstruction,
        groupId
      };
    });

    if (centerPt) {
      const cId = this.randomId('pt');
      entities[cId] = {
        id: cId,
        type: 'POINT',
        x: centerPt.x,
        y: centerPt.y,
        isConstruction: true,
        groupId
      };
      ptIds.push(cId);
    }

    const edgeIds: string[] = [];
    for (let i = 0; i < 4; i++) {
      const lId = this.randomId('line');
      entities[lId] = {
        id: lId,
        type: 'LINE',
        startPointId: ptIds[i],
        endPointId: ptIds[(i + 1) % 4],
        isConstruction,
        groupId,
        tag: `RECT_EDGE_${i}`
      };
      entityIds.push(lId);
      edgeIds.push(lId);
    }

    // Constraints
    if (mode === 'CORNER' || mode === 'CENTER') {
      const ch1 = this.randomId('c-rect-h1');
      const ch2 = this.randomId('c-rect-h2');
      const cv1 = this.randomId('c-rect-v1');
      const cv2 = this.randomId('c-rect-v2');
      constraints[ch1] = { id: ch1, type: 'HORIZONTAL', entityIds: [edgeIds[0]] };
      constraints[ch2] = { id: ch2, type: 'HORIZONTAL', entityIds: [edgeIds[2]] };
      constraints[cv1] = { id: cv1, type: 'VERTICAL', entityIds: [edgeIds[1]] };
      constraints[cv2] = { id: cv2, type: 'VERTICAL', entityIds: [edgeIds[3]] };
    } else if (mode !== 'PARALLELOGRAM') {
      const c1 = this.randomId('c-rect-perp');
      constraints[c1] = { id: c1, type: 'PERPENDICULAR', entityIds: [edgeIds[0], edgeIds[1]] };
    }
    const c2 = this.randomId('c-rect-par');
    constraints[c2] = { id: c2, type: 'PARALLEL', entityIds: [edgeIds[0], edgeIds[2]] };
    const c3 = this.randomId('c-rect-par2');
    constraints[c3] = { id: c3, type: 'PARALLEL', entityIds: [edgeIds[1], edgeIds[3]] };

    if (mode === 'CENTER') {
      const diag1Id = this.randomId('line');
      entities[diag1Id] = {
        id: diag1Id,
        type: 'LINE',
        startPointId: ptIds[0],
        endPointId: ptIds[2],
        isConstruction: true,
        groupId,
        tag: 'RECT_DIAG_1'
      };
      entityIds.push(diag1Id);

      const diag2Id = this.randomId('line');
      entities[diag2Id] = {
        id: diag2Id,
        type: 'LINE',
        startPointId: ptIds[1],
        endPointId: ptIds[3],
        isConstruction: true,
        groupId,
        tag: 'RECT_DIAG_2'
      };
      entityIds.push(diag2Id);
    }

    const width = Math.round(Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y));
    const height = Math.round(Math.hypot(corners[3].x - corners[0].x, corners[3].y - corners[0].y));
    const area = width * height;

    return {
      tool: 'RECTANGLE',
      primaryEntityId: edgeIds[0],
      entities,
      constraints,
      pointIds: ptIds,
      entityIds,
      metadata: { mode, groupId, width, height, area }
    };
  }

  // ============================================================================
  // 15. MIDPOINT LINE TOOL
  // ============================================================================
  public static createMidpointLine(
    mid: Vector2D,
    end: Vector2D,
    options?: { isConstruction?: boolean; isCenterline?: boolean; groupId?: string }
  ): SketchCreationResult {
    const isConstruction = options?.isConstruction ?? false;
    const isCenterline = options?.isCenterline ?? false;
    const groupId = options?.groupId ?? this.randomId('grp-mpline');

    const dx = end.x - mid.x;
    const dy = end.y - mid.y;
    const start = { x: mid.x - dx, y: mid.y - dy };

    const pMidId = this.randomId('pt');
    const pStartId = this.randomId('pt');
    const pEndId = this.randomId('pt');
    const lineId = this.randomId('line');

    const entities: Record<string, IndustrialSketchEntity> = {
      [pMidId]: { id: pMidId, type: 'POINT', x: mid.x, y: mid.y, isConstruction: true, groupId, tag: 'MIDPOINT' },
      [pStartId]: { id: pStartId, type: 'POINT', x: start.x, y: start.y, isConstruction, groupId },
      [pEndId]: { id: pEndId, type: 'POINT', x: end.x, y: end.y, isConstruction, groupId },
      [lineId]: {
        id: lineId,
        type: 'LINE',
        startPointId: pStartId,
        endPointId: pEndId,
        isConstruction,
        isCenterline,
        groupId,
        tag: 'MIDPOINT_LINE'
      }
    };

    const constraints: Record<string, IndustrialSketchConstraint> = {};
    const cMid = this.randomId('c-mid');
    constraints[cMid] = { id: cMid, type: 'MIDPOINT', entityIds: [pMidId, lineId] };

    return {
      tool: 'LINE',
      primaryEntityId: lineId,
      entities,
      constraints,
      pointIds: [pMidId, pStartId, pEndId],
      entityIds: [lineId],
      metadata: { type: 'MIDPOINT_LINE', groupId }
    };
  }

  // ============================================================================
  // 16. 3-POINT PERIMETER CIRCLE
  // ============================================================================
  public static create3PointCircle(
    p1: Vector2D,
    p2: Vector2D,
    p3: Vector2D,
    options?: { isConstruction?: boolean; groupId?: string }
  ): SketchCreationResult {
    const isConstruction = options?.isConstruction ?? false;
    const groupId = options?.groupId ?? this.randomId('grp-3pt-circle');
    
    const circleData = this.computeCircumcenter(p1, p2, p3);
    const center = circleData ? circleData.center : p1;
    const radius = circleData ? circleData.radius : 10;

    const p1Id = this.randomId('pt');
    const p2Id = this.randomId('pt');
    const p3Id = this.randomId('pt');
    const cPtId = this.randomId('pt');
    const circleId = this.randomId('circle');

    const entities: Record<string, IndustrialSketchEntity> = {
      [p1Id]: { id: p1Id, type: 'POINT', x: p1.x, y: p1.y, isConstruction, groupId },
      [p2Id]: { id: p2Id, type: 'POINT', x: p2.x, y: p2.y, isConstruction, groupId },
      [p3Id]: { id: p3Id, type: 'POINT', x: p3.x, y: p3.y, isConstruction, groupId },
      [cPtId]: { id: cPtId, type: 'POINT', x: center.x, y: center.y, isConstruction: true, groupId },
      [circleId]: {
        id: circleId,
        type: 'CIRCLE',
        centerPointId: cPtId,
        radius,
        isConstruction,
        groupId,
        tag: '3POINT_CIRCLE'
      } as SketchCircle2D
    };

    const constraints: Record<string, IndustrialSketchConstraint> = {};
    [p1Id, p2Id, p3Id].forEach(ptId => {
      const cid = this.randomId('c-on-circle');
      constraints[cid] = { id: cid, type: 'COINCIDENT', entityIds: [ptId, circleId] };
    });

    return {
      tool: 'CIRCLE',
      primaryEntityId: circleId,
      entities,
      constraints,
      pointIds: [p1Id, p2Id, p3Id, cPtId],
      entityIds: [circleId],
      metadata: { type: '3POINT_PERIMETER_CIRCLE', center, radius, groupId }
    };
  }

  // ============================================================================
  // 17. TANGENT ARC TOOL
  // ============================================================================
  public static createTangentArc(
    tangentEntityId: string,
    end: Vector2D,
    sketch: IndustrialSketchDefinition,
    options?: { isConstruction?: boolean; groupId?: string }
  ): SketchCreationResult {
    const isConstruction = options?.isConstruction ?? false;
    const groupId = options?.groupId ?? this.randomId('grp-tan-arc');
    
    const startPtId = this.randomId('pt');
    const endPtId = this.randomId('pt');
    const cPtId = this.randomId('pt');
    const arcId = this.randomId('arc');

    const entities: Record<string, IndustrialSketchEntity> = {
      [startPtId]: { id: startPtId, type: 'POINT', x: end.x - 10, y: end.y, isConstruction, groupId },
      [endPtId]: { id: endPtId, type: 'POINT', x: end.x, y: end.y, isConstruction, groupId },
      [cPtId]: { id: cPtId, type: 'POINT', x: end.x - 5, y: end.y + 5, isConstruction: true, groupId },
      [arcId]: {
        id: arcId,
        type: 'ARC',
        centerPointId: cPtId,
        startPointId: startPtId,
        endPointId: endPtId,
        radius: 7.07,
        direction: 'CW',
        isConstruction,
        groupId,
        tag: 'TANGENT_ARC'
      } as SketchArc2D
    };

    const constraints: Record<string, IndustrialSketchConstraint> = {};
    const cTan = this.randomId('c-tan');
    constraints[cTan] = { id: cTan, type: 'TANGENT', entityIds: [tangentEntityId, arcId] };

    return {
      tool: 'ARC',
      primaryEntityId: arcId,
      entities,
      constraints,
      pointIds: [startPtId, endPtId, cPtId],
      entityIds: [arcId],
      metadata: { type: 'TANGENT_ARC', groupId }
    };
  }

  // ============================================================================
  // 18. CENTERPOINT ARC TOOL
  // ============================================================================
  public static createCenterpointArc(
    center: Vector2D,
    start: Vector2D,
    end: Vector2D,
    options?: { isConstruction?: boolean; groupId?: string }
  ): SketchCreationResult {
    const isConstruction = options?.isConstruction ?? false;
    const groupId = options?.groupId ?? this.randomId('grp-cp-arc');
    const radius = this.dist(center, start);

    const cPtId = this.randomId('pt');
    const sPtId = this.randomId('pt');
    const ePtId = this.randomId('pt');
    const arcId = this.randomId('arc');

    const entities: Record<string, IndustrialSketchEntity> = {
      [cPtId]: { id: cPtId, type: 'POINT', x: center.x, y: center.y, isConstruction: true, groupId },
      [sPtId]: { id: sPtId, type: 'POINT', x: start.x, y: start.y, isConstruction, groupId },
      [ePtId]: { id: ePtId, type: 'POINT', x: end.x, y: end.y, isConstruction, groupId },
      [arcId]: {
        id: arcId,
        type: 'ARC',
        centerPointId: cPtId,
        startPointId: sPtId,
        endPointId: ePtId,
        radius,
        direction: 'CW',
        isConstruction,
        groupId,
        tag: 'CENTERPOINT_ARC'
      } as SketchArc2D
    };

    return {
      tool: 'ARC',
      primaryEntityId: arcId,
      entities,
      constraints: {},
      pointIds: [cPtId, sPtId, ePtId],
      entityIds: [arcId],
      metadata: { type: 'CENTERPOINT_ARC', radius, groupId }
    };
  }

  // ============================================================================
  // 9. POLYGON TOOL (Regular N-gon)
  // ============================================================================
  public static createPolygon(
    center: Vector2D,
    radiusOrVertex: number | Vector2D,
    sides: number = 6,
    options?: {
      mode?: PolygonMode;
      startAngleRad?: number;
      isConstruction?: boolean;
      groupId?: string;
    }
  ): SketchCreationResult {
    const N = Math.max(3, Math.round(sides));
    const mode = options?.mode ?? 'INSCRIBED';
    const isConstruction = options?.isConstruction ?? false;
    const groupId = options?.groupId ?? this.randomId('grp-poly');

    let radius = typeof radiusOrVertex === 'number'
      ? radiusOrVertex
      : this.dist(center, radiusOrVertex);

    let initialAngle = options?.startAngleRad ?? 0;
    if (typeof radiusOrVertex !== 'number') {
      initialAngle = Math.atan2(radiusOrVertex.y - center.y, radiusOrVertex.x - center.x);
    }

    // Circumscribed adjustment: R_vertices = R_inscribed / cos(pi/N)
    if (mode === 'CIRCUMSCRIBED') {
      radius = radius / Math.cos(Math.PI / N);
    }

    const entities: Record<string, IndustrialSketchEntity> = {};
    const constraints: Record<string, IndustrialSketchConstraint> = {};
    const pointIds: string[] = [];
    const entityIds: string[] = [];

    // Center point
    const centerPtId = this.randomId('pt');
    entities[centerPtId] = {
      id: centerPtId,
      type: 'POINT',
      x: center.x,
      y: center.y,
      isConstruction: true,
      groupId
    };
    pointIds.push(centerPtId);

    // Vertices
    for (let i = 0; i < N; i++) {
      const angle = initialAngle + (2 * Math.PI * i) / N;
      const vx = center.x + radius * Math.cos(angle);
      const vy = center.y + radius * Math.sin(angle);
      const ptId = this.randomId('pt');
      entities[ptId] = {
        id: ptId,
        type: 'POINT',
        x: vx,
        y: vy,
        isConstruction,
        groupId
      };
      pointIds.push(ptId);
    }

    // Reference Construction Circle
    const refCircleId = this.randomId('circ');
    entities[refCircleId] = {
      id: refCircleId,
      type: 'CIRCLE',
      centerPointId: centerPtId,
      radius,
      isConstruction: true,
      groupId,
      tag: 'POLYGON_REF_CIRCLE'
    };
    entityIds.push(refCircleId);

    // Perimeter Lines
    // pointIds[0] is center, pointIds[1..N] are vertices
    const vertexIds = pointIds.slice(1);
    const lineIds: string[] = [];

    for (let i = 0; i < N; i++) {
      const startId = vertexIds[i];
      const endId = vertexIds[(i + 1) % N];
      const lId = this.randomId('line');
      entities[lId] = {
        id: lId,
        type: 'LINE',
        startPointId: startId,
        endPointId: endId,
        isConstruction,
        groupId,
        tag: `POLYGON_EDGE_${i}`
      };
      lineIds.push(lId);
      entityIds.push(lId);
    }

    // Equal length constraints between consecutive edges
    for (let i = 0; i < lineIds.length - 1; i++) {
      const cId = this.randomId('c-poly-eq');
      constraints[cId] = {
        id: cId,
        type: 'EQUAL',
        entityIds: [lineIds[i], lineIds[i + 1]]
      };
    }

    const sideLength = 2 * radius * Math.sin(Math.PI / N);

    return {
      tool: 'POLYGON',
      primaryEntityId: lineIds[0],
      entities,
      constraints,
      pointIds,
      entityIds,
      metadata: {
        sides: N,
        radius,
        mode,
        sideLength,
        perimeter: N * sideLength,
        area: 0.5 * N * radius * radius * Math.sin((2 * Math.PI) / N),
        groupId
      }
    };
  }

  // ============================================================================
  // 10. POLYLINE TOOL (Connected chain of lines)
  // ============================================================================
  public static createPolyline(
    points: Vector2D[],
    options?: {
      closed?: boolean;
      isConstruction?: boolean;
      groupId?: string;
    }
  ): SketchCreationResult {
    if (!points || points.length < 2) {
      throw new Error('Polyline requires at least 2 points.');
    }

    const closed = options?.closed ?? false;
    const isConstruction = options?.isConstruction ?? false;
    const groupId = options?.groupId ?? this.randomId('grp-pline');

    const entities: Record<string, IndustrialSketchEntity> = {};
    const constraints: Record<string, IndustrialSketchConstraint> = {};
    const pointIds: string[] = [];
    const entityIds: string[] = [];

    // Create Points
    points.forEach((pt) => {
      const ptId = this.randomId('pt');
      entities[ptId] = {
        id: ptId,
        type: 'POINT',
        x: pt.x,
        y: pt.y,
        isConstruction,
        groupId
      };
      pointIds.push(ptId);
    });

    // Create Connecting Line Segments
    for (let i = 0; i < pointIds.length - 1; i++) {
      const lId = this.randomId('line');
      entities[lId] = {
        id: lId,
        type: 'LINE',
        startPointId: pointIds[i],
        endPointId: pointIds[i + 1],
        isConstruction,
        groupId,
        tag: `POLYLINE_SEG_${i}`
      };
      entityIds.push(lId);
    }

    // Optional closing segment
    if (closed && pointIds.length >= 3) {
      const closeLId = this.randomId('line');
      entities[closeLId] = {
        id: closeLId,
        type: 'LINE',
        startPointId: pointIds[pointIds.length - 1],
        endPointId: pointIds[0],
        isConstruction,
        groupId,
        tag: 'POLYLINE_CLOSE_SEG'
      };
      entityIds.push(closeLId);
    }

    let totalLength = 0;
    for (let i = 0; i < points.length - 1; i++) {
      totalLength += this.dist(points[i], points[i + 1]);
    }
    if (closed && points.length >= 3) {
      totalLength += this.dist(points[points.length - 1], points[0]);
    }

    return {
      tool: 'POLYLINE',
      primaryEntityId: entityIds[0],
      entities,
      constraints,
      pointIds,
      entityIds,
      metadata: {
        segmentCount: entityIds.length,
        vertexCount: pointIds.length,
        closed,
        totalLength,
        groupId
      }
    };
  }

  // ============================================================================
  // 11. SLOT TOOL (Straight Slot with 2 Arcs & 2 Lines & Centerline)
  // ============================================================================
  public static createSlot(
    start: Vector2D,
    end: Vector2D,
    width: number,
    options?: {
      type?: SlotMode;
      isConstruction?: boolean;
      groupId?: string;
    }
  ): SketchCreationResult {
    const slotWidth = Math.max(1.0, width);
    const radius = slotWidth / 2;
    const isConstruction = options?.isConstruction ?? false;
    const groupId = options?.groupId ?? this.randomId('grp-slot');

    let c1: Vector2D = start;
    let c2: Vector2D = end;

    if (options?.type === 'CENTER_POINT') {
      // Start is center of slot, end defines direction and half length
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      c1 = { x: start.x - dx, y: start.y - dy };
      c2 = { x: start.x + dx, y: start.y + dy };
    }

    const dx = c2.x - c1.x;
    const dy = c2.y - c1.y;
    const length = Math.hypot(dx, dy);

    if (length < 1e-4) {
      // Degenerate slot with 0 length: return circle
      return this.createCircle(c1, radius, options);
    }

    // Unit direction vector & unit normal vector
    const ux = dx / length;
    const uy = dy / length;
    const nx = -uy;
    const ny = ux;

    // Corner junction vertices between lines and semi-circular arcs
    // P1: Top-start (C1 + R*n)
    // P2: Top-end   (C2 + R*n)
    // P3: Bot-end   (C2 - R*n)
    // P4: Bot-start (C1 - R*n)
    const p1: Vector2D = { x: c1.x + nx * radius, y: c1.y + ny * radius };
    const p2: Vector2D = { x: c2.x + nx * radius, y: c2.y + ny * radius };
    const p3: Vector2D = { x: c2.x - nx * radius, y: c2.y - ny * radius };
    const p4: Vector2D = { x: c1.x - nx * radius, y: c1.y - ny * radius };

    const c1PtId = this.randomId('pt');
    const c2PtId = this.randomId('pt');
    const p1Id = this.randomId('pt');
    const p2Id = this.randomId('pt');
    const p3Id = this.randomId('pt');
    const p4Id = this.randomId('pt');

    const lineTopId = this.randomId('line');
    const lineBotId = this.randomId('line');
    const arcRightId = this.randomId('arc');
    const arcLeftId = this.randomId('arc');
    const centerlineId = this.randomId('line');

    const entities: Record<string, IndustrialSketchEntity> = {
      // Points
      [c1PtId]: { id: c1PtId, type: 'POINT', x: c1.x, y: c1.y, isConstruction: true, groupId },
      [c2PtId]: { id: c2PtId, type: 'POINT', x: c2.x, y: c2.y, isConstruction: true, groupId },
      [p1Id]: { id: p1Id, type: 'POINT', x: p1.x, y: p1.y, isConstruction, groupId },
      [p2Id]: { id: p2Id, type: 'POINT', x: p2.x, y: p2.y, isConstruction, groupId },
      [p3Id]: { id: p3Id, type: 'POINT', x: p3.x, y: p3.y, isConstruction, groupId },
      [p4Id]: { id: p4Id, type: 'POINT', x: p4.x, y: p4.y, isConstruction, groupId },

      // Centerline Reference Axis
      [centerlineId]: {
        id: centerlineId,
        type: 'LINE',
        startPointId: c1PtId,
        endPointId: c2PtId,
        isConstruction: true,
        isCenterline: true,
        groupId,
        tag: 'SLOT_CENTERLINE'
      },

      // Top Line (P1 -> P2)
      [lineTopId]: {
        id: lineTopId,
        type: 'LINE',
        startPointId: p1Id,
        endPointId: p2Id,
        isConstruction,
        groupId,
        tag: 'SLOT_TOP_LINE'
      },

      // Right Arc (P2 -> P3, centered at C2)
      [arcRightId]: {
        id: arcRightId,
        type: 'ARC',
        centerPointId: c2PtId,
        startPointId: p2Id,
        endPointId: p3Id,
        radius,
        direction: 'CW',
        isConstruction,
        groupId,
        tag: 'SLOT_RIGHT_ARC'
      },

      // Bottom Line (P3 -> P4)
      [lineBotId]: {
        id: lineBotId,
        type: 'LINE',
        startPointId: p3Id,
        endPointId: p4Id,
        isConstruction,
        groupId,
        tag: 'SLOT_BOT_LINE'
      },

      // Left Arc (P4 -> P1, centered at C1)
      [arcLeftId]: {
        id: arcLeftId,
        type: 'ARC',
        centerPointId: c1PtId,
        startPointId: p4Id,
        endPointId: p1Id,
        radius,
        direction: 'CW',
        isConstruction,
        groupId,
        tag: 'SLOT_LEFT_ARC'
      }
    };

    const constraints: Record<string, IndustrialSketchConstraint> = {};

    // Parallel constraint between Top and Bottom lines
    const cPar = this.randomId('c-slot-par');
    constraints[cPar] = { id: cPar, type: 'PARALLEL', entityIds: [lineTopId, lineBotId] };

    // Equal radius between Left and Right arcs
    const cEq = this.randomId('c-slot-eq');
    constraints[cEq] = { id: cEq, type: 'EQUAL', entityIds: [arcLeftId, arcRightId] };

    // Tangency constraints
    const cTan1 = this.randomId('c-slot-tan1');
    const cTan2 = this.randomId('c-slot-tan2');
    constraints[cTan1] = { id: cTan1, type: 'TANGENT', entityIds: [lineTopId, arcRightId] };
    constraints[cTan2] = { id: cTan2, type: 'TANGENT', entityIds: [lineBotId, arcLeftId] };

    return {
      tool: 'SLOT',
      primaryEntityId: lineTopId,
      entities,
      constraints,
      pointIds: [c1PtId, c2PtId, p1Id, p2Id, p3Id, p4Id],
      entityIds: [centerlineId, lineTopId, arcRightId, lineBotId, arcLeftId],
      metadata: {
        centerDistance: length,
        totalLength: length + 2 * radius,
        width: slotWidth,
        radius,
        area: length * slotWidth + Math.PI * radius * radius,
        perimeter: 2 * length + 2 * Math.PI * radius,
        groupId
      }
    };
  }

  // ============================================================================
  // 12. ELLIPSE TOOL
  // ============================================================================
  public static createEllipse(
    center: Vector2D,
    majorAxisPt: Vector2D,
    minorRadiusOrPt: number | Vector2D,
    options?: {
      id?: string;
      isConstruction?: boolean;
      groupId?: string;
    }
  ): SketchCreationResult {
    const isConstruction = options?.isConstruction ?? false;
    const groupId = options?.groupId ?? this.randomId('grp-ellipse');

    const majorRadius = Math.max(1e-3, this.dist(center, majorAxisPt));
    const rotation = Math.atan2(majorAxisPt.y - center.y, majorAxisPt.x - center.x);

    let minorRadius: number;
    if (typeof minorRadiusOrPt === 'number') {
      minorRadius = Math.max(1e-3, minorRadiusOrPt);
    } else {
      // Distance from center to minor point projected perpendicular to major axis
      const dx = minorRadiusOrPt.x - center.x;
      const dy = minorRadiusOrPt.y - center.y;
      // Perpendicular direction: (-sin(rotation), cos(rotation))
      const perpDist = Math.abs(-Math.sin(rotation) * dx + Math.cos(rotation) * dy);
      minorRadius = Math.max(1e-3, perpDist > 1e-4 ? perpDist : this.dist(center, minorRadiusOrPt));
    }

    const centerPtId = this.randomId('pt');
    const majorPt1Id = this.randomId('pt');
    const majorPt2Id = this.randomId('pt');
    const minorPt1Id = this.randomId('pt');
    const minorPt2Id = this.randomId('pt');

    const majorAxisLineId = this.randomId('line');
    const minorAxisLineId = this.randomId('line');
    const ellipseId = options?.id ?? this.randomId('ellipse');

    // Major axis endpoints
    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);
    const pMaj1: Vector2D = { x: center.x + majorRadius * cosR, y: center.y + majorRadius * sinR };
    const pMaj2: Vector2D = { x: center.x - majorRadius * cosR, y: center.y - majorRadius * sinR };

    // Minor axis endpoints (perpendicular)
    const pMin1: Vector2D = { x: center.x - minorRadius * sinR, y: center.y + minorRadius * cosR };
    const pMin2: Vector2D = { x: center.x + minorRadius * sinR, y: center.y - minorRadius * cosR };

    const entities: Record<string, IndustrialSketchEntity> = {
      [centerPtId]: { id: centerPtId, type: 'POINT', x: center.x, y: center.y, isConstruction: true, groupId },
      [majorPt1Id]: { id: majorPt1Id, type: 'POINT', x: pMaj1.x, y: pMaj1.y, isConstruction: true, groupId },
      [majorPt2Id]: { id: majorPt2Id, type: 'POINT', x: pMaj2.x, y: pMaj2.y, isConstruction: true, groupId },
      [minorPt1Id]: { id: minorPt1Id, type: 'POINT', x: pMin1.x, y: pMin1.y, isConstruction: true, groupId },
      [minorPt2Id]: { id: minorPt2Id, type: 'POINT', x: pMin2.x, y: pMin2.y, isConstruction: true, groupId },

      // Construction Centerlines for Major and Minor axes
      [majorAxisLineId]: {
        id: majorAxisLineId,
        type: 'LINE',
        startPointId: majorPt1Id,
        endPointId: majorPt2Id,
        isConstruction: true,
        isCenterline: true,
        groupId,
        tag: 'ELLIPSE_MAJOR_AXIS'
      },
      [minorAxisLineId]: {
        id: minorAxisLineId,
        type: 'LINE',
        startPointId: minorPt1Id,
        endPointId: minorPt2Id,
        isConstruction: true,
        isCenterline: true,
        groupId,
        tag: 'ELLIPSE_MINOR_AXIS'
      },

      // Ellipse Entity
      [ellipseId]: {
        id: ellipseId,
        type: 'ELLIPSE',
        centerPointId: centerPtId,
        majorRadius,
        minorRadius,
        rotation,
        isConstruction,
        groupId,
        tag: 'ELLIPSE'
      } as SketchEllipse2D
    };

    const constraints: Record<string, IndustrialSketchConstraint> = {};
    // Perpendicular constraint between major and minor axes
    const cPerp = this.randomId('c-ellipse-perp');
    constraints[cPerp] = {
      id: cPerp,
      type: 'PERPENDICULAR',
      entityIds: [majorAxisLineId, minorAxisLineId]
    };

    // Ramanujan approximation for ellipse perimeter
    const h = Math.pow(majorRadius - minorRadius, 2) / Math.pow(majorRadius + minorRadius, 2);
    const approxPerimeter = Math.PI * (majorRadius + minorRadius) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));

    return {
      tool: 'ELLIPSE',
      primaryEntityId: ellipseId,
      entities,
      constraints,
      pointIds: [centerPtId, majorPt1Id, majorPt2Id, minorPt1Id, minorPt2Id],
      entityIds: [ellipseId, majorAxisLineId, minorAxisLineId],
      metadata: {
        center,
        majorRadius,
        minorRadius,
        rotationRad: rotation,
        rotationDeg: (rotation * 180) / Math.PI,
        area: Math.PI * majorRadius * minorRadius,
        approxPerimeter,
        eccentricity: majorRadius >= minorRadius ? Math.sqrt(1 - (minorRadius * minorRadius) / (majorRadius * majorRadius)) : 0,
        groupId
      }
    };
  }

  // ============================================================================
  // SKETCH MUTATION HELPER
  // ============================================================================
  public static applyToSketch(
    sketch: IndustrialSketchDefinition,
    creationResult: SketchCreationResult
  ): IndustrialSketchDefinition {
    const nextSketch: IndustrialSketchDefinition = JSON.parse(JSON.stringify(sketch));
    nextSketch.revision = (nextSketch.revision || 1) + 1;

    // Merge Entities
    Object.entries(creationResult.entities).forEach(([id, ent]) => {
      nextSketch.entities[id] = ent;
    });

    // Merge Constraints
    Object.entries(creationResult.constraints).forEach(([id, cons]) => {
      nextSketch.constraints[id] = cons;
    });

    return nextSketch;
  }

  // ============================================================================
  // MATHEMATICAL HELPERS
  // ============================================================================
  public static computeCircumcenter(
    p1: Vector2D,
    p2: Vector2D,
    p3: Vector2D
  ): { center: Vector2D; radius: number } | null {
    const d = 2 * (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y));
    if (Math.abs(d) < 1e-9) {
      return null; // Collinear
    }

    const p1Sq = p1.x * p1.x + p1.y * p1.y;
    const p2Sq = p2.x * p2.x + p2.y * p2.y;
    const p3Sq = p3.x * p3.x + p3.y * p3.y;

    const cx = (p1Sq * (p2.y - p3.y) + p2Sq * (p3.y - p1.y) + p3Sq * (p1.y - p2.y)) / d;
    const cy = (p1Sq * (p3.x - p2.x) + p2Sq * (p1.x - p3.x) + p3Sq * (p2.x - p1.x)) / d;

    const center = { x: cx, y: cy };
    const radius = Math.hypot(p1.x - cx, p1.y - cy);

    return { center, radius };
  }

  // ============================================================================
  // 13. 2D SKETCH FILLET TOOL (CORNER FILLET)
  // ============================================================================
  public static createFillet2D(
    corner: Vector2D,
    line1End: Vector2D,
    line2End: Vector2D,
    requestedRadius: number = 10
  ): {
    success: boolean;
    center: Vector2D;
    radius: number;
    t1: Vector2D;
    t2: Vector2D;
    arcEntity: SketchArc2D;
    points: { centerPt: SketchPoint2D; t1Pt: SketchPoint2D; t2Pt: SketchPoint2D };
  } | null {
    const d1 = Math.hypot(line1End.x - corner.x, line1End.y - corner.y);
    const d2 = Math.hypot(line2End.x - corner.x, line2End.y - corner.y);
    if (d1 < 1e-4 || d2 < 1e-4) return null;

    const u1 = { x: (line1End.x - corner.x) / d1, y: (line1End.y - corner.y) / d1 };
    const u2 = { x: (line2End.x - corner.x) / d2, y: (line2End.y - corner.y) / d2 };

    const dot = u1.x * u2.x + u1.y * u2.y;
    const clampedDot = Math.max(-0.999, Math.min(0.999, dot));
    const theta = Math.acos(clampedDot); // Angle between lines
    if (theta < 0.05 || theta > Math.PI - 0.05) return null; // Collinear or folded

    const halfTheta = theta / 2;
    const maxT = Math.min(d1, d2) * 0.8;
    const maxR = maxT * Math.tan(halfTheta);
    const radius = Math.max(1, Math.min(requestedRadius, maxR));
    const T = radius / Math.tan(halfTheta);

    const t1 = { x: Math.round(corner.x + u1.x * T), y: Math.round(corner.y + u1.y * T) };
    const t2 = { x: Math.round(corner.x + u2.x * T), y: Math.round(corner.y + u2.y * T) };

    const bisector = { x: u1.x + u2.x, y: u1.y + u2.y };
    const bLen = Math.hypot(bisector.x, bisector.y);
    if (bLen < 1e-4) return null;
    const uB = { x: bisector.x / bLen, y: bisector.y / bLen };

    const centerDist = radius / Math.sin(halfTheta);
    const center = { x: Math.round(corner.x + uB.x * centerDist), y: Math.round(corner.y + uB.y * centerDist) };

    const cPtId = this.randomId('pt_fillet_c');
    const t1PtId = this.randomId('pt_fillet_t1');
    const t2PtId = this.randomId('pt_fillet_t2');
    const arcId = this.randomId('arc_fillet');

    const centerPt: SketchPoint2D = { id: cPtId, type: 'POINT', x: center.x, y: center.y };
    const t1Pt: SketchPoint2D = { id: t1PtId, type: 'POINT', x: t1.x, y: t1.y };
    const t2Pt: SketchPoint2D = { id: t2PtId, type: 'POINT', x: t2.x, y: t2.y };

    const arcEntity: SketchArc2D = {
      id: arcId,
      type: 'ARC',
      centerPointId: cPtId,
      startPointId: t1PtId,
      endPointId: t2PtId,
      radius: Math.round(radius),
      isConstruction: false
    };

    return {
      success: true,
      center,
      radius: Math.round(radius),
      t1,
      t2,
      arcEntity,
      points: { centerPt, t1Pt, t2Pt }
    };
  }

  // ============================================================================
  // 14. 2D SKETCH CHAMFER TOOL (CORNER CHAMFER)
  // ============================================================================
  public static createChamfer2D(
    corner: Vector2D,
    line1End: Vector2D,
    line2End: Vector2D,
    distance: number = 10
  ): {
    success: boolean;
    c1: Vector2D;
    c2: Vector2D;
    lineEntity: SketchLine2D;
    points: { c1Pt: SketchPoint2D; c2Pt: SketchPoint2D };
  } | null {
    const d1 = Math.hypot(line1End.x - corner.x, line1End.y - corner.y);
    const d2 = Math.hypot(line2End.x - corner.x, line2End.y - corner.y);
    if (d1 < 1e-4 || d2 < 1e-4) return null;

    const u1 = { x: (line1End.x - corner.x) / d1, y: (line1End.y - corner.y) / d1 };
    const u2 = { x: (line2End.x - corner.x) / d2, y: (line2End.y - corner.y) / d2 };

    const dist = Math.max(1, Math.min(distance, Math.min(d1, d2) * 0.8));
    const c1 = { x: Math.round(corner.x + u1.x * dist), y: Math.round(corner.y + u1.y * dist) };
    const c2 = { x: Math.round(corner.x + u2.x * dist), y: Math.round(corner.y + u2.y * dist) };

    const c1PtId = this.randomId('pt_chamfer_1');
    const c2PtId = this.randomId('pt_chamfer_2');
    const lineId = this.randomId('line_chamfer');

    const c1Pt: SketchPoint2D = { id: c1PtId, type: 'POINT', x: c1.x, y: c1.y };
    const c2Pt: SketchPoint2D = { id: c2PtId, type: 'POINT', x: c2.x, y: c2.y };

    const lineEntity: SketchLine2D = {
      id: lineId,
      type: 'LINE',
      startPointId: c1PtId,
      endPointId: c2PtId,
      isConstruction: false
    };

    return {
      success: true,
      c1,
      c2,
      lineEntity,
      points: { c1Pt, c2Pt }
    };
  }
}
