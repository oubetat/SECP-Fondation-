/**
 * SECP Kernel Adapter
 * Base class for specific CAD kernel implementations.
 */

import { GeometryKernel } from '../geometry/GeometryKernel';
import { ShapeHandle } from '../geometry/ShapeHandle';
import { Vector3, Plane, IdentityContext, KernelManifest, TopologyReference } from '../geometry/GeometryTypes';
import { SketchDefinition } from '../geometry/SketchTypes';

export abstract class KernelAdapter implements GeometryKernel {
  abstract createBox(dx: number, dy: number, dz: number, center?: Vector3, context?: IdentityContext): Promise<ShapeHandle>;
  abstract createCylinder(radius: number, height: number, plane?: Plane, context?: IdentityContext): Promise<ShapeHandle>;
  abstract createSphere(radius: number, center?: Vector3, context?: IdentityContext): Promise<ShapeHandle>;
  abstract createRectangularFace(w: number, h: number, context?: IdentityContext): Promise<ShapeHandle>;

  abstract createPoint(x: number, y: number, z: number): Promise<Vector3>;
  abstract createLine(p1: Vector3, p2: Vector3, context?: IdentityContext): Promise<ShapeHandle>;
  abstract createCircle(center: Vector3, radius: number, normal?: Vector3, context?: IdentityContext): Promise<ShapeHandle>;
  abstract createArc(p1: Vector3, p2: Vector3, p3: Vector3, context?: IdentityContext): Promise<ShapeHandle>;
  abstract createWire(edges: ShapeHandle[], context?: IdentityContext): Promise<ShapeHandle>;
  abstract makeFaceFromWire(wire: ShapeHandle, context?: IdentityContext): Promise<ShapeHandle>;

  abstract fuse(target: ShapeHandle, tool: ShapeHandle, context?: IdentityContext): Promise<ShapeHandle>;
  abstract cut(target: ShapeHandle, tool: ShapeHandle, context?: IdentityContext): Promise<ShapeHandle>;
  abstract common(target: ShapeHandle, tool: ShapeHandle, context?: IdentityContext): Promise<ShapeHandle>;

  // Formalized Software Contract aliases
  async booleanUnion(target: ShapeHandle, tool: ShapeHandle, context?: IdentityContext): Promise<ShapeHandle> {
    return this.fuse(target, tool, context);
  }

  async booleanCut(target: ShapeHandle, tool: ShapeHandle, context?: IdentityContext): Promise<ShapeHandle> {
    return this.cut(target, tool, context);
  }

  async booleanIntersect(target: ShapeHandle, tool: ShapeHandle, context?: IdentityContext): Promise<ShapeHandle> {
    return this.common(target, tool, context);
  }

  abstract evaluateSketch(sketch: SketchDefinition, context?: IdentityContext): Promise<ShapeHandle>;
  abstract fillet(shape: ShapeHandle, radius: number, edgeReferences?: TopologyReference[], context?: IdentityContext): Promise<ShapeHandle>;
  abstract chamfer(shape: ShapeHandle, distance: number, edgeReferences?: TopologyReference[], context?: IdentityContext): Promise<ShapeHandle>;
  abstract revolve(shape: ShapeHandle, axisPoint: Vector3, axisDir: Vector3, angle: number, context?: IdentityContext): Promise<ShapeHandle>;
  abstract sweep(profile: ShapeHandle, path: ShapeHandle, context?: IdentityContext): Promise<ShapeHandle>;
  abstract extrude(shape: ShapeHandle, dx: number, dy: number, dz: number, context?: IdentityContext): Promise<ShapeHandle>;

  abstract translate(shape: ShapeHandle, vector: Vector3): Promise<ShapeHandle>;
  abstract rotate(shape: ShapeHandle, axis: Vector3, angle: number): Promise<ShapeHandle>;

  async transform(shape: ShapeHandle, translation: Vector3, rotation?: Vector3): Promise<ShapeHandle> {
    let moved = await this.translate(shape, translation);
    if (rotation) {
      if (rotation.x !== 0) moved = await this.rotate(moved, { x: 1, y: 0, z: 0 }, rotation.x);
      if (rotation.y !== 0) moved = await this.rotate(moved, { x: 0, y: 1, z: 0 }, rotation.y);
      if (rotation.z !== 0) moved = await this.rotate(moved, { x: 0, y: 0, z: 1 }, rotation.z);
    }
    return moved;
  }

  async tessellate(shape: ShapeHandle, linearDeflection: number, angularDeflection: number): Promise<any> {
    return shape.tessellate(linearDeflection, angularDeflection);
  }

  async validate(shape: ShapeHandle): Promise<boolean> {
    const props = await shape.getProperties();
    return props.isValid || false;
  }

  abstract getManifest(): KernelManifest;
  abstract exportStep(shape: ShapeHandle): Promise<string>;
  abstract exportStepAP(shape: ShapeHandle, ap: '203' | '214' | '242'): Promise<string>;
  abstract importStep(stepContent: string): Promise<ShapeHandle>;


  
  abstract heal(shape: ShapeHandle): Promise<ShapeHandle>;
}
