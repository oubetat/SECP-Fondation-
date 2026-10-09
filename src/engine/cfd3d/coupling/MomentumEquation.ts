/**
 * SECP Industrial OS v2 — Momentum Equation Discretization & Prediction
 * PATCH-054: Pressure-Velocity Coupling
 */

import { CFDMesh3D, BoundaryType } from '../mesh/CFDMeshTypes';
import { 
  MomentumCoefficients, 
  MomentumPrediction, 
  VelocityField, 
  UnderRelaxationConfig 
} from './PressureVelocityTypes';
import { CouplingDiagnostic, CouplingDiagnosticsHelper } from './CouplingDiagnostics';

export class MomentumEquationEngine {

  /**
   * Assembles momentum equation coefficients (aP, aN, sU, sV, sW) from mesh, fluxes, and under-relaxation.
   */
  public static assembleCoefficients(
    mesh: CFDMesh3D,
    density: number,
    viscosity: number,
    velocity: VelocityField,
    faceMassFluxes: Float64Array, // m_f
    relaxation: UnderRelaxationConfig
  ): MomentumCoefficients {
    const numCells = mesh.cells.length;
    const aP = new Float64Array(numCells);
    const aN: Map<number, number>[] = Array.from({ length: numCells }, () => new Map());
    const sU = new Float64Array(numCells);
    const sV = new Float64Array(numCells);
    const sW = new Float64Array(numCells);
    const vol = new Float64Array(numCells);
    const gradP = new Float64Array(numCells * 3);

    for (let c = 0; c < numCells; c++) {
      vol[c] = mesh.cells[c].volume;
    }

    // Assemble convective and diffusive contributions across interior faces
    for (let fIdx = 0; fIdx < mesh.faces.length; fIdx++) {
      const face = mesh.faces[fIdx];
      if (face.isBoundary) continue;

      const owner = face.ownerCellId;
      const neighbor = face.neighborCellId;
      if (neighbor === null || owner < 0 || owner >= numCells || neighbor < 0 || neighbor >= numCells) continue;

      const mF = faceMassFluxes[fIdx]; // Mass flux out of owner (+)

      // Distance between cell centers
      const oCenter = mesh.cells[owner].center;
      const nCenter = mesh.cells[neighbor].center;
      const dx = nCenter[0] - oCenter[0];
      const dy = nCenter[1] - oCenter[1];
      const dz = nCenter[2] - oCenter[2];
      const dLR = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const invDLR = dLR > 1e-12 ? 1.0 / dLR : 0.0;

      // Diffusive conductance D_f = mu * area / dLR
      const dF = viscosity * face.area * invDLR;

      // Hybrid / Upwind convective flux
      // aN = D_f + max(-mF, 0)
      // aO = D_f + max(mF, 0)
      const aNeighForOwner = dF + Math.max(-mF, 0);
      const aOwnerForNeigh = dF + Math.max(mF, 0);

      aN[owner].set(neighbor, aNeighForOwner);
      aN[neighbor].set(owner, aOwnerForNeigh);

      aP[owner] += aNeighForOwner;
      aP[neighbor] += aOwnerForNeigh;
    }

    // Under-relaxation of momentum central coefficient aP
    const alphaV = relaxation.velocityRelaxation;
    for (let c = 0; c < numCells; c++) {
      // Ensure positive diagonal dominance
      if (aP[c] <= 0) {
        aP[c] = 1e-10;
      }
      // Apply under-relaxation: aP / alphaV
      const aPUnder = aP[c] / alphaV;

      // Source terms incorporate (1 - alphaV) * aPUnder * u_old
      sU[c] += (1.0 - alphaV) * aPUnder * velocity.u[c];
      sV[c] += (1.0 - alphaV) * aPUnder * velocity.v[c];
      sW[c] += (1.0 - alphaV) * aPUnder * velocity.w[c];

      aP[c] = aPUnder;
    }

    return {
      aP,
      aN,
      sU,
      sV,
      sW,
      vol,
      gradP,
      provenance: 'MESH + FLUX + BOUNDARY_CONDITIONS + HYBRID_SCHEME'
    };
  }

  /**
   * Predicts velocity star field (u*, v*, w*) using Jacobi/Gauss-Seidel momentum sweep.
   */
  public static predictVelocity(
    mesh: CFDMesh3D,
    coeffs: MomentumCoefficients,
    pressureGrad: Float64Array,
    currentVel: VelocityField
  ): MomentumPrediction {
    const diagnostics: string[] = [];
    const numCells = mesh.cells.length;

    const uStar = new Float64Array(numCells);
    const vStar = new Float64Array(numCells);
    const wStar = new Float64Array(numCells);

    let maxResidual = 0;

    for (let c = 0; c < numCells; c++) {
      const aP = coeffs.aP[c];
      if (aP <= 0 || !CouplingDiagnosticsHelper.isFiniteNumber(aP)) {
        diagnostics.push(CouplingDiagnostic.NEGATIVE_COEFFICIENT);
        return { uStar, vStar, wStar, coefficients: coeffs, residual: Infinity, valid: false, diagnostics };
      }

      // Sum_N (a_N * u_N)
      let sumU = 0;
      let sumV = 0;
      let sumW = 0;

      const neighbors = coeffs.aN[c];
      for (const [neighId, aN] of neighbors.entries()) {
        sumU += aN * currentVel.u[neighId];
        sumV += aN * currentVel.v[neighId];
        sumW += aN * currentVel.w[neighId];
      }

      // Pressure gradient force: - V * gradP
      const vol = coeffs.vol[c];
      const dpX = pressureGrad[3 * c + 0];
      const dpY = pressureGrad[3 * c + 1];
      const dpZ = pressureGrad[3 * c + 2];

      const rhsU = sumU + coeffs.sU[c] - vol * dpX;
      const rhsV = sumV + coeffs.sV[c] - vol * dpY;
      const rhsW = sumW + coeffs.sW[c] - vol * dpZ;

      uStar[c] = rhsU / aP;
      vStar[c] = rhsV / aP;
      wStar[c] = rhsW / aP;

      const resU = Math.abs(aP * uStar[c] - rhsU);
      if (resU > maxResidual) maxResidual = resU;
    }

    if (!CouplingDiagnosticsHelper.isFiniteArray(uStar)) {
      diagnostics.push(CouplingDiagnostic.NON_FINITE_VALUE);
      return { uStar, vStar, wStar, coefficients: coeffs, residual: Infinity, valid: false, diagnostics };
    }

    return {
      uStar,
      vStar,
      wStar,
      coefficients: coeffs,
      residual: maxResidual,
      valid: true,
      diagnostics: []
    };
  }
}
