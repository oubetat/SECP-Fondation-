/**
 * SECP Geometry Kernel Interface
 * Defines the standard operations required from any CAD kernel adapter.
 */

import { Vector3, Plane, IdentityContext, KernelManifest, TopologyReference } from './GeometryTypes';
import { ShapeHandle } from './ShapeHandle';
import { SketchDefinition } from './SketchTypes';

export interface GeometryKernel {
  // Primitives
  createBox(dx: number, dy: number, dz: number, center?: Vector3, context?: IdentityContext): Promise<ShapeHandle>;
  createCylinder(radius: number, height: number, plane?: Plane, context?: IdentityContext): Promise<ShapeHandle>;
  createSphere(radius: number, center?: Vector3, context?: IdentityContext): Promise<ShapeHandle>;
  createRectangularFace(w: number, h: number, context?: IdentityContext): Promise<ShapeHandle>;

  // Low-level Primitives & Profiles
  createPoint(x: number, y: number, z: number): Promise<Vector3>;
  createLine(p1: Vector3, p2: Vector3, context?: IdentityContext): Promise<ShapeHandle>;
  createCircle(center: Vector3, radius: number, normal?: Vector3, context?: IdentityContext): Promise<ShapeHandle>;
  createArc(p1: Vector3, p2: Vector3, p3: Vector3, context?: IdentityContext): Promise<ShapeHandle>;
  createWire(edges: ShapeHandle[], context?: IdentityContext): Promise<ShapeHandle>;
  makeFaceFromWire(wire: ShapeHandle, context?: IdentityContext): Promise<ShapeHandle>;

  // Boolean Operations
  fuse(target: ShapeHandle, tool: ShapeHandle, context?: IdentityContext): Promise<ShapeHandle>;
  cut(target: ShapeHandle, tool: ShapeHandle, context?: IdentityContext): Promise<ShapeHandle>;
  common(target: ShapeHandle, tool: ShapeHandle, context?: IdentityContext): Promise<ShapeHandle>;

  // Formalized Software Contract aliases/methods
  booleanUnion(target: ShapeHandle, tool: ShapeHandle, context?: IdentityContext): Promise<ShapeHandle>;
  booleanCut(target: ShapeHandle, tool: ShapeHandle, context?: IdentityContext): Promise<ShapeHandle>;
  booleanIntersect(target: ShapeHandle, tool: ShapeHandle, context?: IdentityContext): Promise<ShapeHandle>;

  // Local Operations
  evaluateSketch(sketch: SketchDefinition, context?: IdentityContext): Promise<ShapeHandle>;
  fillet(shape: ShapeHandle, radius: number, edgeReferences?: TopologyReference[], context?: IdentityContext): Promise<ShapeHandle>;
  chamfer(shape: ShapeHandle, distance: number, edgeReferences?: TopologyReference[], context?: IdentityContext): Promise<ShapeHandle>;
  revolve(shape: ShapeHandle, axisPoint: Vector3, axisDir: Vector3, angle: number, context?: IdentityContext): Promise<ShapeHandle>;
  sweep(profile: ShapeHandle, path: ShapeHandle, context?: IdentityContext): Promise<ShapeHandle>;
  extrude(shape: ShapeHandle, dx: number, dy: number, dz: number, context?: IdentityContext): Promise<ShapeHandle>;

  // Transformations
  translate(shape: ShapeHandle, vector: Vector3): Promise<ShapeHandle>;
  rotate(shape: ShapeHandle, axis: Vector3, angle: number): Promise<ShapeHandle>;
  transform(shape: ShapeHandle, translation: Vector3, rotation?: Vector3): Promise<ShapeHandle>;

  // High-fidelity inspections
  tessellate(shape: ShapeHandle, linearDeflection: number, angularDeflection: number): Promise<any>;
  validate(shape: ShapeHandle): Promise<boolean>;

  // IO (Standard capitalization matches contract specifications)
  getManifest(): KernelManifest;
  exportStep(shape: ShapeHandle): Promise<string>;
  exportStepAP(shape: ShapeHandle, ap: '203' | '214' | '242'): Promise<string>;
  importStep(stepContent: string): Promise<ShapeHandle>;
  
  // Healing
  heal(shape: ShapeHandle): Promise<ShapeHandle>;
}
