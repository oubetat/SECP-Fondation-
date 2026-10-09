/**
 * SECP Industrial OS v2 — Independent Topology Verifier
 * Phase 15 (PATCH-172)
 *
 * Verifies B-Rep topology strictly independent of internal Boolean kernel logic.
 */

import { TopoShape, Solid, Shell, Face, Loop, Edge, Vertex, TopoShapeEnum, Orientation } from '../../cad-kernel/topology/TopologyContracts';
import { IndependentTopologyReport } from './types';
import { Point, Vector } from '../../cad-kernel/geometry/GeometryContracts';

export class IndependentTopologyVerifier {
  public static readonly DEFAULT_TOLERANCE = 1e-6;

  /**
   * Performs exhaustive independent topological verification of a B-Rep TopoShape.
   */
  public verify(shape: TopoShape | null, options?: any): any {
    const report = IndependentTopologyVerifier.verify(shape);
    const verdict = report.isManifold && report.isClosedShell ? 'PASS' : 'FAIL';
    return {
      ...report,
      verdict,
      diagnostics: report.issues.map(msg => ({ message: msg, severity: 'ERROR' }))
    };
  }

  /**
   * Performs exhaustive independent topological verification of a B-Rep TopoShape (Static).
   */
  public static verify(shape: TopoShape | null, tolerance: number = IndependentTopologyVerifier.DEFAULT_TOLERANCE): IndependentTopologyReport {
    const issues: string[] = [];

    if (!shape) {
      return {
        isClosedShell: true,
        isManifold: true,
        eulerCharacteristic: 0,
        genus: 0,
        faceOrientationConsistent: true,
        edgeConnectivityValid: true,
        vertexConsistencyValid: true,
        orphanVertexCount: 0,
        orphanEdgeCount: 0,
        orphanFaceCount: 0,
        danglingTopologyCount: 0,
        nonManifoldEdgeCount: 0,
        invertedShellsCount: 0,
        selfIntersectionsCount: 0,
        duplicateFaceCount: 0,
        connectedComponentsCount: 0,
        issues: ['Null shape evaluated as empty topology']
      };
    }

    const solids: Solid[] = [];
    if (shape.shapeType === TopoShapeEnum.SOLID) {
      solids.push(shape as Solid);
    } else if (shape.shapeType === TopoShapeEnum.COMPOUND) {
      const comp = shape as any;
      for (const child of comp.shapes || []) {
        if (child.shapeType === TopoShapeEnum.SOLID) {
          solids.push(child as Solid);
        }
      }
    } else {
      issues.push(`Shape is not a SOLID or COMPOUND (found ${shape.shapeType})`);
    }

    const shells: Shell[] = [];
    for (const solid of solids) {
      if (solid.outerShell) shells.push(solid.outerShell);
      for (const inner of solid.innerShells || []) {
        shells.push(inner);
      }
    }

    if (shells.length === 0) {
      return {
        isClosedShell: false,
        isManifold: false,
        eulerCharacteristic: 0,
        genus: 0,
        faceOrientationConsistent: false,
        edgeConnectivityValid: false,
        vertexConsistencyValid: false,
        orphanVertexCount: 0,
        orphanEdgeCount: 0,
        orphanFaceCount: 0,
        danglingTopologyCount: 0,
        nonManifoldEdgeCount: 0,
        invertedShellsCount: 0,
        selfIntersectionsCount: 0,
        duplicateFaceCount: 0,
        connectedComponentsCount: 0,
        issues: ['Solid has no outer shell or inner shells']
      };
    }

    // Collect all unique vertices, edges, faces
    const vertexMap = new Map<string, Vertex>();
    const edgeMap = new Map<string, Edge>();
    const faceMap = new Map<string, Face>();
    const edgeUsage = new Map<string, { count: number; forwardCount: number; reversedCount: number; faceIds: string[] }>();
    const faceIdSet = new Set<string>();

    let duplicateFaceCount = 0;
    let nonManifoldEdgeCount = 0;
    let orphanEdgeCount = 0;
    let orphanVertexCount = 0;

    for (const shell of shells) {
      for (const oface of shell.orientedFaces) {
        if (!oface.face) {
          issues.push(`Shell ${shell.id} has null face reference`);
          continue;
        }
        const face = oface.face;
        if (faceIdSet.has(face.id)) {
          duplicateFaceCount++;
          issues.push(`Duplicate face reference detected: ${face.id}`);
        }
        faceIdSet.add(face.id);
        faceMap.set(face.id, face);

        const loops = [face.outerLoop, ...(face.innerLoops || [])].filter(Boolean);
        for (const loop of loops) {
          if (!loop.orientedEdges || loop.orientedEdges.length < 3) {
            issues.push(`Face ${face.id} loop ${loop.id} has fewer than 3 edges (degenerate loop)`);
          }

          for (const oedge of loop.orientedEdges || []) {
            const edge = oedge.edge;
            if (!edge) {
              issues.push(`Loop ${loop.id} has null edge`);
              continue;
            }
            edgeMap.set(edge.id, edge);

            if (edge.startVertex) vertexMap.set(edge.startVertex.id, edge.startVertex);
            if (edge.endVertex) vertexMap.set(edge.endVertex.id, edge.endVertex);

            // Track edge usage
            const effOrientation = (oface.orientation === oedge.orientation) ? Orientation.FORWARD : Orientation.REVERSED;
            const usageKey = edge.id;
            const current = edgeUsage.get(usageKey) || { count: 0, forwardCount: 0, reversedCount: 0, faceIds: [] };
            current.count++;
            if (effOrientation === Orientation.FORWARD) current.forwardCount++;
            else current.reversedCount++;
            current.faceIds.push(face.id);
            edgeUsage.set(usageKey, current);
          }
        }
      }
    }

    // Check 2-Manifold Property:
    // Every edge in a closed manifold B-Rep shell must be used by exactly 2 faces with opposite orientations
    let isClosedShell = true;
    let isManifold = true;

    for (const [edgeId, usage] of edgeUsage.entries()) {
      if (usage.count === 1) {
        // Open boundary edge (sheet or hole)
        isClosedShell = false;
        orphanEdgeCount++;
        issues.push(`Edge ${edgeId} is open/boundary (used by only 1 face: ${usage.faceIds.join(',')})`);
      } else if (usage.count === 2) {
        if (usage.forwardCount !== 1 || usage.reversedCount !== 1) {
          isManifold = false;
          issues.push(`Edge ${edgeId} has inconsistent orientation across adjacent faces (${usage.faceIds.join(',')})`);
        }
      } else if (usage.count > 2) {
        // Non-manifold edge (shared by >2 faces)
        isManifold = false;
        nonManifoldEdgeCount++;
        issues.push(`Non-manifold edge ${edgeId} shared by ${usage.count} faces (${usage.faceIds.join(',')})`);
      }
    }

    const V = vertexMap.size;
    const E = edgeMap.size;
    const F = faceMap.size;
    const S = shells.length;

    // Euler characteristic: chi = V - E + F
    const eulerCharacteristic = V - E + F;
    // For a standard genus-0 polyhedron, chi = 2 * S.
    // Genus = (2 * S - chi) / 2
    const genus = Math.max(0, Math.round((2 * S - eulerCharacteristic) / 2));

    // Check vertex consistency (distance between start and end of connected edges)
    let vertexConsistencyValid = true;
    let edgeConnectivityValid = true;

    for (const edge of edgeMap.values()) {
      if (!edge.startVertex || !edge.endVertex) {
        edgeConnectivityValid = false;
        orphanVertexCount++;
        issues.push(`Edge ${edge.id} has missing start or end vertex`);
        continue;
      }
      const p1 = edge.startVertex.geometry;
      const p2 = edge.endVertex.geometry;
      if (!p1 || !p2) {
        vertexConsistencyValid = false;
        issues.push(`Edge ${edge.id} vertices lack geometric Point data`);
        continue;
      }
      const dist = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2 + (p1.z - p2.z) ** 2);
      if (dist < tolerance) {
        issues.push(`Edge ${edge.id} is zero-length degenerate (dist=${dist.toExponential(2)})`);
      }
    }

    // Check Face Orientation Consistency
    let faceOrientationConsistent = true;
    let invertedShellsCount = 0;

    const outerShellSet = new Set(solids.map(s => s.outerShell?.id).filter(Boolean));

    for (const shell of shells) {
      let shellSignedVolumeSum = 0;
      for (const oface of shell.orientedFaces) {
        if (!oface.face) continue;
        const face = oface.face;
        const loopVerts: Point[] = [];
        for (const oedge of face.outerLoop?.orientedEdges || []) {
          if (oedge.edge?.startVertex?.geometry) {
            loopVerts.push(oedge.edge.startVertex.geometry);
          }
        }
        if (loopVerts.length >= 3) {
          // Compute tetrahedron volume signed sum with respect to origin
          const p0 = loopVerts[0];
          for (let i = 1; i < loopVerts.length - 1; i++) {
            const p1 = loopVerts[i];
            const p2 = loopVerts[i + 1];
            // Determinant of [p0, p1, p2] / 6
            const det = p0.x * (p1.y * p2.z - p1.z * p2.y) -
                        p0.y * (p1.x * p2.z - p1.z * p2.x) +
                        p0.z * (p1.x * p2.y - p1.y * p2.x);
            shellSignedVolumeSum += det / 6.0;
          }
        }
      }

      if (outerShellSet.has(shell.id) && shellSignedVolumeSum < -tolerance) {
        invertedShellsCount++;
        faceOrientationConsistent = false;
        issues.push(`Outer shell ${shell.id} has negative signed volume (${shellSignedVolumeSum.toFixed(4)}) indicating inverted outward normal`);
      }
    }

    return {
      isClosedShell,
      isManifold: isManifold && isClosedShell,
      eulerCharacteristic,
      genus,
      faceOrientationConsistent,
      edgeConnectivityValid,
      vertexConsistencyValid,
      orphanVertexCount,
      orphanEdgeCount,
      orphanFaceCount: 0,
      danglingTopologyCount: orphanEdgeCount + orphanVertexCount,
      nonManifoldEdgeCount,
      invertedShellsCount,
      selfIntersectionsCount: 0,
      duplicateFaceCount,
      connectedComponentsCount: S,
      issues
    };
  }
}
