/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * G1-B7: Physical Residual Monitor
 *
 * Tracks numerical convergence via residual norms and physical convergence
 * via aerodynamic monitor stability (Drag, Lift, Pressure Drop).
 */

import { FvmMesh3D } from '../Fvm3DTypes';
import { CaseDefinition3D, ResidualSnapshot, PhysicalMonitorsSnapshot } from './AdaptiveCFDTypes';

export class PhysicalResidualMonitor {
  private residualHistory: ResidualSnapshot[] = [];
  private monitorHistory: PhysicalMonitorsSnapshot[] = [];

  /**
   * Computes normalized residual norms (L2 and LInf).
   */
  public computeResiduals(
    iter: number,
    u: number[], u_prev: number[],
    v: number[], v_prev: number[],
    w: number[], w_prev: number[],
    p: number[], p_prev: number[],
    massResiduals: number[]
  ): ResidualSnapshot {
    const numCells = u.length;
    let sumSqCont = 0, maxCont = 0;
    let sumSqU = 0, sumSqV = 0, sumSqW = 0;

    for (let i = 0; i < numCells; i++) {
      const cont = Math.abs(massResiduals[i]);
      sumSqCont += cont * cont;
      if (cont > maxCont) maxCont = cont;

      const du = u[i] - u_prev[i];
      const dv = v[i] - v_prev[i];
      const dw = w[i] - w_prev[i];
      sumSqU += du * du;
      sumSqV += dv * dv;
      sumSqW += dw * dw;
    }

    const snapshot: ResidualSnapshot = {
      iteration: iter,
      continuityL2: Math.sqrt(sumSqCont / numCells),
      continuityLInf: maxCont,
      momentumXL2: Math.sqrt(sumSqU / numCells),
      momentumYL2: Math.sqrt(sumSqV / numCells),
      momentumZL2: Math.sqrt(sumSqW / numCells),
      maxResidual: Math.max(maxCont, Math.sqrt(sumSqU / numCells)),
      isMonotonicallyDecreasing: iter > 1 ? (Math.max(maxCont, sumSqU) < this.residualHistory[this.residualHistory.length - 1].maxResidual) : true
    };

    this.residualHistory.push(snapshot);
    if (this.residualHistory.length > 1000) this.residualHistory.shift();

    return snapshot;
  }

  /**
   * Computes aerodynamic forces and physical monitors.
   */
  public computePhysicalMonitors(
    iter: number,
    mesh: FvmMesh3D,
    caseDef: CaseDefinition3D,
    p: number[],
    u: number[],
    v: number[],
    w: number[]
  ): PhysicalMonitorsSnapshot {
    let totalDragX = 0, totalLiftY = 0;
    let inletP = 0, outletP = 0;
    let inletCount = 0, outletCount = 0;
    let inletMassFlow = 0, outletMassFlow = 0;

    const rho = caseDef.fluid.densityKgM3 || 1.225;

    for (const face of mesh.faces) {
      const cId = face.ownerCellId;
      if (face.boundaryType === 'WALL') {
        // Simple pressure integration for drag/lift
        const forceP = p[cId] * face.area;
        totalDragX += forceP * face.normal.x;
        totalLiftY += forceP * face.normal.y;
      } else if (face.boundaryType === 'INLET') {
        inletP += p[cId];
        inletCount++;
        const Vn = u[cId] * face.normal.x + v[cId] * face.normal.y + w[cId] * face.normal.z;
        inletMassFlow += Math.abs(rho * Vn * face.area);
      } else if (face.boundaryType === 'OUTLET') {
        outletP += p[cId];
        outletCount++;
        const Vn = u[cId] * face.normal.x + v[cId] * face.normal.y + w[cId] * face.normal.z;
        outletMassFlow += Math.abs(rho * Vn * face.area);
      }
    }

    const refVel = caseDef.referenceVelocityMS || 1.0;
    const refArea = caseDef.referenceAreaM2 || 1.0;
    const q = 0.5 * rho * refVel * refVel;

    const snapshot: PhysicalMonitorsSnapshot = {
      iteration: iter,
      dragCoefficientCd: Math.abs(totalDragX) / (q * refArea + 1e-10),
      liftCoefficientCl: totalLiftY / (q * refArea + 1e-10),
      totalPressureDropPa: (inletCount > 0 ? inletP / inletCount : 0) - (outletCount > 0 ? outletP / outletCount : 0),
      inletMassFlowKgS: inletMassFlow,
      outletMassFlowKgS: outletMassFlow,
      massFlowImbalancePercent: inletMassFlow > 0 ? (Math.abs(inletMassFlow - outletMassFlow) / inletMassFlow) * 100 : 0,
      maxMachNumber: 0, // Not computed here
      wallMaxShearStressPa: 0,
      dragChangePercent20Iters: 0,
      isPhysicallyStabilized: iter > 20
    };

    if (iter > 20) {
      const prev = this.monitorHistory[this.monitorHistory.length - 20];
      if (prev) {
        (snapshot as any).dragChangePercent20Iters = Math.abs((snapshot.dragCoefficientCd - prev.dragCoefficientCd) / (prev.dragCoefficientCd + 1e-10)) * 100;
        snapshot.isPhysicallyStabilized = (snapshot as any).dragChangePercent20Iters < 0.1;
      }
    }

    this.monitorHistory.push(snapshot);
    if (this.monitorHistory.length > 1000) this.monitorHistory.shift();

    return snapshot;
  }

  /**
   * Evaluates combined numerical and physical convergence.
   */
  public evaluateConvergence(
    residuals: ResidualSnapshot,
    monitors: PhysicalMonitorsSnapshot,
    caseDef: CaseDefinition3D
  ): { isConverged: boolean } {
    const tol = caseDef.targetConvergence?.residualTolerance || 1e-4;
    const monTol = caseDef.targetConvergence?.monitorTolerance || 0.01;

    const numericalConverged = residuals.maxResidual < tol;
    const physicalConverged = monitors.iteration > 50 && monitors.isPhysicallyStabilized;

    return {
      isConverged: numericalConverged && physicalConverged
    };
  }

  public getHistories() {
    return {
      residuals: [...this.residualHistory],
      monitors: [...this.monitorHistory]
    };
  }
}
