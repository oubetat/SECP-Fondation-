/**
 * SECP CAD Kernel — Production 3D GCS Datum Reference Engine
 * Phase 15 (PATCH-173)
 *
 * Provides persistent Datum Planes, Datum Axes, Datum Points, and Coordinate Systems
 * that act as invariant geometric anchors during parametric regeneration.
 */

import { Point, Direction } from '../cad-kernel/geometry/GeometryContracts';
import { Spatial3DEntity, Production3DConstraint } from './Production3DGCSTypes';

export interface DatumPlaneDefinition {
  readonly id: string;
  readonly name: string;
  readonly origin: Point;
  readonly normal: Direction;
  readonly isPermanent?: boolean;
}

export interface DatumAxisDefinition {
  readonly id: string;
  readonly name: string;
  readonly origin: Point;
  readonly direction: Direction;
  readonly isPermanent?: boolean;
}

export interface DatumPointDefinition {
  readonly id: string;
  readonly name: string;
  readonly position: Point;
  readonly isPermanent?: boolean;
}

export class DatumReferenceEngine {
  public static createStandardDatums(): Spatial3DEntity[] {
    const origin: Point = { x: 0, y: 0, z: 0 };
    const nx: Direction = { x: 1, y: 0, z: 0 };
    const ny: Direction = { x: 0, y: 1, z: 0 };
    const nz: Direction = { x: 0, y: 0, z: 1 };

    return [
      // Standard Origin
      {
        id: 'DATUM-ORIGIN',
        name: 'Origin (0,0,0)',
        type: 'DATUM_POINT',
        isDatum: true,
        isFixed: true,
        geometry: {
          type: 'DATUM_POINT',
          data: { ...origin, isFixed: true }
        }
      },
      // Standard XY Plane (Z normal)
      {
        id: 'DATUM-PLANE-XY',
        name: 'XY Plane (Top)',
        type: 'DATUM_PLANE',
        isDatum: true,
        isFixed: true,
        geometry: {
          type: 'DATUM_PLANE',
          data: { origin, normal: nz }
        }
      },
      // Standard XZ Plane (Y normal)
      {
        id: 'DATUM-PLANE-XZ',
        name: 'XZ Plane (Front)',
        type: 'DATUM_PLANE',
        isDatum: true,
        isFixed: true,
        geometry: {
          type: 'DATUM_PLANE',
          data: { origin, normal: ny }
        }
      },
      // Standard YZ Plane (X normal)
      {
        id: 'DATUM-PLANE-YZ',
        name: 'YZ Plane (Right)',
        type: 'DATUM_PLANE',
        isDatum: true,
        isFixed: true,
        geometry: {
          type: 'DATUM_PLANE',
          data: { origin, normal: nx }
        }
      },
      // Standard Axes
      {
        id: 'DATUM-AXIS-X',
        name: 'X Axis',
        type: 'DATUM_AXIS',
        isDatum: true,
        isFixed: true,
        geometry: {
          type: 'DATUM_AXIS',
          data: { origin, direction: nx }
        }
      },
      {
        id: 'DATUM-AXIS-Y',
        name: 'Y Axis',
        type: 'DATUM_AXIS',
        isDatum: true,
        isFixed: true,
        geometry: {
          type: 'DATUM_AXIS',
          data: { origin, direction: ny }
        }
      },
      {
        id: 'DATUM-AXIS-Z',
        name: 'Z Axis',
        type: 'DATUM_AXIS',
        isDatum: true,
        isFixed: true,
        geometry: {
          type: 'DATUM_AXIS',
          data: { origin, direction: nz }
        }
      }
    ];
  }

  public static createOffsetDatumPlane(
    id: string,
    name: string,
    parentPlaneId: string,
    offsetMm: number,
    baseOrigin: Point,
    baseNormal: Direction
  ): { entity: Spatial3DEntity; constraint: Production3DConstraint } {
    const entity: Spatial3DEntity = {
      id,
      name,
      type: 'DATUM_PLANE',
      isDatum: true,
      isFixed: false,
      geometry: {
        type: 'DATUM_PLANE',
        data: {
          origin: {
            x: baseOrigin.x + baseNormal.x * offsetMm,
            y: baseOrigin.y + baseNormal.y * offsetMm,
            z: baseOrigin.z + baseNormal.z * offsetMm
          },
          normal: { ...baseNormal }
        }
      }
    };

    const constraint: Production3DConstraint = {
      constraintId: `DATUM-OFFSET-${id}`,
      type: 'PLANE_PLANE',
      entities: [{ entityId: parentPlaneId }, { entityId: id }],
      parameters: { offset: offsetMm },
      tolerance: 1e-7,
      priority: 90,
      driving: true
    };

    return { entity, constraint };
  }
}
