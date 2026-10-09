import { MathUtils321A } from './MathUtils321A';
import { SurfaceParameters321A } from './AnalyticalSurfaceTypes321A';

export interface FittingResult {
  valid: boolean;
  rmsResidual: number;
  maxResidual: number;
  parameters?: SurfaceParameters321A;
  errorReason?: string;
}

export class SurfaceFitter321A {
  public static fitPlane(points: number[][]): FittingResult {
    if (points.length < 3) return { valid: false, rmsResidual: 0, maxResidual: 0, errorReason: 'INSUFFICIENT_GEOMETRY' };

    const n = points.length;
    let cx = 0, cy = 0, cz = 0;
    for (const p of points) {
      cx += p[0]; cy += p[1]; cz += p[2];
    }
    cx /= n; cy /= n; cz /= n;

    const cov = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ];

    for (const p of points) {
      const dx = p[0] - cx;
      const dy = p[1] - cy;
      const dz = p[2] - cz;
      cov[0][0] += dx * dx; cov[0][1] += dx * dy; cov[0][2] += dx * dz;
      cov[1][0] += dy * dx; cov[1][1] += dy * dy; cov[1][2] += dy * dz;
      cov[2][0] += dz * dx; cov[2][1] += dz * dy; cov[2][2] += dz * dz;
    }

    const { eigenvalues, eigenvectors } = MathUtils321A.eigenDecomposition3x3(cov);
    
    // Find smallest eigenvalue
    let minIdx = 0;
    if (eigenvalues[1] < eigenvalues[minIdx]) minIdx = 1;
    if (eigenvalues[2] < eigenvalues[minIdx]) minIdx = 2;

    let normal: [number, number, number] = [eigenvectors[0][minIdx], eigenvectors[1][minIdx], eigenvectors[2][minIdx]];
    normal = MathUtils321A.normalize(normal);

    // Enforce deterministic orientation (e.g., largest absolute component is positive)
    let maxCompIdx = 0;
    if (Math.abs(normal[1]) > Math.abs(normal[maxCompIdx])) maxCompIdx = 1;
    if (Math.abs(normal[2]) > Math.abs(normal[maxCompIdx])) maxCompIdx = 2;
    if (normal[maxCompIdx] < 0) {
      normal = [-normal[0], -normal[1], -normal[2]];
    }

    const d = -MathUtils321A.dotProduct(normal, [cx, cy, cz]);

    // Calculate residuals
    let sumSq = 0;
    let maxRes = 0;
    for (const p of points) {
      const dist = Math.abs(MathUtils321A.dotProduct(normal, p) + d);
      sumSq += dist * dist;
      if (dist > maxRes) maxRes = dist;
    }

    return {
      valid: true,
      rmsResidual: Math.sqrt(sumSq / n),
      maxResidual: maxRes,
      parameters: {
        centroid: [cx, cy, cz],
        normal,
        d
      }
    };
  }

  public static fitSphere(points: number[][]): FittingResult {
    if (points.length < 4) return { valid: false, rmsResidual: 0, maxResidual: 0, errorReason: 'INSUFFICIENT_GEOMETRY' };

    const A: number[][] = [];
    const b: number[] = [];

    for (const p of points) {
      A.push([2 * p[0], 2 * p[1], 2 * p[2], 1]);
      b.push(p[0]*p[0] + p[1]*p[1] + p[2]*p[2]);
    }

    const x = MathUtils321A.solveLeastSquares(A, b);
    if (!x) return { valid: false, rmsResidual: 0, maxResidual: 0, errorReason: 'DEGENERATE' };

    const cx = x[0], cy = x[1], cz = x[2];
    const r2 = x[3] + cx*cx + cy*cy + cz*cz;
    
    if (r2 <= 0) return { valid: false, rmsResidual: 0, maxResidual: 0, errorReason: 'DEGENERATE' };
    const r = Math.sqrt(r2);

    let sumSq = 0;
    let maxRes = 0;
    for (const p of points) {
      const dx = p[0] - cx, dy = p[1] - cy, dz = p[2] - cz;
      const dist = Math.abs(Math.sqrt(dx*dx + dy*dy + dz*dz) - r);
      sumSq += dist * dist;
      if (dist > maxRes) maxRes = dist;
    }

    return {
      valid: true,
      rmsResidual: Math.sqrt(sumSq / points.length),
      maxResidual: maxRes,
      parameters: {
        center: [cx, cy, cz],
        radius: r
      }
    };
  }

  /**
   * Fits a cylinder to a set of points and normals.
   * 
   * ENGINEERING LIMITATION: This is a two-stage geometric estimator:
   * 1. Axis estimation via normal-covariance PCA.
   * 2. 2D circle fitting of projected points.
   * It is NOT a full joint 3D nonlinear least-squares optimization.
   */
  public static fitCylinder(points: number[][], normals: number[][]): FittingResult {
    if (points.length < 5 || normals.length !== points.length) {
      return { valid: false, rmsResidual: 0, maxResidual: 0, errorReason: 'INSUFFICIENT_GEOMETRY' };
    }

    const n = points.length;

    // 1. Find axis from normals
    const cov = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ];
    for (const norm of normals) {
      cov[0][0] += norm[0] * norm[0]; cov[0][1] += norm[0] * norm[1]; cov[0][2] += norm[0] * norm[2];
      cov[1][0] += norm[1] * norm[0]; cov[1][1] += norm[1] * norm[1]; cov[1][2] += norm[1] * norm[2];
      cov[2][0] += norm[2] * norm[0]; cov[2][1] += norm[2] * norm[1]; cov[2][2] += norm[2] * norm[2];
    }

    const { eigenvalues, eigenvectors } = MathUtils321A.eigenDecomposition3x3(cov);
    let minIdx = 0;
    if (eigenvalues[1] < eigenvalues[minIdx]) minIdx = 1;
    if (eigenvalues[2] < eigenvalues[minIdx]) minIdx = 2;

    let axis: [number, number, number] = [eigenvectors[0][minIdx], eigenvectors[1][minIdx], eigenvectors[2][minIdx]];
    axis = MathUtils321A.normalize(axis);

    // Deterministic axis direction
    let maxCompIdx = 0;
    if (Math.abs(axis[1]) > Math.abs(axis[maxCompIdx])) maxCompIdx = 1;
    if (Math.abs(axis[2]) > Math.abs(axis[maxCompIdx])) maxCompIdx = 2;
    if (axis[maxCompIdx] < 0) {
      axis = [-axis[0], -axis[1], -axis[2]];
    }

    // 2. Project points to plane orthogonal to axis
    const [u, v] = MathUtils321A.findOrthogonalBasis(axis);
    
    let sumX = 0, sumY = 0, sumZ = 0;
    for (const p of points) { sumX += p[0]; sumY += p[1]; sumZ += p[2]; }
    const centroid = [sumX/n, sumY/n, sumZ/n];

    const A: number[][] = [];
    const b: number[] = [];

    for (const p of points) {
      const dx = p[0] - centroid[0];
      const dy = p[1] - centroid[1];
      const dz = p[2] - centroid[2];
      const pu = dx*u[0] + dy*u[1] + dz*u[2];
      const pv = dx*v[0] + dy*v[1] + dz*v[2];
      A.push([2*pu, 2*pv, 1]);
      b.push(pu*pu + pv*pv);
    }

    // 3. Fit 2D circle
    const x = MathUtils321A.solveLeastSquares(A, b);
    if (!x) return { valid: false, rmsResidual: 0, maxResidual: 0, errorReason: 'DEGENERATE' };

    const cu = x[0], cv = x[1];
    const r2 = x[2] + cu*cu + cv*cv;
    if (r2 <= 0) return { valid: false, rmsResidual: 0, maxResidual: 0, errorReason: 'DEGENERATE' };
    const r = Math.sqrt(r2);

    const axisOrigin: [number, number, number] = [
      centroid[0] + cu*u[0] + cv*v[0],
      centroid[1] + cu*u[1] + cv*v[1],
      centroid[2] + cu*u[2] + cv*v[2]
    ];

    let sumSq = 0;
    let maxRes = 0;
    for (const p of points) {
      const distToAxis = MathUtils321A.distancePointToLine(p, axisOrigin, axis);
      const dist = Math.abs(distToAxis - r);
      sumSq += dist * dist;
      if (dist > maxRes) maxRes = dist;
    }

    return {
      valid: true,
      rmsResidual: Math.sqrt(sumSq / n),
      maxResidual: maxRes,
      parameters: {
        axisOrigin,
        axisDirection: axis,
        radius: r
      }
    };
  }

  public static fitCone(points: number[][], normals: number[][]): FittingResult {
    if (points.length < 6 || normals.length !== points.length) {
      return { valid: false, rmsResidual: 0, maxResidual: 0, errorReason: 'INSUFFICIENT_GEOMETRY' };
    }

    const n = points.length;

    // 1. Find Apex
    // n_i . (p_i - C) = 0 => n_i . C = n_i . p_i
    const A_apex: number[][] = [];
    const b_apex: number[] = [];
    for (let i = 0; i < n; i++) {
      A_apex.push([normals[i][0], normals[i][1], normals[i][2]]);
      b_apex.push(MathUtils321A.dotProduct(normals[i], points[i]));
    }

    const C = MathUtils321A.solveLeastSquares(A_apex, b_apex);
    if (!C || C.length < 3) return { valid: false, rmsResidual: 0, maxResidual: 0, errorReason: 'DEGENERATE_APEX' };
    const apex: [number, number, number] = [C[0], C[1], C[2]];

    // 2. Find Axis
    // n_i . d = constant = cos(beta). Let d' = d / cos(beta). Then n_i . d' = 1.
    const A_axis: number[][] = [];
    const b_axis: number[] = [];
    for (let i = 0; i < n; i++) {
      A_axis.push([normals[i][0], normals[i][1], normals[i][2]]);
      b_axis.push(1);
    }

    const d_prime = MathUtils321A.solveLeastSquares(A_axis, b_axis);
    if (!d_prime || d_prime.length < 3) return { valid: false, rmsResidual: 0, maxResidual: 0, errorReason: 'DEGENERATE_AXIS' };

    const len = Math.sqrt(d_prime[0]*d_prime[0] + d_prime[1]*d_prime[1] + d_prime[2]*d_prime[2]);
    if (len < 1e-9) return { valid: false, rmsResidual: 0, maxResidual: 0, errorReason: 'DEGENERATE_AXIS' };
    
    let axis: [number, number, number] = [d_prime[0]/len, d_prime[1]/len, d_prime[2]/len];
    
    // beta is angle between normal and axis
    // beta = acos(1/len)
    if (1/len > 1.0) return { valid: false, rmsResidual: 0, maxResidual: 0, errorReason: 'DEGENERATE_AXIS' }; // numerical error
    const beta = Math.acos(1/len);
    const halfAngleRad = Math.PI / 2 - beta;
    if (halfAngleRad < 1e-3 || halfAngleRad > Math.PI/2 - 1e-3) {
      return { valid: false, rmsResidual: 0, maxResidual: 0, errorReason: 'DEGENERATE_ANGLE' };
    }

    // Deterministic axis direction
    let maxCompIdx = 0;
    if (Math.abs(axis[1]) > Math.abs(axis[maxCompIdx])) maxCompIdx = 1;
    if (Math.abs(axis[2]) > Math.abs(axis[maxCompIdx])) maxCompIdx = 2;
    if (axis[maxCompIdx] < 0) {
      axis = [-axis[0], -axis[1], -axis[2]];
    }

    // 3. Compute residuals
    // A point P on cone satisfies: distance to axis = distance to apex * sin(halfAngle)
    const sinHalfAngle = Math.sin(halfAngleRad);
    let sumSq = 0;
    let maxRes = 0;
    
    for (const p of points) {
      const v = [p[0] - apex[0], p[1] - apex[1], p[2] - apex[2]];
      const distToApex = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
      const distToAxis = MathUtils321A.distancePointToLine(p, apex, axis);
      
      const expectedDistToAxis = distToApex * sinHalfAngle;
      const dist = Math.abs(distToAxis - expectedDistToAxis);
      
      sumSq += dist * dist;
      if (dist > maxRes) maxRes = dist;
    }

    return {
      valid: true,
      rmsResidual: Math.sqrt(sumSq / n),
      maxResidual: maxRes,
      parameters: {
        apex,
        axisDirection: axis,
        halfAngleDeg: halfAngleRad * 180 / Math.PI
      }
    };
  }
}
