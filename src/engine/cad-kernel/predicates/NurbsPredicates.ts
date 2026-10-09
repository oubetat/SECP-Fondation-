/**
 * SECP CAD Kernel — NURBS Predicate Integration
 * Phase 2 (PATCH-018)
 */
import { Point } from '../geometry/GeometryContracts';
import { NurbsCurve, NurbsSurface, NurbsTolerance } from '../nurbs/NurbsContracts';
import { NurbsEvaluator } from '../nurbs/NurbsEvaluator';
import { NurbsValidator } from '../nurbs/NurbsValidator';
import { GeometricTolerance, GeometricToleranceModel } from './GeometricTolerance';
import {
  GeometricPredicateResult,
  NurbsPointClassification
} from './PredicateContracts';
import { DistancePredicates } from './DistancePredicates';

export class NurbsPredicates {
  /**
   * Evaluates if a 3D point is on a NURBS curve at a specific parameter u.
   */
  public static pointOnNurbsCurveAtParam(
    pt: Point,
    curve: NurbsCurve,
    u: number,
    tolModel: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): GeometricPredicateResult<NurbsPointClassification, { distance: number; curvePoint: Point }> {
    if (!pt || !curve) {
      return {
        classification: 'INVALID',
        semantics: 'TOLERANCE_BASED',
        diagnostics: ['Null point or curve input']
      };
    }

    const valResult = NurbsValidator.validateCurve(curve);
    if (!valResult.isValid) {
      return {
        classification: 'INVALID',
        semantics: 'TOLERANCE_BASED',
        diagnostics: ['Invalid NURBS curve definition', ...valResult.errors.map(e => e.message)]
      };
    }

    const nurbsTol: NurbsTolerance = {
      absolute: tolModel.absoluteLength,
      relative: tolModel.relativeLength
    };

    const evalRes = NurbsEvaluator.evaluateCurve(curve, u, nurbsTol);
    if (evalRes.status !== 'OK') {
      return {
        classification: 'INVALID',
        semantics: 'TOLERANCE_BASED',
        diagnostics: [`NURBS evaluation failed: ${evalRes.status}`]
      };
    }

    const distRes = DistancePredicates.pointPointDistance(pt, evalRes.point);
    const dist = distRes.value!.distance;

    if (dist <= tolModel.absoluteLength * 0.01) {
      return {
        classification: 'EXACT_ON',
        value: { distance: dist, curvePoint: evalRes.point },
        semantics: 'TOLERANCE_BASED',
        diagnostics: [`Distance ${dist} is within exact algebraic threshold`]
      };
    }

    if (dist <= tolModel.absoluteLength) {
      return {
        classification: 'WITHIN_TOLERANCE',
        value: { distance: dist, curvePoint: evalRes.point },
        semantics: 'TOLERANCE_BASED',
        diagnostics: [`Distance ${dist} is within tolerance ${tolModel.absoluteLength}`]
      };
    }

    return {
      classification: 'OUTSIDE_TOLERANCE',
      value: { distance: dist, curvePoint: evalRes.point },
      semantics: 'TOLERANCE_BASED',
      diagnostics: [`Distance ${dist} exceeds tolerance ${tolModel.absoluteLength}`]
    };
  }

  /**
   * Evaluates if a 3D point is on a NURBS surface at parameters (u, v).
   */
  public static pointOnNurbsSurfaceAtParams(
    pt: Point,
    surface: NurbsSurface,
    u: number,
    v: number,
    tolModel: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): GeometricPredicateResult<NurbsPointClassification, { distance: number; surfacePoint: Point }> {
    if (!pt || !surface) {
      return {
        classification: 'INVALID',
        semantics: 'TOLERANCE_BASED',
        diagnostics: ['Null point or surface input']
      };
    }

    const valResult = NurbsValidator.validateSurface(surface);
    if (!valResult.isValid) {
      return {
        classification: 'INVALID',
        semantics: 'TOLERANCE_BASED',
        diagnostics: ['Invalid NURBS surface definition', ...valResult.errors.map(e => e.message)]
      };
    }

    const nurbsTol: NurbsTolerance = {
      absolute: tolModel.absoluteLength,
      relative: tolModel.relativeLength
    };

    const evalRes = NurbsEvaluator.evaluateSurface(surface, u, v, nurbsTol);
    if (evalRes.status !== 'OK') {
      return {
        classification: 'INVALID',
        semantics: 'TOLERANCE_BASED',
        diagnostics: [`NURBS surface evaluation failed: ${evalRes.status}`]
      };
    }

    const distRes = DistancePredicates.pointPointDistance(pt, evalRes.point);
    const dist = distRes.value!.distance;

    if (dist <= tolModel.absoluteLength * 0.01) {
      return {
        classification: 'EXACT_ON',
        value: { distance: dist, surfacePoint: evalRes.point },
        semantics: 'TOLERANCE_BASED',
        diagnostics: [`Distance ${dist} is within exact threshold`]
      };
    }

    if (dist <= tolModel.absoluteLength) {
      return {
        classification: 'WITHIN_TOLERANCE',
        value: { distance: dist, surfacePoint: evalRes.point },
        semantics: 'TOLERANCE_BASED',
        diagnostics: [`Distance ${dist} is within tolerance ${tolModel.absoluteLength}`]
      };
    }

    return {
      classification: 'OUTSIDE_TOLERANCE',
      value: { distance: dist, surfacePoint: evalRes.point },
      semantics: 'TOLERANCE_BASED',
      diagnostics: [`Distance ${dist} exceeds tolerance ${tolModel.absoluteLength}`]
    };
  }

  /**
   * Tests whether a 3D point is near a NURBS curve by discretizing parameter domain.
   */
  public static pointNearNurbsCurve(
    pt: Point,
    curve: NurbsCurve,
    sampleCount: number = 32,
    tolModel: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): GeometricPredicateResult<NurbsPointClassification, { minDistance: number; bestParam: number }> {
    if (!pt || !curve) {
      return {
        classification: 'INVALID',
        semantics: 'TOLERANCE_BASED',
        diagnostics: ['Null point or curve input']
      };
    }

    const valResult = NurbsValidator.validateCurve(curve);
    if (!valResult.isValid) {
      return {
        classification: 'INVALID',
        semantics: 'TOLERANCE_BASED',
        diagnostics: ['Invalid NURBS curve definition']
      };
    }

    const uMin = curve.knots[curve.degree];
    const uMax = curve.knots[curve.knots.length - 1 - curve.degree];
    const count = Math.max(8, sampleCount);

    const nurbsTol: NurbsTolerance = {
      absolute: tolModel.absoluteLength,
      relative: tolModel.relativeLength
    };

    let minDistance = Infinity;
    let bestParam = uMin;

    for (let i = 0; i <= count; i++) {
      const u = uMin + (i / count) * (uMax - uMin);
      const evalRes = NurbsEvaluator.evaluateCurve(curve, u, nurbsTol);
      if (evalRes.status === 'OK') {
        const dRes = DistancePredicates.pointPointDistance(pt, evalRes.point);
        if (dRes.value!.distance < minDistance) {
          minDistance = dRes.value!.distance;
          bestParam = u;
        }
      }
    }

    if (minDistance <= tolModel.absoluteLength) {
      return {
        classification: 'WITHIN_TOLERANCE',
        value: { minDistance, bestParam },
        semantics: 'TOLERANCE_BASED',
        diagnostics: [`Point is within tolerance of NURBS curve (minDist=${minDistance} at u=${bestParam})`]
      };
    }

    return {
      classification: 'OUTSIDE_TOLERANCE',
      value: { minDistance, bestParam },
      semantics: 'TOLERANCE_BASED',
      diagnostics: [`minDistance ${minDistance} exceeds tolerance ${tolModel.absoluteLength}`]
    };
  }
}
