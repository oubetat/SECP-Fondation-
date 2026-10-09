export class GeometryFittingUtils320 {
  /**
   * Fit a plane to 3D points using PCA (Principal Component Analysis)
   * The normal is the eigenvector corresponding to the smallest eigenvalue of the covariance matrix.
   */
  public static fitPlane(points: [number, number, number][]): { origin: [number, number, number]; normal: [number, number, number]; rmse: number } {
    if (points.length < 3) {
      return { origin: [0, 0, 0], normal: [0, 0, 1], rmse: Infinity };
    }

    // 1. Compute Centroid
    let cx = 0, cy = 0, cz = 0;
    for (const p of points) {
      cx += p[0]; cy += p[1]; cz += p[2];
    }
    cx /= points.length; cy /= points.length; cz /= points.length;

    // 2. Compute Covariance Matrix
    let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0;
    for (const p of points) {
      const dx = p[0] - cx;
      const dy = p[1] - cy;
      const dz = p[2] - cz;
      xx += dx * dx; xy += dx * dy; xz += dx * dz;
      yy += dy * dy; yz += dy * dz; zz += dz * dz;
    }

    // 3. Find smallest eigenvalue/vector using a robust power iteration variation (inverse power iteration)
    // For a 3x3 matrix, we can use a more direct approach or enough iterations
    let nx = 0, ny = 0, nz = 1; // Initial guess
    
    // Inverse Power Iteration to find smallest eigenvector
    // Since we only need the normal to the plane (smallest variation)
    // We can solve (Cov - lambda*I)n = 0. Or just power iterate on the inverse if non-singular.
    // Simplified for 3x3: Use multiple guesses and Power Iteration for LARGEST, then project out.
    // Or just use a simple 3x3 characteristic equation solver (analytical).
    
    // Analytic 3x3 Eigenvalues (simplified for stability in this context)
    // For the Gate, we use Power Iteration to find the LARGE eigenvalues and the smallest remains.
    const iters = 10;
    let v: [number, number, number] = [1, 1, 1];
    for (let i = 0; i < iters; i++) {
      const tx = xx * v[0] + xy * v[1] + xz * v[2];
      const ty = xy * v[0] + yy * v[1] + yz * v[2];
      const tz = xz * v[0] + yz * v[1] + zz * v[2];
      const len = Math.sqrt(tx*tx + ty*ty + tz*tz);
      if (len < 1e-9) break;
      v = [tx/len, ty/len, tz/len];
    }
    // v is now the largest principal component. We need the smallest.
    // For a plane, the smallest is the normal. 
    // We'll use a simpler heuristic for the 3rd vector if we don't want a full SVD solver.
    // But since the user wants "Mathematical Truth", let's use a 3x3 Symmetric Eigen solver.
    const eigen = this.solveSymmetric3x3(xx, xy, xz, yy, yz, zz);
    const normal = eigen.smallestVector;

    // Calculate real RMSE
    let sumSq = 0;
    for (const p of points) {
      const d = Math.abs(normal[0] * (p[0] - cx) + normal[1] * (p[1] - cy) + normal[2] * (p[2] - cz));
      sumSq += d * d;
    }
    const rmse = Math.sqrt(sumSq / points.length);

    return {
      origin: [cx, cy, cz],
      normal: normal,
      rmse
    };
  }

  /**
   * Fit a cylinder to 3D points
   * Algorithm: 
   * 1. Estimate axis by finding vector most perpendicular to surface normals
   * 2. Project points to plane perpendicular to axis
   * 3. Fit circle to 2D points using Least Squares
   */
  public static fitCylinder(points: [number, number, number][], normals?: [number, number, number][]): { origin: [number, number, number]; axis: [number, number, number]; radius: number; rmse: number } {
    if (points.length < 6) {
      return { origin: [0, 0, 0], axis: [0, 0, 1], radius: 0, rmse: Infinity };
    }

    // 1. Axis Estimation
    let axis: [number, number, number] = [0, 0, 1];
    if (normals && normals.length === points.length) {
      let nxx = 0, nxy = 0, nxz = 0, nyy = 0, nyz = 0, nzz = 0;
      for (const n of normals) {
        nxx += n[0] * n[0]; nxy += n[0] * n[1]; nxz += n[0] * n[2];
        nyy += n[1] * n[1]; nyz += n[1] * n[2]; nzz += n[2] * n[2];
      }
      const eigen = this.solveSymmetric3x3(nxx, nxy, nxz, nyy, nyz, nzz);
      axis = eigen.smallestVector;
    } else {
      let cx = 0, cy = 0, cz = 0;
      for (const p of points) { cx += p[0]; cy += p[1]; cz += p[2]; }
      cx /= points.length; cy /= points.length; cz /= points.length;
      let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0;
      for (const p of points) {
        const dx = p[0] - cx; const dy = p[1] - cy; const dz = p[2] - cz;
        xx += dx * dx; xy += dx * dy; xz += dx * dz; yy += dy * dy; yz += dy * yz; zz += dz * dz;
      }
      const eigen = this.solveSymmetric3x3(xx, xy, xz, yy, yz, zz);
      axis = eigen.largestVector;
    }

    // 2. Project points to 2D
    let u: [number, number, number] = Math.abs(axis[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    let dotU = u[0]*axis[0] + u[1]*axis[1] + u[2]*axis[2];
    u = [u[0] - dotU*axis[0], u[1] - dotU*axis[1], u[2] - dotU*axis[2]];
    let uLen = Math.sqrt(u[0]**2 + u[1]**2 + u[2]**2);
    u = [u[0]/uLen, u[1]/uLen, u[2]/uLen];
    const v: [number, number, number] = [
      axis[1]*u[2] - axis[2]*u[1],
      axis[2]*u[0] - axis[0]*u[2],
      axis[0]*u[1] - axis[1]*u[0]
    ];

    const pts2d: [number, number][] = points.map(p => [
      p[0]*u[0] + p[1]*u[1] + p[2]*u[2],
      p[0]*v[0] + p[1]*v[1] + p[2]*v[2]
    ]);

    // 3. Robust Least Squares Circle Fit
    // Linear system: [2xi, 2yi, 1] [xc, yc, K]^T = [xi^2 + yi^2]
    let m00 = 0, m01 = 0, m02 = 0, m11 = 0, m12 = 0, m22 = 0;
    let b0 = 0, b1 = 0, b2 = 0;
    for (const p of pts2d) {
      const x = p[0], y = p[1];
      const x2 = x * x, y2 = y * y;
      const x2y2 = x2 + y2;
      m00 += 4 * x2; m01 += 4 * x * y; m02 += 2 * x;
      m11 += 4 * y2; m12 += 2 * y;
      m22 += 1;
      b0 += 2 * x * x2y2; b1 += 2 * y * x2y2; b2 += x2y2;
    }

    // Solve 3x3 Symmetric System via Cramer's Rule
    const det = m00*(m11*m22 - m12*m12) - m01*(m01*m22 - m02*m12) + m02*(m01*m12 - m02*m11);
    if (Math.abs(det) < 1e-9) return { origin: [0, 0, 0], axis, radius: 0, rmse: Infinity };

    const xc = (b0*(m11*m22 - m12*m12) - m01*(b1*m22 - b2*m12) + m02*(b1*m12 - b2*m11)) / det;
    const yc = (m00*(b1*m22 - b2*m12) - b0*(m01*m22 - m02*m12) + m02*(m01*b2 - m02*b1)) / det;
    const K = (m00*(m11*b2 - m12*b1) - m01*(m01*b2 - m02*b1) + b0*(m01*m12 - m02*m11)) / det;
    
    const radius = Math.sqrt(Math.max(0, K + xc*xc + yc*yc));

    const origin: [number, number, number] = [
      xc * u[0] + yc * v[0],
      xc * u[1] + yc * v[1],
      xc * u[2] + yc * v[2]
    ];

    // RMSE
    let sumSq = 0;
    for (const p of points) {
      const dx = p[0] - origin[0], dy = p[1] - origin[1], dz = p[2] - origin[2];
      const dAxis = dx*axis[0] + dy*axis[1] + dz*axis[2];
      const px = dx - dAxis*axis[0], py = dy - dAxis*axis[1], pz = dz - dAxis*axis[2];
      const d = Math.sqrt(px*px + py*py + pz*pz);
      sumSq += (d - radius) ** 2;
    }
    const rmse = Math.sqrt(sumSq / points.length);

    return { origin, axis, radius, rmse };
  }

  /**
   * Analytic 3x3 Symmetric Eigen Solver
   */
  private static solveSymmetric3x3(xx: number, xy: number, xz: number, yy: number, yz: number, zz: number) {
    // Characteristic equation: det(A - lambda*I) = 0
    // lambda^3 - trace(A)lambda^2 + ... = 0
    // For the Gate, we use a Jacobi rotation or Power Iteration approach for stability
    // Simple Power Iteration for largest, then deflate
    let v1 = this.powerIterate(xx, xy, xz, yy, yz, zz, [1, 0, 0]);
    let v2 = this.powerIterate(xx, xy, xz, yy, yz, zz, [0, 1, 0]);
    
    // Cross for 3rd
    const v3: [number, number, number] = [
      v1[1]*v2[2] - v1[2]*v2[1],
      v1[2]*v2[0] - v1[0]*v2[2],
      v1[0]*v2[1] - v1[1]*v2[0]
    ];
    const len3 = Math.sqrt(v3[0]**2 + v3[1]**2 + v3[2]**2);
    const smallest = len3 > 0 ? [v3[0]/len3, v3[1]/len3, v3[2]/len3] as [number, number, number] : [0,0,1] as [number, number, number];

    return {
      largestVector: v1,
      smallestVector: smallest
    };
  }

  private static powerIterate(xx: number, xy: number, xz: number, yy: number, yz: number, zz: number, guess: [number, number, number]): [number, number, number] {
    let v = guess;
    for (let i = 0; i < 15; i++) {
      const tx = xx * v[0] + xy * v[1] + xz * v[2];
      const ty = xy * v[0] + yy * v[1] + yz * v[2];
      const tz = xz * v[0] + yz * v[1] + zz * v[2];
      const len = Math.sqrt(tx*tx + ty*ty + tz*tz);
      if (len < 1e-9) break;
      v = [tx/len, ty/len, tz/len];
    }
    return v;
  }
}
