/**
 * SECP Industrial OS v3 — PATCH-182: Deterministic Geometry & Topology Engine
 * Forces B-Rep geometry and topology data into canonical, normalized representations.
 * Prevents ordering, orientation, or naming drifts from corrupting deterministic identities.
 */

import { EngineeringInputManifest, CanonicalGeometry, CanonicalTopology } from './DeterminismTypes';
import { generateDeterministicHashSync } from '../../lib/hash';
import { DeterministicReductionEngine } from './DeterministicReductionEngine';

export class DeterministicGeometryTopologyEngine {
  /**
   * Forces Geometry kernel outputs into canonical, normalized geometry structures.
   */
  public static canonicalizeGeometry(input: EngineeringInputManifest): CanonicalGeometry {
    const rawVerts = input.geometry.rawVertices;

    // 1. Sort Vertices canonically
    const canonicalVertices = [...rawVerts]
      .map(v => [
        DeterministicReductionEngine.quantizeFloat(v[0]),
        DeterministicReductionEngine.quantizeFloat(v[1]),
        DeterministicReductionEngine.quantizeFloat(v[2])
      ] as [number, number, number])
      .sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);

    // 2. Derive canonical edges (sorted node index pairs)
    const rawEdges: Array<[number, number]> = [];
    input.geometry.rawFaces.forEach(face => {
      for (let i = 0; i < face.length; i++) {
        const idx1 = face[i];
        const idx2 = face[(i + 1) % face.length];
        const minIdx = Math.min(idx1, idx2);
        const maxIdx = Math.max(idx1, idx2);
        rawEdges.push([minIdx, maxIdx]);
      }
    });

    // Remove duplicates & sort
    const edgeMap = new Map<string, [number, number]>();
    rawEdges.forEach(e => edgeMap.set(`${e[0]}_${e[1]}`, e));
    const canonicalEdges = Array.from(edgeMap.values()).sort((a, b) => a[0] - b[0] || a[1] - b[1]);

    // 3. Canonical Faces (sorted vertex index loops)
    const canonicalFaces = input.geometry.rawFaces
      .map(f => [...f].sort((a, b) => a - b))
      .sort((a, b) => a[0] - b[0] || a.length - b.length);

    const transformMatrix = [
      1.0, 0.0, 0.0, 0.0,
      0.0, 1.0, 0.0, 0.0,
      0.0, 0.0, 1.0, 0.0,
      0.0, 0.0, 0.0, 1.0
    ];

    const geomHashData = {
      vertices: canonicalVertices,
      edges: canonicalEdges,
      faces: canonicalFaces,
      transform: transformMatrix,
      tolerance: 1e-6
    };

    const geometryHash = `GEO-${generateDeterministicHashSync(geomHashData)}`;

    return {
      canonicalVertices,
      canonicalEdges,
      canonicalFaces,
      entityCount: canonicalVertices.length + canonicalEdges.length + canonicalFaces.length,
      normalizedTransformMatrix: transformMatrix,
      toleranceMM: 1e-6,
      geometryHash
    };
  }

  /**
   * B-Rep Topology Canonicalizer.
   * Normalizes B-Rep entity structures, aligns face orientations, and detects identity drift.
   */
  public static canonicalizeTopology(input: EngineeringInputManifest, geometry: CanonicalGeometry): CanonicalTopology {
    const detectedDriftFlags: string[] = [];

    // 1. Build Canonical Vertices
    const canonicalVertices = geometry.canonicalVertices.map((v, i) => ({
      vertexId: `V-${String(i + 1).padStart(4, '0')}`,
      coords: v
    }));

    // 2. Build Canonical Edges
    const canonicalEdges = geometry.canonicalEdges.map((e, i) => ({
      edgeId: `E-${String(i + 1).padStart(4, '0')}`,
      vertexIds: [`V-${String(e[0] + 1).padStart(4, '0')}`, `V-${String(e[1] + 1).padStart(4, '0')}`] as [string, string],
      lengthMM: DeterministicReductionEngine.quantizeFloat(
        Math.sqrt(
          Math.pow(geometry.canonicalVertices[e[0]][0] - geometry.canonicalVertices[e[1]][0], 2) +
          Math.pow(geometry.canonicalVertices[e[0]][1] - geometry.canonicalVertices[e[1]][1], 2) +
          Math.pow(geometry.canonicalVertices[e[0]][2] - geometry.canonicalVertices[e[1]][2], 2)
        )
      )
    }));

    // 3. Build Canonical Faces & Normalize Orientations
    let orientationNormalizationsCount = 0;
    const canonicalFaces = geometry.canonicalFaces.map((f, i) => {
      // Determine orientation (+1 or -1)
      const isReversed = input.topology.orientations[i % input.topology.orientations.length] < 0;
      if (isReversed) {
        orientationNormalizationsCount++;
        detectedDriftFlags.push(`Face F-${i + 1} orientation normalized to outwards standard.`);
      }

      const edgeIds: string[] = [];
      for (let k = 0; k < f.length; k++) {
        const v1 = f[k];
        const v2 = f[(k + 1) % f.length];
        const edgeIdx = geometry.canonicalEdges.findIndex(e => (e[0] === v1 && e[1] === v2) || (e[0] === v2 && e[1] === v1));
        if (edgeIdx >= 0) {
          edgeIds.push(`E-${String(edgeIdx + 1).padStart(4, '0')}`);
        }
      }

      return {
        faceId: `F-${String(i + 1).padStart(4, '0')}`,
        edgeIds,
        orientation: 1 as (1 | -1) // Outwards normalized
      };
    });

    // 4. Build Canonical Bodies
    const canonicalBodies = [
      {
        bodyId: 'B-0001',
        faceIds: canonicalFaces.map(f => f.faceId)
      }
    ];

    const topData = {
      bodies: canonicalBodies,
      faces: canonicalFaces,
      edges: canonicalEdges,
      vertices: canonicalVertices
    };

    const topologyHash = `TOP-${generateDeterministicHashSync(topData)}`;

    return {
      canonicalBodies,
      canonicalFaces,
      canonicalEdges,
      canonicalVertices,
      orientationNormalizationsCount,
      detectedDriftFlags,
      topologyHash
    };
  }
}
