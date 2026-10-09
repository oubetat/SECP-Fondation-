/**
 * SECP Industrial OS v2 — Independent CFD Physics & Geometric Oracles
 * Phase 15 (PATCH-174)
 *
 * Provides analytical Navier-Stokes solutions, geometric topology invariant checks,
 * and reference physical benchmarks independent of the solver.
 */

import { FvmMesh3D, Vector3D } from '../../cfd3d/Fvm3DTypes';

export interface PoiseuilleAnalyticalSolution {
  channelLengthM: number;
  channelHeightM: number;
  channelWidthM: number;
  avgVelocityMS: number;
  maxVelocityMS: number;
  viscosityPaS: number;
  densityKgM3: number;
  reynoldsNumber: number;
  exactPressureDropPa: number;
  exactWallShearStressPa: number;
  exactVolumetricFlowRateM3S: number;
  velocityAtHeight: (y: number) => number;
}

export interface CouetteAnalyticalSolution {
  channelHeightM: number;
  wallVelocityMS: number;
  viscosityPaS: number;
  densityKgM3: number;
  reynoldsNumber: number;
  exactWallShearStressPa: number;
  exactPressureGradientPaM: number;
  velocityAtHeight: (y: number) => number;
}

export class CFDIndependentOracles {
  /**
   * Exact Analytical Poiseuille Flow in 2D/3D Duct:
   * Navier-Stokes exact solution: u(y) = 6 * U_avg * (y/h) * (1 - y/h)
   * Pressure drop: \Delta p = (12 * \mu * L * U_avg) / h^2
   */
  public static getPoiseuilleAnalytical(
    lengthM: number,
    heightM: number,
    widthM: number,
    avgVelocityMS: number,
    viscosityPaS: number,
    densityKgM3: number
  ): PoiseuilleAnalyticalSolution {
    const reynoldsNumber = (densityKgM3 * avgVelocityMS * heightM) / viscosityPaS;
    const exactPressureDropPa = (12.0 * viscosityPaS * lengthM * avgVelocityMS) / (heightM * heightM);
    const maxVelocityMS = 1.5 * avgVelocityMS;
    const exactWallShearStressPa = (6.0 * viscosityPaS * avgVelocityMS) / heightM;
    const exactVolumetricFlowRateM3S = avgVelocityMS * heightM * widthM;

    return {
      channelLengthM: lengthM,
      channelHeightM: heightM,
      channelWidthM: widthM,
      avgVelocityMS,
      maxVelocityMS,
      viscosityPaS,
      densityKgM3,
      reynoldsNumber,
      exactPressureDropPa,
      exactWallShearStressPa,
      exactVolumetricFlowRateM3S,
      velocityAtHeight: (y: number) => {
        const normY = y / heightM;
        if (normY < 0 || normY > 1) return 0;
        return 6.0 * avgVelocityMS * normY * (1.0 - normY);
      }
    };
  }

  /**
   * Exact Analytical Couette Flow (Planar shear between fixed bottom and moving top wall):
   * Navier-Stokes exact solution: u(y) = U_wall * (y/h)
   * Shear stress: \tau = \mu * (U_wall / h) = constant
   * Pressure gradient: dp/dx = 0
   */
  public static getCouetteAnalytical(
    heightM: number,
    wallVelocityMS: number,
    viscosityPaS: number,
    densityKgM3: number
  ): CouetteAnalyticalSolution {
    const reynoldsNumber = (densityKgM3 * wallVelocityMS * heightM) / viscosityPaS;
    const exactWallShearStressPa = (viscosityPaS * wallVelocityMS) / heightM;
    const exactPressureGradientPaM = 0.0;

    return {
      channelHeightM: heightM,
      wallVelocityMS,
      viscosityPaS,
      densityKgM3,
      reynoldsNumber,
      exactWallShearStressPa,
      exactPressureGradientPaM,
      velocityAtHeight: (y: number) => {
        const normY = y / heightM;
        if (normY < 0) return 0;
        if (normY > 1) return wallVelocityMS;
        return wallVelocityMS * normY;
      }
    };
  }

  /**
   * Evaluates velocity profile error norms (L2 and Linf) against an analytical function
   */
  public static evaluateProfileErrorNorm(
    cellCentroids: Vector3D[],
    numericalVelocitiesU: number[],
    analyticalFunction: (y: number) => number
  ): { l2Norm: number; lInfNorm: number; relativeErrorPercent: number } {
    let sumSqDiff = 0;
    let sumSqRef = 0;
    let maxAbsDiff = 0;

    const n = Math.min(cellCentroids.length, numericalVelocitiesU.length);
    if (n === 0) return { l2Norm: 0, lInfNorm: 0, relativeErrorPercent: 0 };

    for (let i = 0; i < n; i++) {
      const y = cellCentroids[i].y;
      const numU = numericalVelocitiesU[i];
      const exactU = analyticalFunction(y);

      const diff = Math.abs(numU - exactU);
      sumSqDiff += diff * diff;
      sumSqRef += exactU * exactU;

      if (diff > maxAbsDiff) {
        maxAbsDiff = diff;
      }
    }

    const l2Norm = Math.sqrt(sumSqDiff / n);
    const refL2 = Math.sqrt(sumSqRef / n) || 1e-6;
    const relativeErrorPercent = (l2Norm / refL2) * 100.0;

    return {
      l2Norm,
      lInfNorm: maxAbsDiff,
      relativeErrorPercent
    };
  }

  /**
   * Geometric & Topological Mesh Invariant Oracle
   * Verifies Gauss Divergence theorem on every control volume (\sum A_f * n_f = 0),
   * strict volume positivity, and face neighbor connectivity.
   */
  public static verifyGeometricInvariants(mesh: FvmMesh3D, tolerance: number = 1e-5): {
    satisfied: boolean;
    violations: string[];
    maxClosednessResidual: number;
    hasPositiveVolumes: boolean;
    hasValidFaces: boolean;
  } {
    const violations: string[] = [];
    let maxClosednessResidual = 0;
    let hasPositiveVolumes = true;
    let hasValidFaces = true;

    if (!mesh.cells || mesh.cells.length === 0) {
      return {
        satisfied: false,
        violations: ['Mesh contains zero cells (EMPTY_MESH)'],
        maxClosednessResidual: 999,
        hasPositiveVolumes: false,
        hasValidFaces: false
      };
    }

    // 1. Audit Face Areas
    for (const f of mesh.faces) {
      if (f.area <= 0 || isNaN(f.area) || !isFinite(f.area)) {
        hasValidFaces = false;
        violations.push(`Face ${f.faceId} has non-positive area: ${f.area}`);
      }
      const normLen = Math.sqrt(f.normal.x * f.normal.x + f.normal.y * f.normal.y + f.normal.z * f.normal.z);
      if (Math.abs(normLen - 1.0) > 1e-3) {
        hasValidFaces = false;
        violations.push(`Face ${f.faceId} unit normal magnitude deviation: |n|=${normLen}`);
      }
    }

    // 2. Audit Closed Control Volumes (\sum A_f * n_f = 0)
    for (const c of mesh.cells) {
      if (c.volume <= 0 || isNaN(c.volume) || !isFinite(c.volume)) {
        hasPositiveVolumes = false;
        violations.push(`Cell ${c.cellId} has non-positive volume: ${c.volume}`);
      }

      let sumAx = 0, sumAy = 0, sumAz = 0;
      for (const fId of c.faceIds) {
        const f = mesh.faces[fId];
        if (!f) continue;
        const sign = (f.ownerCellId === c.cellId) ? 1.0 : -1.0;
        sumAx += sign * f.area * f.normal.x;
        sumAy += sign * f.area * f.normal.y;
        sumAz += sign * f.area * f.normal.z;
      }

      const closednessMag = Math.sqrt(sumAx * sumAx + sumAy * sumAy + sumAz * sumAz);
      if (closednessMag > maxClosednessResidual) {
        maxClosednessResidual = closednessMag;
      }

      if (closednessMag > tolerance) {
        violations.push(`Cell ${c.cellId} fails Gauss closedness invariant: ||sum A*n|| = ${closednessMag.toExponential(3)}`);
      }
    }

    const satisfied = violations.length === 0 && hasPositiveVolumes && hasValidFaces;

    return {
      satisfied,
      violations,
      maxClosednessResidual,
      hasPositiveVolumes,
      hasValidFaces
    };
  }
}
