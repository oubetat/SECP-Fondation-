/**
 * SECP Industrial OS — Engineering Truth Platform
 * PATCH-244 — SIMPLE Coupling Algorithm
 */

import { CfdMesh } from '../../mesh/CfdMesh';
import { CfdScalarField, CfdVectorField } from '../../mesh/CfdField';
import { CfdCellEquation } from '../../fvm/FvmTypes';
import { 
  PressureVelocityCouplingStrategy, 
  CouplingIterationResult 
} from './CouplingTypes';
import { Vector3 } from '../../mesh/CfdGeneralMeshTypes';

export class SimpleCoupling implements PressureVelocityCouplingStrategy {
  private pRefCellId: string | null = null;
  private pRefValue: number = 0;

  constructor(
    private mesh: CfdMesh,
    private config: {
      density: number;
      pRelaxation: number;
      uRelaxation: number;
    }
  ) {
    // Select first cell as pressure reference if not set
    if (this.mesh.cells.size > 0) {
      this.pRefCellId = this.mesh.cells.keys().next().value || null;
    }
  }

  public solve(
    velocity: CfdVectorField,
    pressure: CfdScalarField,
    momentumEquations: {
      u: Map<string, CfdCellEquation>;
      v: Map<string, CfdCellEquation>;
      w: Map<string, CfdCellEquation>;
    }
  ): CouplingIterationResult {
    // 1. Calculate Face Fluxes from current velocity field (Momentum Predictor Result)
    const fluxes = this.calculateStarFluxes(velocity);

    // 2. Assemble Pressure Correction Equation (Poisson)
    const pEquations = this.assemblePressureCorrection(momentumEquations, fluxes);

    // 3. Solve Pressure Correction (Numerical Sparse solve simulation for P244)
    const pPrime = this.solvePressureCorrection(pEquations);

    // 4. Correct Pressure, Velocity, and Fluxes
    this.applyCorrections(velocity, pressure, pPrime, momentumEquations, fluxes);

    // 5. Calculate Continuity Residual (Sum of fluxes)
    const stats = this.calculateContinuityStats(fluxes);

    return {
      iteration: 0, // Managed by NavierStokesSolver
      continuityResidual: stats.totalError,
      momentumResidual: 0.1, // Should be calculated per component
      maxMassImbalance: stats.maxError,
      isConverged: stats.totalError < 1e-6
    };
  }

  private calculateStarFluxes(velocity: CfdVectorField): Map<string, number> {
    const fluxes = new Map<string, number>();
    this.mesh.faces.forEach(face => {
      // Interpolate cell velocities to face
      const v1 = velocity.getValue(face.ownerCellId);
      const v2 = face.neighbourCellId ? velocity.getValue(face.neighbourCellId) : v1;
      
      const vFace = {
        x: (v1.x + v2.x) * 0.5,
        y: (v1.y + v2.y) * 0.5,
        z: (v1.z + v2.z) * 0.5
      };

      const areaVec = face.normal;
      const flux = this.config.density * (vFace.x * areaVec.x + vFace.y * areaVec.y + vFace.z * areaVec.z) * face.area;
      fluxes.set(face.id, flux);
    });
    return fluxes;
  }

  private assemblePressureCorrection(
    momEqs: { u: Map<string, CfdCellEquation> },
    fluxes: Map<string, number>
  ): Map<string, CfdCellEquation> {
    const pEqs = new Map<string, CfdCellEquation>();

    this.mesh.cells.forEach(cell => {
      const eq: CfdCellEquation = { cellId: cell.id, aP: 0, aN: new Map(), source: 0 };
      
      // b_p = - net mass flux out of cell
      let netFlux = 0;
      cell.faceIds.forEach(fid => {
        const face = this.mesh.faces.get(fid)!;
        const flux = fluxes.get(fid)!;
        const sign = face.ownerCellId === cell.id ? 1 : -1;
        netFlux += sign * flux;

        // aN = rho * d_f * A_f
        // d_f = A_f / aP_momentum
        const neighborId = face.ownerCellId === cell.id ? face.neighbourCellId : face.ownerCellId;
        if (neighborId) {
          const momEq = momEqs.u.get(cell.id)!;
          const df = face.area / momEq.aP;
          const coeff = this.config.density * df * face.area;
          eq.aN.set(neighborId, coeff);
          eq.aP += coeff;
        }
      });

      eq.source = -netFlux;
      pEqs.set(cell.id, eq);
    });

    // Handle Pressure Reference
    if (this.pRefCellId && pEqs.has(this.pRefCellId)) {
      const refEq = pEqs.get(this.pRefCellId)!;
      refEq.aP *= 1e10; // Fix pressure value
    }

    return pEqs;
  }

  private solvePressureCorrection(equations: Map<string, CfdCellEquation>): Map<string, number> {
    const pPrime = new Map<string, number>();
    // Simplified iterative solve for P244 simulation truth
    equations.forEach((eq, id) => {
      let rhs = eq.source;
      eq.aN.forEach((val, nid) => {
        rhs += val * (pPrime.get(nid) || 0);
      });
      pPrime.set(id, rhs / eq.aP);
    });
    return pPrime;
  }

  private applyCorrections(
    velocity: CfdVectorField,
    pressure: CfdScalarField,
    pPrime: Map<string, number>,
    momEqs: { u: Map<string, CfdCellEquation> },
    fluxes: Map<string, number>
  ): void {
    // 1. Correct Pressure: p = p + alpha_p * p'
    this.mesh.cells.forEach(cell => {
      const currentP = pressure.getValue(cell.id);
      const correction = pPrime.get(cell.id) || 0;
      pressure.setValue(cell.id, currentP + this.config.pRelaxation * correction);

      // 2. Correct Cell Velocity: u = u* - (V/aP) * grad(p')
      // Simplified: u = u* + d * sum(p'n - p'p)
      const currentU = velocity.getValue(cell.id);
      const momEq = momEqs.u.get(cell.id)!;
      const d = 1.0 / momEq.aP;
      
      const uCorr = { x: 0, y: 0, z: 0 };
      cell.faceIds.forEach(fid => {
        const face = this.mesh.faces.get(fid)!;
        const neighborId = face.ownerCellId === cell.id ? face.neighbourCellId : face.ownerCellId;
        if (neighborId) {
          const sign = face.ownerCellId === cell.id ? 1 : -1;
          const dp = (pPrime.get(neighborId) || 0) - (pPrime.get(cell.id) || 0);
          uCorr.x -= sign * d * face.area * face.normal.x * dp;
          uCorr.y -= sign * d * face.area * face.normal.y * dp;
          uCorr.z -= sign * d * face.area * face.normal.z * dp;
        }
      });

      velocity.setValue(cell.id, {
        x: currentU.x + uCorr.x,
        y: currentU.y + uCorr.y,
        z: currentU.z + uCorr.z
      });
    });

    // 3. Correct Face Fluxes: m = m* + aN_p * (p'N - p'P)
    this.mesh.faces.forEach(face => {
      if (face.ownerCellId && face.neighbourCellId) {
        const dp = (pPrime.get(face.neighbourCellId) || 0) - (pPrime.get(face.ownerCellId) || 0);
        const momEq = momEqs.u.get(face.ownerCellId)!;
        const df = face.area / momEq.aP;
        const corr = this.config.density * df * face.area * dp;
        const starFlux = fluxes.get(face.id) || 0;
        fluxes.set(face.id, starFlux + corr);
      }
    });
  }

  private calculateContinuityStats(fluxes: Map<string, number>) {
    let totalError = 0;
    let maxError = 0;
    this.mesh.cells.forEach(cell => {
      let netFlux = 0;
      cell.faceIds.forEach(fid => {
        const face = this.mesh.faces.get(fid)!;
        const flux = fluxes.get(fid)!;
        const sign = face.ownerCellId === cell.id ? 1 : -1;
        netFlux += sign * flux;
      });
      const err = Math.abs(netFlux);
      totalError += err;
      maxError = Math.max(maxError, err);
    });
    return { totalError, maxError };
  }
}
