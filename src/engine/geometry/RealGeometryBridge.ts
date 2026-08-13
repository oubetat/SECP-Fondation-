/**
 * SECP Real Geometry Bridge
 * Bridges the Feature Tree and the Production CAD Kernel (OCCT).
 */

import { GeometryKernelManager } from './GeometryKernelManager';
import { ShapeHandle } from './ShapeHandle';
import { CadSolidEntity, MeshGeometryData, Vector3D } from '../cadKernel';
import { ShapeType } from './GeometryTypes';

export class RealGeometryBridge {
  /**
   * Converts a real ShapeHandle to the legacy CadSolidEntity for backward compatibility and UI display.
   */
  public static async toSolidEntity(handle: ShapeHandle, name: string): Promise<CadSolidEntity> {
    const props = await handle.getProperties();
    const bbox = await handle.getBoundingBox();
    const meshData = await handle.tessellate(0.5, 0.1); // Linear and angular deflection

    const mesh: MeshGeometryData = {
      vertices: Array.from(meshData.positions),
      normals: Array.from(meshData.normals),
      indices: Array.from(meshData.indices),
      facesCount: meshData.indices.length / 3
    };

    const centerOfGravity: Vector3D = props.centerOfMass || { x: 0, y: 0, z: 0 };

    return {
      id: handle.id,
      name: name,
      type: handle.type === ShapeType.SOLID ? 'BOX' : 'COMPOUND_BOOLEAN', // Simplified mapping
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      colorHex: '#3B82F6',
      dimensions: {
        dx: bbox.max.x - bbox.min.x,
        dy: bbox.max.y - bbox.min.y,
        dz: bbox.max.z - bbox.min.z
      },
      volumeM3: props.volume || 0,
      surfaceAreaM2: props.surfaceArea || 0,
      centerOfGravity: centerOfGravity,
      mesh: mesh
    };
  }

  /**
   * Helper to execute operations using the real kernel
   */
  public static async executeBox(dx: number, dy: number, dz: number, name: string): Promise<CadSolidEntity> {
    const kernel = await GeometryKernelManager.getKernel();
    const handle = await kernel.createBox(dx, dy, dz);
    return this.toSolidEntity(handle, name);
  }

  public static async executeCylinder(r: number, h: number, name: string): Promise<CadSolidEntity> {
    const kernel = await GeometryKernelManager.getKernel();
    const handle = await kernel.createCylinder(r, h);
    return this.toSolidEntity(handle, name);
  }

  public static async executeBoolean(target: ShapeHandle, tool: ShapeHandle, op: 'FUSE' | 'CUT' | 'COMMON', name: string): Promise<CadSolidEntity> {
    const kernel = await GeometryKernelManager.getKernel();
    let result: ShapeHandle;
    if (op === 'FUSE') result = await kernel.fuse(target, tool);
    else if (op === 'CUT') result = await kernel.cut(target, tool);
    else result = await kernel.common(target, tool);
    
    return this.toSolidEntity(result, name);
  }
}
