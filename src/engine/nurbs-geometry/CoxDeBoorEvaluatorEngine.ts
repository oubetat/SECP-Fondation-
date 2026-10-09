/**
 * PATCH-SECP-074-001: NURBS Knot Vector & Basis Function Engine (Cox-de Boor Evaluator)
 * Mathematically rigorous implementation of the recursive Cox-de Boor algorithm 
 * to evaluate B-spline basis functions N_{i,p}(u).
 */

import { GeometricToleranceEngine } from './GeometricToleranceEngine';

export class CoxDeBoorEvaluatorEngine {
  /**
   * Evaluates the non-zero basis functions at parameter u.
   * Returns an array of values N_{i,p}(u) for i = span-p to span.
   */
  public static evaluateBasisFunctions(
    u: number,
    degree: number,
    knots: number[]
  ): number[] {
    const span = this.findKnotSpan(u, degree, knots);
    return this.basisFuns(span, u, degree, knots);
  }

  /**
   * Finds the knot span index i such that u is in [knots[i], knots[i+1]).
   * Implements a binary search for efficiency O(log(n)).
   */
  public static findKnotSpan(u: number, degree: number, knots: number[]): number {
    const n = knots.length - degree - 2; // Index of last control point
    
    // Handle specific case for u == knots[n+1]
    if (Math.abs(u - knots[n + 1]) <= GeometricToleranceEngine.NUMERICAL_SOLVER_TOLERANCE) {
      return n;
    }

    let low = degree;
    let high = n + 1;
    let mid = Math.floor((low + high) / 2);

    while (u < knots[mid] || u >= knots[mid + 1]) {
      if (u < knots[mid]) {
        high = mid;
      } else {
        low = mid;
      }
      mid = Math.floor((low + high) / 2);
    }
    return mid;
  }

  /**
   * Computes the non-zero basis functions N_{span-p, p}(u), ..., N_{span, p}(u).
   * Implements the dynamic programming table to avoid deep recursion.
   * Based on The NURBS Book (Piegl & Tiller).
   */
  private static basisFuns(span: number, u: number, degree: number, knots: number[]): number[] {
    const N = new Array(degree + 1).fill(0);
    const left = new Array(degree + 1).fill(0);
    const right = new Array(degree + 1).fill(0);
    
    N[0] = 1.0;

    for (let j = 1; j <= degree; j++) {
      left[j] = u - knots[span + 1 - j];
      right[j] = knots[span + j] - u;
      let saved = 0.0;

      for (let r = 0; r < j; r++) {
        const temp = N[r] / (right[r + 1] + left[j - r]);
        N[r] = saved + right[r + 1] * temp;
        saved = left[j - r] * temp;
      }
      N[j] = saved;
    }

    return N;
  }
}
