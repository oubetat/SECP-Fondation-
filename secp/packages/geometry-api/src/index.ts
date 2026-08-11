import { Point3D, BoundingBox, StructuralNode } from '../../engineering-types/src';

/**
 * Geometry API Package
 * High-Level wrapper interfacing between TypeScript frontend and C++ CAD/Mesh kernel.
 */
export class GeometryApi {
  public static calculateBoundingBox(points: Point3D[]): BoundingBox {
    if (points.length === 0) {
      return {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 0, y: 0, z: 0 }
      };
    }

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.z < minZ) minZ = p.z;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
      if (p.z > maxZ) maxZ = p.z;
    }

    return {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ }
    };
  }

  public static computeMemberLength(nodeA: StructuralNode, nodeB: StructuralNode): number {
    const dx = nodeB.position.x - nodeA.position.x;
    const dy = nodeB.position.y - nodeA.position.y;
    const dz = nodeB.position.z - nodeA.position.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
}
