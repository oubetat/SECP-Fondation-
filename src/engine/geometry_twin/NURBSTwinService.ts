// SECP Industrial OS v2 — NURBS Twin Service
import { NURBSCurveDefinition, NURBSSurfaceDefinition, Vector3D } from './types';
import { CanonicalGeometrySerializer } from './CanonicalGeometrySerializer';

export class NURBSTwinService {
  public static createSampleNURBSCurve(): NURBSCurveDefinition {
    const cp: Vector3D[] = [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 20, z: 0 },
      { x: 30, y: 15, z: 5 },
      { x: 40, y: 0, z: 0 }
    ];
    const knots = [0, 0, 0, 0, 1, 1, 1, 1];
    const weights = [1, 1, 1, 1];
    const multiplicities = [4, 4];

    const curve: NURBSCurveDefinition = {
      curveId: 'NCURVE-01',
      degree: 3,
      knots,
      weights,
      controlPoints: cp,
      multiplicities,
      isRational: false,
      parameterDomain: [0, 1],
      curveHash: ''
    };

    curve.curveHash = CanonicalGeometrySerializer.computeNURBSCurveHash(curve);
    return curve;
  }

  public static createSampleNURBSSurface(): NURBSSurfaceDefinition {
    const cp: Vector3D[][] = [
      [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 10, z: 2 },
        { x: 0, y: 20, z: 0 }
      ],
      [
        { x: 10, y: 0, z: 4 },
        { x: 10, y: 10, z: 12 },
        { x: 10, y: 20, z: 4 }
      ],
      [
        { x: 20, y: 0, z: 0 },
        { x: 20, y: 10, z: 2 },
        { x: 20, y: 20, z: 0 }
      ]
    ];
    const weights: number[][] = [
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1]
    ];
    const knotsU = [0, 0, 0, 1, 1, 1];
    const knotsV = [0, 0, 0, 1, 1, 1];

    const surf: NURBSSurfaceDefinition = {
      surfaceId: 'NSURF-01',
      degreeU: 2,
      degreeV: 2,
      knotsU,
      knotsV,
      weights,
      controlPoints: cp,
      multiplicitiesU: [3, 3],
      multiplicitiesV: [3, 3],
      isRational: false,
      parameterDomainU: [0, 1],
      parameterDomainV: [0, 1],
      surfaceHash: ''
    };

    surf.surfaceHash = CanonicalGeometrySerializer.computeNURBSSurfaceHash(surf);
    return surf;
  }
}
