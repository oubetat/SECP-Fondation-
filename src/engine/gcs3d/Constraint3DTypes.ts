/**
 * SECP CAD Kernel — GCS 3D Constraint Types
 * Phase 2 (PATCH-026)
 */

import { Point, Direction } from '../cad-kernel/geometry/GeometryContracts';
import { EngineeringIdentity } from '../identity/CanonicalEngineeringIdentity';
import { ProvenanceNode } from '../provenance/ProvenanceGraphTypes';

export type Geometry3DEntityType =
  | 'POINT_3D'
  | 'LINE_3D'
  | 'PLANE'
  | 'AXIS_3D'
  | 'CIRCLE_3D'
  | 'CYLINDER_AXIS'
  | 'SPHERE';

export interface Point3DGeometry extends Point {}

export interface Line3DGeometry {
  readonly origin: Point;
  readonly direction: Direction;
}

export interface PlaneGeometry {
  readonly origin: Point;
  readonly normal: Direction;
  readonly xDir: Direction;
}

export interface Axis3DGeometry {
  readonly origin: Point;
  readonly direction: Direction;
}

export interface Circle3DGeometry {
  readonly center: Point;
  readonly normal: Direction;
  readonly radius: number;
}

export interface CylinderAxisGeometry {
  readonly origin: Point;
  readonly direction: Direction;
  readonly radius: number;
}

export interface SphereGeometry {
  readonly center: Point;
  readonly radius: number;
}

export type Geometry3D =
  | { readonly type: 'POINT_3D'; readonly data: Point3DGeometry }
  | { readonly type: 'LINE_3D'; readonly data: Line3DGeometry }
  | { readonly type: 'PLANE'; readonly data: PlaneGeometry }
  | { readonly type: 'AXIS_3D'; readonly data: Axis3DGeometry }
  | { readonly type: 'CIRCLE_3D'; readonly data: Circle3DGeometry }
  | { readonly type: 'CYLINDER_AXIS'; readonly data: CylinderAxisGeometry }
  | { readonly type: 'SPHERE'; readonly data: SphereGeometry };

export interface Geometry3DEntity {
  readonly id: EngineeringIdentity;
  readonly type: Geometry3DEntityType;
  readonly geometry: Geometry3D;
  readonly provenance: ProvenanceNode;
}

export interface Model3D {
  readonly id: EngineeringIdentity;
  readonly entities: readonly Geometry3DEntity[];
  readonly version: number;
}

export type Constraint3DType =
  | 'COINCIDENT_3D'
  | 'POINT_ON_LINE_3D'
  | 'POINT_ON_PLANE_3D'
  | 'POINT_ON_CIRCLE_3D'
  | 'DISTANCE_3D'
  | 'DISTANCE_X_3D'
  | 'DISTANCE_Y_3D'
  | 'DISTANCE_Z_3D'
  | 'ANGLE_3D'
  | 'PARALLEL_3D'
  | 'PERPENDICULAR_3D'
  | 'COLLINEAR_3D'
  | 'COPLANAR_3D'
  | 'CONCENTRIC_3D'
  | 'COAXIAL_3D'
  | 'TANGENT_3D'
  | 'FIX_3D'
  | 'RADIUS_3D'
  | 'DIAMETER_3D';

export interface Constraint3DParameters {
  readonly value?: number;
  readonly expression?: string;
  readonly unit?: string;
}
