/**
 * SECP Industrial OS v2 — Mass Conservation Framework
 * PATCH-057: Control Volume Balance
 */

import { CFDMesh3D } from '../mesh/CFDMeshTypes';
import { ControlVolumeMassBalance } from './MassConservationTypes';

export class CellMassBalance {
  
  public static calculateCellBalance(
    cellIdx: number,
    mesh: CFDMesh3D,
    faceFluxes: Float64Array, // m_dot per face index
    accumulation: number = 0.0
  ): ControlVolumeMassBalance {
    const cell = mesh.cells[cellIdx];
    let inflow = 0.0;
    let outflow = 0.0;
    const diagnostics: string[] = [];

    const attachedFaces = mesh.faces.filter(f => f.ownerCellId === cellIdx || f.neighborCellId === cellIdx); for (const f_item of attachedFaces) { const fIdx = f_item.id;
      const face = mesh.faces[fIdx];
      const flux = faceFluxes[fIdx];
      
      // Flux is positive OUTFLOW if owner is cellIdx
      // If neighbor is cellIdx, then positive flux in face is INFLOW to cellIdx
      const isOwner = face.ownerCellId === cellIdx;
      const cellFlux = isOwner ? flux : -flux;

      if (cellFlux > 0) {
        outflow += cellFlux;
      } else {
        inflow += Math.abs(cellFlux);
      }
    }

    const imbalance = (outflow - inflow) + accumulation;
    const den = Math.max(inflow, outflow, 1e-15);
    const normalizedImbalance = Math.abs(imbalance) / den;

    return {
      cellId: cellIdx,
      inflow,
      outflow,
      accumulation,
      imbalance,
      normalizedImbalance,
      finite: Number.isFinite(imbalance),
      diagnostics
    };
  }
}
