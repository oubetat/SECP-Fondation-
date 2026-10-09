import { NurbsCurve, NurbsControlPoint, NurbsTolerance } from './NurbsContracts';
import { NurbsValidator } from './NurbsValidator';
import { NurbsBasis } from './NurbsBasis';
import { NurbsEvaluator } from './NurbsEvaluator';

export class NurbsKnotInsertion {
  public static insertKnotCurve(curve: NurbsCurve, u: number, r: number, tol: NurbsTolerance): NurbsCurve | null {
    const valRes = NurbsValidator.validateCurve(curve);
    if (!valRes.isValid) return null;

    if (!Number.isFinite(u) || r <= 0) {
      return curve; // nothing to do
    }

    const p = curve.degree;
    const n = curve.controlPoints.length - 1;
    const uMin = curve.knots[p];
    const uMax = curve.knots[n + 1];

    if (u < uMin || u > uMax) {
      return null;
    }

    let currentKnots = [...curve.knots];
    let currentHomogeneous = curve.controlPoints.map(cp => ({
      x: cp.x * cp.w,
      y: cp.y * cp.w,
      z: cp.z * cp.w,
      w: cp.w
    }));

    for (let step = 0; step < r; step++) {
      const currentN = currentHomogeneous.length - 1;
      const k = NurbsBasis.findKnotSpan(u, p, currentKnots, tol);
      if (k === -1) return null;

      const nextHomogeneous: { x: number; y: number; z: number; w: number }[] = [];
      const nextKnots: number[] = [];

      for (let i = 0; i <= k - p; i++) {
        nextHomogeneous.push({ ...currentHomogeneous[i] });
      }

      for (let i = k - p + 1; i <= k; i++) {
        const denom = currentKnots[i + p] - currentKnots[i];
        const alpha = Math.abs(denom) > tol.absolute ? (u - currentKnots[i]) / denom : 0;
        
        const pPrev = currentHomogeneous[i - 1];
        const pCurr = currentHomogeneous[i];
        
        nextHomogeneous.push({
          x: (1 - alpha) * pPrev.x + alpha * pCurr.x,
          y: (1 - alpha) * pPrev.y + alpha * pCurr.y,
          z: (1 - alpha) * pPrev.z + alpha * pCurr.z,
          w: (1 - alpha) * pPrev.w + alpha * pCurr.w
        });
      }

      for (let i = k; i <= currentN; i++) {
        nextHomogeneous.push({ ...currentHomogeneous[i] });
      }

      for (let i = 0; i <= k; i++) {
        nextKnots.push(currentKnots[i]);
      }
      nextKnots.push(u);
      for (let i = k + 1; i < currentKnots.length; i++) {
        nextKnots.push(currentKnots[i]);
      }

      currentHomogeneous = nextHomogeneous;
      currentKnots = nextKnots;
    }

    const resultControlPoints: NurbsControlPoint[] = currentHomogeneous.map(h => {
      if (Math.abs(h.w) <= tol.absolute) {
        return { x: NaN, y: NaN, z: NaN, w: 0 }; // Degenerate weight
      }
      return {
        x: h.x / h.w,
        y: h.y / h.w,
        z: h.z / h.w,
        w: h.w
      };
    });

    const resultCurve: NurbsCurve = {
      degree: p,
      controlPoints: resultControlPoints,
      knots: currentKnots,
      evaluate: (param: number) => {
        const evalRes = NurbsEvaluator.evaluateCurve(resultCurve, param, tol);
        return evalRes.status === 'OK' ? evalRes.point : { x: NaN, y: NaN, z: NaN };
      },
      domain: () => ({ uMin, uMax })
    };

    return resultCurve;
  }
}
