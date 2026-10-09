/**
 * SECP CAD Kernel — Independent Phase 1 Red-Team Adversarial Test Suite
 * 
 * Capability: CAP-SUP-001 (B-Rep Topological Fillet)
 * 
 * Strict Red-Team Contract:
 * - Assume CAP-SUP-001 is NOT PROVEN until all independent attacks pass.
 * - Do not trust self-verifying implementation claims.
 * - Perform independent topological recomputation, entity identity audits,
 *   vertex star neighborhood analysis, geometric reality tests, adversarial radii,
 *   and 8-point mutation resistance verification.
 */

import { describe, it, expect } from 'vitest';
import { CanonicalBRepFixtures } from '../CanonicalBRepFixtures';
import { BRepEulerOps } from '../BRepEulerOps';
import { 
  BRepSolid, 
  BRepShell, 
  BRepFace, 
  BRepLoop, 
  BRepEdge, 
  BRepVertex 
} from '../../topology/BRepTopology';
import { 
  BRepPoint, 
  BRepLine, 
  BRepPlane, 
  BRepCylinder 
} from '../../geometry/BRepGeometry';
import { Orientation } from '../../topology/TopologyContracts';
import { IndependentBRepValidator } from '../IndependentBRepValidator';

/**
 * Completely independent topological analyzer built strictly inside Red-Team
 */
class RedTeamTopologicalAnalyzer {
  public static analyze(solid: BRepSolid) {
    const vertexMap = new Map<string, BRepVertex>();
    const edgeMap = new Map<string, BRepEdge>();
    const faceMap = new Map<string, BRepFace>();
    const edgeToFaces = new Map<string, Set<string>>();
    const vertexToEdges = new Map<string, Set<string>>();
    const vertexToFaces = new Map<string, Set<string>>();
    const loopDiscontinuities: string[] = [];

    // Collect all faces
    for (const of of solid.outerShell.orientedFaces) {
      const face = of.face as BRepFace;
      faceMap.set(face.id, face);

      const allLoops = [face.outerLoop, ...face.innerLoops];
      for (const loop of allLoops) {
        for (let i = 0; i < loop.orientedEdges.length; i++) {
          const oe = loop.orientedEdges[i];
          const edge = oe.edge as BRepEdge;
          edgeMap.set(edge.id, edge);

          if (!edgeToFaces.has(edge.id)) edgeToFaces.set(edge.id, new Set());
          edgeToFaces.get(edge.id)!.add(face.id);

          const sV = edge.startVertex as BRepVertex;
          const eV = edge.endVertex as BRepVertex;
          if (sV) {
            vertexMap.set(sV.id, sV);
            if (!vertexToEdges.has(sV.id)) vertexToEdges.set(sV.id, new Set());
            vertexToEdges.get(sV.id)!.add(edge.id);
            if (!vertexToFaces.has(sV.id)) vertexToFaces.set(sV.id, new Set());
            vertexToFaces.get(sV.id)!.add(face.id);
          }
          if (eV) {
            vertexMap.set(eV.id, eV);
            if (!vertexToEdges.has(eV.id)) vertexToEdges.set(eV.id, new Set());
            vertexToEdges.get(eV.id)!.add(edge.id);
            if (!vertexToFaces.has(eV.id)) vertexToFaces.set(eV.id, new Set());
            vertexToFaces.get(eV.id)!.add(face.id);
          }

          // Loop continuity check
          const nextOe = loop.orientedEdges[(i + 1) % loop.orientedEdges.length];
          const curEnd = oe.orientation === Orientation.FORWARD ? oe.edge.endVertex : oe.edge.startVertex;
          const nextStart = nextOe.orientation === Orientation.FORWARD ? nextOe.edge.startVertex : nextOe.edge.endVertex;

          if (!curEnd || !nextStart || curEnd.id !== nextStart.id) {
            loopDiscontinuities.push(`Discontinuity in ${loop.id}: edge ${oe.edge.id} end (${curEnd?.id}) != edge ${nextOe.edge.id} start (${nextStart?.id})`);
          }
        }
      }
    }

    const boundaryEdges: string[] = [];
    const nonManifoldEdges: string[] = [];
    for (const [eId, fSet] of edgeToFaces) {
      if (fSet.size === 1) boundaryEdges.push(eId);
      if (fSet.size > 2) nonManifoldEdges.push(eId);
    }

    const V = vertexMap.size;
    const E = edgeMap.size;
    const F = faceMap.size;
    const chi = V - E + F;

    // Connected components via edge-adjacency
    const visitedVertices = new Set<string>();
    let connectedComponents = 0;
    for (const vId of vertexMap.keys()) {
      if (!visitedVertices.has(vId)) {
        connectedComponents++;
        const queue = [vId];
        visitedVertices.add(vId);
        while (queue.length > 0) {
          const curr = queue.shift()!;
          const incEdges = vertexToEdges.get(curr) || new Set();
          for (const eId of incEdges) {
            const e = edgeMap.get(eId)!;
            const neighborId = e.startVertex?.id === curr ? e.endVertex?.id : e.startVertex?.id;
            if (neighborId && !visitedVertices.has(neighborId)) {
              visitedVertices.add(neighborId);
              queue.push(neighborId);
            }
          }
        }
      }
    }

    return {
      V,
      E,
      F,
      chi,
      boundaryEdges,
      nonManifoldEdges,
      connectedComponents,
      loopDiscontinuities,
      vertexMap,
      edgeMap,
      faceMap,
      edgeToFaces,
      vertexToEdges,
      vertexToFaces,
      isManifold: boundaryEdges.length === 0 && nonManifoldEdges.length === 0,
      isClosed: boundaryEdges.length === 0
    };
  }
}

describe('SECP Phase 1 Red-Team — CAP-SUP-001 (B-Rep Fillet)', () => {

  // A1 — Canonical baseline
  it('A1: Independently verify canonical cube baseline topology and invariants', () => {
    const cube = CanonicalBRepFixtures.createCube();
    const a = RedTeamTopologicalAnalyzer.analyze(cube);

    expect(a.V).toBe(8);
    expect(a.E).toBe(12);
    expect(a.F).toBe(6);
    expect(a.chi).toBe(2);
    expect(a.boundaryEdges.length).toBe(0);
    expect(a.nonManifoldEdges.length).toBe(0);
    expect(a.connectedComponents).toBe(1);
    expect(a.loopDiscontinuities.length).toBe(0);
    expect(a.isClosed).toBe(true);
    expect(a.isManifold).toBe(true);
  });

  // A2 — Positive-radius fillet
  it('A2: Execute positive-radius fillet and independently recompute all invariants', () => {
    const cube = CanonicalBRepFixtures.createCube();
    const filletRes = BRepEulerOps.executeTopologicalFillet(cube, 'e01', 1.0);

    expect(filletRes.success).toBe(true);
    expect(filletRes.solid).toBeDefined();

    const a = RedTeamTopologicalAnalyzer.analyze(filletRes.solid!);
    expect(a.V).toBe(10);
    expect(a.E).toBe(15);
    expect(a.F).toBe(7);
    expect(a.chi).toBe(2);
    expect(a.boundaryEdges.length).toBe(0);
    expect(a.nonManifoldEdges.length).toBe(0);
    expect(a.connectedComponents).toBe(1);
    expect(a.loopDiscontinuities.length).toBe(0);
    expect(a.isClosed).toBe(true);
    expect(a.isManifold).toBe(true);
  });

  // A3 — Topology identity red team
  it('A3: Verify edge-to-face incidence exactly 2 and strict cyclic loop identity', () => {
    const cube = CanonicalBRepFixtures.createCube();
    const filletRes = BRepEulerOps.executeTopologicalFillet(cube, 'e01', 1.0);
    const solid = filletRes.solid!;
    const a = RedTeamTopologicalAnalyzer.analyze(solid);

    // Every edge must have exactly 2 incident faces
    for (const [eId, fSet] of a.edgeToFaces) {
      expect(fSet.size).toBe(2);
    }

    // Every face loop must be strictly continuous and closed
    for (const face of a.faceMap.values()) {
      const loop = face.outerLoop;
      expect(loop.orientedEdges.length).toBeGreaterThanOrEqual(3);
      for (let i = 0; i < loop.orientedEdges.length; i++) {
        const oe = loop.orientedEdges[i];
        const nextOe = loop.orientedEdges[(i + 1) % loop.orientedEdges.length];
        const endV = oe.orientation === Orientation.FORWARD ? oe.edge.endVertex : oe.edge.startVertex;
        const startV = nextOe.orientation === Orientation.FORWARD ? nextOe.edge.startVertex : nextOe.edge.endVertex;
        expect(endV?.id).toBe(startV?.id);
      }
    }
  });

  // A4 — Vertex star neighborhood test
  it('A4: Vertex star test — verify connected local neighborhood without dangling/split vertices', () => {
    const cube = CanonicalBRepFixtures.createCube();
    const filletRes = BRepEulerOps.executeTopologicalFillet(cube, 'e01', 1.0);
    const solid = filletRes.solid!;
    const a = RedTeamTopologicalAnalyzer.analyze(solid);

    for (const [vId, incEdges] of a.vertexToEdges) {
      // Valence of any vertex in this genus-0 solid must be >= 3
      expect(incEdges.size).toBeGreaterThanOrEqual(3);
      // Incident faces must match valence (disk-like neighborhood)
      const incFaces = a.vertexToFaces.get(vId)!;
      expect(incFaces.size).toBe(incEdges.size);
    }
  });

  // A5 — Geometric reality test
  it('A5: Prove operation is not a no-op: target edge replaced, blend surface attached, geometry modified', () => {
    const cube = CanonicalBRepFixtures.createCube();
    const filletRes = BRepEulerOps.executeTopologicalFillet(cube, 'e01', 1.0);
    const solid = filletRes.solid!;
    const a = RedTeamTopologicalAnalyzer.analyze(solid);

    // 1. Original target edge e01 must be eliminated
    expect(a.edgeMap.has('e01')).toBe(false);

    // 2. Blend face must exist
    expect(filletRes.newFaces.length).toBe(1);
    const blendFace = filletRes.newFaces[0];
    expect(blendFace.geometry).toBeInstanceOf(BRepCylinder);

    // 3. New vertices must be 4, new edges 4
    expect(filletRes.newVertices.length).toBe(4);
    expect(filletRes.newEdges.length).toBe(4);
  });

  // A6 — Adversarial radii tests
  it('A6: Adversarial radii — reject non-positive and geometrically out-of-bounds radii safely', () => {
    const cube = CanonicalBRepFixtures.createCube();

    // Zero radius
    const rZero = BRepEulerOps.executeTopologicalFillet(cube, 'e01', 0);
    expect(rZero.success).toBe(false);
    expect(rZero.diagnostics[0]).toContain('positive');

    // Negative radius
    const rNeg = BRepEulerOps.executeTopologicalFillet(cube, 'e01', -2.5);
    expect(rNeg.success).toBe(false);
    expect(rNeg.diagnostics[0]).toContain('positive');

    // Very small positive radius (e.g. 1e-4)
    const rSmall = BRepEulerOps.executeTopologicalFillet(cube, 'e01', 1e-4);
    expect(rSmall.success).toBe(true);

    // Radius exceeding edge length (edge is 10.0, radius is 15.0)
    const rExceed = BRepEulerOps.executeTopologicalFillet(cube, 'e01', 15.0);
    expect(rExceed.success).toBe(false);
    expect(rExceed.diagnostics[0]).toContain('exceeds');
  });

  // A7 — Topology mutation red team
  it('A7: Topology mutation red team — detect all 8 forms of topological corruption', () => {
    const cube = CanonicalBRepFixtures.createCube();
    const filletRes = BRepEulerOps.executeTopologicalFillet(cube, 'e01', 1.0);
    expect(filletRes.success).toBe(true);

    const validSolid = filletRes.solid!;

    // Mutation 1: Next half-edge mutation (reverse one edge orientation)
    const m1Faces = validSolid.outerShell.orientedFaces.map((of, idx) => {
      if (idx !== 0) return of;
      const f = of.face as BRepFace;
      const corruptEdges = [...f.outerLoop.orientedEdges];
      corruptEdges[0] = { 
        edge: corruptEdges[0].edge, 
        orientation: corruptEdges[0].orientation === Orientation.FORWARD ? Orientation.REVERSE : Orientation.FORWARD 
      };
      return { face: new BRepFace(f.id, f.geometry, new BRepLoop(f.outerLoop.id, corruptEdges), []), orientation: of.orientation };
    });
    expect(IndependentBRepValidator.audit(new BRepSolid('m1', new BRepShell('sh1', m1Faces), [])).isValid).toBe(false);

    // Mutation 2: Previous half-edge mutation (swap order of two consecutive edges)
    const m2Faces = validSolid.outerShell.orientedFaces.map((of, idx) => {
      if (idx !== 0) return of;
      const f = of.face as BRepFace;
      const corruptEdges = [...f.outerLoop.orientedEdges];
      const tmp = corruptEdges[0];
      corruptEdges[0] = corruptEdges[1];
      corruptEdges[1] = tmp;
      return { face: new BRepFace(f.id, f.geometry, new BRepLoop(f.outerLoop.id, corruptEdges), []), orientation: of.orientation };
    });
    expect(IndependentBRepValidator.audit(new BRepSolid('m2', new BRepShell('sh2', m2Faces), [])).isValid).toBe(false);

    // Mutation 3: Edge endpoint mutation (corrupt start vertex)
    const m3Faces = validSolid.outerShell.orientedFaces.map((of, idx) => {
      if (idx !== 0) return of;
      const f = of.face as BRepFace;
      const corruptEdges = [...f.outerLoop.orientedEdges];
      const origE = corruptEdges[0].edge as BRepEdge;
      const fakeV = new BRepVertex('fake_v_999', new BRepPoint(999, 999, 999));
      const corruptE = new BRepEdge('corrupt_e_end', origE.geometry, fakeV, origE.endVertex);
      corruptEdges[0] = { edge: corruptE, orientation: corruptEdges[0].orientation };
      return { face: new BRepFace(f.id, f.geometry, new BRepLoop(f.outerLoop.id, corruptEdges), []), orientation: of.orientation };
    });
    expect(IndependentBRepValidator.audit(new BRepSolid('m3', new BRepShell('sh3', m3Faces), [])).isValid).toBe(false);

    // Mutation 4: Face-edge association (drop one edge from a face loop)
    const m4Faces = validSolid.outerShell.orientedFaces.map((of, idx) => {
      if (idx !== 0) return of;
      const f = of.face as BRepFace;
      const corruptEdges = f.outerLoop.orientedEdges.slice(1);
      return { face: new BRepFace(f.id, f.geometry, new BRepLoop(f.outerLoop.id, corruptEdges), []), orientation: of.orientation };
    });
    expect(IndependentBRepValidator.audit(new BRepSolid('m4', new BRepShell('sh4', m4Faces), [])).isValid).toBe(false);

    // Mutation 5: Shared edge identity (replace shared edge in one face with an unshared duplicate edge object)
    const m5Faces = validSolid.outerShell.orientedFaces.map((of, idx) => {
      if (idx !== 0) return of;
      const f = of.face as BRepFace;
      const corruptEdges = [...f.outerLoop.orientedEdges];
      const origE = corruptEdges[0].edge as BRepEdge;
      const dupE = new BRepEdge('dup_unshared_e', origE.geometry, origE.startVertex, origE.endVertex);
      corruptEdges[0] = { edge: dupE, orientation: corruptEdges[0].orientation };
      return { face: new BRepFace(f.id, f.geometry, new BRepLoop(f.outerLoop.id, corruptEdges), []), orientation: of.orientation };
    });
    expect(IndependentBRepValidator.audit(new BRepSolid('m5', new BRepShell('sh5', m5Faces), [])).isValid).toBe(false);

    // Mutation 6: Incident face list (add an extra face reusing an edge -> incidence = 3)
    const extraFace = validSolid.outerShell.orientedFaces[0].face as BRepFace;
    const m6Faces = [...validSolid.outerShell.orientedFaces, { face: new BRepFace('f_extra', extraFace.geometry, extraFace.outerLoop, []), orientation: Orientation.FORWARD }];
    expect(IndependentBRepValidator.audit(new BRepSolid('m6', new BRepShell('sh6', m6Faces), [])).isValid).toBe(false);

    // Mutation 7: Vertex identity (replace a vertex with an unshared clone)
    const m7Faces = validSolid.outerShell.orientedFaces.map((of, idx) => {
      if (idx !== 0) return of;
      const f = of.face as BRepFace;
      const corruptEdges = [...f.outerLoop.orientedEdges];
      const origE = corruptEdges[0].edge as BRepEdge;
      const cloneV = new BRepVertex('clone_v', origE.startVertex.geometry);
      const clonedE = new BRepEdge('cloned_v_e', origE.geometry, cloneV, origE.endVertex);
      corruptEdges[0] = { edge: clonedE, orientation: corruptEdges[0].orientation };
      return { face: new BRepFace(f.id, f.geometry, new BRepLoop(f.outerLoop.id, corruptEdges), []), orientation: of.orientation };
    });
    expect(IndependentBRepValidator.audit(new BRepSolid('m7', new BRepShell('sh7', m7Faces), [])).isValid).toBe(false);

    // Mutation 8: Blend face removal (leaves open boundary hole)
    const m8Faces = validSolid.outerShell.orientedFaces.slice(0, 6); // Drop 7th (blend) face
    const audit8 = IndependentBRepValidator.audit(new BRepSolid('m8', new BRepShell('sh8', m8Faces), []));
    expect(audit8.isValid).toBe(false);
    expect(audit8.checks.hasBoundaryEdges).toBe(true);
  });

  // A8 — Euler false-positive resistance
  it('A8: Reject false-positive where Chi=2 but boundary edges exist', () => {
    // Construct an invalid solid with Chi=2:
    // A single square face (4 vertices, 4 edges, 1 face) has Chi = 4 - 4 + 1 = 1.
    // If we add a disconnected triangle (3 vertices, 3 edges, 1 face), total Chi = (4+3) - (4+3) + (1+1) = 7 - 7 + 2 = 2.
    // Chi is 2, but it has 7 boundary edges and 2 disconnected components!
    const v0 = new BRepVertex('v0', new BRepPoint(0,0,0));
    const v1 = new BRepVertex('v1', new BRepPoint(1,0,0));
    const v2 = new BRepVertex('v2', new BRepPoint(1,1,0));
    const v3 = new BRepVertex('v3', new BRepPoint(0,1,0));

    const e01 = new BRepEdge('e01', new BRepLine('l01', v0.geometry, v1.geometry), v0, v1);
    const e12 = new BRepEdge('e12', new BRepLine('l12', v1.geometry, v2.geometry), v1, v2);
    const e23 = new BRepEdge('e23', new BRepLine('l23', v2.geometry, v3.geometry), v2, v3);
    const e30 = new BRepEdge('e30', new BRepLine('l30', v3.geometry, v0.geometry), v3, v0);

    const f1 = new BRepFace('f1', new BRepPlane('p1', v0.geometry, {x:0,y:0,z:1}), new BRepLoop('lp1', [
      { edge: e01, orientation: Orientation.FORWARD },
      { edge: e12, orientation: Orientation.FORWARD },
      { edge: e23, orientation: Orientation.FORWARD },
      { edge: e30, orientation: Orientation.FORWARD }
    ]), []);

    const v4 = new BRepVertex('v4', new BRepPoint(10,0,0));
    const v5 = new BRepVertex('v5', new BRepPoint(11,0,0));
    const v6 = new BRepVertex('v6', new BRepPoint(10,1,0));

    const e45 = new BRepEdge('e45', new BRepLine('l45', v4.geometry, v5.geometry), v4, v5);
    const e56 = new BRepEdge('e56', new BRepLine('l56', v5.geometry, v6.geometry), v5, v6);
    const e64 = new BRepEdge('e64', new BRepLine('l64', v6.geometry, v4.geometry), v6, v4);

    const f2 = new BRepFace('f2', new BRepPlane('p2', v4.geometry, {x:0,y:0,z:1}), new BRepLoop('lp2', [
      { edge: e45, orientation: Orientation.FORWARD },
      { edge: e56, orientation: Orientation.FORWARD },
      { edge: e64, orientation: Orientation.FORWARD }
    ]), []);

    const fakeChi2Solid = new BRepSolid('fake_chi2', new BRepShell('sh_fake', [
      { face: f1, orientation: Orientation.FORWARD },
      { face: f2, orientation: Orientation.FORWARD }
    ]), []);

    const audit = IndependentBRepValidator.audit(fakeChi2Solid);
    expect(audit.topology.eulerCharacteristic).toBe(2);
    // MUST BE REJECTED because boundary edges exist
    expect(audit.isValid).toBe(false);
    expect(audit.checks.hasBoundaryEdges).toBe(true);
  });
});
