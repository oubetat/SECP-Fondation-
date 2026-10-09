/**
 * SECP CAD Kernel — Topology Contracts
 */
import { Point, Curve, Surface } from '../geometry/GeometryContracts';
import { TopologyLineage, TopologyReference } from '../history/FeatureDefinition';

export enum TopoShapeEnum {
  VERTEX = 'VERTEX',
  EDGE = 'EDGE',
  LOOP = 'LOOP',
  WIRE = 'WIRE',
  FACE = 'FACE',
  SHELL = 'SHELL',
  SOLID = 'SOLID',
  COMPOUND = 'COMPOUND'
}

export enum Orientation {
  FORWARD = 'FORWARD',
  REVERSED = 'REVERSED'
}

export interface TopoShape {
  id: string; // Canonical identity
  shapeType: TopoShapeEnum;
  outerShell?: Shell;
  shapes?: TopoShape[];
  persistentId?: string;
  lineage?: TopologyLineage;
  topologyReference?: TopologyReference;
}

export interface Vertex extends TopoShape {
  shapeType: TopoShapeEnum.VERTEX;
  geometry: Point; // Geometry reference
  tolerance: number;
}

export interface Edge extends TopoShape {
  shapeType: TopoShapeEnum.EDGE;
  geometry: Curve;
  startVertex: Vertex;
  endVertex: Vertex;
  tolerance: number;
}

export interface OrientedEdge {
  edge: Edge;
  orientation: Orientation;
}

export interface Loop extends TopoShape {
  shapeType: TopoShapeEnum.LOOP;
  orientedEdges: OrientedEdge[];
}

export interface Wire extends TopoShape {
  shapeType: TopoShapeEnum.WIRE;
  edges: Edge[];
}

export interface Face extends TopoShape {
  shapeType: TopoShapeEnum.FACE;
  geometry: Surface;
  outerLoop: Loop;
  innerLoops: Loop[];
}

export interface OrientedFace {
  face: Face;
  orientation: Orientation;
}

export interface Shell extends TopoShape {
  shapeType: TopoShapeEnum.SHELL;
  orientedFaces: OrientedFace[];
}

export interface Solid extends TopoShape {
  shapeType: TopoShapeEnum.SOLID;
  outerShell: Shell;
  innerShells: Shell[];
}

export interface Compound extends TopoShape {
  shapeType: TopoShapeEnum.COMPOUND;
  shapes: TopoShape[];
}
