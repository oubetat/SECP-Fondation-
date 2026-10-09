import { describe, it, expect } from 'vitest';
import { BRepNamingGraph } from '../BRepNamingGraph';
import { BRepFace, BRepLoop, BRepEdge, BRepVertex, BRepSolid, BRepShell } from '../../topology/BRepTopology';
import { BRepPoint, BRepLine, BRepPlane } from '../../geometry/BRepGeometry';
import { Orientation } from '../../topology/TopologyContracts';

describe('BRepNamingGraph — Persistent Topological Naming & Lineage Graph Engine', () => {
  it('should record entity mutations and resolve lost IDs via Lineage DAG or Topological Signatures', () => {
    const graph = new BRepNamingGraph();

    // 1. Create Original Face
    const v1 = new BRepVertex('v1', new BRepPoint(0, 0, 0));
    const v2 = new BRepVertex('v2', new BRepPoint(10, 0, 0));
    const v3 = new BRepVertex('v3', new BRepPoint(10, 10, 0));
    const v4 = new BRepVertex('v4', new BRepPoint(0, 10, 0));

    const e1 = new BRepEdge('e1', new BRepLine('l1', v1.geometry, v2.geometry), v1, v2);
    const e2 = new BRepEdge('e2', new BRepLine('l2', v2.geometry, v3.geometry), v2, v3);
    const e3 = new BRepEdge('e3', new BRepLine('l3', v3.geometry, v4.geometry), v3, v4);
    const e4 = new BRepEdge('e4', new BRepLine('l4', v4.geometry, v1.geometry), v4, v1);

    const origFace = new BRepFace('f_orig_100', new BRepPlane('p1', v1.geometry, { x: 0, y: 0, z: 1 }), new BRepLoop('loop1', [
      { edge: e1, orientation: Orientation.FORWARD },
      { edge: e2, orientation: Orientation.FORWARD },
      { edge: e3, orientation: Orientation.FORWARD },
      { edge: e4, orientation: Orientation.FORWARD }
    ]), []);

    // Compute original signature
    graph.computeFaceSignature(origFace);

    // Record mutation in lineage graph: f_orig_100 -> [MODIFIED] -> f_mutated_200
    graph.recordMutation('f_orig_100', 'f_mutated_200', 'MODIFIED', 'feat_extrude_1');

    // 2. Create Regenerated Solid with new GUID f_mutated_200
    const mutatedFace = new BRepFace('f_mutated_200', origFace.geometry, origFace.outerLoop, []);
    const regeneratedShell = new BRepShell('shell_regen', [{ face: mutatedFace, orientation: Orientation.FORWARD }]);
    const regeneratedSolid = new BRepSolid('solid_regen', regeneratedShell, []);

    // 3. Resolve Original Lost Reference ID 'f_orig_100' in regenerated solid
    const res = graph.resolveTargetEntity('f_orig_100', regeneratedSolid);

    expect(res.resolvedEntityId).toBe('f_mutated_200');
    expect(res.confidenceScore).toBeGreaterThanOrEqual(0.95);
    expect(res.matchMethod).toBe('LINEAGE_DAG');
  });
});
