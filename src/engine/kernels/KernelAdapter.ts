/**
 * SECP Kernel Adapter
 * Base class for specific CAD kernel implementations.
 */

import { GeometryKernel } from '../geometry/GeometryKernel';
import { ShapeHandle } from '../geometry/ShapeHandle';
import { Vector3, Plane } from '../geometry/GeometryTypes';

export abstract class KernelAdapter implements GeometryKernel {
  abstract createBox(dx: number, dy: number, dz: number, center?: Vector3): Promise<ShapeHandle>;
  abstract createCylinder(radius: number, height: number, plane?: Plane): Promise<ShapeHandle>;
  abstract createSphere(radius: number, center?: Vector3): Promise<ShapeHandle>;

  abstract fuse(target: ShapeHandle, tool: ShapeHandle): Promise<ShapeHandle>;
  abstract cut(target: ShapeHandle, tool: ShapeHandle): Promise<ShapeHandle>;
  abstract common(target: ShapeHandle, tool: ShapeHandle): Promise<ShapeHandle>;

  // Formalized Software Contract aliases
  async booleanUnion(target: ShapeHandle, tool: ShapeHandle): Promise<ShapeHandle> {
    return this.fuse(target, tool);
  }

  async booleanCut(target: ShapeHandle, tool: ShapeHandle): Promise<ShapeHandle> {
    return this.cut(target, tool);
  }

  async booleanIntersect(target: ShapeHandle, tool: ShapeHandle): Promise<ShapeHandle> {
    return this.common(target, tool);
  }

  abstract fillet(shape: ShapeHandle, radius: number, edgeIndices?: number[]): Promise<ShapeHandle>;
  abstract chamfer(shape: ShapeHandle, distance: number, edgeIndices?: number[]): Promise<ShapeHandle>;
  abstract revolve(shape: ShapeHandle, axisPoint: Vector3, axisDir: Vector3, angle: number): Promise<ShapeHandle>;
  abstract sweep(profile: ShapeHandle, path: ShapeHandle): Promise<ShapeHandle>;

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

  abstract exportStep(shape: ShapeHandle): Promise<string>;
  abstract importStep(stepContent: string): Promise<ShapeHandle>;

  async exportSTEP(shape: ShapeHandle): Promise<string> {
    return this.exportStep(shape);
  }

  async importSTEP(stepContent: string): Promise<ShapeHandle> {
    return this.importStep(stepContent);
  }
  
  abstract heal(shape: ShapeHandle): Promise<ShapeHandle>;
}
