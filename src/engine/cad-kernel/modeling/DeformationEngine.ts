/**
 * SECP CAD Kernel — Geometric Deformation & Transformation Engine
 * WP-07 Implementation & Qualification
 */

import { Solid, Vertex, TopoShapeEnum } from '../topology/TopologyContracts';
import { DirectModelingEngine } from './DirectModelingEngine';
import { Point } from '../geometry/GeometryContracts';

export class DeformationEngine {
  /**
   * Performs non-uniform affine scaling on a solid.
   * Validates positive Jacobian determinant (sx * sy * sz > 0) to avoid topological inversion.
   */
  public static scaleNonUniform(solid: Solid, sx: number, sy: number, sz: number): Solid {
    if (sx === 0 || sy === 0 || sz === 0) {
      throw new Error('scaleNonUniform: Scale factors must be non-zero.');
    }
    const det = sx * sy * sz;
    if (det <= 0) {
      throw new Error('scaleNonUniform: Scale matrix Jacobian determinant must be positive to preserve 2-manifold orientation.');
    }

    const cloned = DirectModelingEngine.cloneShape(solid);
    const entityMap = (DirectModelingEngine as any).collectEntities(cloned);

    for (const entity of entityMap.values()) {
      if (entity.shapeType === TopoShapeEnum.VERTEX) {
        const v = entity as Vertex;
        v.geometry.x *= sx;
        v.geometry.y *= sy;
        v.geometry.z *= sz;
      }
    }

    return cloned;
  }

  /**
   * Applies an arbitrary 4x4 affine matrix transformation to all vertices in a solid.
   */
  public static transformAffine(solid: Solid, matrix: number[][]): Solid {
    if (!matrix || matrix.length !== 4 || matrix.some(r => r.length !== 4)) {
      throw new Error('transformAffine: Matrix must be 4x4.');
    }

    const cloned = DirectModelingEngine.cloneShape(solid);
    const entityMap = (DirectModelingEngine as any).collectEntities(cloned);

    for (const entity of entityMap.values()) {
      if (entity.shapeType === TopoShapeEnum.VERTEX) {
        const v = entity as Vertex;
        const x = v.geometry.x;
        const y = v.geometry.y;
        const z = v.geometry.z;

        v.geometry.x = (matrix[0][0] * x + matrix[0][1] * y + matrix[0][2] * z + matrix[0][3]) as any;
        v.geometry.y = (matrix[1][0] * x + matrix[1][1] * y + matrix[1][2] * z + matrix[1][3]) as any;
        v.geometry.z = (matrix[2][0] * x + matrix[2][1] * y + matrix[2][2] * z + matrix[2][3]) as any;
      }
    }

    return cloned;
  }

  /**
   * Applies a twist deformation around Z-axis (or given spatial axis).
   */
  public static twistSolid(solid: Solid, totalAngleRad: number, heightZ: number): Solid {
    if (heightZ <= 0) throw new Error('twistSolid: heightZ must be positive.');

    const cloned = DirectModelingEngine.cloneShape(solid);
    const entityMap = (DirectModelingEngine as any).collectEntities(cloned);

    for (const entity of entityMap.values()) {
      if (entity.shapeType === TopoShapeEnum.VERTEX) {
        const v = entity as Vertex;
        const zRatio = Math.max(0, Math.min(1, v.geometry.z / heightZ));
        const angle = totalAngleRad * zRatio;

        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        const x = v.geometry.x;
        const y = v.geometry.y;

        v.geometry.x = (x * cosA - y * sinA) as any;
        v.geometry.y = (x * sinA + y * cosA) as any;
      }
    }

    return cloned;
  }

  /**
   * Applies a linear taper deformation along Z-axis.
   */
  public static taperSolid(solid: Solid, taperFactorStart: number, taperFactorEnd: number, heightZ: number): Solid {
    if (heightZ <= 0) throw new Error('taperSolid: heightZ must be positive.');

    const cloned = DirectModelingEngine.cloneShape(solid);
    const entityMap = (DirectModelingEngine as any).collectEntities(cloned);

    for (const entity of entityMap.values()) {
      if (entity.shapeType === TopoShapeEnum.VERTEX) {
        const v = entity as Vertex;
        const zRatio = Math.max(0, Math.min(1, v.geometry.z / heightZ));
        const scale = taperFactorStart + zRatio * (taperFactorEnd - taperFactorStart);

        v.geometry.x *= scale;
        v.geometry.y *= scale;
      }
    }

    return cloned;
  }
}
