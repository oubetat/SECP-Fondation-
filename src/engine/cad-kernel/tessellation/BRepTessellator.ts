/**
 * SECP CAD Kernel — BRep Tessellator
 * Phase 2 (PATCH-KERNEL-006)
 *
 * Converts authoritative B-Rep Solids into derived MeshGeometryData while strictly
 * preserving underlying B-Rep topology (adjacency, face/edge/vertex persistent mappings,
 * lineage, and shared edge topological connectivity).
 */

import { Solid, Orientation } from '../topology/TopologyContracts';
import { TopologyLineage } from '../history/FeatureDefinition';
import { EngineeringHashChain } from '../../evidence/EngineeringHashChain';

export interface MeshTopologyMap {
  faceTriangleMap: Record<string, {
    triangleIndices: number[];
    faceId: string;
    persistentId: string;
    lineage?: TopologyLineage;
  }>;
  edgeVertexMap: Record<string, {
    vertexIndices: number[];
    edgeId: string;
    persistentId: string;
    lineage?: TopologyLineage;
  }>;
  vertexIndexMap: Record<string, {
    vertexIndex: number;
    vertexId: string;
    persistentId: string;
  }>;
  sharedEdges: {
    edgeId: string;
    persistentId?: string;
    faceA: string;
    faceB: string;
    sharedVertexIndices: number[];
  }[];
}

export interface MeshGeometryData {
  vertices: number[]; // Flattened x,y,z coordinates (in meters)
  normals: number[];  // Flattened nx,ny,nz unit vectors
  indices: number[];  // Triangle vertex index buffer
  facesCount: number; // Number of triangles
  topologyMap: MeshTopologyMap;
  brepHash: string;
  meshHash: string;
}

export class BRepTessellator {
  /**
   * Tessellates a BRep Solid into a derived MeshGeometryData artifact.
   * Maintains underlying topology, adjacency maps, and computes cryptographic hashes.
   */
  public static tessellate(solid: Solid): MeshGeometryData {
    const vertices: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];

    const topologyMap: MeshTopologyMap = {
      faceTriangleMap: {},
      edgeVertexMap: {},
      vertexIndexMap: {},
      sharedEdges: []
    };

    if (!solid || !solid.outerShell || !Array.isArray(solid.outerShell.orientedFaces)) {
      const brepHash = this.computeBRepHash(solid);
      const emptyMesh = {
        vertices: [],
        normals: [],
        indices: [],
        facesCount: 0,
        topologyMap,
        brepHash,
        meshHash: ''
      };
      emptyMesh.meshHash = this.computeMeshHash(emptyMesh);
      return emptyMesh;
    }

    const vertexKeyMap = new Map<string, number>();
    const edgeFaceMap = new Map<string, { facePersistentId: string; vertexIndices: number[] }[]>();

    for (const of of solid.outerShell.orientedFaces) {
      const face = of.face;
      const facePersistentId = face.persistentId || face.topologyReference?.persistentId || face.id;

      if (!face.outerLoop || !Array.isArray(face.outerLoop.orientedEdges)) {
        continue;
      }

      // Extract vertices from outer loop oriented edges
      const loopVerts = face.outerLoop.orientedEdges.map(oe => {
        const v = oe.orientation === Orientation.FORWARD ? oe.edge.startVertex : oe.edge.endVertex;
        return v;
      });

      if (loopVerts.length < 3) continue;

      // Face normal calculation
      let nx = 0, ny = 0, nz = 1;
      if (face.geometry && typeof (face.geometry as any).normal === 'object') {
        const norm = (face.geometry as any).normal;
        nx = norm.x ?? 0;
        ny = norm.y ?? 0;
        nz = norm.z ?? 1;
      } else {
        const p0 = loopVerts[0].geometry;
        const p1 = loopVerts[1].geometry;
        const p2 = loopVerts[2].geometry;
        const e1x = p1.x - p0.x, e1y = p1.y - p0.y, e1z = p1.z - p0.z;
        const e2x = p2.x - p0.x, e2y = p2.y - p0.y, e2z = p2.z - p0.z;
        const cx = e1y * e2z - e1z * e2y;
        const cy = e1z * e2x - e1x * e2z;
        const cz = e1x * e2y - e1y * e2x;
        const len = Math.hypot(cx, cy, cz) || 1;
        nx = cx / len; ny = cy / len; nz = cz / len;
      }

      // Process face vertices & map to mesh vertex buffer
      const faceMeshVertexIndices: number[] = [];

      for (const v of loopVerts) {
        const vPos = v.geometry;
        const vPersistentId = v.persistentId || v.topologyReference?.persistentId || v.id;
        const key = `${vPos.x.toFixed(6)},${vPos.y.toFixed(6)},${vPos.z.toFixed(6)}`;

        let meshVertIdx: number;
        if (vertexKeyMap.has(key)) {
          meshVertIdx = vertexKeyMap.get(key)!;
        } else {
          meshVertIdx = vertices.length / 3;
          vertices.push(vPos.x, vPos.y, vPos.z);
          normals.push(nx, ny, nz);
          vertexKeyMap.set(key, meshVertIdx);

          topologyMap.vertexIndexMap[vPersistentId] = {
            vertexIndex: meshVertIdx,
            vertexId: v.id,
            persistentId: vPersistentId
          };
        }

        faceMeshVertexIndices.push(meshVertIdx);
      }

      // Triangulate face polygon (ear clipping / fan)
      const faceTriangleIndices: number[] = [];
      const v0Idx = faceMeshVertexIndices[0];

      for (let j = 1; j < faceMeshVertexIndices.length - 1; j++) {
        const tri0 = v0Idx;
        const tri1 = faceMeshVertexIndices[j];
        const tri2 = faceMeshVertexIndices[j + 1];

        const triIdxStart = indices.length;
        indices.push(tri0, tri1, tri2);
        faceTriangleIndices.push(triIdxStart, triIdxStart + 1, triIdxStart + 2);
      }

      // Record face mapping
      topologyMap.faceTriangleMap[facePersistentId] = {
        triangleIndices: faceTriangleIndices,
        faceId: face.id,
        persistentId: facePersistentId,
        lineage: face.lineage
      };

      // Process Edges and Shared Topology
      for (const oe of face.outerLoop.orientedEdges) {
        const edge = oe.edge;
        const edgePersistentId = edge.persistentId || edge.topologyReference?.persistentId || edge.id;

        const startV = edge.startVertex;
        const endV = edge.endVertex;

        const startKey = `${startV.geometry.x.toFixed(6)},${startV.geometry.y.toFixed(6)},${startV.geometry.z.toFixed(6)}`;
        const endKey = `${endV.geometry.x.toFixed(6)},${endV.geometry.y.toFixed(6)},${endV.geometry.z.toFixed(6)}`;

        const startMeshIdx = vertexKeyMap.get(startKey) ?? -1;
        const endMeshIdx = vertexKeyMap.get(endKey) ?? -1;

        const edgeVertIndices = [startMeshIdx, endMeshIdx];

        topologyMap.edgeVertexMap[edgePersistentId] = {
          vertexIndices: edgeVertIndices,
          edgeId: edge.id,
          persistentId: edgePersistentId,
          lineage: edge.lineage
        };

        if (!edgeFaceMap.has(edgePersistentId)) {
          edgeFaceMap.set(edgePersistentId, []);
        }
        edgeFaceMap.get(edgePersistentId)!.push({
          facePersistentId,
          vertexIndices: edgeVertIndices
        });
      }
    }

    // Build shared edge topological adjacency records
    for (const [edgePersistentId, faceRefs] of edgeFaceMap.entries()) {
      if (faceRefs.length >= 2) {
        topologyMap.sharedEdges.push({
          edgeId: faceRefs[0].facePersistentId,
          persistentId: edgePersistentId,
          faceA: faceRefs[0].facePersistentId,
          faceB: faceRefs[1].facePersistentId,
          sharedVertexIndices: faceRefs[0].vertexIndices
        });
      }
    }

    const brepHash = this.computeBRepHash(solid);
    const resultMesh: MeshGeometryData = {
      vertices,
      normals,
      indices,
      facesCount: Math.floor(indices.length / 3),
      topologyMap,
      brepHash,
      meshHash: ''
    };

    resultMesh.meshHash = this.computeMeshHash(resultMesh);
    return resultMesh;
  }

  /**
   * Cryptographically computes canonical hash of a source BRep Solid.
   * Focuses purely on Geometry Identity (Geometry + Topology Connectivity).
   * Excludes volatile IDs and persistent IDs to ensure identical geometry yields identical hashes.
   */
  public static computeBRepHash(solid: Solid): string {
    if (!solid) return 'EMPTY_BREP_HASH';

    const canonicalBRep = {
      // Only include topological structure and geometric data
      faces: (solid.outerShell?.orientedFaces || []).map(of => ({
        vertices: (of?.face?.outerLoop?.orientedEdges || []).map(oe => {
          const vert = oe?.orientation === Orientation.FORWARD ? oe?.edge?.startVertex : oe?.edge?.endVertex;
          const p = vert?.geometry || { x: 0, y: 0, z: 0 };
          return {
            x: Number((p.x || 0).toFixed(6)),
            y: Number((p.y || 0).toFixed(6)),
            z: Number((p.z || 0).toFixed(6))
          };
        })
      }))
    };

    return EngineeringHashChain.computeCanonicalHash(canonicalBRep).canonicalHash;
  }

  /**
   * Cryptographically computes canonical hash of a derived MeshGeometryData artifact.
   */
  public static computeMeshHash(mesh: Partial<MeshGeometryData>): string {
    const canonicalMesh = {
      verticesCount: mesh.vertices?.length || 0,
      indicesCount: mesh.indices?.length || 0,
      facesCount: mesh.facesCount || 0,
      topologyFacesCount: Object.keys(mesh.topologyMap?.faceTriangleMap || {}).length,
      topologyEdgesCount: Object.keys(mesh.topologyMap?.edgeVertexMap || {}).length,
      sharedEdgesCount: mesh.topologyMap?.sharedEdges?.length || 0,
      vertices: mesh.vertices?.map(v => Number(v.toFixed(6))),
      indices: mesh.indices
    };

    return EngineeringHashChain.computeCanonicalHash(canonicalMesh).canonicalHash;
  }
}
