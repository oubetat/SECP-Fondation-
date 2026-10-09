/**
 * SECP Industrial OS — Engineering Truth Platform
 * PATCH-240 — CAD to FEM Model Builder
 */

import { Solid } from '../../cad-kernel/topology/TopologyContracts';
import { FEMMesh } from '../mesh/FEMMesh';
import { FEMMeshGenerator } from '../mesh/FEMMeshGenerator';

export interface CadFemMapping {
  cadShapeId: string;
  femNodeIds: string[];
  femElementIds: string[];
}

export interface CadToFemModel {
  mesh: FEMMesh;
  mappings: CadFemMapping[];
}

/**
 * CadToFemModelBuilder: Bridges CAD B-Rep to FEM meshes.
 * Implements the mandated traceability between CAD Faces/Edges and FEM entities.
 */
export class CadToFemModelBuilder {
  /**
   * Builds a full FEM model from a CAD solid with element size control.
   */
  public static build(solid: any, elementSize: number): CadToFemModel {
    // Unwrap BRepSolid if wrapped
    const topoSolid: Solid = solid?.topology || solid;

    // 1. Identify the geometry type from B-Rep topology
    const geometryType = this.inferGeometryType(topoSolid, solid);
    const dimensions = this.extractDimensions(topoSolid, solid);

    // 2. Generate Mesh using the General FEM Mesh infrastructure (PATCH-231)
    const mesh = FEMMeshGenerator.generate({
      geometryType: geometryType as any,
      dimensions,
      elementSize,
      elementType: 'TET' 
    });

    // 3. Establish Traceability Mappings
    const mappings = this.buildMappings(topoSolid, mesh);

    return { mesh, mappings };
  }

  private static inferGeometryType(solid: Solid, rawEntity?: any): string {
    if (rawEntity?.type === 'CYLINDER') return 'CYLINDER';
    if (rawEntity?.type === 'SPHERE') return 'BOX';

    const faceCount = solid?.outerShell?.orientedFaces?.length || 0;
    const innerShellCount = solid?.innerShells?.length || 0;

    if (innerShellCount > 0) return 'PLATE_WITH_HOLE';
    if (faceCount === 3) return 'CYLINDER';
    if (faceCount === 6) return 'BOX';
    
    return 'BOX'; 
  }

  private static extractDimensions(solid: Solid, rawEntity?: any): Record<string, number> {
    // Check if rawEntity has direct dimensional properties
    if (rawEntity?.dimensions) {
      const d = rawEntity.dimensions;
      const dx = d.width || d.dx || d.length || 1.0;
      const dy = d.height || d.dy || 1.0;
      const dz = d.depth || d.dz || 1.0;
      return {
        dx,
        dy,
        dz,
        radius: d.radius || Math.min(dx, dy) / 2,
        height: d.height || dz,
        holeRadius: d.holeRadius || Math.min(dx, dy) / 4
      };
    }

    // Attempt scanning coordinates from B-Rep faces/wires/vertices
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    if (solid?.outerShell?.orientedFaces) {
      solid.outerShell.orientedFaces.forEach((of: any) => {
        const face = of.face;
        if (face?.outerWire?.edges) {
          face.outerWire.edges.forEach((e: any) => {
            [e.startVertex, e.endVertex].forEach((v: any) => {
              if (v?.point) {
                minX = Math.min(minX, v.point.x);
                maxX = Math.max(maxX, v.point.x);
                minY = Math.min(minY, v.point.y);
                maxY = Math.max(maxY, v.point.y);
                minZ = Math.min(minZ, v.point.z);
                maxZ = Math.max(maxZ, v.point.z);
              }
            });
          });
        }
      });
    }

    if (isFinite(minX) && isFinite(maxX) && maxX > minX) {
      const dx = Math.max(0.01, maxX - minX);
      const dy = Math.max(0.01, maxY - minY);
      const dz = Math.max(0.01, isFinite(minZ) && maxZ > minZ ? maxZ - minZ : 0.1);
      return {
        dx,
        dy,
        dz,
        radius: Math.min(dx, dy) / 2,
        height: dz,
        holeRadius: Math.min(dx, dy) / 4
      };
    }

    return {
      dx: 1.0,
      dy: 1.0,
      dz: 1.0,
      radius: 0.5,
      height: 1.5,
      holeRadius: 0.25
    };
  }

  private static buildMappings(solid: Solid, mesh: FEMMesh): CadFemMapping[] {
    const mappings: CadFemMapping[] = [];
    if (!solid?.outerShell?.orientedFaces || solid.outerShell.orientedFaces.length === 0) {
      return mappings;
    }

    // Iterate through each CAD Face and match geometrically with FEM boundary
    solid.outerShell.orientedFaces.forEach((of, index) => {
      const face = of.face;
      const faceId = face?.id || `FACE_${index}`;

      // Calculate CAD face geometry metrics (vertices, centroid, normal)
      const faceVertices: { x: number; y: number; z: number }[] = [];
      if (face?.outerLoop?.orientedEdges) {
        face.outerLoop.orientedEdges.forEach((oe: any) => {
          const v = oe.edge?.startVertex?.geometry;
          if (v && typeof v.x === 'number') {
            faceVertices.push({ x: v.x, y: v.y, z: v.z });
          }
        });
      }

      let centroid = { x: 0, y: 0, z: 0 };
      if (faceVertices.length > 0) {
        centroid = faceVertices.reduce(
          (acc, v) => ({ x: acc.x + v.x / faceVertices.length, y: acc.y + v.y / faceVertices.length, z: acc.z + v.z / faceVertices.length }),
          { x: 0, y: 0, z: 0 }
        );
      }

      // Compute normal approximation if 3+ vertices exist
      let normal = { x: 0, y: 0, z: 1 };
      if (faceVertices.length >= 3) {
        const v0 = faceVertices[0];
        const v1 = faceVertices[1];
        const v2 = faceVertices[2];
        const ax = v1.x - v0.x, ay = v1.y - v0.y, az = v1.z - v0.z;
        const bx = v2.x - v0.x, by = v2.y - v0.y, bz = v2.z - v0.z;
        const nx = ay * bz - az * by;
        const ny = az * bx - ax * bz;
        const nz = ax * by - ay * bx;
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (len > 1e-9) {
          normal = { x: nx / len, y: ny / len, z: nz / len };
        }
      }

      // Deterministic Geometric Match to FEM Boundary:
      // Score = (1 - normal_dot) * 2.0 + centroid_distance / max_extent
      let bestBoundary: FEMBoundary = mesh.boundaries[0];
      let bestScore = Infinity;

      if (mesh.boundaries.length > 0) {
        for (const bnd of mesh.boundaries) {
          let score = 0;
          if (bnd.normal) {
            const dot = normal.x * bnd.normal.x + normal.y * bnd.normal.y + normal.z * bnd.normal.z;
            score += (1.0 - Math.min(1.0, Math.max(-1.0, dot))) * 10.0;
          }
          if (bnd.centroid && faceVertices.length > 0) {
            const cdist = Math.sqrt(
              Math.pow(centroid.x - bnd.centroid.x, 2) +
              Math.pow(centroid.y - bnd.centroid.y, 2) +
              Math.pow(centroid.z - bnd.centroid.z, 2)
            );
            score += cdist;
          }
          if (score < bestScore) {
            bestScore = score;
            bestBoundary = bnd;
          }
        }
      }

      mappings.push({
        cadShapeId: faceId,
        femNodeIds: bestBoundary?.nodeIds || [],
        femElementIds: bestBoundary?.elementIds || []
      });
    });

    return mappings;
  }
}
