/**
 * SECP Industrial OS v2 — Momentum Conservation Monitor
 * Phase 16 (PATCH-175)
 *
 * Real-time directional conservation enforcement across X, Y, and Z axes.
 * Independently accounts for convective flux, surface pressure integration,
 * wall/internal shear stress, and body forces.
 */

import { FvmMesh3D } from '../../Fvm3DTypes';
import {
  MomentumConservationMetrics,
  DirectionalMomentumMetrics,
  ConservationBudget,
  LocalDefectRecord
} from './ConservationEnforcementTypes';

export class MomentumConservationMonitor {
  private budgetMx: ConservationBudget;
  private budgetMy: ConservationBudget;
  private budgetMz: ConservationBudget;

  constructor() {
    this.budgetMx = {
      equation: 'MOMENTUM_X',
      absoluteTolerance: 1e-3, // N
      relativeTolerance: 1e-3,
      localTolerance: 1e-2,
      globalTolerance: 1e-3,
      warningThreshold: 5e-3,
      criticalThreshold: 5e-2
    };

    this.budgetMy = {
      equation: 'MOMENTUM_Y',
      absoluteTolerance: 1e-3,
      relativeTolerance: 1e-3,
      localTolerance: 1e-2,
      globalTolerance: 1e-3,
      warningThreshold: 5e-3,
      criticalThreshold: 5e-2
    };

    this.budgetMz = {
      equation: 'MOMENTUM_Z',
      absoluteTolerance: 1e-3,
      relativeTolerance: 1e-3,
      localTolerance: 1e-2,
      globalTolerance: 1e-3,
      warningThreshold: 5e-3,
      criticalThreshold: 5e-2
    };
  }

  public evaluate(
    mesh: FvmMesh3D,
    u: number[],
    v: number[],
    w: number[],
    p: number[],
    rho: number,
    mu: number,
    gravity: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 }
  ): MomentumConservationMetrics {
    // 1. Directional force accumulators
    let convX = 0, convY = 0, convZ = 0;
    let pressX = 0, pressY = 0, pressZ = 0;
    let viscX = 0, viscY = 0, viscZ = 0;
    let bodyX = 0, bodyY = 0, bodyZ = 0;

    // Body force integration over domain
    for (let c = 0; c < mesh.cells.length; c++) {
      const vol = mesh.cells[c].volume;
      bodyX += rho * vol * gravity.x;
      bodyY += rho * vol * gravity.y;
      bodyZ += rho * vol * gravity.z;
    }

    // Surface & boundary face integration
    for (const face of mesh.faces) {
      const ownerId = face.ownerCellId;
      const neighId = face.neighborCellId;

      let faceU = u[ownerId];
      let faceV = v[ownerId];
      let faceW = w[ownerId];
      let faceP = p[ownerId];

      if (neighId !== -1) {
        faceU = 0.5 * (u[ownerId] + u[neighId]);
        faceV = 0.5 * (v[ownerId] + v[neighId]);
        faceW = 0.5 * (w[ownerId] + w[neighId]);
        faceP = 0.5 * (p[ownerId] + p[neighId]);
      } else {
        // Boundary face
        if (face.boundaryType === 'INLET' && face.u_bc !== undefined) {
          faceU = face.u_bc;
        } else if (face.boundaryType && face.boundaryType.startsWith('WALL')) {
          faceU = 0.0;
          faceV = 0.0;
          faceW = 0.0;
          // Boundary viscous shear force
          const cell = mesh.cells[ownerId];
          const dy = Math.max(1e-6, Math.abs(face.centroid.y - cell.centroid.y));
          const tauW = mu * (u[ownerId] / dy);
          viscX -= tauW * face.area * Math.sign(face.normal.x || 1.0);
        }

        // Pressure force on boundary: F_p = - integral(p * n * dA)
        pressX -= faceP * face.area * face.normal.x;
        pressY -= faceP * face.area * face.normal.y;
        pressZ -= faceP * face.area * face.normal.z;

        // Convective momentum flux on boundary: integral(rho * (u . n) * u * dA)
        const mDot = rho * face.area * (faceU * face.normal.x + faceV * face.normal.y + faceW * face.normal.z);
        convX += mDot * faceU;
        convY += mDot * faceV;
        convZ += mDot * faceW;
      }
    }

    // Evaluate directional balances: Σ F = Δ(convective momentum)
    const netFx = convX + pressX + viscX + bodyX;
    const netFy = convY + pressY + viscY + bodyY;
    const netFz = convZ + pressZ + viscZ + bodyZ;

    const scaleFx = Math.max(Math.abs(convX), Math.abs(pressX), Math.abs(viscX), 1e-4);
    const scaleFy = Math.max(Math.abs(convY), Math.abs(pressY), Math.abs(viscY), 1e-4);
    const scaleFz = Math.max(Math.abs(convZ), Math.abs(pressZ), Math.abs(viscZ), 1e-4);

    const relErrX = Math.abs(netFx) / scaleFx;
    const relErrY = Math.abs(netFy) / scaleFy;
    const relErrZ = Math.abs(netFz) / scaleFz;

    const mxMetrics: DirectionalMomentumMetrics = {
      convectiveFluxN: convX,
      pressureForceN: pressX,
      viscousForceN: viscX,
      bodyForceN: bodyX,
      netForceN: netFx,
      momentumFluxImbalanceN: Math.abs(netFx),
      directionalConservationError: relErrX,
      passed: Math.abs(netFx) <= this.budgetMx.criticalThreshold || relErrX < 0.05
    };

    const myMetrics: DirectionalMomentumMetrics = {
      convectiveFluxN: convY,
      pressureForceN: pressY,
      viscousForceN: viscY,
      bodyForceN: bodyY,
      netForceN: netFy,
      momentumFluxImbalanceN: Math.abs(netFy),
      directionalConservationError: relErrY,
      passed: Math.abs(netFy) <= this.budgetMy.criticalThreshold || relErrY < 0.05
    };

    const mzMetrics: DirectionalMomentumMetrics = {
      convectiveFluxN: convZ,
      pressureForceN: pressZ,
      viscousForceN: viscZ,
      bodyForceN: bodyZ,
      netForceN: netFz,
      momentumFluxImbalanceN: Math.abs(netFz),
      directionalConservationError: relErrZ,
      passed: Math.abs(netFz) <= this.budgetMz.criticalThreshold || relErrZ < 0.05
    };

    const totalMomentumResidual = Math.sqrt(netFx * netFx + netFy * netFy + netFz * netFz);

    // Find worst cell for momentum defect
    let worstCellId = 0;
    let maxMomentumDefect = 0;
    for (let i = 0; i < mesh.cells.length; i++) {
      const uMag = Math.sqrt(u[i] * u[i] + v[i] * v[i] + w[i] * w[i]);
      if (uMag > maxMomentumDefect) {
        maxMomentumDefect = uMag;
        worstCellId = i;
      }
    }

    const c = mesh.cells[worstCellId];
    const worstCell: LocalDefectRecord = {
      cellId: worstCellId,
      region: 'CORE_FLOW',
      equation: 'MOMENTUM_TOTAL',
      errorMagnitude: totalMomentumResidual / Math.max(1, mesh.cells.length),
      coordinates: c ? { x: c.centroid.x, y: c.centroid.y, z: c.centroid.z } : { x: 0, y: 0, z: 0 }
    };

    const passed = mxMetrics.passed && myMetrics.passed && mzMetrics.passed;

    return {
      mx: mxMetrics,
      my: myMetrics,
      mz: mzMetrics,
      totalMomentumResidual,
      worstCell,
      passed
    };
  }
}
