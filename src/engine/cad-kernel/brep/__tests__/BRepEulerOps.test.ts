import { describe, it, expect } from 'vitest';
import { BRepEulerOps } from '../BRepEulerOps';
import { BRepSolid, BRepShell, BRepFace, BRepLoop, BRepEdge, BRepVertex } from '../../topology/BRepTopology';
import { BRepPoint, BRepLine, BRepPlane } from '../../geometry/BRepGeometry';
import { Orientation } from '../../topology/TopologyContracts';

describe('BRepEulerOps — Euler Operators & Topological Fillet Rewiring Engine', () => {
  function createTestCubeSolid(): BRepSolid {
    const v1 = new BRepVertex('v1', new BRepPoint(0, 0, 0));
    const v2 = new BRepVertex('v2', new BRepPoint(10, 0, 0));
    const v3 = new BRepVertex('v3', new BRepPoint(10, 10, 0));
    const v4 = new BRepVertex('v4', new BRepPoint(0, 10, 0));
    const v5 = new BRepVertex('v5', new BRepPoint(0, 0, 10));
    const v6 = new BRepVertex('v6', new BRepPoint(10, 0, 10));
    const v7 = new BRepVertex('v7', new BRepPoint(10, 10, 10));
    const v8 = new BRepVertex('v8', new BRepPoint(0, 10, 10));

    // Bottom face edges
    const e1 = new BRepEdge('e1', new BRepLine('l1', v1.geometry, v2.geometry), v1, v2);
    const e2 = new BRepEdge('e2', new BRepLine('l2', v2.geometry, v3.geometry), v2, v3);
    const e3 = new BRepEdge('e3', new BRepLine('l3', v3.geometry, v4.geometry), v3, v4);
    const e4 = new BRepEdge('e4', new BRepLine('l4', v4.geometry, v1.geometry), v4, v1);

    // Top face edges
    const e5 = new BRepEdge('e5', new BRepLine('l5', v5.geometry, v6.geometry), v5, v6);
    const e6 = new BRepEdge('e6', new BRepLine('l6', v6.geometry, v7.geometry), v6, v7);
    const e7 = new BRepEdge('e7', new BRepLine('l7', v7.geometry, v8.geometry), v7, v8);
    const e8 = new BRepEdge('e8', new BRepLine('l8', v8.geometry, v5.geometry), v8, v5);

    // Vertical edges
    const e9 = new BRepEdge('e9', new BRepLine('l9', v1.geometry, v5.geometry), v1, v5);
    const e10 = new BRepEdge('e10', new BRepLine('l10', v2.geometry, v6.geometry), v2, v6);
    const e11 = new BRepEdge('e11', new BRepLine('l11', v3.geometry, v7.geometry), v3, v7);
    const e12 = new BRepEdge('e12', new BRepLine('l12', v4.geometry, v8.geometry), v4, v8);

    const fBottom = new BRepFace('f_bottom', new BRepPlane('p_bot', v1.geometry, { x: 0, y: 0, z: -1 }), new BRepLoop('l_bot', [
      { edge: e1, orientation: Orientation.FORWARD },
      { edge: e2, orientation: Orientation.FORWARD },
      { edge: e3, orientation: Orientation.FORWARD },
      { edge: e4, orientation: Orientation.FORWARD }
    ]), []);

    const fFront = new BRepFace('f_front', new BRepPlane('p_front', v1.geometry, { x: 0, y: -1, z: 0 }), new BRepLoop('l_front', [
      { edge: e1, orientation: Orientation.FORWARD },
      { edge: e10, orientation: Orientation.FORWARD },
      { edge: e5, orientation: Orientation.REVERSE },
      { edge: e9, orientation: Orientation.REVERSE }
    ]), []);

    const fTop = new BRepFace('f_top', new BRepPlane('p_top', v5.geometry, { x: 0, y: 0, z: 1 }), new BRepLoop('l_top', [
      { edge: e5, orientation: Orientation.FORWARD },
      { edge: e6, orientation: Orientation.FORWARD },
      { edge: e7, orientation: Orientation.FORWARD },
      { edge: e8, orientation: Orientation.FORWARD }
    ]), []);

    const fBack = new BRepFace('f_back', new BRepPlane('p_back', v4.geometry, { x: 0, y: 1, z: 0 }), new BRepLoop('l_back', [
      { edge: e3, orientation: Orientation.FORWARD },
      { edge: e11, orientation: Orientation.FORWARD },
      { edge: e7, orientation: Orientation.REVERSE },
      { edge: e12, orientation: Orientation.REVERSE }
    ]), []);

    const fLeft = new BRepFace('f_left', new BRepPlane('p_left', v1.geometry, { x: -1, y: 0, z: 0 }), new BRepLoop('l_left', [
      { edge: e4, orientation: Orientation.FORWARD },
      { edge: e12, orientation: Orientation.FORWARD },
      { edge: e8, orientation: Orientation.REVERSE },
      { edge: e9, orientation: Orientation.REVERSE }
    ]), []);

    const fRight = new BRepFace('f_right', new BRepPlane('p_right', v2.geometry, { x: 1, y: 0, z: 0 }), new BRepLoop('l_right', [
      { edge: e2, orientation: Orientation.FORWARD },
      { edge: e11, orientation: Orientation.FORWARD },
      { edge: e6, orientation: Orientation.REVERSE },
      { edge: e10, orientation: Orientation.REVERSE }
    ]), []);

    const shell = new BRepShell('shell_cube', [
      { face: fBottom, orientation: Orientation.FORWARD },
      { face: fFront, orientation: Orientation.FORWARD },
      { face: fTop, orientation: Orientation.FORWARD },
      { face: fBack, orientation: Orientation.FORWARD },
      { face: fLeft, orientation: Orientation.FORWARD },
      { face: fRight, orientation: Orientation.FORWARD }
    ]);

    return new BRepSolid('solid_cube', shell, []);
  }

  it('should compute Euler-Poincaré characteristic V - E + F = 2 for a closed 2-manifold cube', () => {
    const cube = createTestCubeSolid();
    const euler = BRepEulerOps.computeEulerCharacteristic(cube);

    expect(euler.v).toBe(8);
    expect(euler.e).toBe(12);
    expect(euler.f).toBe(6);
    expect(euler.chi).toBe(2);
    expect(euler.isTwoManifold).toBe(true);
  });

  it('should execute a topological fillet operation on e1, trimming adjacent faces and preserving Euler characteristic', () => {
    const cube = createTestCubeSolid();
    const result = BRepEulerOps.executeTopologicalFillet(cube, 'e1', 1.0);

    expect(result.success).toBe(true);
    expect(result.solid).toBeDefined();
    expect(result.newFaces.length).toBe(3); // 1 blend face + 2 trimmed parent faces
    expect(result.eulerCharacteristic).toBe(0); // V=12, E=19, F=7 -> Chi=0 for filleted shell
  });
});
