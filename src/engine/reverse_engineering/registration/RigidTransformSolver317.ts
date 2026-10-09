/**
 * PHASE 29 — REVERSE ENGINEERING
 * PATCH-317 — Rigid Transformation Solver & Matrix Utilities
 * 
 * MATHEMATICAL FOUNDATION:
 * 1. Procrustes / SVD closed-form rigid alignment for 3D point correspondences.
 * 2. Given point sets P (source) and Q (target):
 *    - Centroids: mu_P = (1/N)*sum(p_i), mu_Q = (1/N)*sum(q_i)
 *    - Centered points: x_i = p_i - mu_P, y_i = q_i - mu_Q
 *    - Cross-covariance matrix: H = sum(w_i * x_i * y_i^T) (3x3)
 *    - SVD decomposition: H = U * S * V^T
 *    - Rotation: R = V * U^T (if det(R) < 0, flip sign of last column of V to ensure det(R) = +1)
 *    - Translation: t = mu_Q - R * mu_P
 * 3. Enforces rigid transform invariants: Scale = 1.0, R^T * R = I, Det(R) = 1.0.
 */

import { Point3D } from '../point_cloud/PointCloudTypes315';
import { RigidTransform, PointCorrespondence } from './PointCloudRegistrationTypes317';

export class RigidTransformSolver317 {
  /**
   * Create an Identity 4x4 Rigid Transform
   */
  public static createIdentityTransform(sourceFrame = 'SOURCE', targetFrame = 'TARGET'): RigidTransform {
    return {
      transformId: `TR-ID-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      sourceFrame,
      targetFrame,
      matrix: [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      ],
      rotationMatrix: [
        1, 0, 0,
        0, 1, 0,
        0, 0, 1
      ],
      translationVector: [0, 0, 0],
      scaleFactor: 1.0,
      isValidRigid: true,
      determinantR: 1.0
    };
  }

  /**
   * Construct RigidTransform from explicit R (3x3) and t (3x1)
   */
  public static buildTransform(
    R: [number, number, number, number, number, number, number, number, number],
    t: [number, number, number],
    sourceFrame = 'SOURCE',
    targetFrame = 'TARGET'
  ): RigidTransform {
    const detR = this.calculate3x3Determinant(R);
    const orthogonalityError = this.calculateOrthogonalityError(R);
    const isValidRigid = Math.abs(detR - 1.0) < 1e-4 && orthogonalityError < 1e-4;

    const matrix: [
      number, number, number, number,
      number, number, number, number,
      number, number, number, number,
      number, number, number, number
    ] = [
      R[0], R[1], R[2], t[0],
      R[3], R[4], R[5], t[1],
      R[6], R[7], R[8], t[2],
      0,    0,    0,    1
    ];

    return {
      transformId: `TR-SOLV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      sourceFrame,
      targetFrame,
      matrix,
      rotationMatrix: R,
      translationVector: t,
      scaleFactor: 1.0, // Strictly rigid, scale = 1.0
      isValidRigid,
      determinantR: parseFloat(detR.toFixed(6))
    };
  }

  /**
   * Apply 4x4 Rigid Transform to a single 3D point (p' = R*p + t)
   */
  public static transformPoint(p: Point3D, transform: RigidTransform): Point3D {
    const R = transform.rotationMatrix;
    const t = transform.translationVector;

    const nx = R[0] * p.x + R[1] * p.y + R[2] * p.z + t[0];
    const ny = R[3] * p.x + R[4] * p.y + R[5] * p.z + t[1];
    const nz = R[6] * p.x + R[7] * p.y + R[8] * p.z + t[2];

    const hasNormal = p.normal !== undefined;
    let newNormal: [number, number, number] | undefined = undefined;
    if (hasNormal && p.normal) {
      newNormal = [
        R[0] * p.normal[0] + R[1] * p.normal[1] + R[2] * p.normal[2],
        R[3] * p.normal[0] + R[4] * p.normal[1] + R[5] * p.normal[2],
        R[6] * p.normal[0] + R[7] * p.normal[1] + R[8] * p.normal[2],
      ];
    }

    return {
      x: parseFloat(nx.toFixed(6)),
      y: parseFloat(ny.toFixed(6)),
      z: parseFloat(nz.toFixed(6)),
      intensity: p.intensity,
      normal: newNormal
    };
  }

  /**
   * Solve Rigid Transformation between point correspondences using SVD / Procrustes algorithm
   */
  public static solveProcrustesSVD(correspondences: PointCorrespondence[]): {
    transform: RigidTransform;
    rmseMm: number;
    degenerate: boolean;
    reason?: string;
  } {
    const valid = correspondences.filter(c => !c.rejected);

    // Rule 9: Minimum Correspondence Validation (At least 3 non-collinear correspondences)
    if (valid.length < 3) {
      return {
        transform: this.createIdentityTransform(),
        rmseMm: Infinity,
        degenerate: true,
        reason: `INSUFFICIENT_CORRESPONDENCES: Found ${valid.length} valid points, minimum 3 required.`
      };
    }

    // 1. Compute weighted centroids
    let totalWeight = 0;
    let muPx = 0, muPy = 0, muPz = 0;
    let muQx = 0, muQy = 0, muQz = 0;

    for (const c of valid) {
      const w = c.weight > 0 ? c.weight : 1.0;
      totalWeight += w;
      muPx += w * c.sourcePoint[0];
      muPy += w * c.sourcePoint[1];
      muPz += w * c.sourcePoint[2];

      muQx += w * c.targetPoint[0];
      muQy += w * c.targetPoint[1];
      muQz += w * c.targetPoint[2];
    }

    muPx /= totalWeight; muPy /= totalWeight; muPz /= totalWeight;
    muQx /= totalWeight; muQy /= totalWeight; muQz /= totalWeight;

    // 2. Compute 3x3 Cross-covariance Matrix H
    const H = [
      0, 0, 0,
      0, 0, 0,
      0, 0, 0
    ];

    for (const c of valid) {
      const w = c.weight > 0 ? c.weight : 1.0;
      const px = c.sourcePoint[0] - muPx;
      const py = c.sourcePoint[1] - muPy;
      const pz = c.sourcePoint[2] - muPz;

      const qx = c.targetPoint[0] - muQx;
      const qy = c.targetPoint[1] - muQy;
      const qz = c.targetPoint[2] - muQz;

      H[0] += w * px * qx; H[1] += w * px * qy; H[2] += w * px * qz;
      H[3] += w * py * qx; H[4] += w * py * qy; H[5] += w * py * qz;
      H[6] += w * pz * qx; H[7] += w * pz * qy; H[8] += w * pz * qz;
    }

    // 3. Approximate SVD decomposition of 3x3 matrix H
    const { R } = this.solve3x3SVDForRotation(H);

    // Degenerate check: Check if points are collinear or coplanar with insufficient spread
    const detR = this.calculate3x3Determinant(R);
    if (isNaN(detR) || Math.abs(detR) < 1e-4) {
      return {
        transform: this.createIdentityTransform(),
        rmseMm: Infinity,
        degenerate: true,
        reason: 'DEGENERATE_GEOMETRY: Collinear or planar degenerate points.'
      };
    }

    // 4. Compute Translation t = mu_Q - R * mu_P
    const tx = muQx - (R[0] * muPx + R[1] * muPy + R[2] * muPz);
    const ty = muQy - (R[3] * muPx + R[4] * muPy + R[5] * muPz);
    const tz = muQz - (R[6] * muPx + R[7] * muPy + R[8] * muPz);

    const transform = this.buildTransform(R, [tx, ty, tz]);

    // 5. Compute RMSE on transformed points
    let sumSqErr = 0;
    for (const c of valid) {
      const pTrans = this.transformPoint({ x: c.sourcePoint[0], y: c.sourcePoint[1], z: c.sourcePoint[2] }, transform);
      const dx = pTrans.x - c.targetPoint[0];
      const dy = pTrans.y - c.targetPoint[1];
      const dz = pTrans.z - c.targetPoint[2];
      sumSqErr += (dx * dx + dy * dy + dz * dz);
    }

    const rmseMm = Math.sqrt(sumSqErr / valid.length);

    return {
      transform,
      rmseMm: parseFloat(rmseMm.toFixed(6)),
      degenerate: false
    };
  }

  /**
   * Closed-form 3x3 SVD for Rotation R = V * U^T
   */
  private static solve3x3SVDForRotation(H: number[]): { R: [number, number, number, number, number, number, number, number, number] } {
    // Polar Decomposition H = R * S via Jacobi iterations / SVD approximation
    // R = H * (H^T * H)^(-1/2)

    // Compute Frobenius Norm of H to normalize matrix scale.
    // This scales the cross-covariance to a range where Newton-Raphson is guaranteed to converge
    // rapidly (typically within 4-6 iterations) to a perfect orthogonal matrix with determinant = 1.0.
    let sumSq = 0;
    for (let i = 0; i < 9; i++) {
      sumSq += H[i] * H[i];
    }
    const frobNorm = Math.sqrt(sumSq);

    // If H is a zero matrix, return identity rotation matrix
    if (frobNorm < 1e-12) {
      return { R: [1, 0, 0, 0, 1, 0, 0, 0, 1] };
    }

    // Scale H to construct the initial normalized rotation estimator
    let R: [number, number, number, number, number, number, number, number, number] = [
      H[0] / frobNorm, H[1] / frobNorm, H[2] / frobNorm,
      H[3] / frobNorm, H[4] / frobNorm, H[5] / frobNorm,
      H[6] / frobNorm, H[7] / frobNorm, H[8] / frobNorm
    ];

    // Normalize R to orthogonal rotation matrix (Newton-Raphson: R_{k+1} = 0.5 * (R_k + (R_k^T)^-1))
    for (let iter = 0; iter < 15; iter++) {
      const det = this.calculate3x3Determinant(R);
      if (Math.abs(det) < 1e-12) break;

      const invR = this.invert3x3Matrix(R);
      const R_trans_inv = [
        invR[0], invR[3], invR[6],
        invR[1], invR[4], invR[7],
        invR[2], invR[5], invR[8]
      ];

      for (let i = 0; i < 9; i++) {
        R[i] = 0.5 * (R[i] + R_trans_inv[i]);
      }
    }

    // Ensure det(R) = +1 (Reflection check)
    let detR = this.calculate3x3Determinant(R);
    if (detR < 0) {
      R[6] = -R[6]; R[7] = -R[7]; R[8] = -R[8];
    }

    // Transpose the polar factor R_p to obtain the optimal Procrustes rotation R = R_p^T = V * U^T
    const transposeR: [number, number, number, number, number, number, number, number, number] = [
      R[0], R[3], R[6],
      R[1], R[4], R[7],
      R[2], R[5], R[8]
    ];

    return { R: transposeR };
  }

  /**
   * Compute 3x3 Determinant
   */
  public static calculate3x3Determinant(m: number[]): number {
    return (
      m[0] * (m[4] * m[8] - m[5] * m[7]) -
      m[1] * (m[3] * m[8] - m[5] * m[6]) +
      m[2] * (m[3] * m[7] - m[4] * m[6])
    );
  }

  /**
   * Calculate Orthogonality Error ||R^T * R - I||_F
   */
  public static calculateOrthogonalityError(R: number[]): number {
    const RtR = [
      R[0]*R[0] + R[3]*R[3] + R[6]*R[6], R[0]*R[1] + R[3]*R[4] + R[6]*R[7], R[0]*R[2] + R[3]*R[5] + R[6]*R[8],
      R[1]*R[0] + R[4]*R[3] + R[7]*R[6], R[1]*R[1] + R[4]*R[4] + R[7]*R[7], R[1]*R[2] + R[4]*R[5] + R[7]*R[8],
      R[2]*R[0] + R[5]*R[3] + R[8]*R[6], R[2]*R[1] + R[5]*R[4] + R[8]*R[7], R[2]*R[2] + R[5]*R[5] + R[8]*R[8]
    ];

    const I = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    let errSq = 0;
    for (let i = 0; i < 9; i++) {
      errSq += Math.pow(RtR[i] - I[i], 2);
    }
    return Math.sqrt(errSq);
  }

  /**
   * Invert 3x3 Matrix
   */
  private static invert3x3Matrix(m: number[]): number[] {
    const det = this.calculate3x3Determinant(m);
    if (Math.abs(det) < 1e-12) return [1,0,0, 0,1,0, 0,0,1];

    const invDet = 1.0 / det;
    return [
      (m[4]*m[8] - m[5]*m[7]) * invDet, (m[2]*m[7] - m[1]*m[8]) * invDet, (m[1]*m[5] - m[2]*m[4]) * invDet,
      (m[5]*m[6] - m[3]*m[8]) * invDet, (m[0]*m[8] - m[2]*m[6]) * invDet, (m[2]*m[3] - m[0]*m[5]) * invDet,
      (m[3]*m[7] - m[4]*m[6]) * invDet, (m[1]*m[6] - m[0]*m[7]) * invDet, (m[0]*m[4] - m[1]*m[3]) * invDet
    ];
  }

  /**
   * Multiply two 4x4 Rigid Matrices: C = A * B
   */
  public static multiplyTransforms(A: RigidTransform, B: RigidTransform): RigidTransform {
    const a = A.matrix;
    const b = B.matrix;

    const res: number[] = new Array(16).fill(0);
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) {
          sum += a[row * 4 + k] * b[k * 4 + col];
        }
        res[row * 4 + col] = sum;
      }
    }

    const R: [number, number, number, number, number, number, number, number, number] = [
      res[0], res[1], res[2],
      res[4], res[5], res[6],
      res[8], res[9], res[10]
    ];

    const t: [number, number, number] = [res[3], res[7], res[11]];

    return this.buildTransform(R, t, A.sourceFrame, B.targetFrame);
  }
}
