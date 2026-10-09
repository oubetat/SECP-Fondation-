/**
 * SECP Industrial OS v2 — Energy Conservation Framework
 * PATCH-059: Energy Control Volume Balance
 */

import { CFDMesh3D } from '../../mesh/CFDMeshTypes';
import { ControlVolumeEnergyBalance, EnergyFormulation } from './EnergyConservationTypes';

export interface CellEnergyTerms {
  readonly convectiveFluxes: number[];        // per face in mesh (positive = outflow from owner)
  readonly pressureWorks?: number[];          // per face in mesh (if applicable/separate)
  readonly viscousWorks?: number[];           // per face in mesh
  readonly conductiveHeatFluxes: number[];    // per face in mesh (positive = outflow from owner)
  readonly volumetricHeatSource: number;     // W for this cell
  readonly bodyForcePower: number;           // W for this cell
  readonly explicitSources: number;          // W for this cell
  readonly accumulation: number;             // W (d/dt (rho * E * V))
  readonly formulation: EnergyFormulation;
}

export class EnergyControlVolumeBalance {
  public static calculateCellBalance(
    cellIdx: number,
    mesh: CFDMesh3D,
    terms: CellEnergyTerms,
    referenceEnergyFloor: number = 1e-12
  ): ControlVolumeEnergyBalance {
    const cell = mesh.cells[cellIdx];
    let netConvective = 0;
    let netPressureWork = 0;
    let netViscousWork = 0;
    let netConductiveHeat = 0;
    const diagnostics: string[] = [];

    const attachedFaces = mesh.faces.filter(f => f.ownerCellId === cellIdx || f.neighborCellId === cellIdx); for (const f_item of attachedFaces) { const fIdx = f_item.id;
      const face = mesh.faces[fIdx];
      const isOwner = face.ownerCellId === cellIdx;
      const sign = isOwner ? 1 : -1;

      // Convective flux
      const conv = terms.convectiveFluxes[fIdx] ?? 0;
      netConvective += sign * conv;

      // Pressure work
      if (terms.pressureWorks && terms.pressureWorks[fIdx] !== undefined) {
        netPressureWork += sign * terms.pressureWorks[fIdx];
      }

      // Viscous work
      if (terms.viscousWorks && terms.viscousWorks[fIdx] !== undefined) {
        netViscousWork += sign * terms.viscousWorks[fIdx];
      }

      // Conductive heat flux
      const cond = terms.conductiveHeatFluxes[fIdx] ?? 0;
      netConductiveHeat += sign * cond;
    }

    const totalSources = terms.volumetricHeatSource + terms.bodyForcePower + terms.explicitSources;
    const totalOutwardTransfers = netConvective + netPressureWork + netViscousWork + netConductiveHeat;

    // Imbalance = Accumulation + Outward Transfers - Total Generation/Sources
    const imbalance = terms.accumulation + totalOutwardTransfers - totalSources;

    const denominator = Math.max(
      Math.abs(terms.accumulation),
      Math.abs(totalOutwardTransfers),
      Math.abs(totalSources),
      referenceEnergyFloor
    );

    const normalizedImbalance = Math.abs(imbalance) / denominator;
    const finite = Number.isFinite(imbalance);

    if (!finite) {
      diagnostics.push('NON_FINITE_ENERGY_IMBALANCE');
    }

    return {
      cellId: cellIdx,
      accumulation: terms.accumulation,
      netConvectiveFlux: netConvective,
      pressureWork: netPressureWork,
      viscousWork: netViscousWork,
      conductiveHeatFlux: netConductiveHeat,
      volumetricHeatSource: terms.volumetricHeatSource,
      bodyForcePower: terms.bodyForcePower,
      explicitSources: terms.explicitSources,
      imbalance,
      normalizedImbalance,
      finite,
      diagnostics
    };
  }
}
