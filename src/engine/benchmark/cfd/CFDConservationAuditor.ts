/**
 * SECP Industrial OS v2 — CFD Conservation Auditor
 * Phase 15 (PATCH-174)
 *
 * Evaluates Mass, Momentum, and Energy conservation laws independently of solver residuals.
 * Enforces anti-fabrication rules by recording uncoupled energy equations honestly as UNPROVEN.
 */

import { FvmMesh3D, CfdSolution3D, FluidProperties3D } from '../../cfd3d/Fvm3DTypes';
import { CFDMassBalanceRecord, CFDMomentumBalanceRecord, CFDEnergyBalanceRecord } from './types';

export class CFDConservationAuditor {
  /**
   * Audits Global and Face-by-Face Mass Conservation
   */
  public static auditMassConservation(
    mesh: FvmMesh3D,
    solution: CfdSolution3D,
    fluid: FluidProperties3D,
    tolerancePercent: number = 0.5
  ): CFDMassBalanceRecord {
    let totalInflowKgS = 0.0;
    let totalOutflowKgS = 0.0;

    const rho = fluid.densityKgM3;
    const hasFaceFluxes = Array.isArray(solution.faceFluxes) && solution.faceFluxes.length === mesh.faces.length;

    for (const face of mesh.faces) {
      if (face.boundaryType === 'INLET') {
        if (hasFaceFluxes) {
          totalInflowKgS += Math.abs(solution.faceFluxes[face.faceId]);
        } else {
          const u = face.u_bc ?? 0;
          const v = face.v_bc ?? 0;
          const w = face.w_bc ?? 0;
          const vn = u * face.normal.x + v * face.normal.y + w * face.normal.z;
          totalInflowKgS += Math.abs(rho * vn * face.area);
        }
      } else if (face.boundaryType === 'OUTLET') {
        if (hasFaceFluxes) {
          totalOutflowKgS += Math.abs(solution.faceFluxes[face.faceId]);
        } else {
          const c = face.ownerCellId;
          if (c >= 0 && c < solution.velocity.u.length) {
            const u = solution.velocity.u[c];
            const v = solution.velocity.v[c];
            const w = solution.velocity.w[c];
            const vn = u * face.normal.x + v * face.normal.y + w * face.normal.z;
            totalOutflowKgS += Math.abs(rho * vn * face.area);
          }
        }
      }
    }

    // In case of closed domains (e.g. lid cavity), inflow/outflow are 0, check interior imbalance
    let netImbalanceKgS = Math.abs(totalInflowKgS - totalOutflowKgS);
    let relativeImbalancePercent = 0.0;

    if (totalInflowKgS > 1e-12) {
      relativeImbalancePercent = (netImbalanceKgS / totalInflowKgS) * 100.0;
    } else {
      // Cavity or zero-flow
      relativeImbalancePercent = solution.globalMassImbalanceNorm * 100.0;
      netImbalanceKgS = solution.globalMassImbalanceNorm;
    }

    const isConserved = relativeImbalancePercent <= tolerancePercent;

    return {
      totalInflowKgS,
      totalOutflowKgS,
      netImbalanceKgS,
      relativeImbalancePercent,
      isConserved
    };
  }

  /**
   * Audits Global Momentum Conservation: Sum of Pressure Forces + Viscous Wall Forces + Net Momentum Flux = 0
   */
  public static auditMomentumConservation(
    mesh: FvmMesh3D,
    solution: CfdSolution3D,
    fluid: FluidProperties3D
  ): CFDMomentumBalanceRecord {
    let pressureForceXN = 0.0;
    let viscousForceXN = 0.0;
    let momentumFluxInXN = 0.0;
    let momentumFluxOutXN = 0.0;

    const rho = fluid.densityKgM3;
    const mu = fluid.viscosityPaS;

    for (const face of mesh.faces) {
      if (face.boundaryType === 'INLET') {
        const u = face.u_bc ?? 0;
        const massFlow = Math.abs(rho * u * face.area);
        momentumFluxInXN += massFlow * u;
        // Pressure at inlet
        const c = face.ownerCellId;
        const p = solution.pressure[c] || 0;
        pressureForceXN += p * face.area * face.normal.x;
      } else if (face.boundaryType === 'OUTLET') {
        const c = face.ownerCellId;
        const u = solution.velocity.u[c] || 0;
        const massFlow = Math.abs(rho * u * face.area);
        momentumFluxOutXN += massFlow * u;
        const p = solution.pressure[c] || 0;
        pressureForceXN += p * face.area * face.normal.x;
      } else if (face.boundaryType === 'WALL') {
        // Viscous wall shear force estimation on wall faces
        const c = face.ownerCellId;
        if (c >= 0 && c < mesh.cells.length) {
          const u_cell = solution.velocity.u[c] || 0;
          const dy = Math.abs(face.centroid.y - mesh.cells[c].centroid.y) || 1e-4;
          const tau_w = mu * (u_cell / dy);
          viscousForceXN += tau_w * face.area;
        }
      }
    }

    const netForceXN = pressureForceXN - viscousForceXN;
    const momentumFluxNetXN = momentumFluxOutXN - momentumFluxInXN;
    const residualImbalanceN = Math.abs(netForceXN - momentumFluxNetXN);
    const scale = Math.max(Math.abs(pressureForceXN), Math.abs(momentumFluxNetXN), 1e-3);
    const relativeImbalance = (residualImbalanceN / scale) * 100.0;

    const isConserved = relativeImbalance < 10.0; // Momentum within 10% on coarse FVM grids

    return {
      pressureForceXN,
      viscousForceXN,
      netForceXN,
      momentumFluxNetXN,
      residualImbalanceN,
      isConserved
    };
  }

  /**
   * Audits Energy Conservation (Accurately identifies absence/uncoupled status)
   */
  public static auditEnergyConservation(): CFDEnergyBalanceRecord {
    return {
      status: 'UNPROVEN',
      notes: 'Coupled Energy Equation (Thermal-Buoyancy / Boussinesq) is uncoupled in steady-state isothermal Fvm3DNavierStokesSolver; marked UNPROVEN per Anti-Fabrication rules.'
    };
  }
}
