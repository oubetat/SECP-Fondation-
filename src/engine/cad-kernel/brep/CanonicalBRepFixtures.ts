/**
 * SECP CAD Kernel — Canonical B-Rep Fixtures
 * 
 * Provides a single, topologically proven source of truth for standard shapes.
 * Guaranteed 2-manifold, genus-0, Chi=2.
 */

import { 
  BRepSolid, 
  BRepShell, 
  BRepFace, 
  BRepLoop, 
  BRepEdge, 
  BRepVertex 
} from '../topology/BRepTopology';
import { 
  BRepPoint, 
  BRepLine, 
  BRepPlane 
} from '../geometry/BRepGeometry';
import { Orientation } from '../topology/TopologyContracts';

export class CanonicalBRepFixtures {
  /**
   * Creates a 10x10x10 Canonical Cube at Origin.
   * Topology: 8 Vertices, 12 Edges, 6 Faces.
   * Winding: CCW from outside.
   */
  public static createCube(): BRepSolid {
    // 1. Vertices
    const v = [
      new BRepVertex('v0', new BRepPoint(0, 0, 0)),
      new BRepVertex('v1', new BRepPoint(10, 0, 0)),
      new BRepVertex('v2', new BRepPoint(10, 10, 0)),
      new BRepVertex('v3', new BRepPoint(0, 10, 0)),
      new BRepVertex('v4', new BRepPoint(0, 0, 10)),
      new BRepVertex('v5', new BRepPoint(10, 0, 10)),
      new BRepVertex('v6', new BRepPoint(10, 10, 10)),
      new BRepVertex('v7', new BRepPoint(0, 10, 10))
    ];

    // 2. Edges (strictly shared)
    // Bottom
    const e01 = new BRepEdge('e01', new BRepLine('l01', v[0].geometry, v[1].geometry), v[0], v[1]);
    const e12 = new BRepEdge('e12', new BRepLine('l12', v[1].geometry, v[2].geometry), v[1], v[2]);
    const e23 = new BRepEdge('e23', new BRepLine('l23', v[2].geometry, v[3].geometry), v[2], v[3]);
    const e30 = new BRepEdge('e30', new BRepLine('l30', v[3].geometry, v[0].geometry), v[3], v[0]);
    // Top
    const e45 = new BRepEdge('e45', new BRepLine('l45', v[4].geometry, v[5].geometry), v[4], v[5]);
    const e56 = new BRepEdge('e56', new BRepLine('l56', v[5].geometry, v[6].geometry), v[5], v[6]);
    const e67 = new BRepEdge('e67', new BRepLine('l67', v[6].geometry, v[7].geometry), v[6], v[7]);
    const e74 = new BRepEdge('e74', new BRepLine('l74', v[7].geometry, v[4].geometry), v[7], v[4]);
    // Vertical
    const e04 = new BRepEdge('e04', new BRepLine('l04', v[0].geometry, v[4].geometry), v[0], v[4]);
    const e15 = new BRepEdge('e15', new BRepLine('l15', v[1].geometry, v[5].geometry), v[1], v[5]);
    const e26 = new BRepEdge('e26', new BRepLine('l26', v[2].geometry, v[6].geometry), v[2], v[6]);
    const e37 = new BRepEdge('e37', new BRepLine('l37', v[3].geometry, v[7].geometry), v[3], v[7]);

    // 3. Faces
    const fBottom = new BRepFace('f_bot', new BRepPlane('p_bot', v[0].geometry, {x:0,y:0,z:-1}), new BRepLoop('lp_bot', [
      { edge: e01, orientation: Orientation.REVERSE },
      { edge: e30, orientation: Orientation.REVERSE },
      { edge: e23, orientation: Orientation.REVERSE },
      { edge: e12, orientation: Orientation.REVERSE }
    ]), []);

    const fTop = new BRepFace('f_top', new BRepPlane('p_top', v[4].geometry, {x:0,y:0,z:1}), new BRepLoop('lp_top', [
      { edge: e45, orientation: Orientation.FORWARD },
      { edge: e56, orientation: Orientation.FORWARD },
      { edge: e67, orientation: Orientation.FORWARD },
      { edge: e74, orientation: Orientation.FORWARD }
    ]), []);

    const fFront = new BRepFace('f_front', new BRepPlane('p_front', v[0].geometry, {x:0,y:-1,z:0}), new BRepLoop('lp_front', [
      { edge: e01, orientation: Orientation.FORWARD },
      { edge: e15, orientation: Orientation.FORWARD },
      { edge: e45, orientation: Orientation.REVERSE },
      { edge: e04, orientation: Orientation.REVERSE }
    ]), []);

    const fBack = new BRepFace('f_back', new BRepPlane('p_back', v[2].geometry, {x:0,y:1,z:0}), new BRepLoop('lp_back', [
      { edge: e23, orientation: Orientation.FORWARD },
      { edge: e37, orientation: Orientation.FORWARD },
      { edge: e67, orientation: Orientation.REVERSE },
      { edge: e26, orientation: Orientation.REVERSE }
    ]), []);

    const fLeft = new BRepFace('f_left', new BRepPlane('p_left', v[0].geometry, {x:-1,y:0,z:0}), new BRepLoop('lp_left', [
      { edge: e30, orientation: Orientation.FORWARD },
      { edge: e04, orientation: Orientation.FORWARD },
      { edge: e74, orientation: Orientation.REVERSE },
      { edge: e37, orientation: Orientation.REVERSE }
    ]), []);

    const fRight = new BRepFace('f_right', new BRepPlane('p_right', v[1].geometry, {x:1,y:0,z:0}), new BRepLoop('lp_right', [
      { edge: e12, orientation: Orientation.FORWARD },
      { edge: e26, orientation: Orientation.FORWARD },
      { edge: e56, orientation: Orientation.REVERSE },
      { edge: e15, orientation: Orientation.REVERSE }
    ]), []);

    const shell = new BRepShell('shell_cube', [
      { face: fBottom, orientation: Orientation.FORWARD },
      { face: fTop, orientation: Orientation.FORWARD },
      { face: fFront, orientation: Orientation.FORWARD },
      { face: fBack, orientation: Orientation.FORWARD },
      { face: fLeft, orientation: Orientation.FORWARD },
      { face: fRight, orientation: Orientation.FORWARD }
    ]);

    return new BRepSolid('solid_cube', shell, []);
  }
}
