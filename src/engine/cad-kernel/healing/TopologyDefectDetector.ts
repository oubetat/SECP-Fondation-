/**
 * SECP CAD Kernel — Topology Defect Detector
 * Phase 2 (PATCH-020)
 */

import {
  Solid, Shell, Face, Loop, Edge, Vertex, OrientedEdge, OrientedFace, TopoShapeEnum, Orientation
} from '../topology/TopologyContracts';
import { HealingDefect } from './HealingTypes';
import { HealingDiagnostics } from './HealingDiagnostics';
import { ToleranceHealing } from './ToleranceHealing';
import { GeometricTolerance, GeometricToleranceModel } from '../predicates/GeometricTolerance';

export class TopologyDefectDetector {
  public static detectDefects(
    shape: any,
    model: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): HealingDefect[] {
    HealingDiagnostics.resetCounter();
    const defects: HealingDefect[] = [];

    if (!shape || typeof shape !== 'object') {
      defects.push(
        HealingDiagnostics.createDefect(
          'INVALID_CONTAINMENT',
          'CRITICAL',
          ['root'],
          'Input shape is null or invalid object',
          'UNSUPPORTED'
        )
      );
      return defects;
    }

    if (shape.shapeType === TopoShapeEnum.SOLID || shape.shapeType === 'SOLID') {
      this.detectSolidDefects(shape as Solid, defects, model);
    } else if (shape.shapeType === TopoShapeEnum.SHELL || shape.shapeType === 'SHELL') {
      this.detectShellDefects(shape as Shell, defects, model);
    } else if (shape.shapeType === TopoShapeEnum.FACE || shape.shapeType === 'FACE') {
      this.detectFaceDefects(shape as Face, defects, model);
    }

    if (defects.length > 0) {
      // Defects detected - processing internal register
    }

    return defects;
  }

  private static detectSolidDefects(
    solid: Solid,
    defects: HealingDefect[],
    model: GeometricToleranceModel
  ): void {
    if (!solid.outerShell) {
      defects.push(
        HealingDiagnostics.createDefect(
          'OPEN_SOLID',
          'CRITICAL',
          [solid.id],
          `Solid ${solid.id} has no outer shell`,
          'UNSAFE'
        )
      );
      return;
    }

    this.detectShellDefects(solid.outerShell, defects, model);

    if (solid.innerShells) {
      for (const inner of solid.innerShells) {
        this.detectShellDefects(inner, defects, model);
      }
    }
  }

  public static detectShellDefects(
    shell: Shell,
    defects: HealingDefect[],
    model: GeometricToleranceModel
  ): void {
    if (!shell.orientedFaces || shell.orientedFaces.length === 0) {
      defects.push(
        HealingDiagnostics.createDefect(
          'OPEN_SHELL',
          'ERROR',
          [shell.id],
          `Shell ${shell.id} contains no faces`,
          'UNSAFE'
        )
      );
      return;
    }

    // Edge usage map to detect free edges and non-manifold edges
    const edgeUsage = new Map<string, { edge: Edge; faces: string[] }>();
    const facesInShell: Face[] = [];

    for (const of of shell.orientedFaces) {
      if (!of.face) continue;
      facesInShell.push(of.face);
      this.detectFaceDefects(of.face, defects, model);

      if (of.face.outerLoop && of.face.outerLoop.orientedEdges) {
        for (const oe of of.face.outerLoop.orientedEdges) {
          if (!oe.edge) continue;
          const e = oe.edge;
          if (!edgeUsage.has(e.id)) {
            edgeUsage.set(e.id, { edge: e, faces: [] });
          }
          edgeUsage.get(e.id)!.faces.push(of.face.id);
        }
      }
    }

    // Check free edges and non-manifold edges
    let freeEdgeCount = 0;
    for (const [eId, usage] of edgeUsage.entries()) {
      if (usage.faces.length === 1) {
        freeEdgeCount++;
      } else if (usage.faces.length > 2) {
        defects.push(HealingDiagnostics.nonManifoldShell(shell.id, eId, usage.faces.length));
      }
    }

    if (freeEdgeCount > 0) {
      defects.push(HealingDiagnostics.openShell(shell.id, freeEdgeCount));
    }

    this.detectOrientationDefects(shell, edgeUsage, defects);
  }

  private static detectOrientationDefects(
    shell: Shell,
    edgeUsage: Map<string, { edge: Edge; faces: string[] }>,
    defects: HealingDefect[]
  ): void {
    // For a manifold closed shell, each edge must be used twice in opposite directions.
    // If an edge is used twice in the SAME direction by two faces, one face is reversed.
    const orientedUsage = new Map<string, { faceId: string; orientation: number }[]>();

    for (const of of shell.orientedFaces) {
      if (!of.face.outerLoop) continue;
      const faceOrientation = (of.orientation === Orientation.REVERSED || of.orientation === -1) ? -1 : 1;
      for (const oe of of.face.outerLoop.orientedEdges) {
        const edgeOrientation = (oe.orientation === Orientation.REVERSED || oe.orientation === -1) ? -1 : 1;
        const key = oe.edge.id;
        if (!orientedUsage.has(key)) orientedUsage.set(key, []);
        orientedUsage.get(key)!.push({ faceId: of.face.id, orientation: faceOrientation * edgeOrientation });
      }
    }

    for (const [eId, usages] of orientedUsage.entries()) {
      if (usages.length === 2) {
        if (usages[0].orientation === usages[1].orientation) {
          defects.push(
            HealingDiagnostics.createDefect(
              'FACE_ORIENTATION_CONFLICT',
              'WARNING',
              [usages[0].faceId, usages[1].faceId],
              `Edge ${eId} is used with the same orientation by two adjacent faces. Shell normal field is inconsistent.`,
              'SAFE'
            )
          );
        }
      }
    }
  }

  public static detectFaceDefects(
    face: Face,
    defects: HealingDefect[],
    model: GeometricToleranceModel
  ): void {
    if (!face.outerLoop) {
      defects.push(
        HealingDiagnostics.createDefect(
          'INVALID_FACE_BOUNDARY',
          'ERROR',
          [face.id],
          `Face ${face.id} missing outer loop`,
          'UNSAFE'
        )
      );
      return;
    }

    this.detectLoopDefects(face.outerLoop, face.id, defects, model);

    if (face.innerLoops) {
      for (const inner of face.innerLoops) {
        this.detectLoopDefects(inner, face.id, defects, model);
      }
    }
  }

  public static detectLoopDefects(
    loop: Loop,
    faceId: string,
    defects: HealingDefect[],
    model: GeometricToleranceModel
  ): void {
    if (!loop.orientedEdges || loop.orientedEdges.length === 0) {
      defects.push(
        HealingDiagnostics.createDefect(
          'OPEN_WIRE',
          'ERROR',
          [loop.id],
          `Loop ${loop.id} has no edges`,
          'UNSAFE'
        )
      );
      return;
    }

    const vertices: Vertex[] = [];
    const edges: Edge[] = [];

    for (let i = 0; i < loop.orientedEdges.length; i++) {
      const oe = loop.orientedEdges[i];
      if (!oe.edge) continue;
      edges.push(oe.edge);

      this.detectEdgeDefects(oe.edge, defects, model);

      const next = loop.orientedEdges[(i + 1) % loop.orientedEdges.length];
      if (next && next.edge) {
        const vEnd = oe.orientation === 'FORWARD' ? oe.edge.endVertex : oe.edge.startVertex;
        const vStartNext = next.orientation === 'FORWARD' ? next.edge.startVertex : next.edge.endVertex;

        if (vEnd && vStartNext) {
          if (vEnd.id !== vStartNext.id) {
            const dist = ToleranceHealing.distance(vEnd.geometry, vStartNext.geometry);
            if (dist > model.absoluteLength) {
              defects.push(HealingDiagnostics.openWire(loop.id, dist, model.absoluteLength));
            } else {
              // Topological gap: vertices at same location but different IDs
              defects.push(HealingDiagnostics.duplicateVertex(vEnd.id, vStartNext.id, dist, model.absoluteLength));
            }
          }
        }
      }
    }

    // Check duplicate or near duplicate vertices within the loop
    for (let i = 0; i < edges.length; i++) {
      for (let j = i + 1; j < edges.length; j++) {
        const v1 = edges[i].startVertex;
        const v2 = edges[j].startVertex;
        if (v1 && v2 && v1.id !== v2.id) {
          const dist = ToleranceHealing.distance(v1.geometry, v2.geometry);
          if (dist <= model.absoluteLength * 10) {
            defects.push(HealingDiagnostics.duplicateVertex(v1.id, v2.id, dist, model.absoluteLength));
          }
        }
      }
    }
  }

  public static detectEdgeDefects(
    edge: Edge,
    defects: HealingDefect[],
    model: GeometricToleranceModel
  ): void {
    if (!edge.startVertex || !edge.endVertex) {
      defects.push(
        HealingDiagnostics.createDefect(
          'INVALID_EDGE_CURVE',
          'ERROR',
          [edge.id],
          `Edge ${edge.id} missing start or end vertex`,
          'SAFE'
        )
      );
      return;
    }

    const len = ToleranceHealing.distance(edge.startVertex.geometry, edge.endVertex.geometry);
    if (len <= model.absoluteLength) {
      defects.push(HealingDiagnostics.zeroLengthEdge(edge.id, len, model.absoluteLength));
    }
  }
}
