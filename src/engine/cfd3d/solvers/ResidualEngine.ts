/**
 * SECP Industrial OS — Engineering Truth Platform
 * PATCH-246 — Residual Engine
 */

import { CfdMesh } from '../mesh/CfdMesh';
import { CfdScalarField, CfdVectorField } from '../mesh/CfdField';
import { CfdCellEquation } from '../fvm/FvmTypes';

export enum ConvergenceState {
  INITIALIZING = 'INITIALIZING',
  ITERATING = 'ITERATING',
  CONVERGING = 'CONVERGING',
  CONVERGED = 'CONVERGED',
  STALLED = 'STALLED',
  DIVERGING = 'DIVERGING',
  MAX_ITERATIONS = 'MAX_ITERATIONS',
  INVALID = 'INVALID'
}

export interface ResidualHistory {
  iteration: number;
  time: number;
  momentumU: number;
  momentumV: number;
  momentumW: number;
  pressure: number;
  continuity: number;
  massImbalance: number;
  convergenceState: ConvergenceState;
}

export interface MassBalanceReport {
  inFlux: number;
  outFlux: number;
  netFlux: number;
  relativeImbalance: number;
}

export interface WorstCellDiagnostic {
  cellId: string;
  residual: number;
  equation: string;
  location: { x: number; y: number; z: number };
}

export class ResidualEngine {
  private history: ResidualHistory[] = [];
  private currentState: ConvergenceState = ConvergenceState.INITIALIZING;
  private refU: number = 1.0;
  private refV: number = 1.0;
  private refW: number = 1.0;
  private refP: number = 1.0;
  private refC: number = 1.0;

  constructor(private mesh: CfdMesh) {}

  public getHistory(): ResidualHistory[] {
    return this.history;
  }

  public getConvergenceState(): ConvergenceState {
    return this.currentState;
  }

  /**
   * Sets initial reference residuals for normalization
   */
  public setReferenceResiduals(u: number, v: number, w: number, p: number, c: number): void {
    this.refU = Math.max(u, 1e-8);
    this.refV = Math.max(v, 1e-8);
    this.refW = Math.max(w, 1e-8);
    this.refP = Math.max(p, 1e-8);
    this.refC = Math.max(c, 1e-8);
  }

  /**
   * Calculates local and global residuals for a scalar field equation
   */
  public calculateScalarResidual(
    equations: Map<string, CfdCellEquation>,
    field: CfdScalarField,
    normType: 'L1' | 'L2' | 'L_INF' = 'L2'
  ): { global: number; cellResiduals: Map<string, number> } {
    const cellResiduals = new Map<string, number>();
    let sumRes = 0;
    let sumVal = 0;
    let maxRes = 0;

    equations.forEach((eq, id) => {
      let lhs = eq.aP * field.getValue(id);
      eq.aN.forEach((val, nid) => {
        lhs -= val * field.getValue(nid);
      });
      const res = Math.abs(lhs - eq.source);
      cellResiduals.set(id, res);

      if (normType === 'L1') {
        sumRes += res;
        sumVal += Math.abs(lhs);
      } else if (normType === 'L2') {
        sumRes += res * res;
        sumVal += lhs * lhs;
      } else {
        maxRes = Math.max(maxRes, res);
      }
    });

    let global = 0;
    if (normType === 'L1') {
      global = sumRes / (sumVal + 1e-10);
    } else if (normType === 'L2') {
      global = Math.sqrt(sumRes) / (Math.sqrt(sumVal) + 1e-10);
    } else {
      global = maxRes;
    }

    // Guard against NaN/Infinity
    if (isNaN(global) || !isFinite(global)) {
      this.currentState = ConvergenceState.INVALID;
      return { global: NaN, cellResiduals };
    }

    return { global, cellResiduals };
  }

  /**
   * Calculates mass imbalance (continuity residual)
   */
  public calculateContinuity(velocity: CfdVectorField, density: number = 1.0): { global: number; local: Map<string, number> } {
    const local = new Map<string, number>();
    let totalImbalance = 0;
    let sumFluxMag = 0;

    this.mesh.cells.forEach(cell => {
      let netFlux = 0;
      let sumFluxCell = 0;
      cell.faceIds.forEach(fid => {
        const face = this.mesh.faces.get(fid)!;
        const v1 = velocity.getValue(face.ownerCellId);
        const v2 = face.neighbourCellId ? velocity.getValue(face.neighbourCellId) : v1;
        const vFace = {
          x: (v1.x + v2.x) * 0.5,
          y: (v1.y + v2.y) * 0.5,
          z: (v1.z + v2.z) * 0.5
        };
        const areaNormal = face.normal;
        const flux = density * (vFace.x * areaNormal.x + vFace.y * areaNormal.y + vFace.z * areaNormal.z) * face.area;
        const sign = face.ownerCellId === cell.id ? 1 : -1;
        netFlux += sign * flux;
        sumFluxCell += Math.abs(flux);
      });
      local.set(cell.id, netFlux);
      totalImbalance += netFlux * netFlux;
      sumFluxMag += sumFluxCell;
    });

    const global = Math.sqrt(totalImbalance) / (sumFluxMag + 1e-10);
    return { global, local };
  }

  /**
   * Evaluates complete global mass balance matching inlet/outlet flows
   */
  public calculateMassBalance(velocity: CfdVectorField, density: number = 1.0): MassBalanceReport {
    let inFlux = 0;
    let outFlux = 0;

    this.mesh.faces.forEach(face => {
      // Is boundary face
      if (!face.neighbourCellId) {
        const v = velocity.getValue(face.ownerCellId);
        const normalFlux = density * (v.x * face.normal.x + v.y * face.normal.y + v.z * face.normal.z) * face.area;
        if (normalFlux < 0) {
          inFlux += Math.abs(normalFlux);
        } else {
          outFlux += normalFlux;
        }
      }
    });

    const netFlux = inFlux - outFlux;
    const denom = Math.max(inFlux, outFlux, 1e-10);
    const relativeImbalance = Math.abs(netFlux) / denom;

    return {
      inFlux,
      outFlux,
      netFlux,
      relativeImbalance
    };
  }

  /**
   * Performs diagnosis on cells with worst residual errors
   */
  public diagnoseWorstCells(
    uRes: Map<string, number>,
    vRes: Map<string, number>,
    wRes: Map<string, number>,
    pRes: Map<string, number>
  ): WorstCellDiagnostic[] {
    const list: WorstCellDiagnostic[] = [];

    this.mesh.cells.forEach(cell => {
      const ru = uRes.get(cell.id) || 0;
      const rv = vRes.get(cell.id) || 0;
      const rw = wRes.get(cell.id) || 0;
      const rp = pRes.get(cell.id) || 0;

      // Find largest residual of this cell
      const maxVal = Math.max(ru, rv, rw, rp);
      let equation = 'Continuity';
      if (maxVal === ru) equation = 'Momentum-U';
      else if (maxVal === rv) equation = 'Momentum-V';
      else if (maxVal === rw) equation = 'Momentum-W';

      // Compute geometric center of cell
      let cx = 0, cy = 0, cz = 0;
      let count = 0;
      cell.nodeIds.forEach(nid => {
        const node = this.mesh.nodes.get(nid);
        if (node) {
          cx += node.x;
          cy += node.y;
          cz += node.z;
          count++;
        }
      });

      list.push({
        cellId: cell.id,
        residual: maxVal,
        equation,
        location: count > 0 ? { x: cx / count, y: cy / count, z: cz / count } : { x: 0, y: 0, z: 0 }
      });
    });

    // Sort descending by residual and return top 5
    return list.sort((a, b) => b.residual - a.residual).slice(0, 5);
  }

  /**
   * Appends iteration record and runs state machine logic for convergence/divergence
   */
  public recordIteration(
    iteration: number,
    u: number,
    v: number,
    w: number,
    p: number,
    c: number,
    massImbalance: number,
    tolerance: number = 1e-5,
    maxIter: number = 500
  ): ResidualHistory {
    // Check for NaN or infinity anywhere in residuals
    const hasNaN = [u, v, w, p, c, massImbalance].some(val => isNaN(val) || !isFinite(val));
    if (hasNaN) {
      this.currentState = ConvergenceState.INVALID;
    }

    if (this.currentState !== ConvergenceState.INVALID) {
      if (iteration === 1) {
        this.setReferenceResiduals(u, v, w, p, c);
        this.currentState = ConvergenceState.ITERATING;
      }

      // Check Converged condition
      const isConverged = u < tolerance && v < tolerance && w < tolerance && c < tolerance;

      if (isConverged) {
        this.currentState = ConvergenceState.CONVERGED;
      } else if (iteration >= maxIter) {
        this.currentState = ConvergenceState.MAX_ITERATIONS;
      } else {
        // Run Stagnation/Divergence logic
        this.currentState = this.detectAnomalies(u, v, w, p, c, iteration);
      }
    }

    const record: ResidualHistory = {
      iteration,
      time: iteration * 0.01,
      momentumU: u,
      momentumV: v,
      momentumW: w,
      pressure: p,
      continuity: c,
      massImbalance,
      convergenceState: this.currentState
    };

    this.history.push(record);
    return record;
  }

  private detectAnomalies(u: number, v: number, w: number, p: number, c: number, iter: number): ConvergenceState {
    if (this.history.length < 5) return ConvergenceState.ITERATING;

    // Divergence Check (continuous growth of residuals over last 4 iterations)
    let isGrowing = true;
    for (let i = this.history.length - 4; i < this.history.length; i++) {
      const prev = this.history[i - 1];
      const curr = this.history[i];
      if (curr.momentumU <= prev.momentumU && curr.continuity <= prev.continuity) {
        isGrowing = false;
        break;
      }
    }

    if (isGrowing && (u > this.refU * 100 || c > this.refC * 100)) {
      return ConvergenceState.DIVERGING;
    }

    // Stagnation (Stalled) Check (minimal change in residuals over last 5 iterations)
    let isStagnated = true;
    for (let i = this.history.length - 4; i < this.history.length; i++) {
      const prev = this.history[i - 1];
      const curr = this.history[i];
      const deltaU = Math.abs(curr.momentumU - prev.momentumU);
      if (deltaU > 1e-6) {
        isStagnated = false;
        break;
      }
    }

    if (isStagnated) {
      return ConvergenceState.STALLED;
    }

    // Standard iterating or converging
    if (u < this.refU * 0.1) {
      return ConvergenceState.CONVERGING;
    }

    return ConvergenceState.ITERATING;
  }
}

/**
 * IndependentResidualVerifier: Implements strict A*x - b recalculations completely decoupled 
 * from any solver references to mathematically guarantee no verification circularity or forgery.
 */
export class IndependentResidualVerifier {
  public static verifyAphiMinusB(
    eq: CfdCellEquation,
    phiValue: number,
    neighborValues: Map<string, number>
  ): number {
    let lhs = eq.aP * phiValue;
    eq.aN.forEach((val, nid) => {
      const neighborVal = neighborValues.get(nid) || 0;
      lhs -= val * neighborVal;
    });
    return Math.abs(lhs - eq.source);
  }
}
