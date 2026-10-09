// SECP Industrial OS v2 — B-Rep Twin Service
import {
  BRepTwinDefinition,
  VertexEntity,
  EdgeEntity,
  LoopEntity,
  FaceEntity,
  ShellEntity,
  SolidEntity,
  Vector3D
} from './types';
import { CanonicalGeometrySerializer } from './CanonicalGeometrySerializer';

export class BRepTwinService {
  public static createCubeBRep(size: number = 10): BRepTwinDefinition {
    const half = size / 2;
    // 8 vertices
    const rawVertices: { id: string; pt: Vector3D }[] = [
      { id: 'V0', pt: { x: -half, y: -half, z: -half } },
      { id: 'V1', pt: { x: half, y: -half, z: -half } },
      { id: 'V2', pt: { x: half, y: half, z: -half } },
      { id: 'V3', pt: { x: -half, y: half, z: -half } },
      { id: 'V4', pt: { x: -half, y: -half, z: half } },
      { id: 'V5', pt: { x: half, y: -half, z: half } },
      { id: 'V6', pt: { x: half, y: half, z: half } },
      { id: 'V7', pt: { x: -half, y: half, z: half } }
    ];

    const vertices: VertexEntity[] = rawVertices.map(v => {
      const vert: VertexEntity = {
        vertexId: v.id,
        point: v.pt,
        tolerance: 0.001
      };
      vert.canonicalHash = CanonicalGeometrySerializer.computeVertexHash(vert);
      return vert;
    });

    // 12 edges
    const rawEdges: { id: string; s: string; e: string }[] = [
      { id: 'E0', s: 'V0', e: 'V1' },
      { id: 'E1', s: 'V1', e: 'V2' },
      { id: 'E2', s: 'V2', e: 'V3' },
      { id: 'E3', s: 'V3', e: 'V0' },
      { id: 'E4', s: 'V4', e: 'V5' },
      { id: 'E5', s: 'V5', e: 'V6' },
      { id: 'E6', s: 'V6', e: 'V7' },
      { id: 'E7', s: 'V7', e: 'V4' },
      { id: 'E8', s: 'V0', e: 'V4' },
      { id: 'E9', s: 'V1', e: 'V5' },
      { id: 'E10', s: 'V2', e: 'V6' },
      { id: 'E11', s: 'V3', e: 'V7' }
    ];

    const edges: EdgeEntity[] = rawEdges.map(e => ({
      edgeId: e.id,
      curveType: 'LINE',
      curveDefinitionHash: CanonicalGeometrySerializer.sha256(`LINE_${e.s}_${e.e}`),
      startVertexId: e.s,
      endVertexId: e.e,
      orientation: 'FORWARD',
      length: size
    }));

    // 6 loops (1 for each face)
    const rawLoops: { id: string; edges: string[] }[] = [
      { id: 'L0', edges: ['E0', 'E1', 'E2', 'E3'] }, // Bottom (z = -half)
      { id: 'L1', edges: ['E4', 'E5', 'E6', 'E7'] }, // Top (z = half)
      { id: 'L2', edges: ['E0', 'E9', 'E4', 'E8'] }, // Front
      { id: 'L3', edges: ['E1', 'E10', 'E5', 'E9'] }, // Right
      { id: 'L4', edges: ['E2', 'E11', 'E6', 'E10'] }, // Back
      { id: 'L5', edges: ['E3', 'E8', 'E7', 'E11'] } // Left
    ];

    const loops: LoopEntity[] = rawLoops.map(l => ({
      loopId: l.id,
      edgeIds: l.edges,
      isOuter: true,
      isClosed: true
    }));

    // 6 faces
    const faces: FaceEntity[] = loops.map((l, idx) => ({
      faceId: `F${idx}`,
      surfaceType: 'PLANE',
      surfaceDefinitionHash: CanonicalGeometrySerializer.sha256(`PLANE_FACE_${idx}`),
      outerLoopId: l.loopId,
      innerLoopIds: [],
      orientation: 'FORWARD',
      boundaryHash: CanonicalGeometrySerializer.computeLoopHash(l),
      area: size * size
    }));

    // 1 outer shell
    const shells: ShellEntity[] = [
      {
        shellId: 'S0',
        faceIds: faces.map(f => f.faceId),
        isClosed: true,
        isManifold: true
      }
    ];

    // 1 solid
    const solids: SolidEntity[] = [
      {
        solidId: 'SOL0',
        outerShellId: 'S0',
        voidShellIds: [],
        volume: size * size * size,
        isClosed: true
      }
    ];

    const brep: BRepTwinDefinition = {
      vertices,
      edges,
      loops,
      faces,
      shells,
      solids,
      vertexCount: vertices.length,
      edgeCount: edges.length,
      wireCount: loops.length,
      faceCount: faces.length,
      shellCount: shells.length,
      solidCount: solids.length,
      bRepHash: '',
      topologyHash: ''
    };

    brep.topologyHash = CanonicalGeometrySerializer.computeTopologyHash(brep);
    brep.bRepHash = CanonicalGeometrySerializer.computeGeometryHash({ bRep: brep });

    return brep;
  }
}
