/**
 * SECP CAD Kernel — GCS 3D Constraint System
 * Phase 2 (PATCH-026)
 */

import { Model3D, Geometry3DEntity } from './Constraint3DTypes';

export class Constraint3DSystem {
  private readonly params: number[] = [];
  private readonly paramMap: Map<string, number> = new Map(); // "entityId:paramName" -> index

  constructor(model: Model3D) {
    this.initialize(model);
  }

  private initialize(model: Model3D): void {
    for (const entity of model.entities) {
      this.addEntityParams(entity);
    }
  }

  private addEntityParams(entity: Geometry3DEntity): void {
    const id = entity.id.identityId;
    const geom = entity.geometry;

    switch (geom.type) {
      case 'POINT_3D':
        this.addParam(id, 'x', geom.data.x);
        this.addParam(id, 'y', geom.data.y);
        this.addParam(id, 'z', geom.data.z);
        break;
      case 'LINE_3D':
        this.addParam(id, 'ox', geom.data.origin.x);
        this.addParam(id, 'oy', geom.data.origin.y);
        this.addParam(id, 'oz', geom.data.origin.z);
        this.addParam(id, 'dx', geom.data.direction.x);
        this.addParam(id, 'dy', geom.data.direction.y);
        this.addParam(id, 'dz', geom.data.direction.z);
        break;
      case 'PLANE':
        this.addParam(id, 'ox', geom.data.origin.x);
        this.addParam(id, 'oy', geom.data.origin.y);
        this.addParam(id, 'oz', geom.data.origin.z);
        this.addParam(id, 'nx', geom.data.normal.x);
        this.addParam(id, 'ny', geom.data.normal.y);
        this.addParam(id, 'nz', geom.data.normal.z);
        break;
      case 'AXIS_3D':
        this.addParam(id, 'ox', geom.data.origin.x);
        this.addParam(id, 'oy', geom.data.origin.y);
        this.addParam(id, 'oz', geom.data.origin.z);
        this.addParam(id, 'dx', geom.data.direction.x);
        this.addParam(id, 'dy', geom.data.direction.y);
        this.addParam(id, 'dz', geom.data.direction.z);
        break;
      case 'CIRCLE_3D':
        this.addParam(id, 'cx', geom.data.center.x);
        this.addParam(id, 'cy', geom.data.center.y);
        this.addParam(id, 'cz', geom.data.center.z);
        this.addParam(id, 'nx', geom.data.normal.x);
        this.addParam(id, 'ny', geom.data.normal.y);
        this.addParam(id, 'nz', geom.data.normal.z);
        this.addParam(id, 'r', geom.data.radius);
        break;
      case 'CYLINDER_AXIS':
        this.addParam(id, 'ox', geom.data.origin.x);
        this.addParam(id, 'oy', geom.data.origin.y);
        this.addParam(id, 'oz', geom.data.origin.z);
        this.addParam(id, 'dx', geom.data.direction.x);
        this.addParam(id, 'dy', geom.data.direction.y);
        this.addParam(id, 'dz', geom.data.direction.z);
        this.addParam(id, 'r', geom.data.radius);
        break;
      case 'SPHERE':
        this.addParam(id, 'cx', geom.data.center.x);
        this.addParam(id, 'cy', geom.data.center.y);
        this.addParam(id, 'cz', geom.data.center.z);
        this.addParam(id, 'r', geom.data.radius);
        break;
    }
  }

  private addParam(entityId: string, paramName: string, value: number): void {
    const key = `${entityId}:${paramName}`;
    this.paramMap.set(key, this.params.length);
    this.params.push(value);
  }

  public getParamIndex(entityId: string, paramName: string): number {
    const key = `${entityId}:${paramName}`;
    const idx = this.paramMap.get(key);
    if (idx === undefined) {
      throw new Error(`Parameter not found: ${key}`);
    }
    return idx;
  }

  public hasParam(entityId: string, paramName: string): boolean {
    const key = `${entityId}:${paramName}`;
    return this.paramMap.has(key);
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

  /**
   * Reconstructs and returns a deep copy of the model with updated geometry parameter values.
   */
  public reconstructModel(originalModel: Model3D): Model3D {
    const updatedEntities = originalModel.entities.map(entity => {
      const id = entity.id.identityId;
      let updatedGeom = { ...entity.geometry };

      switch (entity.geometry.type) {
        case 'POINT_3D':
          updatedGeom = {
            type: 'POINT_3D',
            data: {
              x: this.getParamValue(id, 'x'),
              y: this.getParamValue(id, 'y'),
              z: this.getParamValue(id, 'z'),
            },
          };
          break;
        case 'LINE_3D':
          updatedGeom = {
            type: 'LINE_3D',
            data: {
              origin: {
                x: this.getParamValue(id, 'ox'),
                y: this.getParamValue(id, 'oy'),
                z: this.getParamValue(id, 'oz'),
              },
              direction: {
                x: this.getParamValue(id, 'dx'),
                y: this.getParamValue(id, 'dy'),
                z: this.getParamValue(id, 'dz'),
              },
            },
          };
          break;
        case 'PLANE':
          updatedGeom = {
            type: 'PLANE',
            data: {
              origin: {
                x: this.getParamValue(id, 'ox'),
                y: this.getParamValue(id, 'oy'),
                z: this.getParamValue(id, 'oz'),
              },
              normal: {
                x: this.getParamValue(id, 'nx'),
                y: this.getParamValue(id, 'ny'),
                z: this.getParamValue(id, 'nz'),
              },
              xDir: { ...(entity.geometry as any).data.xDir }
            },
          } as any;
          break;
        case 'AXIS_3D':
          updatedGeom = {
            type: 'AXIS_3D',
            data: {
              origin: {
                x: this.getParamValue(id, 'ox'),
                y: this.getParamValue(id, 'oy'),
                z: this.getParamValue(id, 'oz'),
              },
              direction: {
                x: this.getParamValue(id, 'dx'),
                y: this.getParamValue(id, 'dy'),
                z: this.getParamValue(id, 'dz'),
              },
            },
          };
          break;
        case 'CIRCLE_3D':
          updatedGeom = {
            type: 'CIRCLE_3D',
            data: {
              center: {
                x: this.getParamValue(id, 'cx'),
                y: this.getParamValue(id, 'cy'),
                z: this.getParamValue(id, 'cz'),
              },
              normal: {
                x: this.getParamValue(id, 'nx'),
                y: this.getParamValue(id, 'ny'),
                z: this.getParamValue(id, 'nz'),
              },
              radius: this.getParamValue(id, 'r'),
            },
          };
          break;
        case 'CYLINDER_AXIS':
          updatedGeom = {
            type: 'CYLINDER_AXIS',
            data: {
              origin: {
                x: this.getParamValue(id, 'ox'),
                y: this.getParamValue(id, 'oy'),
                z: this.getParamValue(id, 'oz'),
              },
              direction: {
                x: this.getParamValue(id, 'dx'),
                y: this.getParamValue(id, 'dy'),
                z: this.getParamValue(id, 'dz'),
              },
              radius: this.getParamValue(id, 'r'),
            },
          };
          break;
        case 'SPHERE':
          updatedGeom = {
            type: 'SPHERE',
            data: {
              center: {
                x: this.getParamValue(id, 'cx'),
                y: this.getParamValue(id, 'cy'),
                z: this.getParamValue(id, 'cz'),
              },
              radius: this.getParamValue(id, 'r'),
            },
          };
          break;
      }

      return {
        ...entity,
        geometry: updatedGeom,
      };
    });

    return {
      ...originalModel,
      entities: updatedEntities,
      version: originalModel.version + 1,
    };
  }
}
