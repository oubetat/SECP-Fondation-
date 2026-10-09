import { NurbsTolerance } from './NurbsContracts';

export class NurbsBasis {
  /**
   * Finds the knot span index i such that u is in [knots[i], knots[i+1]).
   * Strictly handles clamped and unclamped vectors.
   */
  public static findKnotSpan(u: number, degree: number, knots: readonly number[], tol: NurbsTolerance): number {
    const n = knots.length - degree - 2;
    if (n < 0) return -1;
    
    if (u >= knots[n + 1] - tol.absolute) {
      return n;
    }
    if (u <= knots[degree] + tol.absolute) {
      return degree;
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
   * Evaluates the non-zero basis functions at parameter u.
   * Returns an array of values N_{i,p}(u) for i = span-p to span.
   */
  public static evaluateBasisFunctions(span: number, u: number, degree: number, knots: readonly number[]): number[] {
    const N = new Array(degree + 1).fill(0);
    const left = new Array(degree + 1).fill(0);
    const right = new Array(degree + 1).fill(0);
    
    N[0] = 1.0;
    for (let j = 1; j <= degree; j++) {
      left[j] = u - knots[span + 1 - j];
      right[j] = knots[span + j] - u;
      let saved = 0.0;
      for (let r = 0; r < j; r++) {
        const denom = right[r + 1] + left[j - r];
        const temp = denom !== 0 ? N[r] / denom : 0;
        N[r] = saved + right[r + 1] * temp;
        saved = left[j - r] * temp;
      }
      N[j] = saved;
    }
    return N;
  }
}
