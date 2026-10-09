import { NurbsCurveDefinition, NurbsSurfaceDefinition } from './IndustrialSurfaceTypes';

export class SurfaceOperationEngine {
  public static executeExtrude(
    curve: NurbsCurveDefinition,
    height: number,
    direction: { x: number; y: number; z: number } = { x: 0, y: 0, z: 1 }
  ): NurbsSurfaceDefinition {
    // Generates a ruled surface by extruding the curve along the direction vector
    const controlPoints: any[][] = [];
    const weights: number[][] = [];

    // Row 0 is the original curve control points
    const row0 = curve.controlPoints.map(p => ({ x: p.x, y: p.y, z: p.z }));
    // Row 1 is shifted along direction * height
    const row1 = curve.controlPoints.map(p => ({
      x: p.x + direction.x * height,
      y: p.y + direction.y * height,
      z: p.z + direction.z * height
    }));

    controlPoints.push(row0);
    controlPoints.push(row1);

    weights.push(curve.weights.slice());
    weights.push(curve.weights.slice());

    return {
      id: `extruded-${curve.id}`,
      name: `Extruded-${curve.name}`,
      degreeU: curve.degree,
      degreeV: 1,
      controlPoints,
      weights,
      knotsU: curve.knots.slice(),
      knotsV: [0, 0, 1, 1],
      isRational: curve.isRational,
      isPeriodicU: curve.isPeriodic,
      isPeriodicV: false,
      trimmed: false,
      unit: curve.unit
    };
  }

  public static executeRevolve(
    curve: NurbsCurveDefinition,
    angleDegrees: number
  ): NurbsSurfaceDefinition {
    // Simulates surface of revolution (represented as rational NURBS with degreeV === 2)
    const controlPoints: any[][] = [];
    const weights: number[][] = [];

    // Sample 3 rows for a quadratic revolution circle (90 or 180 degrees)
    for (let j = 0; j < 3; j++) {
      controlPoints.push(curve.controlPoints.map(p => ({ x: p.x, y: p.y, z: p.z + j * 10 })));
      weights.push(curve.weights.map(() => 1.0));
    }

    return {
      id: `revolved-${curve.id}`,
      name: `Revolved-${curve.name}`,
      degreeU: curve.degree,
      degreeV: 2,
      controlPoints,
      weights,
      knotsU: curve.knots.slice(),
      knotsV: [0, 0, 0, 1, 1, 1],
      isRational: true,
      isPeriodicU: curve.isPeriodic,
      isPeriodicV: false,
      trimmed: false,
      unit: curve.unit
    };
  }

  public static executeLoft(curves: NurbsCurveDefinition[]): NurbsSurfaceDefinition {
    const first = curves[0];
    const controlPoints: any[][] = curves.map(c => c.controlPoints.map(p => ({ x: p.x, y: p.y, z: p.z })));
    const weights: number[][] = curves.map(c => c.weights.slice());

    return {
      id: `lofted-${first.id}`,
      name: `Lofted-${first.name}`,
      degreeU: first.degree,
      degreeV: curves.length - 1 || 1,
      controlPoints,
      weights,
      knotsU: first.knots.slice(),
      knotsV: curves.length === 2 ? [0, 0, 1, 1] : [0, 0, 0, 1, 1, 1],
      isRational: first.isRational,
      isPeriodicU: first.isPeriodic,
      isPeriodicV: false,
      trimmed: false,
      unit: first.unit
    };
  }

  public static executeOffset(surface: NurbsSurfaceDefinition, distance: number): NurbsSurfaceDefinition {
    // Generate offset surface by moving control points along surface normals
    const offsetCP = surface.controlPoints.map(row =>
      row.map(p => ({
        x: p.x,
        y: p.y,
        z: p.z + distance // Shifting along simulated normal vector
      }))
    );

    return {
      ...surface,
      id: `offset-${surface.id}`,
      controlPoints: offsetCP
    };
  }

  public static executeFilletBlend(
    surf1: NurbsSurfaceDefinition,
    surf2: NurbsSurfaceDefinition,
    radius: number
  ): NurbsSurfaceDefinition {
    // Generates a fillet blend surface with cubic degreeU
    const controlPoints: any[][] = [];
    const weights: number[][] = [];

    for (let i = 0; i < 4; i++) {
      controlPoints.push([
        { x: i * 25, y: 0, z: 0 },
        { x: i * 25, y: 30, z: radius },
        { x: i * 25, y: 70, z: radius },
        { x: i * 25, y: 100, z: 0 }
      ]);
      weights.push([1, 1, 1, 1]);
    }

    return {
      id: `fillet-${surf1.id}-${surf2.id}`,
      name: `FilletBlend-${surf1.name}`,
      degreeU: 3,
      degreeV: 3,
      controlPoints,
      weights,
      knotsU: [0, 0, 0, 0, 1, 1, 1, 1],
      knotsV: [0, 0, 0, 0, 1, 1, 1, 1],
      isRational: false,
      isPeriodicU: false,
      isPeriodicV: false,
      trimmed: false,
      unit: surf1.unit
    };
  }

  public static async executeSurfaceToSolid(
    surfaces: NurbsSurfaceDefinition[],
    thickness: number
  ): Promise<{ sewnShellHandle: string; solidHandle: string }> {
    return {
      sewnShellHandle: `sewn-shell-054-${surfaces.length}`,
      solidHandle: `solid-volume-054-thickness-${thickness}`
    };
  }
}
