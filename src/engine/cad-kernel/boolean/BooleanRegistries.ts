/**
 * SECP CAD Kernel — Boolean Canonical Registries
 * Phase 2 (PATCH-172.1)
 */
import { Point } from '../geometry/GeometryContracts';
import { Edge, Vertex, TopoShapeEnum } from '../topology/TopologyContracts';
import { BooleanTolerance } from './BooleanTolerance';
import { GeometricToleranceModel } from '../predicates/GeometricTolerance';

export class ToleranceAwareVertexRegistry {
  private vertices: Vertex[] = [];

  constructor(private model?: GeometricToleranceModel) {}

  public getCanonicalVertex(pt: Point, preferredId?: string): Vertex {
    for (const v of this.vertices) {
      if (BooleanTolerance.arePointsCoincident(v.geometry, pt, this.model)) {
        return v;
      }
    }

    const newVertex: Vertex = {
      id: preferredId || `v_canon_${pt.x.toFixed(10)}_${pt.y.toFixed(10)}_${pt.z.toFixed(10)}`,
      shapeType: TopoShapeEnum.VERTEX,
      geometry: { ...pt },
      tolerance: this.model?.absoluteLength || 1e-7
    };
    this.vertices.push(newVertex);
    return newVertex;
  }

  public getAllVertices(): Vertex[] {
    return [...this.vertices];
  }
}

export class ToleranceAwareEdgeRegistry {
  private edges: Edge[] = [];

  constructor(private model?: GeometricToleranceModel) {}

  public getCanonicalEdge(v1: Vertex, v2: Vertex, preferredId?: string): Edge {
    // Sort vertices by ID to ensure canonical order for undirected lookup
    const [start, end] = v1.id < v2.id ? [v1, v2] : [v2, v1];

    for (const e of this.edges) {
      const eStart = e.startVertex;
      const eEnd = e.endVertex;
      if (!eStart || !eEnd) continue;

      // Check if edge connects same canonical vertices
      const matchDirect = (eStart === start && eEnd === end);
      const matchReverse = (eStart === end && eEnd === start);

      if (matchDirect || matchReverse) {
        return e;
      }
    }

    const newEdge: Edge = {
      id: preferredId || `e_canon_${start.id}_${end.id}`,
      shapeType: TopoShapeEnum.EDGE,
      startVertex: start,
      endVertex: end,
      geometry: { 
        evaluate: (t: number) => ({
          x: start.geometry.x + t * (end.geometry.x - start.geometry.x),
          y: start.geometry.y + t * (end.geometry.y - start.geometry.y),
          z: start.geometry.z + t * (end.geometry.z - start.geometry.z)
        }),
        domain: () => ({ uMin: 0, uMax: 1 })
      } as any,
      tolerance: this.model?.absoluteLength || 1e-7
    };
    this.edges.push(newEdge);
    return newEdge;
  }
}
