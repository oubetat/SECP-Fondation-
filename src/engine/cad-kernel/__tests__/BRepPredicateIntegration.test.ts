import { describe, it, expect } from 'vitest';
import { TopologyPredicates } from '../predicates/TopologyPredicates';
import { Vertex, TopoShapeEnum, Loop, Orientation, Edge } from '../topology/TopologyContracts';

describe('PATCH-018: B-Rep & Topology Predicate Integration', () => {
  it('should evaluate vertex coincidence within tolerance', () => {
    const v1: Vertex = {
      id: 'v1',
      shapeType: TopoShapeEnum.VERTEX,
      geometry: { x: 0, y: 0, z: 0 },
      tolerance: 1e-6
    };
    const v2: Vertex = {
      id: 'v2',
      shapeType: TopoShapeEnum.VERTEX,
      geometry: { x: 1e-7, y: 0, z: 0 },
      tolerance: 1e-6
    };
    const v3: Vertex = {
      id: 'v3',
      shapeType: TopoShapeEnum.VERTEX,
      geometry: { x: 1, y: 0, z: 0 },
      tolerance: 1e-6
    };

    expect(TopologyPredicates.areVerticesCoincident(v1, v2).classification).toBe('TRUE');
    expect(TopologyPredicates.areVerticesCoincident(v1, v3).classification).toBe('FALSE');
  });

  it('should evaluate planarity of a polygonal loop', () => {
    const makeV = (id: string, x: number, y: number, z: number): Vertex => ({
      id,
      shapeType: TopoShapeEnum.VERTEX,
      geometry: { x, y, z },
      tolerance: 1e-6
    });

    const v1 = makeV('v1', 0, 0, 0);
    const v2 = makeV('v2', 10, 0, 0);
    const v3 = makeV('v3', 10, 10, 0);
    const v4 = makeV('v4', 0, 10, 0);

    const makeE = (id: string, start: Vertex, end: Vertex): Edge => ({
      id,
      shapeType: TopoShapeEnum.EDGE,
      geometry: {
        evaluate: (u) => ({ x: start.geometry.x + u * (end.geometry.x - start.geometry.x), y: 0, z: 0 }),
        domain: () => ({ uMin: 0, uMax: 1 })
      },
      startVertex: start,
      endVertex: end,
      tolerance: 1e-6
    });

    const loop: Loop = {
      id: 'l1',
      shapeType: TopoShapeEnum.LOOP,
      orientedEdges: [
        { edge: makeE('e1', v1, v2), orientation: Orientation.FORWARD },
        { edge: makeE('e2', v2, v3), orientation: Orientation.FORWARD },
        { edge: makeE('e3', v3, v4), orientation: Orientation.FORWARD },
        { edge: makeE('e4', v4, v1), orientation: Orientation.FORWARD }
      ]
    };

    const planarRes = TopologyPredicates.isLoopPlanar(loop);
    expect(planarRes.classification).toBe('TRUE');
    expect(planarRes.value?.maxDeviation).toBeLessThan(1e-6);
  });
});
