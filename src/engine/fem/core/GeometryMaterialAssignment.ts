/**
 * SECP Industrial OS — Programmable Material Engineering (SECP-PROGRAMMABLE-MATERIAL-V4)
 * GeometryMaterialAssignment.ts
 * 
 * Formal contract, lifecycle state machine, coordinate transforms,
 * and domain coverage verification between Canonical Geometry and Material Fields.
 */

import { SpatialDomain } from "./SpatialMaterialField";
import { FEMElement, FEMNode } from "./FEMTypes";

export type AssignmentState =
  | 'DECLARED'
  | 'VALIDATED'
  | 'BOUND_TO_GEOMETRY'
  | 'BOUND_TO_MESH'
  | 'READY_FOR_ANALYSIS'
  | 'INVALIDATED'
  | 'REJECTED';

export type CoordinateFrameType = 'GLOBAL_CARTESIAN' | 'LOCAL_PART_FRAME' | 'LOCAL_CUSTOM_FRAME';

export type CoveragePolicy = 'FULL_COVERAGE_MANDATORY' | 'PARTIAL_PERMITTED';

export interface Transform3D {
  position: { x: number; y: number; z: number };
  /**
   * 3x3 orthonormal rotation matrix R:
   * [ [R00, R01, R02],
   *   [R10, R11, R12],
   *   [R20, R21, R22] ]
   * Defaults to identity matrix if omitted.
   */
  rotationMatrix?: number[][];
}

export interface CoordinateFrameContract {
  frameType: CoordinateFrameType;
  frameId?: string;
  transform?: Transform3D;
}

export interface GeometryMaterialAssignment {
  assignmentId: string;
  canonicalGeometryId: string;
  geometryRevisionId: string;
  materialId: string;
  materialRevisionId: string;
  spatialFieldId?: string;
  targetDomain?: SpatialDomain;
  coordinateFrame: CoordinateFrameContract;
  coveragePolicy: CoveragePolicy;
  state: AssignmentState;
  rejectionReason?: string;
  boundElementIds?: string[];
  metadata?: Record<string, any>;
}

export class CoordinateFrameTransformEngine {
  /**
   * Transforms coordinates from Global Cartesian frame to the local frame of the part.
   * x_local = R^T * (x_global - position)
   */
  public static toLocal(
    pGlobal: { x: number; y: number; z: number },
    frame: CoordinateFrameContract
  ): { x: number; y: number; z: number } {
    if (frame.frameType === 'GLOBAL_CARTESIAN' || !frame.transform) {
      return { ...pGlobal };
    }

    const t = frame.transform.position;
    const dx = pGlobal.x - t.x;
    const dy = pGlobal.y - t.y;
    const dz = pGlobal.z - t.z;

    const R = frame.transform.rotationMatrix;
    if (!R) {
      // Pure translation
      return { x: dx, y: dy, z: dz };
    }

    // Multiply by R^T (transpose of R):
    // x_local = R00*dx + R10*dy + R20*dz
    // y_local = R01*dx + R11*dy + R21*dz
    // z_local = R02*dx + R12*dy + R22*dz
    const lx = R[0][0] * dx + R[1][0] * dy + R[2][0] * dz;
    const ly = R[0][1] * dx + R[1][1] * dy + R[2][1] * dz;
    const lz = R[0][2] * dx + R[1][2] * dy + R[2][2] * dz;

    return { x: lx, y: ly, z: lz };
  }

  /**
   * Transforms coordinates from local part frame to Global Cartesian frame.
   * x_global = R * x_local + position
   */
  public static toGlobal(
    pLocal: { x: number; y: number; z: number },
    frame: CoordinateFrameContract
  ): { x: number; y: number; z: number } {
    if (frame.frameType === 'GLOBAL_CARTESIAN' || !frame.transform) {
      return { ...pLocal };
    }

    const t = frame.transform.position;
    const R = frame.transform.rotationMatrix;

    if (!R) {
      return {
        x: pLocal.x + t.x,
        y: pLocal.y + t.y,
        z: pLocal.z + t.z
      };
    }

    // Multiply by R:
    // gx = R00*lx + R01*ly + R02*lz + tx
    // gy = R10*lx + R11*ly + R12*lz + ty
    // gz = R20*lx + R21*ly + R22*lz + tz
    const gx = R[0][0] * pLocal.x + R[0][1] * pLocal.y + R[0][2] * pLocal.z + t.x;
    const gy = R[1][0] * pLocal.x + R[1][1] * pLocal.y + R[1][2] * pLocal.z + t.y;
    const gz = R[2][0] * pLocal.x + R[2][1] * pLocal.y + R[2][2] * pLocal.z + t.z;

    return { x: gx, y: gy, z: gz };
  }
}

export class GeometryDomainAuditor {
  /**
   * Computes the bounding box of a collection of nodes or element-bound nodes.
   */
  public static computeBoundingBox(
    nodes: Map<string, FEMNode>,
    elementIds?: string[],
    elements?: Map<string, FEMElement>
  ): SpatialDomain {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    const nodeIdsToScan = new Set<string>();

    if (elementIds && elements) {
      for (const elemId of elementIds) {
        const elem = elements.get(elemId);
        if (elem) {
          for (const nid of elem.nodeIds) {
            nodeIdsToScan.add(nid);
          }
        }
      }
    } else {
      for (const nid of nodes.keys()) {
        nodeIdsToScan.add(nid);
      }
    }

    if (nodeIdsToScan.size === 0) {
      return {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 0, y: 0, z: 0 }
      };
    }

    for (const nid of nodeIdsToScan) {
      const node = nodes.get(nid);
      if (node) {
        if (node.x < minX) minX = node.x;
        if (node.x > maxX) maxX = node.x;
        if (node.y < minY) minY = node.y;
        if (node.y > maxY) maxY = node.y;
        if (node.z < minZ) minZ = node.z;
        if (node.z > maxZ) maxZ = node.z;
      }
    }

    return {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ }
    };
  }

  /**
   * Checks whether the inner bounding box is fully contained within outer bounding box.
   */
  public static isContained(
    inner: SpatialDomain,
    outer: SpatialDomain,
    tolerance = 1e-6
  ): boolean {
    return (
      inner.min.x >= outer.min.x - tolerance &&
      inner.max.x <= outer.max.x + tolerance &&
      inner.min.y >= outer.min.y - tolerance &&
      inner.max.y <= outer.max.y + tolerance &&
      inner.min.z >= outer.min.z - tolerance &&
      inner.max.z <= outer.max.z + tolerance
    );
  }
}
