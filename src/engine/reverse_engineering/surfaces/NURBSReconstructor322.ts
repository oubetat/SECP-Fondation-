
import { AnalyticalSurface321A } from './AnalyticalSurfaceTypes321A';
import { NURBSSurfaceData322, NURBSPoint322 } from './NURBSTypes322';
import { MathUtils321A } from './MathUtils321A';

export class NURBSReconstructor322 {
  public static reconstruct(surface: AnalyticalSurface321A): NURBSSurfaceData322 | null {
    switch (surface.surfaceType) {
      case 'PLANE':
        return this.reconstructPlane(surface);
      case 'CYLINDER':
        return this.reconstructCylinder(surface);
      case 'SPHERE':
        return this.reconstructSphere(surface);
      case 'CONE':
        return this.reconstructCone(surface);
      default:
        return null;
    }
  }

  private static reconstructPlane(surface: AnalyticalSurface321A): NURBSSurfaceData322 {
    const { normal, centroid, extents } = surface.parameters;
    if (!normal || !centroid) throw new Error('Invalid plane parameters');

    const [u, v] = MathUtils321A.findOrthogonalBasis(normal);
    const sizeU = extents ? extents[0] : 100;
    const sizeV = extents ? extents[1] : 100;

    const cp: NURBSPoint322[][] = [
      [
        { x: centroid[0] - sizeU * u[0] - sizeV * v[0], y: centroid[1] - sizeU * u[1] - sizeV * v[1], z: centroid[2] - sizeU * u[2] - sizeV * v[2] },
        { x: centroid[0] - sizeU * u[0] + sizeV * v[0], y: centroid[1] - sizeU * u[1] + sizeV * v[1], z: centroid[2] - sizeU * u[2] + sizeV * v[2] }
      ],
      [
        { x: centroid[0] + sizeU * u[0] - sizeV * v[0], y: centroid[1] + sizeU * u[1] - sizeV * v[1], z: centroid[2] + sizeU * u[2] - sizeV * v[2] },
        { x: centroid[0] + sizeU * u[0] + sizeV * v[0], y: centroid[1] + sizeU * u[1] + sizeV * v[1], z: centroid[2] + sizeU * u[2] + sizeV * v[2] }
      ]
    ];

    return {
      degreeU: 1,
      degreeV: 1,
      knotsU: [0, 0, 1, 1],
      knotsV: [0, 0, 1, 1],
      controlPoints: cp,
      weights: [[1, 1], [1, 1]],
      isRational: false
    };
  }

  private static reconstructCylinder(surface: AnalyticalSurface321A): NURBSSurfaceData322 {
    const { axisOrigin, axisDirection, radius, height: paramHeight } = surface.parameters;
    if (!axisOrigin || !axisDirection || radius === undefined) throw new Error('Invalid cylinder parameters');

    const [u, v] = MathUtils321A.findOrthogonalBasis(axisDirection);
    const height = paramHeight ?? 100;

    // Standard 9-point NURBS circle in the [u, v] plane
    const w = Math.sqrt(2) / 2;
    const circleCP_local = [
      [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0]
    ];
    const circleWeights = [1, w, 1, w, 1, w, 1, w, 1];

    const cp: NURBSPoint322[][] = Array.from({ length: 9 }, () => new Array(2));
    const weights: number[][] = Array.from({ length: 9 }, () => new Array(2));

    for (let i = 0; i < 9; i++) {
      const lu = circleCP_local[i][0] * radius;
      const lv = circleCP_local[i][1] * radius;
      
      // Top point (h=0)
      cp[i][0] = {
        x: axisOrigin[0] + lu * u[0] + lv * v[0],
        y: axisOrigin[1] + lu * u[1] + lv * v[1],
        z: axisOrigin[2] + lu * u[2] + lv * v[2]
      };
      
      // Bottom point (h=height)
      cp[i][1] = {
        x: axisOrigin[0] + height * axisDirection[0] + lu * u[0] + lv * v[0],
        y: axisOrigin[1] + height * axisDirection[1] + lu * u[1] + lv * v[1],
        z: axisOrigin[2] + height * axisDirection[2] + lu * u[2] + lv * v[2]
      };

      weights[i][0] = circleWeights[i];
      weights[i][1] = circleWeights[i];
    }

    return {
      degreeU: 2,
      degreeV: 1,
      knotsU: [0, 0, 0, 0.25, 0.25, 0.5, 0.5, 0.75, 0.75, 1, 1, 1],
      knotsV: [0, 0, 1, 1],
      controlPoints: cp,
      weights: weights,
      isRational: true
    };
  }

  private static reconstructSphere(surface: AnalyticalSurface321A): NURBSSurfaceData322 {
    const { center, radius } = surface.parameters;
    if (!center || radius === undefined) throw new Error('Invalid sphere parameters');

    // A sphere is a surface of revolution of a semi-circle
    // Semi-circle (degree 2, 3 points) revolved 360 degrees
    const w = Math.sqrt(2) / 2;
    
    // Semi-circle CP (in XZ plane)
    const arcCP = [[0, 1], [1, 1], [1, 0]]; // Actually for sphere we need a full 180 arc
    // Better: 3 segments for 180 degrees? 
    // Let's use 5 points for 180 degrees (2 segments of 90 deg)
    // Semi-circle CP (in XZ plane, traversing latitude from North Pole +radius to South Pole -radius)
    const arcPoints = [[0, 0, radius], [radius, 0, radius], [radius, 0, 0], [radius, 0, -radius], [0, 0, -radius]];
    const arcWeights = [1, w, 1, w, 1];
    
    // Revolve arc around Z axis
    const cp: NURBSPoint322[][] = Array.from({ length: 9 }, () => new Array(5));
    const weights: number[][] = Array.from({ length: 9 }, () => new Array(5));

    const circleWeights = [1, w, 1, w, 1, w, 1, w, 1];
    // Clockwise circle parameterization in XY plane ensures that (dS/du x dS/dv) = (-theta) x (-z) = +r (strictly OUTWARD normal)
    const circleCP_unit = [[1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0]];

    for (let j = 0; j < 5; j++) {
      const r_at_h = arcPoints[j][0];
      const z_at_h = arcPoints[j][2];
      
      for (let i = 0; i < 9; i++) {
        cp[i][j] = {
          x: center[0] + circleCP_unit[i][0] * r_at_h,
          y: center[1] + circleCP_unit[i][1] * r_at_h,
          z: center[2] + z_at_h
        };
        weights[i][j] = circleWeights[i] * arcWeights[j];
      }
    }

    return {
      degreeU: 2,
      degreeV: 2,
      knotsU: [0, 0, 0, 0.25, 0.25, 0.5, 0.5, 0.75, 0.75, 1, 1, 1],
      knotsV: [0, 0, 0, 0.5, 0.5, 1, 1, 1],
      controlPoints: cp,
      weights: weights,
      isRational: true
    };
  }

  private static reconstructCone(surface: AnalyticalSurface321A): NURBSSurfaceData322 {
    const { apex, axisDirection, halfAngleDeg, height: paramHeight } = surface.parameters;
    if (!apex || !axisDirection || halfAngleDeg === undefined) throw new Error('Invalid cone parameters');

    const [u, v] = MathUtils321A.findOrthogonalBasis(axisDirection);
    const halfAngleRad = halfAngleDeg * Math.PI / 180;
    const height = paramHeight ?? 100;
    const radiusAtHeight = height * Math.tan(halfAngleRad);

    const w = Math.sqrt(2) / 2;
    const circleCP_unit = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0]];
    const circleWeights = [1, w, 1, w, 1, w, 1, w, 1];

    const cp: NURBSPoint322[][] = Array.from({ length: 9 }, () => new Array(2));
    const weights: number[][] = Array.from({ length: 9 }, () => new Array(2));

    for (let i = 0; i < 9; i++) {
      // Top point (Apex)
      cp[i][0] = { x: apex[0], y: apex[1], z: apex[2] };
      
      // Bottom point (Circular base)
      const lu = circleCP_unit[i][0] * radiusAtHeight;
      const lv = circleCP_unit[i][1] * radiusAtHeight;
      cp[i][1] = {
        x: apex[0] + height * axisDirection[0] + lu * u[0] + lv * v[0],
        y: apex[1] + height * axisDirection[1] + lu * u[1] + lv * v[1],
        z: apex[2] + height * axisDirection[2] + lu * u[2] + lv * v[2]
      };

      weights[i][0] = circleWeights[i];
      weights[i][1] = circleWeights[i];
    }

    return {
      degreeU: 2,
      degreeV: 1,
      knotsU: [0, 0, 0, 0.25, 0.25, 0.5, 0.5, 0.75, 0.75, 1, 1, 1],
      knotsV: [0, 0, 1, 1],
      controlPoints: cp,
      weights: weights,
      isRational: true
    };
  }
}
