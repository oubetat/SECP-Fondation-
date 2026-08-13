/**
 * SECP Geometry Kernel Interface
 * Defines the standard operations required from any CAD kernel adapter.
 */

import { Vector3, Plane } from './GeometryTypes';
import { ShapeHandle } from './ShapeHandle';

export interface GeometryKernel {
  // Primitives
  createBox(dx: number, dy: number, dz: number, center?: Vector3): Promise<ShapeHandle>;
  createCylinder(radius: number, height: number, plane?: Plane): Promise<ShapeHandle>;
  createSphere(radius: number, center?: Vector3): Promise<ShapeHandle>;

  // Boolean Operations
  fuse(target: ShapeHandle, tool: ShapeHandle): Promise<ShapeHandle>;
  cut(target: ShapeHandle, tool: ShapeHandle): Promise<ShapeHandle>;
  common(target: ShapeHandle, tool: ShapeHandle): Promise<ShapeHandle>;

  // Formalized Software Contract aliases/methods
  booleanUnion(target: ShapeHandle, tool: ShapeHandle): Promise<ShapeHandle>;
  booleanCut(target: ShapeHandle, tool: ShapeHandle): Promise<ShapeHandle>;
  booleanIntersect(target: ShapeHandle, tool: ShapeHandle): Promise<ShapeHandle>;

  // Local Operations
  fillet(shape: ShapeHandle, radius: number, edgeIndices?: number[]): Promise<ShapeHandle>;
  chamfer(shape: ShapeHandle, distance: number, edgeIndices?: number[]): Promise<ShapeHandle>;
  revolve(shape: ShapeHandle, axisPoint: Vector3, axisDir: Vector3, angle: number): Promise<ShapeHandle>;
  sweep(profile: ShapeHandle, path: ShapeHandle): Promise<ShapeHandle>;

  // Transformations
  translate(shape: ShapeHandle, vector: Vector3): Promise<ShapeHandle>;
  rotate(shape: ShapeHandle, axis: Vector3, angle: number): Promise<ShapeHandle>;
  transform(shape: ShapeHandle, translation: Vector3, rotation?: Vector3): Promise<ShapeHandle>;

  // High-fidelity inspections
  tessellate(shape: ShapeHandle, linearDeflection: number, angularDeflection: number): Promise<any>;
  validate(shape: ShapeHandle): Promise<boolean>;

  // IO (Standard capitalization matches contract specifications)
  exportStep(shape: ShapeHandle): Promise<string>;
  importStep(stepContent: string): Promise<ShapeHandle>;
  exportSTEP(shape: ShapeHandle): Promise<string>;
  importSTEP(stepContent: string): Promise<ShapeHandle>;
  
  // Healing
  heal(shape: ShapeHandle): Promise<ShapeHandle>;
}
