
import { NURBSSurfaceData322, NURBSEvaluationResult322 } from './NURBSTypes322';

export class NURBSUtils322 {
  /**
   * Find the span in the knot vector for a given parameter u
   */
  public static findSpan(n: number, p: number, u: number, knots: number[]): number {
    if (u >= knots[n + 1]) return n;
    if (u <= knots[p]) return p;

    let low = p;
    let high = n + 1;
    let mid = Math.floor((low + high) / 2);

    while (u < knots[mid] || u >= knots[mid + 1]) {
      if (u < knots[mid]) high = mid;
      else low = mid;
      mid = Math.floor((low + high) / 2);
    }
    return mid;
  }

  /**
   * Calculate non-zero basis functions
   */
  public static basisFunctions(i: number, u: number, p: number, knots: number[]): number[] {
    const N = new Array(p + 1).fill(0);
    const left = new Array(p + 1).fill(0);
    const right = new Array(p + 1).fill(0);
    N[0] = 1.0;

    for (let j = 1; j <= p; j++) {
      left[j] = u - knots[i + 1 - j];
      right[j] = knots[i + j] - u;
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

  /**
   * Calculate non-zero basis functions and their derivatives
   */
  public static basisFunctionDerivatives(i: number, u: number, p: number, n_derivs: number, knots: number[]): number[][] {
    const ders = Array.from({ length: n_derivs + 1 }, () => new Array(p + 1).fill(0));
    const ndu = Array.from({ length: p + 1 }, () => new Array(p + 1).fill(0));
    ndu[0][0] = 1.0;
    const left = new Array(p + 1).fill(0);
    const right = new Array(p + 1).fill(0);

    for (let j = 1; j <= p; j++) {
      left[j] = u - knots[i + 1 - j];
      right[j] = knots[i + j] - u;
      let saved = 0.0;
      for (let r = 0; r < j; r++) {
        ndu[j][r] = right[r + 1] + left[j - r];
        const temp = ndu[r][j - 1] / ndu[j][r];
        ndu[r][j] = saved + right[r + 1] * temp;
        saved = left[j - r] * temp;
      }
      ndu[j][j] = saved;
    }

    for (let j = 0; j <= p; j++) {
      ders[0][j] = ndu[j][p];
    }

    const a = Array.from({ length: 2 }, () => new Array(p + 1).fill(0));
    for (let r = 0; r <= p; r++) {
      let s1 = 0;
      let s2 = 1;
      
      // Clear a matrix for each basis function r
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col <= p; col++) a[row][col] = 0;
      }
      
      a[0][0] = 1.0;
      for (let k = 1; k <= n_derivs; k++) {
        let d = 0.0;
        const rk = r - k;
        const pk = p - k;
        if (r >= k) {
          a[s2][0] = a[s1][0] / ndu[pk + 1][rk];
          d = a[s2][0] * ndu[rk][pk];
        }
        const j1 = rk >= -1 ? 1 : -rk;
        const j2 = r - 1 <= pk ? k - 1 : p - r;
        for (let j = j1; j <= j2; j++) {
          a[s2][j] = (a[s1][j] - a[s1][j - 1]) / ndu[pk + 1][rk + j];
          d += a[s2][j] * ndu[rk + j][pk];
        }
        if (r <= pk) {
          a[s2][k] = -a[s1][k - 1] / ndu[pk + 1][r];
          d += a[s2][k] * ndu[r][pk];
        }
        ders[k][r] = d;
        const jtmp = s1; s1 = s2; s2 = jtmp;
      }
    }

    let r = p;
    for (let k = 1; k <= n_derivs; k++) {
      for (let j = 0; j <= p; j++) ders[k][j] *= r;
      r *= (p - k);
    }

    return ders;
  }

  /**
   * Evaluate a point on the NURBS surface at (u, v)
   */
  public static evaluateSurface(data: NURBSSurfaceData322, u: number, v: number): NURBSEvaluationResult322 {
    const { degreeU, degreeV, knotsU, knotsV, controlPoints, weights } = data;

    const nU = controlPoints.length - 1;
    const nV = controlPoints[0].length - 1;

    const spanU = this.findSpan(nU, degreeU, u, knotsU);
    const spanV = this.findSpan(nV, degreeV, v, knotsV);

    const dersU = this.basisFunctionDerivatives(spanU, u, degreeU, 1, knotsU);
    const dersV = this.basisFunctionDerivatives(spanV, v, degreeV, 1, knotsV);

    const temp = Array.from({ length: degreeV + 1 }, () => ({ x: 0, y: 0, z: 0, w: 0 }));
    const dTempU = Array.from({ length: degreeV + 1 }, () => ({ x: 0, y: 0, z: 0, w: 0 }));

    for (let j = 0; j <= degreeV; j++) {
      for (let i = 0; i <= degreeU; i++) {
        const cp = controlPoints[spanU - degreeU + i][spanV - degreeV + j];
        const w = weights[spanU - degreeU + i][spanV - degreeV + j];
        
        const Nu = dersU[0][i];
        const dNu = dersU[1][i];

        temp[j].x += Nu * cp.x * w;
        temp[j].y += Nu * cp.y * w;
        temp[j].z += Nu * cp.z * w;
        temp[j].w += Nu * w;

        dTempU[j].x += dNu * cp.x * w;
        dTempU[j].y += dNu * cp.y * w;
        dTempU[j].z += dNu * cp.z * w;
        dTempU[j].w += dNu * w;
      }
    }

    let Sw = { x: 0, y: 0, z: 0, w: 0 };
    let dSwU = { x: 0, y: 0, z: 0, w: 0 };
    let dSwV = { x: 0, y: 0, z: 0, w: 0 };

    for (let j = 0; j <= degreeV; j++) {
      const Nv = dersV[0][j];
      const dNv = dersV[1][j];

      Sw.x += Nv * temp[j].x;
      Sw.y += Nv * temp[j].y;
      Sw.z += Nv * temp[j].z;
      Sw.w += Nv * temp[j].w;

      dSwU.x += Nv * dTempU[j].x;
      dSwU.y += Nv * dTempU[j].y;
      dSwU.z += Nv * dTempU[j].z;
      dSwU.w += Nv * dTempU[j].w;

      dSwV.x += dNv * temp[j].x;
      dSwV.y += dNv * temp[j].y;
      dSwV.z += dNv * temp[j].z;
      dSwV.w += dNv * temp[j].w;
    }

    const point: [number, number, number] = [Sw.x / Sw.w, Sw.y / Sw.w, Sw.z / Sw.w];

    // Surface Derivatives S_u and S_v for normal calculation
    // S_u = (Sw_u * Sw.w - Sw * Sw_w_u) / Sw.w^2
    const su: [number, number, number] = [
      (dSwU.x * Sw.w - Sw.x * dSwU.w) / (Sw.w * Sw.w),
      (dSwU.y * Sw.w - Sw.y * dSwU.w) / (Sw.w * Sw.w),
      (dSwU.z * Sw.w - Sw.z * dSwU.w) / (Sw.w * Sw.w)
    ];

    const sv: [number, number, number] = [
      (dSwV.x * Sw.w - Sw.x * dSwV.w) / (Sw.w * Sw.w),
      (dSwV.y * Sw.w - Sw.y * dSwV.w) / (Sw.w * Sw.w),
      (dSwV.z * Sw.w - Sw.z * dSwV.w) / (Sw.w * Sw.w)
    ];

    // Normal = S_u x S_v
    let nx = su[1] * sv[2] - su[2] * sv[1];
    let ny = su[2] * sv[0] - su[0] * sv[2];
    let nz = su[0] * sv[1] - su[1] * sv[0];
    const len = Math.sqrt(nx*nx + ny*ny + nz*nz);
    const normal: [number, number, number] = len > 1e-9 ? [nx/len, ny/len, nz/len] : [0, 0, 1];

    return { point, normal };
  }
}
