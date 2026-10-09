/**
 * SECP PATCH-034 — 034-A & 034-C: Sketch Entity & Geometry Registry
 * Manages 2D and 3D sketch entities, construction geometry, parameters, and sketch operations.
 */

export type SketchEntityType2D =
  | 'LINE'
  | 'CIRCLE'
  | 'RECTANGLE'
  | 'ARC'
  | 'SPLINE'
  | 'ELLIPSE'
  | 'PARTIAL_ELLIPSE'
  | 'PARABOLA'
  | 'CONIC'
  | 'POLYGON'
  | 'SLOT'
  | 'CENTERLINE'
  | 'POINT'
  | 'EQUATION_CURVE'
  | 'CONVERTED_ENTITY';

export type SketchEntityType3D =
  | '3D_LINE'
  | '3D_ARC'
  | '3D_SPLINE'
  | '3D_POINT'
  | 'PLANE_REFERENCE'
  | 'AXIS_REFERENCE'
  | 'COORDINATE_REFERENCE'
  | 'SURFACE_REFERENCE'
  | 'EDGE_REFERENCE'
  | 'INTERSECTION_CURVE'
  | 'SILHOUETTE_ENTITIES';

export type SketchEntityType = SketchEntityType2D | SketchEntityType3D;

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface SketchEntity034 {
  id: string;
  type: SketchEntityType;
  points: Point3D[];
  params: Record<string, any>;
  constraints: string[];
  isConstruction: boolean;
  is3D: boolean;
  layer?: string;
  fixed?: boolean;
  referenceId?: string;
  equationString?: string;
}

export class SketchEntityRegistry {
  private entities: SketchEntity034[] = [];

  public getEntities(): SketchEntity034[] {
    return this.entities;
  }

  public setEntities(entities: SketchEntity034[]): void {
    this.entities = entities;
  }

  public addEntity(entityData: Omit<SketchEntity034, 'id'>): SketchEntity034 {
    // Deterministic ID based on type and current entity count to ensure reproducibility
    const newId = `ENT-${entityData.type}-${this.entities.length + 1}`;
    const newEntity: SketchEntity034 = {
      ...entityData,
      id: newId
    };
    this.entities.push(newEntity);
    return newEntity;
  }

  public updateEntity(id: string, updates: Partial<SketchEntity034>): void {
    const idx = this.entities.findIndex(e => e.id === id);
    if (idx !== -1) {
      this.entities[idx] = { ...this.entities[idx], ...updates };
    }
  }

  public deleteEntity(id: string): void {
    this.entities = this.entities.filter(e => e.id !== id);
  }

  public clear(): void {
    this.entities = [];
  }

  // 034-A Sketch Transformations
  public moveEntity(id: string, dx: number, dy: number, dz: number = 0): void {
    const ent = this.entities.find(e => e.id === id);
    if (!ent) return;
    ent.points = ent.points.map(p => ({
      x: p.x + dx,
      y: p.y + dy,
      z: p.z + dz
    }));
  }

  public rotateEntity(id: string, center: Point3D, angleRad: number): void {
    const ent = this.entities.find(e => e.id === id);
    if (!ent) return;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    ent.points = ent.points.map(p => {
      const rx = p.x - center.x;
      const ry = p.y - center.y;
      return {
        x: Math.round(center.x + rx * cos - ry * sin),
        y: Math.round(center.y + rx * sin + ry * cos),
        z: p.z
      };
    });
  }

  public scaleEntity(id: string, center: Point3D, factor: number): void {
    const ent = this.entities.find(e => e.id === id);
    if (!ent) return;
    ent.points = ent.points.map(p => ({
      x: Math.round(center.x + (p.x - center.x) * factor),
      y: Math.round(center.y + (p.y - center.y) * factor),
      z: Math.round(center.z + (p.z - center.z) * factor)
    }));
  }

  public convertEntities(sourceId: string): SketchEntity034 | null {
    const source = this.entities.find(e => e.id === sourceId);
    if (!source) return null;
    return this.addEntity({
      type: 'CONVERTED_ENTITY',
      points: JSON.parse(JSON.stringify(source.points)),
      params: { ...source.params, sourceId },
      constraints: ['FIX'],
      isConstruction: false,
      is3D: source.is3D
    });
  }

  public createIntersectionCurve(surface1Ref: string, surface2Ref: string): SketchEntity034 {
    return this.addEntity({
      type: 'INTERSECTION_CURVE',
      points: [
        { x: 300, y: 250, z: 20 },
        { x: 450, y: 300, z: 50 },
        { x: 500, y: 350, z: 80 }
      ],
      params: { surface1Ref, surface2Ref },
      constraints: ['TANGENT'],
      isConstruction: false,
      is3D: true
    });
  }

  public createSilhouetteEntities(faceRef: string): SketchEntity034 {
    return this.addEntity({
      type: 'SILHOUETTE_ENTITIES',
      points: [
        { x: 250, y: 200, z: 0 },
        { x: 550, y: 400, z: 0 }
      ],
      params: { faceRef, projectionAngle: 0 },
      constraints: ['CONVERTED'],
      isConstruction: false,
      is3D: false
    });
  }
}
