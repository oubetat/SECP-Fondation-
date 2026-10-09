import { describe, it, expect } from 'vitest';
import { BRepNamingGraph, LineageMutationType } from '../BRepNamingGraph';
import { BRepFace, BRepLoop, BRepEdge, BRepVertex, BRepSolid, BRepShell } from '../../topology/BRepTopology';
import { BRepPoint, BRepLine, BRepPlane } from '../../geometry/BRepGeometry';
import { Orientation } from '../../topology/TopologyContracts';

describe('BRepNaming — Persistent Naming & Lineage Forensic Audit', () => {
  function createBasicFace(id: string, z: number = 0): BRepFace {
    const v1 = new BRepVertex(`${id}_v1`, new BRepPoint(0, 0, z));
    const v2 = new BRepVertex(`${id}_v2`, new BRepPoint(10, 0, z));
    const v3 = new BRepVertex(`${id}_v3`, new BRepPoint(10, 10, z));
    const v4 = new BRepVertex(`${id}_v4`, new BRepPoint(0, 10, z));
    const edges = [
      new BRepEdge(`${id}_e1`, new BRepLine(`${id}_l1`, v1.geometry, v2.geometry), v1, v2),
      new BRepEdge(`${id}_e2`, new BRepLine(`${id}_l2`, v2.geometry, v3.geometry), v2, v3),
      new BRepEdge(`${id}_e3`, new BRepLine(`${id}_l3`, v3.geometry, v4.geometry), v3, v4),
      new BRepEdge(`${id}_e4`, new BRepLine(`${id}_l4`, v4.geometry, v1.geometry), v4, v1)
    ];
    return new BRepFace(id, new BRepPlane(`${id}_p`, v1.geometry, {x:0,y:0,z:1}), new BRepLoop(`${id}_loop`, edges.map(e => ({edge: e, orientation: Orientation.FORWARD}))), []);
  }

  it('FORENSIC: Should resolve complex split and modified lineage', () => {
    const graph = new BRepNamingGraph();
    const faceParent = createBasicFace('f_parent');
    graph.computeFaceSignature(faceParent);

    // Record Split: f_parent -> [f_child_1, f_child_2]
    graph.recordMutation('f_parent', 'f_child_1', 'SPLIT', 'feat_split_1');
    graph.recordMutation('f_parent', 'f_child_2', 'SPLIT', 'feat_split_1');

    // Create a regenerated solid containing only f_child_2
    const faceChild2 = createBasicFace('f_child_2_new_guid'); // Simulating GUID change
    // But we need to make sure the lineage map is updated if GUID changed?
    // Actually the lineage map should have the NEW GUID.
    graph.recordMutation('f_parent', 'f_child_2_new_guid', 'SPLIT', 'feat_split_1');

    const solidRegen = new BRepSolid('regen', new BRepShell('s', [{face: faceChild2, orientation: Orientation.FORWARD}]), []);

    const res = graph.resolveTargetEntity('f_parent', solidRegen);
    expect(res.matchMethod).toBe('LINEAGE_DAG');
    expect(res.resolvedEntityId).toBe('f_child_2_new_guid');
  });

  it('ADVERSARIAL: Should report UNRESOLVED for deleted entities', () => {
    const graph = new BRepNamingGraph();
    const face = createBasicFace('f_dead');
    graph.computeFaceSignature(face);
    graph.recordMutation('f_dead', 'null', 'DELETED', 'feat_delete');

    const emptySolid = new BRepSolid('empty', new BRepShell('s', []), []);
    const res = graph.resolveTargetEntity('f_dead', emptySolid);

    expect(res.resolvedEntityId).toBeNull();
    expect(res.matchMethod).toBe('UNRESOLVED');
  });

  it('ADVERSARIAL: Should handle geometric ambiguity via signature confidence', () => {
    const graph = new BRepNamingGraph();
    const faceOrig = createBasicFace('f_orig', 0);
    graph.computeFaceSignature(faceOrig);

    // Create two identical faces in regenerated solid
    const faceA = createBasicFace('f_candidate_A', 0.001); // Near match
    const faceB = createBasicFace('f_candidate_B', 10.0);   // Far match

    const solidRegen = new BRepSolid('regen', new BRepShell('s', [
      {face: faceA, orientation: Orientation.FORWARD},
      {face: faceB, orientation: Orientation.FORWARD}
    ]), []);

    const res = graph.resolveTargetEntity('f_orig', solidRegen);
    expect(res.resolvedEntityId).toBe('f_candidate_A');
    expect(res.matchMethod).toBe('TOPOLOGICAL_SIGNATURE');
    expect(res.confidenceScore).toBeGreaterThan(0.6);
  });
});
