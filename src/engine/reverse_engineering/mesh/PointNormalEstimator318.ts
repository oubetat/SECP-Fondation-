/**
 * PHASE 29 — REVERSE ENGINEERING
 * PATCH-318 — Point Normal Estimation Engine (PCA & Orientation Consistency)
 * 
 * MATHEMATICAL ALGORITHM:
 * 1. Neighborhood Construction: k-Nearest Neighbors (k-NN) or spatial radius search.
 * 2. Covariance Matrix C = (1/k) * sum((p_i - mu) * (p_i - mu)^T) for 3x3 point positions.
 * 3. Eigen-Decomposition of 3x3 symmetric covariance matrix:
 *    - Eigenvalues: lambda_0 <= lambda_1 <= lambda_2.
 *    - Normal n = Eigenvector associated with smallest eigenvalue lambda_0.
 * 4. Normal Confidence:
 *    - Surface variation / curvature metric: sigma = lambda_0 / (lambda_0 + lambda_1 + lambda_2).
 *    - Confidence = max(0, 1.0 - 3.0 * sigma). (1.0 for flat planar regions, lower for noise/sharp corners).
 * 5. Orientation Consistency:
 *    - Orient normals consistently outward relative to the point cloud centroid: n . (p_i - C_cloud) > 0.
 */

import { Point3D } from '../point_cloud/PointCloudTypes315';
import { PointNormal318 } from './ScanMeshTypes318';

export class PointNormalEstimator318 {
  /**
   * Compute Local Normals for a list of 3D points using PCA on k-NN neighborhoods
   */
  public static estimateNormals(
    points: Point3D[],
    kNeighbors = 10,
    reorientOutward = true
  ): PointNormal318[] {
    if (points.length === 0) return [];

    // Calculate Cloud Centroid for global outward orientation
    let cx = 0, cy = 0, cz = 0;
    for (const p of points) {
      cx += p.x; cy += p.y; cz += p.z;
    }
    cx /= points.length; cy /= points.length; cz /= points.length;

    const normals: PointNormal318[] = [];

    for (let i = 0; i < points.length; i++) {
      const target = points[i];

      // Existing point normal preservation if valid
      if (target.normal && Array.isArray(target.normal)) {
        const [tnx, tny, tnz] = target.normal;
        if (Math.abs(tnx**2 + tny**2 + tnz**2 - 1.0) < 1e-2) {
          normals.push({
            nx: tnx,
            ny: tny,
            nz: tnz,
            confidence: 0.95,
            isOriented: true
          });
          continue;
        }
      }

      // 1. Find k-Nearest Neighbors
      const neighbors = this.findKNearestNeighbors(target, points, kNeighbors);

      if (neighbors.length < 3) {
        normals.push({ nx: 0, ny: 0, nz: 1, confidence: 0.1, isOriented: false });
        continue;
      }

      // 2. Compute Centroid of Neighborhood
      let ncx = 0, ncy = 0, ncz = 0;
      for (const n of neighbors) {
        ncx += n.x; ncy += n.y; ncz += n.z;
      }
      ncx /= neighbors.length; ncy /= neighbors.length; ncz /= neighbors.length;

      // 3. Construct 3x3 Covariance Matrix C
      const C = [
        0, 0, 0,
        0, 0, 0,
        0, 0, 0
      ];

      for (const n of neighbors) {
        const dx = n.x - ncx;
        const dy = n.y - ncy;
        const dz = n.z - ncz;

        C[0] += dx * dx; C[1] += dx * dy; C[2] += dx * dz;
        C[3] += dy * dx; C[4] += dy * dy; C[5] += dy * dz;
        C[6] += dz * dx; C[7] += dz * dy; C[8] += dz * dz;
      }

      const invK = 1.0 / neighbors.length;
      for (let j = 0; j < 9; j++) C[j] *= invK;

      // 4. Solve Eigenvalues & Eigenvectors via Jacobi Iteration for 3x3 Symmetric Matrix
      const { eigenvalues, eigenvectors } = this.solveSymmetric3x3Eigen(C);

      // Smallest eigenvalue index
      let minIdx = 0;
      if (eigenvalues[1] < eigenvalues[minIdx]) minIdx = 1;
      if (eigenvalues[2] < eigenvalues[minIdx]) minIdx = 2;

      let nx = eigenvectors[minIdx][0];
      let ny = eigenvectors[minIdx][1];
      let nz = eigenvectors[minIdx][2];

      // Normalize normal vector
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (len > 1e-8) {
        nx /= len; ny /= len; nz /= len;
      } else {
        nx = 0; ny = 0; nz = 1;
      }

      // 5. Calculate Normal Confidence (Surface variation / anisotropy metric)
      const sumEig = eigenvalues[0] + eigenvalues[1] + eigenvalues[2];
      const curvature = sumEig > 1e-12 ? eigenvalues[minIdx] / sumEig : 0.0;
      const confidence = Math.max(0.05, Math.min(1.0, parseFloat((1.0 - 3.0 * curvature).toFixed(3))));

      // 6. Orient Normal Outward from Cloud Centroid if requested
      if (reorientOutward) {
        const vecToPtX = target.x - cx;
        const vecToPtY = target.y - cy;
        const vecToPtZ = target.z - cz;
        const dot = nx * vecToPtX + ny * vecToPtY + nz * vecToPtZ;

        if (dot < 0) {
          nx = -nx; ny = -ny; nz = -nz;
        }
      }

      normals.push({
        nx: parseFloat(nx.toFixed(6)),
        ny: parseFloat(ny.toFixed(6)),
        nz: parseFloat(nz.toFixed(6)),
        confidence,
        isOriented: true
      });
    }

    return normals;
  }

  /**
   * Find k Nearest Neighbors for target point
   */
  private static findKNearestNeighbors(target: Point3D, points: Point3D[], k: number): Point3D[] {
    const list: { point: Point3D; distSq: number }[] = [];

    for (const p of points) {
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const dz = target.z - p.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      list.push({ point: p, distSq });
    }

    list.sort((a, b) => a.distSq - b.distSq);
    return list.slice(0, Math.min(k, points.length)).map(item => item.point);
  }

  /**
   * Jacobi Eigen Solver for 3x3 Real Symmetric Matrix
   */
  private static solveSymmetric3x3Eigen(A: number[]): { eigenvalues: number[]; eigenvectors: number[][] } {
    const V = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ];

    const D = [
      A[0], A[1], A[2],
      A[3], A[4], A[5],
      A[6], A[7], A[8]
    ];

    for (let iter = 0; iter < 15; iter++) {
      let maxOff = 0;
      let p = 0, q = 1;

      // Find largest off-diagonal element
      if (Math.abs(D[1]) > maxOff) { maxOff = Math.abs(D[1]); p = 0; q = 1; }
      if (Math.abs(D[2]) > maxOff) { maxOff = Math.abs(D[2]); p = 0; q = 2; }
      if (Math.abs(D[5]) > maxOff) { maxOff = Math.abs(D[5]); p = 1; q = 2; }

      if (maxOff < 1e-9) break;

      const app = D[p * 3 + p];
      const aqq = D[q * 3 + q];
      const apq = D[p * 3 + q];

      const theta = 0.5 * Math.atan2(2 * apq, aqq - app);
      const c = Math.cos(theta);
      const s = Math.sin(theta);

      // Rotate D
      D[p * 3 + p] = c * c * app - 2 * s * c * apq + s * s * aqq;
      D[q * 3 + q] = s * s * app + 2 * s * c * apq + c * c * aqq;
      D[p * 3 + q] = 0; D[q * 3 + p] = 0;

      // Update eigenvectors
      for (let i = 0; i < 3; i++) {
        const vip = V[i][p];
        const viq = V[i][q];
        V[i][p] = c * vip - s * viq;
        V[i][q] = s * vip + c * viq;
      }
    }

    const eigenvalues = [D[0], D[4], D[8]];
    const eigenvectors = [
      [V[0][0], V[1][0], V[2][0]],
      [V[0][1], V[1][1], V[2][1]],
      [V[0][2], V[1][2], V[2][2]]
    ];

    return { eigenvalues, eigenvectors };
  }
}
