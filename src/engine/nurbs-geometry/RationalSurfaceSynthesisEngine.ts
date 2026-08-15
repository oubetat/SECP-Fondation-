/**
 * PATCH-SECP-074-003: Rational NURBS Surface Synthesis Engine
 * Evaluates points on 3D Rational NURBS surfaces by applying Cox-de Boor tensor products.
 */

import { NurbsSurface, Vector3D } from './NurbsTypes';
import { CoxDeBoorEvaluatorEngine } from './CoxDeBoorEvaluatorEngine';

export class RationalSurfaceSynthesisEngine {
  /**
   * Evaluates a 3D point S(u,v) on a Rational NURBS Surface.
   * Uses tensor product of basis functions N_{i,p}(u) and N_{j,q}(v).
   */
  public static evaluatePoint(surface: NurbsSurface, u: number, v: number): Vector3D {
    const spanU = CoxDeBoorEvaluatorEngine.findKnotSpan(u, surface.degreeU, surface.knotsU);
    const spanV = CoxDeBoorEvaluatorEngine.findKnotSpan(v, surface.degreeV, surface.knotsV);

    const basisU = CoxDeBoorEvaluatorEngine.evaluateBasisFunctions(u, surface.degreeU, surface.knotsU);
    const basisV = CoxDeBoorEvaluatorEngine.evaluateBasisFunctions(v, surface.degreeV, surface.knotsV);

    let SW = { x: 0, y: 0, z: 0 };
    let W = 0;

    for (let i = 0; i <= surface.degreeU; i++) {
      for (let j = 0; j <= surface.degreeV; j++) {
        const cpIndexU = spanU - surface.degreeU + i;
        const cpIndexV = spanV - surface.degreeV + j;

        const cp = surface.controlPoints[cpIndexU][cpIndexV];
        const Nu = basisU[i];
        const Nv = basisV[j];

        const weighted_N = Nu * Nv * cp.w;

        SW.x += cp.x * weighted_N;
        SW.y += cp.y * weighted_N;
        SW.z += cp.z * weighted_N;
        W += weighted_N;
      }
    }

    if (W === 0) return { x: 0, y: 0, z: 0 };

    return { x: SW.x / W, y: SW.y / W, z: SW.z / W };
  }
}
