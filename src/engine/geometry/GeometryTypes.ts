/**
 * SECP Geometry Types
 * Defines the fundamental geometric types used by the SECP Geometry API.
 */

export enum ShapeType {
  VERTEX = 'VERTEX',
  EDGE = 'EDGE',
  WIRE = 'WIRE',
  FACE = 'FACE',
  SHELL = 'SHELL',
  SOLID = 'SOLID',
  COMPOUND = 'COMPOUND'
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Plane {
  origin: Vector3;
  normal: Vector3;
}

export interface BoundingBox {
  min: Vector3;
  max: Vector3;
}

export interface GeometricProperties {
  volume?: number;
  surfaceArea?: number;
  centerOfMass?: Vector3;
  inertiaTensor?: number[][];
  faceCount?: number;
  edgeCount?: number;
  isValid?: boolean;
}
