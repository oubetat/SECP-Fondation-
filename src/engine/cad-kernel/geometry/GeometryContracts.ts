/**
 * SECP CAD Kernel — Geometry Contracts
 */
import { Meters } from '../core/Units';

export interface Point {
  x: Meters;
  y: Meters;
  z: Meters;
}

export interface Vector {
  x: Meters;
  y: Meters;
  z: Meters;
}

export interface Direction extends Vector {}

export interface Axis {
  location: Point;
  direction: Direction;
}

export interface Plane {
  origin: Point;
  normal: Direction;
  xDir: Direction;
}

export interface Transform {
  matrix: number[]; // 4x4 affine transform matrix
}

export interface BoundingBox {
  min: Point;
  max: Point;
}

export interface Curve {
  evaluate(u: number): Point;
  domain(): { uMin: number; uMax: number };
}

export interface Surface {
  type?: 'PLANE' | 'CYLINDER' | 'SPHERE' | 'TORUS' | 'CONE' | 'NURBS' | 'RULED' | 'REVOLVED' | 'EXTRUDED' | 'SWEPT' | 'LOFTED' | 'B_SPLINE' | string;
  evaluate(u: number, v: number): Point;
  domain(): { uMin: number; uMax: number; vMin: number; vMax: number };
  origin?: Point;
  normal?: Direction;
  xDir?: Direction;
  radius?: Meters;
  isPeriodic?: boolean;
}
