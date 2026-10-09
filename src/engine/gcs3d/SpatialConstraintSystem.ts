/**
 * SECP CAD Kernel — Production 3D GCS Spatial Constraint System
 * Phase 15 (PATCH-173)
 *
 * Manages state vectors, parameter maps, entity reconstructions, and datum coordinates.
 */

import { Point, Direction, Vector } from '../cad-kernel/geometry/GeometryContracts';
import {
  Spatial3DEntity,
  SpatialPoint3D,
  SpatialLine3D,
  SpatialCircle3D,
  SpatialArc3D,
  SpatialPlane3D,
  SpatialCylinder3D,
  SpatialSphere3D,
  SpatialAxis3D,
  SpatialCoordinateSystem3D,
  SpatialRigidBody3D,
  SpatialAssemblyComponent3D
} from './Production3DGCSTypes';

export class SpatialConstraintSystem {
  private readonly params: number[] = [];
  private readonly paramMap: Map<string, number> = new Map(); // "entityId:paramName" -> param index
  private readonly entityParamRanges: Map<string, { start: number; count: number }> = new Map();
  private entities: Record<string, Spatial3DEntity> = {};

  constructor(entities: Record<string, Spatial3DEntity>) {
    this.entities = { ...entities };
    this.initialize();
  }

  private initialize(): void {
    const sortedIds = Object.keys(this.entities).sort();
    for (const id of sortedIds) {
      const ent = this.entities[id];
      const startIndex = this.params.length;
      this.addEntityParams(ent);
      const count = this.params.length - startIndex;
      this.entityParamRanges.set(id, { start: startIndex, count });
    }
  }

  private addEntityParams(ent: Spatial3DEntity): void {
    const id = ent.id;
    const geom = ent.geometry;

    switch (geom.type) {
      case 'POINT_3D':
      case 'DATUM_POINT':
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

      case 'CIRCLE_3D':
        this.addParam(id, 'cx', geom.data.center.x);
        this.addParam(id, 'cy', geom.data.center.y);
        this.addParam(id, 'cz', geom.data.center.z);
        this.addParam(id, 'nx', geom.data.normal.x);
        this.addParam(id, 'ny', geom.data.normal.y);
        this.addParam(id, 'nz', geom.data.normal.z);
        this.addParam(id, 'r', geom.data.radius);
        break;

      case 'ARC_3D':
        this.addParam(id, 'cx', geom.data.center.x);
        this.addParam(id, 'cy', geom.data.center.y);
        this.addParam(id, 'cz', geom.data.center.z);
        this.addParam(id, 'nx', geom.data.normal.x);
        this.addParam(id, 'ny', geom.data.normal.y);
        this.addParam(id, 'nz', geom.data.normal.z);
        this.addParam(id, 'r', geom.data.radius);
        this.addParam(id, 'sweep', geom.data.sweepAngleRad);
        break;

      case 'PLANE':
      case 'DATUM_PLANE':
        this.addParam(id, 'ox', geom.data.origin.x);
        this.addParam(id, 'oy', geom.data.origin.y);
        this.addParam(id, 'oz', geom.data.origin.z);
        this.addParam(id, 'nx', geom.data.normal.x);
        this.addParam(id, 'ny', geom.data.normal.y);
        this.addParam(id, 'nz', geom.data.normal.z);
        break;

      case 'CYLINDER':
        this.addParam(id, 'ox', geom.data.origin.x);
        this.addParam(id, 'oy', geom.data.origin.y);
        this.addParam(id, 'oz', geom.data.origin.z);
        this.addParam(id, 'dx', geom.data.axisDirection.x);
        this.addParam(id, 'dy', geom.data.axisDirection.y);
        this.addParam(id, 'dz', geom.data.axisDirection.z);
        this.addParam(id, 'r', geom.data.radius);
        break;

      case 'SPHERE':
        this.addParam(id, 'cx', geom.data.center.x);
        this.addParam(id, 'cy', geom.data.center.y);
        this.addParam(id, 'cz', geom.data.center.z);
        this.addParam(id, 'r', geom.data.radius);
        break;

      case 'AXIS_3D':
      case 'DATUM_AXIS':
        this.addParam(id, 'ox', geom.data.origin.x);
        this.addParam(id, 'oy', geom.data.origin.y);
        this.addParam(id, 'oz', geom.data.origin.z);
        this.addParam(id, 'dx', geom.data.direction.x);
        this.addParam(id, 'dy', geom.data.direction.y);
        this.addParam(id, 'dz', geom.data.direction.z);
        break;

      case 'COORDINATE_SYSTEM':
        this.addParam(id, 'ox', geom.data.origin.x);
        this.addParam(id, 'oy', geom.data.origin.y);
        this.addParam(id, 'oz', geom.data.origin.z);
        this.addParam(id, 'rx', 0);
        this.addParam(id, 'ry', 0);
        this.addParam(id, 'rz', 0);
        break;

      case 'RIGID_BODY':
        this.addParam(id, 'x', geom.data.position.x);
        this.addParam(id, 'y', geom.data.position.y);
        this.addParam(id, 'z', geom.data.position.z);
        this.addParam(id, 'rx', geom.data.orientation[1]);
        this.addParam(id, 'ry', geom.data.orientation[2]);
        this.addParam(id, 'rz', geom.data.orientation[3]);
        break;

      case 'ASSEMBLY_COMPONENT':
        this.addParam(id, 'x', geom.data.position.x);
        this.addParam(id, 'y', geom.data.position.y);
        this.addParam(id, 'z', geom.data.position.z);
        this.addParam(id, 'rx', geom.data.rotationEulerRad.x);
        this.addParam(id, 'ry', geom.data.rotationEulerRad.y);
        this.addParam(id, 'rz', geom.data.rotationEulerRad.z);
        break;
    }
  }

  private addParam(entityId: string, paramName: string, value: number): void {
    const key = `${entityId}:${paramName}`;
    this.paramMap.set(key, this.params.length);
    this.params.push(value);
  }

  public getDimension(): number {
    return this.params.length;
  }

  public getVector(): number[] {
    return [...this.params];
  }

  public updateFromVector(vector: readonly number[]): void {
    for (let i = 0; i < Math.min(this.params.length, vector.length); i++) {
      this.params[i] = vector[i];
    }
  }

  public getParamValue(entityId: string, paramName: string): number {
    const key = `${entityId}:${paramName}`;
    const idx = this.paramMap.get(key);
    if (idx === undefined) {
      throw new Error(`Parameter '${key}' not found in spatial constraint system`);
    }
    return this.params[idx];
  }

  public setParamValue(entityId: string, paramName: string, value: number): void {
    const key = `${entityId}:${paramName}`;
    const idx = this.paramMap.get(key);
    if (idx !== undefined) {
      this.params[idx] = value;
    }
  }

  public hasParam(entityId: string, paramName: string): boolean {
    return this.paramMap.has(`${entityId}:${paramName}`);
  }

  public getPoint(entityId: string): Point {
    if (this.hasParam(entityId, 'x')) {
      return {
        x: this.getParamValue(entityId, 'x'),
        y: this.getParamValue(entityId, 'y'),
        z: this.getParamValue(entityId, 'z')
      };
    }
    if (this.hasParam(entityId, 'ox')) {
      return {
        x: this.getParamValue(entityId, 'ox'),
        y: this.getParamValue(entityId, 'oy'),
        z: this.getParamValue(entityId, 'oz')
      };
    }
    if (this.hasParam(entityId, 'cx')) {
      return {
        x: this.getParamValue(entityId, 'cx'),
        y: this.getParamValue(entityId, 'cy'),
        z: this.getParamValue(entityId, 'cz')
      };
    }
    return { x: 0, y: 0, z: 0 };
  }

  public getDirection(entityId: string): Vector {
    if (this.hasParam(entityId, 'dx')) {
      return {
        x: this.getParamValue(entityId, 'dx'),
        y: this.getParamValue(entityId, 'dy'),
        z: this.getParamValue(entityId, 'dz')
      };
    }
    if (this.hasParam(entityId, 'nx')) {
      return {
        x: this.getParamValue(entityId, 'nx'),
        y: this.getParamValue(entityId, 'ny'),
        z: this.getParamValue(entityId, 'nz')
      };
    }
    return { x: 0, y: 0, z: 1 };
  }

  public getRadius(entityId: string): number {
    if (this.hasParam(entityId, 'r')) {
      return this.getParamValue(entityId, 'r');
    }
    return 1.0;
  }

  public reconstructEntities(): Record<string, Spatial3DEntity> {
    const updated: Record<string, Spatial3DEntity> = {};

    for (const [id, ent] of Object.entries(this.entities)) {
      const geom = ent.geometry;
      let newGeom = { ...geom };

      switch (geom.type) {
        case 'POINT_3D':
        case 'DATUM_POINT':
          newGeom = {
            type: geom.type,
            data: {
              x: this.getParamValue(id, 'x'),
              y: this.getParamValue(id, 'y'),
              z: this.getParamValue(id, 'z'),
              isFixed: ent.isFixed
            }
          };
          break;

        case 'LINE_3D':
          newGeom = {
            type: 'LINE_3D',
            data: {
              origin: {
                x: this.getParamValue(id, 'ox'),
                y: this.getParamValue(id, 'oy'),
                z: this.getParamValue(id, 'oz')
              },
              direction: {
                x: this.getParamValue(id, 'dx'),
                y: this.getParamValue(id, 'dy'),
                z: this.getParamValue(id, 'dz')
              },
              length: geom.data.length
            }
          };
          break;

        case 'CIRCLE_3D':
          newGeom = {
            type: 'CIRCLE_3D',
            data: {
              center: {
                x: this.getParamValue(id, 'cx'),
                y: this.getParamValue(id, 'cy'),
                z: this.getParamValue(id, 'cz')
              },
              normal: {
                x: this.getParamValue(id, 'nx'),
                y: this.getParamValue(id, 'ny'),
                z: this.getParamValue(id, 'nz')
              },
              radius: this.getParamValue(id, 'r')
            }
          };
          break;

        case 'ARC_3D':
          newGeom = {
            type: 'ARC_3D',
            data: {
              center: {
                x: this.getParamValue(id, 'cx'),
                y: this.getParamValue(id, 'cy'),
                z: this.getParamValue(id, 'cz')
              },
              normal: {
                x: this.getParamValue(id, 'nx'),
                y: this.getParamValue(id, 'ny'),
                z: this.getParamValue(id, 'nz')
              },
              radius: this.getParamValue(id, 'r'),
              startAngleRad: geom.data.startAngleRad,
              sweepAngleRad: this.getParamValue(id, 'sweep')
            }
          };
          break;

        case 'PLANE':
        case 'DATUM_PLANE':
          newGeom = {
            type: geom.type,
            data: {
              origin: {
                x: this.getParamValue(id, 'ox'),
                y: this.getParamValue(id, 'oy'),
                z: this.getParamValue(id, 'oz')
              },
              normal: {
                x: this.getParamValue(id, 'nx'),
                y: this.getParamValue(id, 'ny'),
                z: this.getParamValue(id, 'nz')
              }
            }
          };
          break;

        case 'CYLINDER':
          newGeom = {
            type: 'CYLINDER',
            data: {
              origin: {
                x: this.getParamValue(id, 'ox'),
                y: this.getParamValue(id, 'oy'),
                z: this.getParamValue(id, 'oz')
              },
              axisDirection: {
                x: this.getParamValue(id, 'dx'),
                y: this.getParamValue(id, 'dy'),
                z: this.getParamValue(id, 'dz')
              },
              radius: this.getParamValue(id, 'r')
            }
          };
          break;

        case 'SPHERE':
          newGeom = {
            type: 'SPHERE',
            data: {
              center: {
                x: this.getParamValue(id, 'cx'),
                y: this.getParamValue(id, 'cy'),
                z: this.getParamValue(id, 'cz')
              },
              radius: this.getParamValue(id, 'r')
            }
          };
          break;

        case 'AXIS_3D':
        case 'DATUM_AXIS':
          newGeom = {
            type: geom.type,
            data: {
              origin: {
                x: this.getParamValue(id, 'ox'),
                y: this.getParamValue(id, 'oy'),
                z: this.getParamValue(id, 'oz')
              },
              direction: {
                x: this.getParamValue(id, 'dx'),
                y: this.getParamValue(id, 'dy'),
                z: this.getParamValue(id, 'dz')
              }
            }
          };
          break;

        case 'ASSEMBLY_COMPONENT':
          newGeom = {
            type: 'ASSEMBLY_COMPONENT',
            data: {
              componentId: geom.data.componentId,
              instanceId: geom.data.instanceId,
              position: {
                x: this.getParamValue(id, 'x'),
                y: this.getParamValue(id, 'y'),
                z: this.getParamValue(id, 'z')
              },
              rotationEulerRad: {
                x: this.getParamValue(id, 'rx'),
                y: this.getParamValue(id, 'ry'),
                z: this.getParamValue(id, 'rz')
              },
              isGrounded: geom.data.isGrounded
            }
          };
          break;
      }

      updated[id] = {
        ...ent,
        geometry: newGeom as any
      };
    }

    return updated;
  }
}
