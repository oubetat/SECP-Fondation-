/**
 * SECP Industrial OS v2 — Mass Conservation Monitor
 * Phase 16 (PATCH-175)
 *
 * Real-time inline monitor for cell-wise continuity, boundary fluxes,
 * global mass balance, and worst-cell defect localization.
 */

import { FvmMesh3D } from '../../Fvm3DTypes';
import {
  MassConservationMetrics,
  ConservationBudget,
  LocalDefectRecord
} from './ConservationEnforcementTypes';

export class MassConservationMonitor {
  private budget: ConservationBudget;

  constructor(customBudget?: Partial<ConservationBudget>) {
    this.budget = {
      equation: 'MASS',
      absoluteTolerance: 1e-4, // kg/s
      relativeTolerance: 1e-3, // 0.1%
      localTolerance: 1e-3,    // kg/s local defect
      globalTolerance: 1e-4,
      warningThreshold: 5e-4,
      criticalThreshold: 5e-3,
      ...customBudget
    };
  }

  public evaluate(
    mesh: FvmMesh3D,
    u: number[],
    v: number[],
    w: number[],
    p: number[],
    rho: number,
    massResiduals: number[]
  ): MassConservationMetrics {
    let inletMassFlux = 0.0;
    let outletMassFlux = 0.0;
    let internalFluxSum = 0.0;
    let totalMassKg = 0.0;

    // Calculate total fluid mass in domain
    for (let i = 0; i < mesh.cells.length; i++) {
      totalMassKg += rho * mesh.cells[i].volume;
    }

    // Compute boundary face fluxes
    for (const face of mesh.faces) {
      const ownerId = face.ownerCellId;
      const neighId = face.neighborCellId;

      let faceU = u[ownerId];
      let faceV = v[ownerId];
      let faceW = w[ownerId];

      if (neighId !== -1) {
        // Internal face
        faceU = 0.5 * (u[ownerId] + u[neighId]);
        faceV = 0.5 * (v[ownerId] + v[neighId]);
        faceW = 0.5 * (w[ownerId] + w[neighId]);
        const dotVn = faceU * face.normal.x + faceV * face.normal.y + faceW * face.normal.z;
        internalFluxSum += Math.abs(rho * face.area * dotVn);
      } else {
        // Boundary face
        if (face.boundaryType === 'INLET') {
          const uIn = face.u_bc !== undefined ? face.u_bc : faceU;
          const dotVn = uIn * face.normal.x + faceV * face.normal.y + faceW * face.normal.z;
          // Normal points outward; inlet flux entering domain has dotVn < 0
          inletMassFlux += Math.abs(rho * face.area * dotVn);
        } else if (face.boundaryType === 'OUTLET' || face.boundaryType === 'PRESSURE_OUTLET') {
          const dotVn = faceU * face.normal.x + faceV * face.normal.y + faceW * face.normal.z;
          outletMassFlux += Math.abs(rho * face.area * dotVn);
        }
      }
    }

    // If closed cavity (no inlet/outlet), base relative error on internal mass circulation flux
    const refFlux = Math.max(inletMassFlux, outletMassFlux, (internalFluxSum / Math.max(1, mesh.faces.length)), 1e-7);
    const massImbalanceKgS = Math.abs(inletMassFlux - outletMassFlux);
    const relativeMassError = massImbalanceKgS / refFlux;

    // Locate worst cell local continuity defect
    let maxLocalContinuityError = 0.0;
    let worstCellId = 0;

    for (let cId = 0; cId < mesh.cells.length; cId++) {
      const cellErr = Math.abs(massResiduals[cId] || 0.0);
      if (cellErr > maxLocalContinuityError) {
        maxLocalContinuityError = cellErr;
        worstCellId = cId;
      }
    }

    const worstCell = mesh.cells[worstCellId];
    const worstCellRecord: LocalDefectRecord = {
      cellId: worstCellId,
      region: worstCellId < mesh.cells.length / 2 ? 'CORE_FLOW' : 'DOWNSTREAM_BOUNDARY',
      equation: 'MASS_CONTINUITY',
      errorMagnitude: maxLocalContinuityError,
      coordinates: worstCell ? { x: worstCell.centroid.x, y: worstCell.centroid.y, z: worstCell.centroid.z } : { x: 0, y: 0, z: 0 }
    };

    const passed =
      massImbalanceKgS <= this.budget.criticalThreshold &&
      relativeMassError <= this.budget.relativeTolerance * 10 &&
      maxLocalContinuityError <= this.budget.localTolerance * 20;

    return {
      totalMassKg,
      inletMassFluxKgS: inletMassFlux,
      outletMassFluxKgS: outletMassFlux,
      internalFluxSumKgS: internalFluxSum,
      massImbalanceKgS,
      relativeMassError,
      maxLocalContinuityErrorKgS: maxLocalContinuityError,
      worstCell: worstCellRecord,
      passed
    };
  }

  public getBudget(): ConservationBudget {
    return this.budget;
  }
}
