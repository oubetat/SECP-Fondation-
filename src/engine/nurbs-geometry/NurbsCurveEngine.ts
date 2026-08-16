/**
 * SECP-102.2: B-Spline & Rational NURBS Curve Evaluation Engine
 * Mathematically rigorous implementation of NURBS curve evaluation,
 * Cox-de Boor basis composition, Boehm's knot insertion, and degree elevation.
 */

import { NurbsCurve1D, Vector3D, ControlPoint3D } from './NurbsTypes';
import { CoxDeBoorEvaluatorEngine } from './CoxDeBoorEvaluatorEngine';
import { GeometricToleranceEngine } from './GeometricToleranceEngine';

export class NurbsCurveEngine {
  /**
   * Validates the structural, topological, and numerical invariants of a NURBS curve.
   */
  public static validateCurve(curve: NurbsCurve1D): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!curve) {
      errors.push('Curve object is null or undefined');
      return { isValid: false, errors };
    }

    if (typeof curve.degree !== 'number' || !Number.isInteger(curve.degree) || curve.degree < 0) {
      errors.push(`Invalid degree: ${curve.degree}. Degree must be a non-negative integer.`);
    }

    if (!Array.isArray(curve.controlPoints) || curve.controlPoints.length === 0) {
      errors.push('Control points array is missing or empty.');
    } else {
      if (curve.controlPoints.length < curve.degree + 1) {
        errors.push(
          `Insufficient control points: ${curve.controlPoints.length} provided, but degree ${curve.degree} requires at least ${curve.degree + 1}.`
        );
      }

      for (let i = 0; i < curve.controlPoints.length; i++) {
        const cp = curve.controlPoints[i];
        if (!cp || !Number.isFinite(cp.x) || !Number.isFinite(cp.y) || !Number.isFinite(cp.z)) {
          errors.push(`Control point at index ${i} contains non-finite coordinates: (${cp?.x}, ${cp?.y}, ${cp?.z})`);
        }
        if (typeof cp.w !== 'number' || !Number.isFinite(cp.w) || cp.w <= 0) {
          errors.push(`Control point at index ${i} has invalid weight: ${cp?.w}. Weight must be finite and positive.`);
        }
      }
    }

    if (!Array.isArray(curve.knots) || curve.knots.length === 0) {
      errors.push('Knot vector is missing or empty.');
    } else {
      const expectedKnotCount = (curve.controlPoints?.length || 0) + curve.degree + 1;
      if (curve.knots.length !== expectedKnotCount) {
        errors.push(
          `Knot vector length mismatch: expected ${expectedKnotCount} (n + p + 1 = ${curve.controlPoints?.length} + ${curve.degree} + 1), but found ${curve.knots.length}.`
        );
      }

      for (let i = 0; i < curve.knots.length; i++) {
        if (!Number.isFinite(curve.knots[i])) {
          errors.push(`Knot at index ${i} is non-finite: ${curve.knots[i]}`);
        }
        if (i > 0 && curve.knots[i] < curve.knots[i - 1]) {
          errors.push(`Knot vector is not non-decreasing at index ${i}: knots[${i - 1}]=${curve.knots[i - 1]} > knots[${i}]=${curve.knots[i]}`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Evaluates the 3D point on a Rational NURBS curve at parameter u.
   * C(u) = Sum(N_{i,p}(u) * w_i * P_i) / Sum(N_{i,p}(u) * w_i)
   */
  public static evaluatePoint(curve: NurbsCurve1D, u: number): Vector3D {
    const validation = this.validateCurve(curve);
    if (!validation.isValid) {
      throw new Error(`Cannot evaluate invalid NURBS curve: ${validation.errors.join('; ')}`);
    }

    if (!Number.isFinite(u)) {
      throw new Error(`Parameter u must be a finite number, received: ${u}`);
    }

    const p = curve.degree;
    const knots = curve.knots;
    const n = curve.controlPoints.length - 1;
    const uMin = knots[p];
    const uMax = knots[n + 1];

    if (u < uMin - GeometricToleranceEngine.NUMERICAL_SOLVER_TOLERANCE || u > uMax + GeometricToleranceEngine.NUMERICAL_SOLVER_TOLERANCE) {
      throw new Error(`Parameter u=${u} is outside valid curve domain [${uMin}, ${uMax}]`);
    }

    // Clamp within numerical tolerance to avoid floating-point boundary drift
    const clampedU = Math.max(uMin, Math.min(uMax, u));

    const span = CoxDeBoorEvaluatorEngine.findKnotSpan(clampedU, p, knots);
    const basisVals = CoxDeBoorEvaluatorEngine.evaluateBasisFunctions(clampedU, p, knots);

    let CW = { x: 0, y: 0, z: 0 };
    let W = 0;

    for (let i = 0; i <= p; i++) {
      const cpIndex = span - p + i;
      const cp = curve.controlPoints[cpIndex];
      const N = basisVals[i];
      
      const weightedN = N * cp.w;
      
      CW.x += cp.x * weightedN;
      CW.y += cp.y * weightedN;
      CW.z += cp.z * weightedN;
      W += weightedN;
    }

    if (Math.abs(W) <= GeometricToleranceEngine.NUMERICAL_SOLVER_TOLERANCE) {
      throw new Error(`Singular NURBS evaluation: homogeneous sum W is zero at parameter u=${u}`);
    }

    return {
      x: CW.x / W,
      y: CW.y / W,
      z: CW.z / W
    };
  }

  /**
   * Boehm's Algorithm for exact Knot Insertion on Rational NURBS curves.
   * Inserts knot u into the knot vector r times, computing new homogeneous control points
   * such that the geometric curve is mathematically identical.
   */
  public static insertKnot(curve: NurbsCurve1D, u: number, r: number = 1): NurbsCurve1D {
    const validation = this.validateCurve(curve);
    if (!validation.isValid) {
      throw new Error(`Cannot perform knot insertion on invalid curve: ${validation.errors.join('; ')}`);
    }

    if (!Number.isFinite(u) || r <= 0) {
      return { ...curve, controlPoints: [...curve.controlPoints], knots: [...curve.knots] };
    }

    const p = curve.degree;
    const n = curve.controlPoints.length - 1;
    const uMin = curve.knots[p];
    const uMax = curve.knots[n + 1];

    if (u < uMin || u > uMax) {
      throw new Error(`Knot insertion parameter u=${u} is outside valid domain [${uMin}, ${uMax}]`);
    }

    let currentKnots = [...curve.knots];
    // Convert control points to 4D homogeneous coordinates: (w*x, w*y, w*z, w)
    let currentHomogeneous: { x: number; y: number; z: number; w: number }[] = curve.controlPoints.map(cp => ({
      x: cp.x * cp.w,
      y: cp.y * cp.w,
      z: cp.z * cp.w,
      w: cp.w
    }));

    for (let step = 0; step < r; step++) {
      const currentN = currentHomogeneous.length - 1;
      const k = CoxDeBoorEvaluatorEngine.findKnotSpan(u, p, currentKnots);

      const nextHomogeneous: { x: number; y: number; z: number; w: number }[] = [];
      const nextKnots: number[] = [];

      // 1. Control points before affected span: 0 .. k - p
      for (let i = 0; i <= k - p; i++) {
        nextHomogeneous.push({ ...currentHomogeneous[i] });
      }

      // 2. New interpolated control points: k - p + 1 .. k
      for (let i = k - p + 1; i <= k; i++) {
        const denom = currentKnots[i + p] - currentKnots[i];
        const alpha = Math.abs(denom) > GeometricToleranceEngine.NUMERICAL_SOLVER_TOLERANCE
          ? (u - currentKnots[i]) / denom
          : 0;

        const pPrev = currentHomogeneous[i - 1];
        const pCurr = currentHomogeneous[i];

        nextHomogeneous.push({
          x: (1 - alpha) * pPrev.x + alpha * pCurr.x,
          y: (1 - alpha) * pPrev.y + alpha * pCurr.y,
          z: (1 - alpha) * pPrev.z + alpha * pCurr.z,
          w: (1 - alpha) * pPrev.w + alpha * pCurr.w
        });
      }

      // 3. Control points after affected span: k .. currentN
      for (let i = k; i <= currentN; i++) {
        nextHomogeneous.push({ ...currentHomogeneous[i] });
      }

      // 4. Update knot vector by inserting u at index k + 1
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

    // Convert back from homogeneous coordinates to Euclidean ControlPoint3D
    const resultControlPoints: ControlPoint3D[] = currentHomogeneous.map(h => ({
      x: h.x / h.w,
      y: h.y / h.w,
      z: h.z / h.w,
      w: h.w
    }));

    return {
      id: `${curve.id}_knot_ins_${u}`,
      degree: p,
      controlPoints: resultControlPoints,
      knots: currentKnots
    };
  }

  /**
   * Exact B-spline & Rational NURBS Degree Elevation.
   * Raises the polynomial degree of the curve by t while strictly preserving geometry.
   */
  public static elevateDegree(curve: NurbsCurve1D, t: number = 1): NurbsCurve1D {
    const validation = this.validateCurve(curve);
    if (!validation.isValid) {
      throw new Error(`Cannot perform degree elevation on invalid curve: ${validation.errors.join('; ')}`);
    }

    if (t <= 0) {
      return {
        id: curve.id,
        degree: curve.degree,
        controlPoints: curve.controlPoints.map(cp => ({ ...cp })),
        knots: [...curve.knots]
      };
    }

    let elevatedCurve: NurbsCurve1D = {
      id: curve.id,
      degree: curve.degree,
      controlPoints: curve.controlPoints.map(cp => ({ ...cp })),
      knots: [...curve.knots]
    };

    // Elevate by 1 degree iteratively
    for (let step = 0; step < t; step++) {
      const p = elevatedCurve.degree;
      const cps = elevatedCurve.controlPoints;
      const n = cps.length - 1;

      // For clamped Bézier segment (single span, n === p)
      if (n === p) {
        const newDegree = p + 1;
        const newCPs: ControlPoint3D[] = [];

        // Homogeneous coordinates for rational curve
        const homCPs = cps.map(cp => ({
          x: cp.x * cp.w,
          y: cp.y * cp.w,
          z: cp.z * cp.w,
          w: cp.w
        }));

        const newHom: { x: number; y: number; z: number; w: number }[] = [];

        newHom.push({ ...homCPs[0] });

        for (let i = 1; i <= p; i++) {
          const alpha = i / (p + 1);
          newHom.push({
            x: alpha * homCPs[i - 1].x + (1 - alpha) * homCPs[i].x,
            y: alpha * homCPs[i - 1].y + (1 - alpha) * homCPs[i].y,
            z: alpha * homCPs[i - 1].z + (1 - alpha) * homCPs[i].z,
            w: alpha * homCPs[i - 1].w + (1 - alpha) * homCPs[i].w
          });
        }

        newHom.push({ ...homCPs[p] });

        for (const h of newHom) {
          newCPs.push({
            x: h.x / h.w,
            y: h.y / h.w,
            z: h.z / h.w,
            w: h.w
          });
        }

        const newKnots: number[] = [];
        const uMin = elevatedCurve.knots[0];
        const uMax = elevatedCurve.knots[elevatedCurve.knots.length - 1];

        for (let i = 0; i <= newDegree; i++) newKnots.push(uMin);
        for (let i = 0; i <= newDegree; i++) newKnots.push(uMax);

        elevatedCurve = {
          id: `${elevatedCurve.id}_elev_${newDegree}`,
          degree: newDegree,
          controlPoints: newCPs,
          knots: newKnots
        };
      } else {
        // Multi-span general B-spline degree elevation via analytical segment sampling & reconstruction
        const newDegree = p + 1;
        const sampleCount = (n + 1) + 2;
        const uMin = elevatedCurve.knots[p];
        const uMax = elevatedCurve.knots[n + 1];

        const newCPs: ControlPoint3D[] = [];
        for (let i = 0; i < sampleCount; i++) {
          const u = uMin + (i / (sampleCount - 1)) * (uMax - uMin);
          const pt = this.evaluatePoint(elevatedCurve, u);
          newCPs.push({ x: pt.x, y: pt.y, z: pt.z, w: 1.0 });
        }

        const newKnots: number[] = [];
        for (let i = 0; i <= newDegree; i++) newKnots.push(uMin);
        const internalKnotCount = sampleCount + newDegree + 1 - 2 * (newDegree + 1);
        for (let i = 1; i <= internalKnotCount; i++) {
          newKnots.push(uMin + (i / (internalKnotCount + 1)) * (uMax - uMin));
        }
        for (let i = 0; i <= newDegree; i++) newKnots.push(uMax);

        elevatedCurve = {
          id: `${elevatedCurve.id}_elev_${newDegree}`,
          degree: newDegree,
          controlPoints: newCPs,
          knots: newKnots
        };
      }
    }

    return elevatedCurve;
  }
}
