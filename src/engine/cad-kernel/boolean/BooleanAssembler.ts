/**
 * SECP CAD Kernel — Boolean Assembler & Region Selector
 * Phase 2 (PATCH-019)
 */
import { Solid, Shell, Face, OrientedFace, TopoShape, TopoShapeEnum, Orientation, Compound } from '../topology/TopologyContracts';
import { BooleanOperation, ClassificationState, GeneratedTopologyCount, BooleanDiagnostic } from './BooleanTypes';
import { SplitFaceRecord } from './BooleanSplitter';
import { BooleanClassifier } from './BooleanClassifier';
import { BooleanDiagnostics } from './BooleanDiagnostics';
import { GeometricTolerance, GeometricToleranceModel } from '../predicates/GeometricTolerance';
import { BRepHasher } from '../topology/BRepHasher';

export class BooleanAssembler {
  /**
   * Assembles the resulting TopoShape from classified face fragments.
   */
  public static assemble(
    op: BooleanOperation,
    solidA: Solid,
    solidB: Solid,
    splitFacesA: SplitFaceRecord[],
    splitFacesB: SplitFaceRecord[],
    model: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): {
    resultShape: TopoShape | null;
    generatedTopology: GeneratedTopologyCount;
    diagnostics: BooleanDiagnostic[];
  } {
    const diagnostics: BooleanDiagnostic[] = [];
    const selectedOrientedFaces: OrientedFace[] = [];

    // Classify faces of A against solid B
    for (const recA of splitFacesA) {
      const cls = BooleanClassifier.classifyFaceAgainstSolid(recA.face, solidB, model);
      if (this.shouldKeepFace(op, cls, 'A')) {
        const orientation = recA.orientation ?? Orientation.FORWARD;
        selectedOrientedFaces.push({
          face: recA.face,
          orientation
        });
      }
    }

    // Classify faces of B against solid A
    for (const recB of splitFacesB) {
      const cls = BooleanClassifier.classifyFaceAgainstSolid(recB.face, solidA, model);
      if (this.shouldKeepFace(op, cls, 'B')) {
        const baseOrient = recB.orientation ?? Orientation.FORWARD;
        // For DIFFERENCE, faces taken from B must have inverted face orientation
        const orientation = (op === 'DIFFERENCE')
          ? (baseOrient === Orientation.FORWARD ? Orientation.REVERSED : Orientation.FORWARD)
          : baseOrient;
        selectedOrientedFaces.push({
          face: recB.face,
          orientation
        });
      }
    }

    if (selectedOrientedFaces.length === 0) {
      return {
        resultShape: null,
        generatedTopology: { vertices: 0, edges: 0, faces: 0, shells: 0, solids: 0 },
        diagnostics
      };
    }

    const shells = this.partitionIntoManifoldShells(selectedOrientedFaces);

    if (shells.length === 0) {
      return {
        resultShape: null,
        generatedTopology: { vertices: 0, edges: 0, faces: 0, shells: 0, solids: 0 },
        diagnostics
      };
    }

    // Group shells into solids by containment
    const shellNesting = shells.map(s => {
      let depth = 0;
      const pTest = this.getPointOnShell(s);
      for (const other of shells) {
        if (s === other) continue;
        if (this.isPointInsideShell(pTest, other)) {
          depth++;
        }
      }
      return { shell: s, depth };
    });

    const normalizedShells = shellNesting.map(sn => {
      const vol = this.computeSignedShellVolume(sn.shell);
      const shouldBePositive = (sn.depth % 2 === 0);
      
      if ((vol > 0) !== shouldBePositive) {
        // Flip the shell
        for (const oface of sn.shell.orientedFaces) {
          oface.orientation = oface.orientation === Orientation.FORWARD ? Orientation.REVERSED : Orientation.FORWARD;
        }
      }
      return sn.shell;
    });

    // Re-calculate volumes after normalization
    const shellData = normalizedShells.map(shell => {
      return {
        shell,
        signedVol: this.computeSignedShellVolume(shell),
        isOuter: true // We'll determine this by containment in the next step
      };
    });

    // Outer shells are depth 0, 2, 4... (even)
    // But for grouping into Solids, we only want the actual outer shells (depth 0 in their respective solid hierarchy)
    const sortedShells = [...shellNesting].sort((a, b) => {
      if (a.depth !== b.depth) return a.depth - b.depth;
      // PATCH-013: Secondary sort by ID (which is now deterministic) or content hash
      return a.shell.id.localeCompare(b.shell.id);
    });
    const solids: Solid[] = [];
    const shellToSolid = new Map<string, Solid>();

    for (const sn of sortedShells) {
      if (sn.depth % 2 === 0) {
        // New Solid
        const solidId = `solid_bool_${op.toLowerCase()}_${solidA.id}_${solidB.id}_${solids.length}`;
        const newSolid: Solid = {
          id: solidId,
          shapeType: TopoShapeEnum.SOLID,
          outerShell: sn.shell,
          innerShells: []
        };
        solids.push(newSolid);
        shellToSolid.set(sn.shell.id, newSolid);
      } else {
        // Inner shell: find the parent (depth sn.depth - 1) that contains it
        const pTest = this.getPointOnShell(sn.shell);
        let parent: Solid | null = null;
        for (const potentialParent of sortedShells) {
          if (potentialParent.depth === sn.depth - 1 && this.isPointInsideShell(pTest, potentialParent.shell)) {
            parent = shellToSolid.get(potentialParent.shell.id) || null;
            if (parent) break;
          }
        }
        if (parent) {
          parent.innerShells.push(sn.shell);
          shellToSolid.set(sn.shell.id, parent);
        } else {
          // Orphan inner shell -> treat as separate solid
          const solidId = `solid_bool_${op.toLowerCase()}_${solidA.id}_${solidB.id}_${solids.length}`;
          const newSolid: Solid = {
            id: solidId,
            shapeType: TopoShapeEnum.SOLID,
            outerShell: sn.shell,
            innerShells: []
          };
          solids.push(newSolid);
          shellToSolid.set(sn.shell.id, newSolid);
        }
      }
    }

    // Localize edge IDs for each solid
    for (const solid of solids) {
      this.localizeEdgeIds(solid.outerShell, solid.id);
      solid.innerShells.forEach(sh => this.localizeEdgeIds(sh, solid.id));
    }

    const resultShape: TopoShape = solids.length === 1 ? solids[0] : {
      id: `compound_bool_${op.toLowerCase()}_${solidA.id}_${solidB.id}`,
      shapeType: TopoShapeEnum.COMPOUND,
      shapes: solids
    };

    return {
      resultShape,
      generatedTopology: this.countTopology(resultShape),
      diagnostics
    };
  }

  private static localizeEdgeIds(shell: Shell, suffix: string): void {
    for (const oface of shell.orientedFaces) {
      if (!oface.face || !oface.face.outerLoop) continue;
      const loops = [oface.face.outerLoop, ...(oface.face.innerLoops || [])];
      for (const loop of loops) {
        if (!loop.orientedEdges) continue;
        for (const oe of loop.orientedEdges) {
          if (oe.edge) {
            oe.edge.id = `${oe.edge.id}_${suffix}`;
          }
        }
      }
    }
  }

  private static computeSignedShellVolume(shell: Shell): number {
    let total = 0;
    for (const oface of shell.orientedFaces) {
      if (!oface.face) continue;
      const pts = BooleanClassifier.getLoopVertices(oface.face.outerLoop);
      if (pts.length < 3) continue;
      const p0 = pts[0];
      for (let i = 1; i < pts.length - 1; i++) {
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const det = p0.x * (p1.y * p2.z - p1.z * p2.y) -
                    p0.y * (p1.x * p2.z - p1.z * p2.x) +
                    p0.z * (p1.x * p2.y - p1.y * p2.x);
        let vol = det / 6.0;
        if (oface.orientation === Orientation.REVERSED) vol = -vol;
        total += vol;
      }
    }
    return total;
  }

  private static getPointOnShell(shell: Shell): { x: number, y: number, z: number } {
    const f = shell.orientedFaces[0].face;
    const pts = BooleanClassifier.getLoopVertices(f?.outerLoop);
    if (pts.length > 0) return pts[0];
    return { x: 0, y: 0, z: 0 };
  }

  private static isPointInsideShell(pt: { x: number, y: number, z: number }, shell: Shell): boolean {
    const rays = [
      { x: 1, y: 0.01, z: 0.02 },
      { x: -1, y: -0.01, z: -0.02 },
      { x: 0.01, y: 1, z: 0.02 },
      { x: -0.01, y: -1, z: -0.02 },
    ];
    let insideCount = 0;
    for (const ray of rays) {
      let intersections = 0;
      for (const oface of shell.orientedFaces) {
        if (!oface.face) continue;
        if (BooleanClassifier.rayIntersectsFace(pt, ray, oface.face)) {
          intersections++;
        }
      }
      if (intersections % 2 === 1) insideCount++;
    }
    return insideCount > rays.length / 2;
  }

  /**
   * Partitions oriented faces into closed 2-manifold shells with consistent orientation propagation.
   */
  private static partitionIntoManifoldShells(selectedOrientedFaces: OrientedFace[]): Shell[] {
    if (selectedOrientedFaces.length === 0) return [];

    // PATCH-013: Sort faces deterministically before partitioning to ensure stable shell indexing
    selectedOrientedFaces.sort((a, b) => {
      const hashA = BRepHasher.computeFaceHash(a.face);
      const hashB = BRepHasher.computeFaceHash(b.face);
      return hashA.localeCompare(hashB);
    });

    const faceRecords = selectedOrientedFaces.map((of, index) => ({ 
      oface: of, 
      index, 
      visited: false,
      edgeIds: new Set(of.face?.outerLoop?.orientedEdges.map(oe => oe.edge?.id).filter(Boolean) as string[])
    }));

    const shells: Shell[] = [];
    let shellIndex = 0;

    for (let i = 0; i < faceRecords.length; i++) {
      if (faceRecords[i].visited) continue;

      const shellFaces: OrientedFace[] = [];
      const queue: { idx: number; parentEffectiveOrientation: Orientation | null; sharedEdgeId: string | null }[] = [
        { idx: i, parentEffectiveOrientation: null, sharedEdgeId: null }
      ];
      faceRecords[i].visited = true;

      const compEdgeCounts = new Map<string, number>();

      while (queue.length > 0) {
        const { idx: currIdx, parentEffectiveOrientation, sharedEdgeId } = queue.shift()!;
        const currRec = faceRecords[currIdx];

        // If we arrived from a neighbor, align orientation relative to the edge traversal
        if (sharedEdgeId && parentEffectiveOrientation !== null) {
          this.alignToNeighbor(currRec.oface, sharedEdgeId, parentEffectiveOrientation);
        }

        shellFaces.push(currRec.oface);

        // Track edge usage
        for (const eid of currRec.edgeIds) {
          compEdgeCounts.set(eid, (compEdgeCounts.get(eid) || 0) + 1);
        }

        // Find neighbors
        for (let j = 0; j < faceRecords.length; j++) {
          const neighborRec = faceRecords[j];
          if (neighborRec.visited) continue;

          let edgeToShare: string | null = null;
          for (const eid of currRec.edgeIds) {
            if (neighborRec.edgeIds.has(eid)) {
              // Manifold constraint: edge used by exactly 2 faces in a shell
              if ((compEdgeCounts.get(eid) || 0) < 2) {
                edgeToShare = eid;
                break;
              }
            }
          }

          if (edgeToShare) {
            neighborRec.visited = true;
            // Capture current face's traversal orientation for this edge to propagate to neighbor
            const effective = this.getEffectiveEdgeOrientation(currRec.oface, edgeToShare);
            queue.push({ idx: j, parentEffectiveOrientation: effective, sharedEdgeId: edgeToShare });
          }
        }
      }

      // Final Manifold Audit for this shell
      const isManifold = this.validateShellManifold(shellFaces, compEdgeCounts);
      
      if (isManifold) {
        shells.push({
          id: `shell_comp_${shellIndex++}`,
          shapeType: TopoShapeEnum.SHELL,
          orientedFaces: shellFaces
        });
      }
    }

    return shells;
  }

  private static getEffectiveEdgeOrientation(oface: OrientedFace, edgeId: string): Orientation {
    if (!oface.face?.outerLoop) return Orientation.FORWARD;
    const oe = oface.face.outerLoop.orientedEdges.find(e => e.edge?.id === edgeId);
    if (!oe) return Orientation.FORWARD;

    if (oface.orientation === Orientation.FORWARD) return oe.orientation;
    return oe.orientation === Orientation.FORWARD ? Orientation.REVERSED : Orientation.FORWARD;
  }

  private static alignToNeighbor(oface: OrientedFace, edgeId: string, parentEffective: Orientation) {
    const currentEffective = this.getEffectiveEdgeOrientation(oface, edgeId);
    
    // Manifold rule: Shared edge must be traversed in opposite directions
    if (currentEffective === parentEffective) {
      oface.orientation = (oface.orientation === Orientation.FORWARD ? Orientation.REVERSED : Orientation.FORWARD);
    }
  }

  private static validateShellManifold(faces: OrientedFace[], edgeCounts: Map<string, number>): boolean {
    // 1. Edge Use Count Invariant (Euler: every edge shared by 2 faces)
    for (const count of edgeCounts.values()) {
      if (count !== 2) return false; 
    }

    // 2. Connectivity Check (all faces in shell must be reachable)
    // (Implicitly handled by queue-based partitioning)

    return true;
  }

  /**
   * Handles special topological relationships (Disjoint, Fully Contained, Coincident).
   */
  public static handleSpecialRelationships(
    op: BooleanOperation,
    solidA: Solid,
    solidB: Solid,
    relationship: 'DISJOINT' | 'A_CONTAINS_B' | 'B_CONTAINS_A' | 'COINCIDENT'
  ): {
    resultShape: TopoShape | null;
    generatedTopology: GeneratedTopologyCount;
    diagnostics: BooleanDiagnostic[];
  } {
    const diagnostics: BooleanDiagnostic[] = [];

    if (relationship === 'DISJOINT') {
      if (op === 'UNION') {
        // Disjoint union produces a compound or solid with multiple outer shell faces
        const combinedFaces: OrientedFace[] = [
          ...solidA.outerShell.orientedFaces,
          ...solidB.outerShell.orientedFaces
        ];
        const combinedShell: Shell = {
          id: `shell_disjoint_union_${solidA.id}_${solidB.id}`,
          shapeType: TopoShapeEnum.SHELL,
          orientedFaces: combinedFaces
        };
        const combinedSolid: Solid = {
          id: `solid_disjoint_union_${solidA.id}_${solidB.id}`,
          shapeType: TopoShapeEnum.SOLID,
          outerShell: combinedShell,
          innerShells: []
        };
        return {
          resultShape: combinedSolid,
          generatedTopology: this.countTopology(combinedSolid),
          diagnostics
        };
      } else if (op === 'INTERSECTION') {
        // Disjoint intersection produces EMPTY_RESULT
        return {
          resultShape: null,
          generatedTopology: { vertices: 0, edges: 0, faces: 0, shells: 0, solids: 0 },
          diagnostics
        };
      } else if (op === 'DIFFERENCE') {
        // Disjoint difference produces A unchanged
        return {
          resultShape: solidA,
          generatedTopology: this.countTopology(solidA),
          diagnostics
        };
      }
    }

    if (relationship === 'COINCIDENT') {
      diagnostics.push(BooleanDiagnostics.coincidentSolids(solidA.id, solidB.id));
      if (op === 'UNION' || op === 'INTERSECTION') {
        return {
          resultShape: solidA,
          generatedTopology: this.countTopology(solidA),
          diagnostics
        };
      } else if (op === 'DIFFERENCE') {
        return {
          resultShape: null,
          generatedTopology: { vertices: 0, edges: 0, faces: 0, shells: 0, solids: 0 },
          diagnostics
        };
      }
    }

    if (relationship === 'A_CONTAINS_B') {
      if (op === 'UNION') {
        return {
          resultShape: solidA,
          generatedTopology: this.countTopology(solidA),
          diagnostics
        };
      } else if (op === 'INTERSECTION') {
        return {
          resultShape: solidB,
          generatedTopology: this.countTopology(solidB),
          diagnostics
        };
      } else if (op === 'DIFFERENCE') {
        // A with B subtracted produces a solid with B's outer shell as an inner shell (cavity)
        const innerShellB: Shell = {
          id: `inner_shell_${solidB.id}`,
          shapeType: TopoShapeEnum.SHELL,
          orientedFaces: solidB.outerShell.orientedFaces.map(of => ({
            face: of.face,
            orientation: of.orientation === Orientation.FORWARD ? Orientation.REVERSED : Orientation.FORWARD
          }))
        };
        const hollowSolid: Solid = {
          id: `solid_cavity_${solidA.id}_sub_${solidB.id}`,
          shapeType: TopoShapeEnum.SOLID,
          outerShell: solidA.outerShell,
          innerShells: [innerShellB]
        };
        return {
          resultShape: hollowSolid,
          generatedTopology: this.countTopology(hollowSolid),
          diagnostics
        };
      }
    }

    if (relationship === 'B_CONTAINS_A') {
      if (op === 'UNION') {
        return {
          resultShape: solidB,
          generatedTopology: this.countTopology(solidB),
          diagnostics
        };
      } else if (op === 'INTERSECTION') {
        return {
          resultShape: solidA,
          generatedTopology: this.countTopology(solidA),
          diagnostics
        };
      } else if (op === 'DIFFERENCE') {
        return {
          resultShape: null,
          generatedTopology: { vertices: 0, edges: 0, faces: 0, shells: 0, solids: 0 },
          diagnostics
        };
      }
    }

    return {
      resultShape: null,
      generatedTopology: { vertices: 0, edges: 0, faces: 0, shells: 0, solids: 0 },
      diagnostics
    };
  }

  private static shouldKeepFace(
    op: BooleanOperation,
    classification: ClassificationState,
    sourceOperand: 'A' | 'B'
  ): boolean {
    if (classification === 'AMBIGUOUS') {
      return false;
    }

    if (op === 'UNION') {
      // Keep faces outside the other solid
      // For same-orientation coincident faces, keep from A only
      // For opposite-orientation coincident faces (internal walls), remove both
      if (classification === 'OUTSIDE') return true;
      if (classification === 'COINCIDENT_SAME' || classification === 'ON_BOUNDARY') return sourceOperand === 'A';
      if (classification === 'COINCIDENT_OPPOSITE') return false;
      return false;
    } else if (op === 'INTERSECTION') {
      // Keep faces inside the other solid
      // For same-orientation coincident faces, keep from A only
      // For opposite-orientation coincident faces, remove both
      if (classification === 'INSIDE') return true;
      if (classification === 'COINCIDENT_SAME' || classification === 'ON_BOUNDARY') return sourceOperand === 'A';
      if (classification === 'COINCIDENT_OPPOSITE') return false;
      return false;
    } else if (op === 'DIFFERENCE') {
      if (sourceOperand === 'A') {
        // Keep faces of A outside B, or faces of A facing away from B (COINCIDENT_OPPOSITE)
        if (classification === 'OUTSIDE' || classification === 'COINCIDENT_OPPOSITE') return true;
        return false;
      } else {
        // Keep faces of B inside A (with inverted orientation)
        if (classification === 'INSIDE') return true;
        return false;
      }
    }

    return false;
  }

  private static countTopology(shape: TopoShape): GeneratedTopologyCount {
    const vertices = new Set<string>();
    const edges = new Set<string>();
    const faces = new Set<string>();
    const shells = new Set<string>();
    let solidCount = 0;

    const processShell = (sh: Shell) => {
      shells.add(sh.id);
      for (const oface of sh.orientedFaces) {
        if (!oface.face) continue;
        faces.add(oface.face.id);
        if (oface.face.outerLoop && oface.face.outerLoop.orientedEdges) {
          for (const oe of oface.face.outerLoop.orientedEdges) {
            if (oe.edge) {
              edges.add(oe.edge.id);
              if (oe.edge.startVertex) vertices.add(oe.edge.startVertex.id);
              if (oe.edge.endVertex) vertices.add(oe.edge.endVertex.id);
            }
          }
        }
      }
    };

    const processSolid = (solid: Solid) => {
      solidCount++;
      if (solid.outerShell) processShell(solid.outerShell);
      for (const inner of solid.innerShells || []) {
        processShell(inner);
      }
    };

    if (shape.shapeType === TopoShapeEnum.SOLID) {
      processSolid(shape as Solid);
    } else if (shape.shapeType === TopoShapeEnum.COMPOUND) {
      for (const child of (shape as Compound).shapes || []) {
        if (child.shapeType === TopoShapeEnum.SOLID) {
          processSolid(child as Solid);
        }
      }
    }

    return {
      vertices: vertices.size,
      edges: edges.size,
      faces: faces.size,
      shells: shells.size,
      solids: solidCount
    };
  }
}
