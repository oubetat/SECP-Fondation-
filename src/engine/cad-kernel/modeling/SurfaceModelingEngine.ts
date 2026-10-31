/**
 * SECP CAD Kernel — Advanced Surface Modeling Engine
 * WP-02 Implementation & Qualification Authority
 */

import { BRepNURBSSurface, BRepPoint } from '../geometry/BRepGeometry';
import { BRepFace, BRepLoop, BRepEdge, BRepVertex } from '../topology/BRepTopology';
import { Orientation, TopoShapeEnum, Edge, Vertex, Loop, Face } from '../topology/TopologyContracts';
import { Point, Direction, Curve } from '../geometry/GeometryContracts';
import { NurbsDerivatives } from '../nurbs/NurbsDerivatives';

export interface SurfaceContinuityReport {
  G0: boolean;
  G1: boolean;
  G2: boolean;
  maxG0Gap: number;
  minG1NormalDot: number;
  maxG2CurvatureDiff: number;
  samples: number;
  diagnostics: string[];
}

export class NurbsIsoCurve implements Curve {
  constructor(
    private surface: BRepNURBSSurface,
    private isUFixed: boolean,
    private fixedParam: number
  ) {}

  public evaluate(t: number): Point {
    const pt = this.isUFixed
      ? this.surface.evaluate(this.fixedParam, t)
      : this.surface.evaluate(t, this.fixedParam);
    return { x: pt.x as any, y: pt.y as any, z: pt.z as any };
  }

  public domain(): { uMin: number; uMax: number } {
    return { uMin: 0, uMax: 1 };
  }
}

export class SurfaceModelingEngine {
  /**
   * Performs a NURBS loft between multiple profiles.
   */
  public static loftNURBS(profiles: Point[][]): BRepNURBSSurface {
    if (!profiles || profiles.length < 2) {
      throw new Error('Loft requires at least 2 profiles');
    }

    const numU = profiles[0].length;
    const numV = profiles.length;

    if (numU < 2) {
      throw new Error('Each loft profile must contain at least 2 points');
    }

    for (let j = 0; j < numV; j++) {
      if (profiles[j].length !== numU) {
        throw new Error('All loft profiles must have the same number of control points for simple NURBS mapping');
      }
    }

    // Build control net: U along profile curves, V across profiles
    const controlNet: Point[][] = [];
    for (let i = 0; i < numU; i++) {
      const uColumn: Point[] = [];
      for (let j = 0; j < numV; j++) {
        uColumn.push({
          x: profiles[j][i].x,
          y: profiles[j][i].y,
          z: profiles[j][i].z
        });
      }
      controlNet.push(uColumn);
    }

    const degU = Math.min(3, numU - 1);
    const degV = Math.min(3, numV - 1);

    return BRepNURBSSurface.create({
      degreeU: degU,
      degreeV: degV,
      controlPoints: controlNet
    });
  }

  /**
   * Generates a swept surface by translating a profile along a trajectory curve.
   */
  public static sweepNURBS(profile: Point[], trajectory: Point[]): BRepNURBSSurface {
    if (!profile || profile.length < 2) {
      throw new Error('Sweep requires a profile with at least 2 points');
    }
    if (!trajectory || trajectory.length < 2) {
      throw new Error('Sweep requires a trajectory with at least 2 points');
    }

    const profiles: Point[][] = [];
    const baseOrigin = trajectory[0];

    for (const pos of trajectory) {
      const translation = {
        x: pos.x - baseOrigin.x,
        y: pos.y - baseOrigin.y,
        z: pos.z - baseOrigin.z
      };
      const shiftedProfile: Point[] = profile.map(p => ({
        x: (p.x + translation.x) as any,
        y: (p.y + translation.y) as any,
        z: (p.z + translation.z) as any
      }));
      profiles.push(shiftedProfile);
    }

    return this.loftNURBS(profiles);
  }

  /**
   * Creates a ruled surface interpolating linearly between two boundary curves.
   */
  public static ruledNURBS(curveA: Point[], curveB: Point[]): BRepNURBSSurface {
    if (curveA.length !== curveB.length || curveA.length < 2) {
      throw new Error('Ruled surface requires two curves with equal point counts (>= 2)');
    }
    return this.loftNURBS([curveA, curveB]);
  }

  /**
   * Generates a surface of revolution by revolving a 3D profile around an axis.
   */
  public static revolveNURBS(
    profile: Point[],
    axisPoint: Point,
    axisDir: Direction,
    angleRad: number = 2 * Math.PI
  ): BRepNURBSSurface {
    if (!profile || profile.length < 2) {
      throw new Error('Revolve requires a profile with at least 2 points');
    }

    const len = Math.hypot(axisDir.x, axisDir.y, axisDir.z) || 1;
    const u = { x: axisDir.x / len, y: axisDir.y / len, z: axisDir.z / len };

    // Discretize revolution into steps (minimum 4 quadrants for circular fidelity)
    const steps = Math.max(4, Math.ceil(Math.abs(angleRad) / (Math.PI / 4)));
    const profiles: Point[][] = [];

    for (let s = 0; s <= steps; s++) {
      const theta = (s / steps) * angleRad;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      const rotatedProfile: Point[] = profile.map(p => {
        const px = p.x - axisPoint.x;
        const py = p.y - axisPoint.y;
        const pz = p.z - axisPoint.z;

        const dot = px * u.x + py * u.y + pz * u.z;
        const crossX = u.y * pz - u.z * py;
        const crossY = u.z * px - u.x * pz;
        const crossZ = u.x * py - u.y * px;

        return {
          x: (axisPoint.x + (px * cosT + crossX * sinT + u.x * dot * (1 - cosT))) as any,
          y: (axisPoint.y + (py * cosT + crossY * sinT + u.y * dot * (1 - cosT))) as any,
          z: (axisPoint.z + (pz * cosT + crossZ * sinT + u.z * dot * (1 - cosT))) as any
        };
      });

      profiles.push(rotatedProfile);
    }

    return this.loftNURBS(profiles);
  }

  /**
   * Generates a Coons boundary surface patch from 4 boundary curves:
   * cBottom (v=0), cTop (v=1), cLeft (u=0), cRight (u=1).
   */
  public static boundaryCoonsPatch(
    cBottom: Point[],
    cTop: Point[],
    cLeft: Point[],
    cRight: Point[]
  ): BRepNURBSSurface {
    const Nu = cBottom.length;
    const Nv = cLeft.length;

    if (cTop.length !== Nu || cRight.length !== Nv) {
      throw new Error('Boundary curve dimensions must match: bottom/top must have Nu points, left/right must have Nv points');
    }

    // Corner points
    const P00 = cBottom[0];
    const P10 = cBottom[Nu - 1];
    const P01 = cTop[0];
    const P11 = cTop[Nu - 1];

    const grid: Point[][] = [];

    for (let i = 0; i < Nu; i++) {
      const u = i / (Nu - 1);
      const uColumn: Point[] = [];
      for (let j = 0; j < Nv; j++) {
        const v = j / (Nv - 1);

        // Ruled surface R1(u, v) blending cBottom and cTop
        const r1x = (1 - v) * cBottom[i].x + v * cTop[i].x;
        const r1y = (1 - v) * cBottom[i].y + v * cTop[i].y;
        const r1z = (1 - v) * cBottom[i].z + v * cTop[i].z;

        // Ruled surface R2(u, v) blending cLeft and cRight
        const r2x = (1 - u) * cLeft[j].x + u * cRight[j].x;
        const r2y = (1 - u) * cLeft[j].y + u * cRight[j].y;
        const r2z = (1 - u) * cLeft[j].z + u * cRight[j].z;

        // Bilinear corner blend T(u, v)
        const tx = (1 - u) * (1 - v) * P00.x + u * (1 - v) * P10.x + (1 - u) * v * P01.x + u * v * P11.x;
        const ty = (1 - u) * (1 - v) * P00.y + u * (1 - v) * P10.y + (1 - u) * v * P01.y + u * v * P11.y;
        const tz = (1 - u) * (1 - v) * P00.z + u * (1 - v) * P10.z + (1 - u) * v * P01.z + u * v * P11.z;

        // Coons patch S(u, v) = R1 + R2 - T
        uColumn.push({
          x: (r1x + r2x - tx) as any,
          y: (r1y + r2y - ty) as any,
          z: (r1z + r2z - tz) as any
        });
      }
      grid.push(uColumn);
    }

    const degU = Math.min(3, Nu - 1);
    const degV = Math.min(3, Nv - 1);

    return BRepNURBSSurface.create({
      degreeU: degU,
      degreeV: degV,
      controlPoints: grid
    });
  }

  /**
   * Creates a fully valid, closed topological B-Rep Face from a NURBS surface.
   */
  public static createNURBSFace(surface: BRepNURBSSurface, id: string): Face {
    const p00 = surface.evaluate(0, 0);
    const p10 = surface.evaluate(1, 0);
    const p11 = surface.evaluate(1, 1);
    const p01 = surface.evaluate(0, 1);

    const v00: Vertex = { id: `${id}_v00`, shapeType: TopoShapeEnum.VERTEX, geometry: p00 as any, tolerance: 1e-7 };
    const v10: Vertex = { id: `${id}_v10`, shapeType: TopoShapeEnum.VERTEX, geometry: p10 as any, tolerance: 1e-7 };
    const v11: Vertex = { id: `${id}_v11`, shapeType: TopoShapeEnum.VERTEX, geometry: p11 as any, tolerance: 1e-7 };
    const v01: Vertex = { id: `${id}_v01`, shapeType: TopoShapeEnum.VERTEX, geometry: p01 as any, tolerance: 1e-7 };

    // 4 Boundary Isoline Curves
    const curveBottom = new NurbsIsoCurve(surface, false, 0); // v = 0, u: 0 -> 1
    const curveRight = new NurbsIsoCurve(surface, true, 1);   // u = 1, v: 0 -> 1
    const curveTop = new NurbsIsoCurve(surface, false, 1);     // v = 1, u: 1 -> 0
    const curveLeft = new NurbsIsoCurve(surface, true, 0);    // u = 0, v: 1 -> 0

    const eBottom: Edge = { id: `${id}_e_bot`, shapeType: TopoShapeEnum.EDGE, geometry: curveBottom, startVertex: v00, endVertex: v10, tolerance: 1e-7 };
    const eRight: Edge = { id: `${id}_e_rig`, shapeType: TopoShapeEnum.EDGE, geometry: curveRight, startVertex: v10, endVertex: v11, tolerance: 1e-7 };
    const eTop: Edge = { id: `${id}_e_top`, shapeType: TopoShapeEnum.EDGE, geometry: curveTop, startVertex: v11, endVertex: v01, tolerance: 1e-7 };
    const eLeft: Edge = { id: `${id}_e_lef`, shapeType: TopoShapeEnum.EDGE, geometry: curveLeft, startVertex: v01, endVertex: v00, tolerance: 1e-7 };

    const outerLoop: Loop = {
      id: `${id}_loop`,
      shapeType: TopoShapeEnum.LOOP,
      orientedEdges: [
        { edge: eBottom, orientation: Orientation.FORWARD },
        { edge: eRight, orientation: Orientation.FORWARD },
        { edge: eTop, orientation: Orientation.FORWARD },
        { edge: eLeft, orientation: Orientation.FORWARD }
      ]
    };

    return {
      id,
      shapeType: TopoShapeEnum.FACE,
      geometry: surface as any,
      outerLoop,
      innerLoops: []
    };
  }

  /**
   * Evaluates geometric and differential continuity (G0, G1, G2) across two adjacent NURBS surfaces.
   */
  public static checkContinuity(
    surfA: BRepNURBSSurface,
    surfB: BRepNURBSSurface,
    options: {
      boundaryType?: 'U_MAX_TO_U_MIN' | 'V_MAX_TO_V_MIN';
      samples?: number;
      toleranceG0?: number;
      toleranceG1AngleDeg?: number;
      toleranceG2?: number;
    } = {}
  ): SurfaceContinuityReport {
    const samples = options.samples || 21;
    const tolG0 = options.toleranceG0 || 1e-5;
    const tolG1 = Math.cos(((options.toleranceG1AngleDeg || 1.0) * Math.PI) / 180.0);
    const tolG2 = options.toleranceG2 || 1e-2;
    const isUMaxToUMin = (options.boundaryType || 'U_MAX_TO_U_MIN') === 'U_MAX_TO_U_MIN';

    let maxG0Gap = 0;
    let minG1NormalDot = 1.0;
    let maxG2CurvatureDiff = 0;
    const diagnostics: string[] = [];

    const tol = { absolute: 1e-7, relative: 1e-7 };

    for (let i = 0; i < samples; i++) {
      const t = i / (samples - 1);
      const ptA = isUMaxToUMin ? surfA.evaluate(1, t) : surfA.evaluate(t, 1);
      const ptB = isUMaxToUMin ? surfB.evaluate(0, t) : surfB.evaluate(t, 0);

      // G0: Euclidean distance
      const gap = Math.hypot(ptA.x - ptB.x, ptA.y - ptB.y, ptA.z - ptB.z);
      if (gap > maxG0Gap) maxG0Gap = gap;

      // G1: Normal vector dot product
      const normResA = NurbsDerivatives.evaluateSurfaceNormal(
        surfA as any,
        isUMaxToUMin ? 1 : t,
        isUMaxToUMin ? t : 1,
        tol
      );
      const normResB = NurbsDerivatives.evaluateSurfaceNormal(
        surfB as any,
        isUMaxToUMin ? 0 : t,
        isUMaxToUMin ? t : 0,
        tol
      );

      if (normResA.status === 'OK' && normResB.status === 'OK' && normResA.normal && normResB.normal) {
        const nA = normResA.normal;
        const nB = normResB.normal;
        const dot = nA.x * nB.x + nA.y * nB.y + nA.z * nB.z;
        if (dot < minG1NormalDot) minG1NormalDot = dot;
      }

      // G2: Mean curvature comparison
      const curvResA = NurbsDerivatives.evaluateSurfaceCurvatures(
        surfA as any,
        isUMaxToUMin ? 1 : t,
        isUMaxToUMin ? t : 1,
        tol
      );
      const curvResB = NurbsDerivatives.evaluateSurfaceCurvatures(
        surfB as any,
        isUMaxToUMin ? 0 : t,
        isUMaxToUMin ? t : 0,
        tol
      );

      if (curvResA.status === 'OK' && curvResB.status === 'OK') {
        const diff = Math.abs((curvResA.meanCurvature || 0) - (curvResB.meanCurvature || 0));
        if (diff > maxG2CurvatureDiff) maxG2CurvatureDiff = diff;
      }
    }

    const g0Passed = maxG0Gap <= tolG0;
    const g1Passed = minG1NormalDot >= tolG1;
    const g2Passed = maxG2CurvatureDiff <= tolG2;

    if (!g0Passed) diagnostics.push(`G0 violation: max positional gap ${maxG0Gap.toExponential(3)} > ${tolG0}`);
    if (!g1Passed) diagnostics.push(`G1 violation: min normal alignment ${minG1NormalDot.toFixed(4)} < ${tolG1.toFixed(4)}`);
    if (!g2Passed) diagnostics.push(`G2 violation: max curvature delta ${maxG2CurvatureDiff.toFixed(4)} > ${tolG2}`);

    return {
      G0: g0Passed,
      G1: g1Passed,
      G2: g2Passed,
      maxG0Gap,
      minG1NormalDot,
      maxG2CurvatureDiff,
      samples,
      diagnostics
    };
  }
}
