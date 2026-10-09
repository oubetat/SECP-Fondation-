/**
 * SECP CAD Kernel — Concrete Topology Implementations
 */
import { 
  TopoShape, TopoShapeEnum, Vertex, Edge, Loop, Wire, Face, Shell, Solid, Orientation, OrientedEdge, OrientedFace, Compound
} from './TopologyContracts';
import { Point, Curve, Surface } from '../geometry/GeometryContracts';

export abstract class BRepShape implements TopoShape {
  public abstract shapeType: TopoShapeEnum;
  constructor(public id: string) {}
}

export class BRepVertex extends BRepShape implements Vertex {
  public shapeType: TopoShapeEnum.VERTEX = TopoShapeEnum.VERTEX;
  constructor(
    id: string,
    public geometry: Point,
    public tolerance: number = 1e-7
  ) {
    super(id);
  }
}

export class BRepEdge extends BRepShape implements Edge {
  public shapeType: TopoShapeEnum.EDGE = TopoShapeEnum.EDGE;
  public geometry!: Curve;
  public startVertex!: Vertex;
  public endVertex!: Vertex;
  public tolerance: number = 1e-7;

  constructor(
    id: string,
    arg1: any,
    arg2?: any,
    arg3?: any,
    arg4?: any
  ) {
    super(id);
    // Explicitly check if arg1 is a Vertex (startVertex) by checking for absence of evaluate() and presence of geometry/point
    if (arg1 && typeof arg1 === 'object' && !('evaluate' in arg1) && ('geometry' in arg1 || 'point' in arg1 || 'vertex' in String(arg1.constructor?.name).toLowerCase()) && arg2 && !('evaluate' in arg2)) {
      this.startVertex = arg1;
      this.endVertex = arg2;
      this.geometry = arg3 || ({ evaluate: () => ({ x: 0, y: 0, z: 0 }), domain: () => ({ uMin: 0, uMax: 1 }) } as any);
      this.tolerance = arg4 ?? 1e-7;
    } else {
      // Standard signature: (id, geometry, startVertex, endVertex, tolerance)
      this.geometry = arg1;
      this.startVertex = arg2;
      this.endVertex = arg3;
      this.tolerance = arg4 ?? 1e-7;
    }
  }
}

export class BRepLoop extends BRepShape implements Loop {
  public shapeType: TopoShapeEnum.LOOP = TopoShapeEnum.LOOP;
  constructor(
    id: string,
    public orientedEdges: OrientedEdge[] = []
  ) {
    super(id);
  }
  public isClosed(): boolean {
    if (this.orientedEdges.length === 0) return false;
    const first = this.orientedEdges[0];
    const last = this.orientedEdges[this.orientedEdges.length - 1];
    
    const startV = first.orientation === Orientation.FORWARD ? first.edge.startVertex : first.edge.endVertex;
    const endV = last.orientation === Orientation.FORWARD ? last.edge.endVertex : last.edge.startVertex;
    return startV.id === endV.id;
  }
}

export class BRepWire extends BRepShape implements Wire {
  public shapeType: TopoShapeEnum.WIRE = TopoShapeEnum.WIRE;
  constructor(
    id: string,
    public edges: Edge[] = []
  ) {
    super(id);
  }
}

export class BRepFace extends BRepShape implements Face {
  public shapeType: TopoShapeEnum.FACE = TopoShapeEnum.FACE;
  public geometry!: Surface;
  public outerLoop!: Loop;
  public innerLoops: Loop[] = [];

  constructor(
    id: string,
    arg1: any,
    arg2?: any,
    arg3?: any
  ) {
    super(id);
    // Explicitly check if arg1 is a Loop (outerLoop) by checking for absence of evaluate() and presence of orientedEdges
    if (arg1 && typeof arg1 === 'object' && !('evaluate' in arg1) && ('orientedEdges' in arg1 || 'isClosed' in arg1)) {
      this.outerLoop = arg1;
      this.innerLoops = Array.isArray(arg2) ? arg2 : [];
      this.geometry = arg3 || arg2 || ({ evaluate: () => ({ x: 0, y: 0, z: 0 }), domain: () => ({ uMin: 0, uMax: 1, vMin: 0, vMax: 1 }) } as any);
    } else {
      // Standard signature: (id, geometry, outerLoop, innerLoops)
      this.geometry = arg1;
      this.outerLoop = arg2;
      this.innerLoops = Array.isArray(arg3) ? arg3 : [];
    }
  }
}

export class BRepShell extends BRepShape implements Shell {
  public shapeType: TopoShapeEnum.SHELL = TopoShapeEnum.SHELL;
  constructor(
    id: string,
    public orientedFaces: OrientedFace[] = []
  ) {
    super(id);
  }
}

export class BRepSolid extends BRepShape implements Solid {
  public shapeType: TopoShapeEnum.SOLID = TopoShapeEnum.SOLID;
  constructor(
    id: string,
    public outerShell: Shell,
    public innerShells: Shell[] = []
  ) {
    super(id);
  }
}

export class BRepCompound extends BRepShape implements Compound {
  public shapeType: TopoShapeEnum.COMPOUND = TopoShapeEnum.COMPOUND;
  constructor(
    id: string,
    public shapes: TopoShape[] = []
  ) {
    super(id);
  }
}
