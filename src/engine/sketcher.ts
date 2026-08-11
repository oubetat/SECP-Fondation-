/**
 * PATCH-SECP-006 — 2D Sketcher & Extruder Engine
 * 2D Geometry Primitives + 2D Geometric & Dimensional Constraints + Profile Extrusion.
 */

import { CadGeometryKernel, CadSolidEntity } from './cadKernel';

export type SketchEntityKind = 'POINT' | 'LINE' | 'ARC' | 'CIRCLE' | 'RECTANGLE' | 'POLYLINE';
export type SketchConstraintKind =
  | 'HORIZONTAL'
  | 'VERTICAL'
  | 'PARALLEL'
  | 'PERPENDICULAR'
  | 'COINCIDENT'
  | 'TANGENT'
  | 'EQUAL'
  | 'DISTANCE'
  | 'ANGLE'
  | 'RADIUS'
  | 'DIAMETER';

export interface SketchPoint2D {
  id: string;
  x: number;
  y: number;
  fixed?: boolean;
}

export interface SketchEntity2D {
  id: string;
  kind: SketchEntityKind;
  name: string;
  points: SketchPoint2D[];
  radiusMm?: number;
  widthMm?: number;
  heightMm?: number;
}

export interface SketchConstraint2D {
  id: string;
  kind: SketchConstraintKind;
  targetEntityIds: string[];
  targetPointIds?: string[];
  value?: number; // e.g. distance in mm, angle in degrees
  unit?: string;
  satisfied: boolean;
}

export interface Sketch2D {
  id: string;
  name: string;
  entities: SketchEntity2D[];
  constraints: SketchConstraint2D[];
  isClosedProfile: boolean;
  totalProfileAreaMm2: number;
}

export class SketcherEngine {
  public static createDefaultSketch(): Sketch2D {
    const p1: SketchPoint2D = { id: 'pt-1', x: 0, y: 0, fixed: true };
    const p2: SketchPoint2D = { id: 'pt-2', x: 200, y: 0 };
    const p3: SketchPoint2D = { id: 'pt-3', x: 200, y: 120 };
    const p4: SketchPoint2D = { id: 'pt-4', x: 0, y: 120 };

    const rectangle: SketchEntity2D = {
      id: 'ent-rect-1',
      kind: 'RECTANGLE',
      name: 'Outer_Contour_Rectangle',
      points: [p1, p2, p3, p4],
      widthMm: 200,
      heightMm: 120,
    };

    const holeCircle: SketchEntity2D = {
      id: 'ent-circle-1',
      kind: 'CIRCLE',
      name: 'Inner_Bore_Circle',
      points: [{ id: 'pt-c1', x: 100, y: 60 }],
      radiusMm: 30,
    };

    const constraints: SketchConstraint2D[] = [
      {
        id: 'sk-c1',
        kind: 'HORIZONTAL',
        targetEntityIds: ['ent-rect-1'],
        targetPointIds: ['pt-1', 'pt-2'],
        satisfied: true,
      },
      {
        id: 'sk-c2',
        kind: 'VERTICAL',
        targetEntityIds: ['ent-rect-1'],
        targetPointIds: ['pt-2', 'pt-3'],
        satisfied: true,
      },
      {
        id: 'sk-c3',
        kind: 'DISTANCE',
        targetEntityIds: ['ent-rect-1'],
        value: 200,
        unit: 'mm',
        satisfied: true,
      },
      {
        id: 'sk-c4',
        kind: 'RADIUS',
        targetEntityIds: ['ent-circle-1'],
        value: 30,
        unit: 'mm',
        satisfied: true,
      },
    ];

    return {
      id: 'sk-001',
      name: 'Main_Base_Sketch001',
      entities: [rectangle, holeCircle],
      constraints,
      isClosedProfile: true,
      totalProfileAreaMm2: 200 * 120 - Math.PI * 30 * 30,
    };
  }

  /**
   * Convert 2D Sketch Profile -> 3D Solid via Extrusion (Pad)
   */
  public static extrude2DSketch(sketch: Sketch2D, depthMm: number): CadSolidEntity {
    return this.extrudeSketchToSolid(sketch, depthMm);
  }

  public static extrudeSketchToSolid(sketch: Sketch2D, depthMm: number): CadSolidEntity {
    const rect = sketch.entities.find(e => e.kind === 'RECTANGLE');
    const width = rect?.widthMm || 200;
    const height = rect?.heightMm || 120;

    let baseSolid = CadGeometryKernel.createBox(width, height, depthMm, `Pad_Extrude_${sketch.name}`);

    // If there is an inner bore circle, cut it
    const circle = sketch.entities.find(e => e.kind === 'CIRCLE');
    if (circle && circle.radiusMm) {
      const tool = CadGeometryKernel.createCylinder(circle.radiusMm, depthMm * 1.5, 'Sketch_Circle_Tool');
      baseSolid = CadGeometryKernel.applyBooleanOperation(baseSolid, tool, 'CUT');
    }

    return baseSolid;
  }
}
