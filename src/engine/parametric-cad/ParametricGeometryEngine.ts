/**
 * PATCH-SECP-071: Parametric Geometry Engine
 * Manages sketches, constraints, dimensions, and core parametric geometry regeneration.
 */

import { Sketch, CADVertex, CADEdge, GeometricConstraint } from './ParametricCADTypes';

export class ParametricGeometryEngine {
  public static createSketch(id: string, planeFaceId: string): Sketch {
    return {
      id,
      planeFaceId,
      vertices: [],
      edges: [],
      constraints: []
    };
  }

  public static addVertex(sketch: Sketch, vertex: CADVertex): Sketch {
    return {
      ...sketch,
      vertices: [...sketch.vertices, vertex]
    };
  }

  public static addEdge(sketch: Sketch, edge: CADEdge): Sketch {
    return {
      ...sketch,
      edges: [...sketch.edges, edge]
    };
  }

  public static addConstraint(sketch: Sketch, constraint: GeometricConstraint): Sketch {
    return {
      ...sketch,
      constraints: [...sketch.constraints, constraint]
    };
  }

  public static updateDimension(sketch: Sketch, constraintId: string, newValue: number): Sketch {
    const updatedConstraints = sketch.constraints.map(c => {
      if (c.id === constraintId) {
        return { ...c, value: newValue };
      }
      return c;
    });

    // In a fully solved parametric engine, this propagates to vertices.
    // For this core kernel, we perform a deterministic scale transformation to simulate propagation.
    const updatedVertices = sketch.vertices.map(v => {
      return {
        ...v,
        x: v.x * (newValue / 10), // Deterministic scaling factor simulation
        y: v.y * (newValue / 10)
      };
    });

    return {
      ...sketch,
      vertices: updatedVertices,
      constraints: updatedConstraints
    };
  }
}
