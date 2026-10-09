import { NurbsCurve, NurbsSurface, NurbsTolerance, NurbsEvaluationResult } from './NurbsContracts';
import { NurbsValidator } from './NurbsValidator';
import { NurbsBasis } from './NurbsBasis';

export class NurbsEvaluator {
  public static evaluateCurve(curve: NurbsCurve, u: number, tol: NurbsTolerance): NurbsEvaluationResult {
    const valRes = NurbsValidator.validateCurve(curve);
    if (!valRes.isValid) {
      return { status: "INVALID", point: { x: NaN, y: NaN, z: NaN }, denominator: 0, diagnostics: valRes.errors.map(e => e.message) };
    }

    const p = curve.degree;
    const n = curve.controlPoints.length - 1;
    const uMin = curve.knots[p];
    const uMax = curve.knots[n + 1];

    if (u < uMin - tol.absolute || u > uMax + tol.absolute) {
      return { status: "INVALID", point: { x: NaN, y: NaN, z: NaN }, parameter: u, denominator: 0, diagnostics: [`Parameter u=${u} outside domain [${uMin}, ${uMax}]`] };
    }

    // Clamp within numerical tolerance
    const clampedU = Math.max(uMin, Math.min(uMax, u));
    
    const span = NurbsBasis.findKnotSpan(clampedU, p, curve.knots, tol);
    const N = NurbsBasis.evaluateBasisFunctions(span, clampedU, p, curve.knots);

    let CWx = 0, CWy = 0, CWz = 0, W = 0;
    
    for (let i = 0; i <= p; i++) {
      const cpIndex = span - p + i;
      const cp = curve.controlPoints[cpIndex];
      const weight = cp.w;
      const basis = N[i];
      const weightedBasis = basis * weight;

      CWx += cp.x * weightedBasis;
      CWy += cp.y * weightedBasis;
      CWz += cp.z * weightedBasis;
      W += weightedBasis;
    }

    if (Math.abs(W) <= tol.absolute) {
      return { status: "SINGULAR", point: { x: NaN, y: NaN, z: NaN }, parameter: u, denominator: W, diagnostics: ["Homogeneous sum W is zero"] };
    }

    return {
      status: "OK",
      point: {
        x: CWx / W,
        y: CWy / W,
        z: CWz / W
      },
      parameter: u,
      denominator: W
    };
  }

  public static evaluateSurface(surface: NurbsSurface, u: number, v: number, tol: NurbsTolerance): NurbsEvaluationResult {
    const valRes = NurbsValidator.validateSurface(surface);
    if (!valRes.isValid) {
      return { status: "INVALID", point: { x: NaN, y: NaN, z: NaN }, denominator: 0, diagnostics: valRes.errors.map(e => e.message) };
    }

    const pU = surface.degreeU;
    const pV = surface.degreeV;
    const nU = surface.controlPoints.length - 1;
    const nV = surface.controlPoints[0].length - 1;
    
    const uMin = surface.knotsU[pU];
    const uMax = surface.knotsU[nU + 1];
    const vMin = surface.knotsV[pV];
    const vMax = surface.knotsV[nV + 1];

    if (u < uMin - tol.absolute || u > uMax + tol.absolute || v < vMin - tol.absolute || v > vMax + tol.absolute) {
      return { status: "INVALID", point: { x: NaN, y: NaN, z: NaN }, u, v, denominator: 0, diagnostics: [`Parameters (u=${u}, v=${v}) outside domain`] };
    }

    const clampedU = Math.max(uMin, Math.min(uMax, u));
    const clampedV = Math.max(vMin, Math.min(vMax, v));

    const spanU = NurbsBasis.findKnotSpan(clampedU, pU, surface.knotsU, tol);
    const spanV = NurbsBasis.findKnotSpan(clampedV, pV, surface.knotsV, tol);
    
    const Nu = NurbsBasis.evaluateBasisFunctions(spanU, clampedU, pU, surface.knotsU);
    const Nv = NurbsBasis.evaluateBasisFunctions(spanV, clampedV, pV, surface.knotsV);

    let SWx = 0, SWy = 0, SWz = 0, W = 0;

    for (let i = 0; i <= pU; i++) {
      for (let j = 0; j <= pV; j++) {
        const uIndex = spanU - pU + i;
        const vIndex = spanV - pV + j;
        const cp = surface.controlPoints[uIndex][vIndex];
        const weight = cp.w;
        const basisU = Nu[i];
        const basisV = Nv[j];
        
        const weightedBasis = basisU * basisV * weight;

        SWx += cp.x * weightedBasis;
        SWy += cp.y * weightedBasis;
        SWz += cp.z * weightedBasis;
        W += weightedBasis;
      }
    }

    if (Math.abs(W) <= tol.absolute) {
      return { status: "SINGULAR", point: { x: NaN, y: NaN, z: NaN }, u, v, denominator: W, diagnostics: ["Homogeneous sum W is zero"] };
    }

    return {
      status: "OK",
      point: {
        x: SWx / W,
        y: SWy / W,
        z: SWz / W
      },
      u,
      v,
      denominator: W
    };
  }
}
