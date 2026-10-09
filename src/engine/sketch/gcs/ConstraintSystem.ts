/**
 * SECP CAD Kernel — GCS Constraint System
 * Phase 2 (PATCH-025)
 */

import { SketchModel } from '../SketchModel';
import { SketchEntity } from '../SketchEntity';

/**
 * Maps geometric parameters to indices in a flat numerical vector.
 */
export class ConstraintSystem {
  private readonly params: number[] = [];
  private readonly paramMap: Map<string, number> = new Map(); // "entityId:paramName" -> index

  constructor(model: SketchModel) {
    this.initialize(model);
  }

  private initialize(model: SketchModel): void {
    for (const entity of model.entities) {
      this.addEntityParams(entity);
    }
  }

  private addEntityParams(entity: SketchEntity): void {
    const id = entity.id.projectId;
    const geom = entity.geometry;

    switch (geom.type) {
      case 'POINT':
        this.addParam(id, 'x', geom.x);
        this.addParam(id, 'y', geom.y);
        break;
      case 'LINE':
        this.addParam(id, 'x1', geom.start.x);
        this.addParam(id, 'y1', geom.start.y);
        this.addParam(id, 'x2', geom.end.x);
        this.addParam(id, 'y2', geom.end.y);
        break;
      case 'CIRCLE':
        this.addParam(id, 'cx', geom.center.x);
        this.addParam(id, 'cy', geom.center.y);
        this.addParam(id, 'r', geom.radius);
        break;
      case 'ARC':
        this.addParam(id, 'cx', geom.center.x);
        this.addParam(id, 'cy', geom.center.y);
        this.addParam(id, 'r', geom.radius);
        this.addParam(id, 'startAngle', geom.startAngle);
        this.addParam(id, 'endAngle', geom.endAngle);
        break;
      // ... others
    }
  }

  private addParam(entityId: string, paramName: string, value: number): void {
    const key = `${entityId}:${paramName}`;
    this.paramMap.set(key, this.params.length);
    this.params.push(value);
  }

  public hasParam(entityId: string, paramName: string): boolean {
    return this.paramMap.has(`${entityId}:${paramName}`);
  }

  public getParamIndex(entityId: string, paramName: string): number {
    const key = `${entityId}:${paramName}`;
    const idx = this.paramMap.get(key);
    if (idx === undefined) throw new Error(`Parameter not found: ${key}`);
    return idx;
  }

  public getVector(): number[] {
    return [...this.params];
  }

  public updateFromVector(vector: number[]): void {
    for (let i = 0; i < vector.length; i++) {
      this.params[i] = vector[i];
    }
  }

  public getParamValue(entityId: string, paramName: string): number {
    return this.params[this.getParamIndex(entityId, paramName)];
  }

  public getDimension(): number {
    return this.params.length;
  }
}
