/**
 * SECP Industrial OS v2 — Momentum Conservation Framework
 * PATCH-058: Momentum Control Volume Balance
 */

import { CFDMesh3D } from '../../mesh/CFDMeshTypes';
import { MomentumVector, ControlVolumeMomentumBalance } from './MomentumConservationTypes';

export interface CellMomentumTerms {
  readonly convectiveFluxes: MomentumVector[]; // per face in mesh
  readonly pressureForces: MomentumVector[]; // per face
  readonly viscousForces: MomentumVector[]; // per face
  readonly bodyForce: MomentumVector;
  readonly sourceTerms: MomentumVector;
  readonly accumulation: MomentumVector;
}

export class MomentumControlVolumeBalance {

  public static calculateCellBalance(
    cellIdx: number,
    mesh: CFDMesh3D,
    terms: CellMomentumTerms,
    referenceMomentum: number = 1e-15
  ): ControlVolumeMomentumBalance {
    const cell = mesh.cells[cellIdx];
    let totalConvective = MomentumVector.zero();
    let totalPressure = MomentumVector.zero();
    let totalViscous = MomentumVector.zero();
    const diagnostics: string[] = [];

    const attachedFaces = mesh.faces.filter(f => f.ownerCellId === cellIdx || f.neighborCellId === cellIdx); for (const f_item of attachedFaces) { const fIdx = f_item.id;
      const face = mesh.faces[fIdx];
      const isOwner = face.ownerCellId === cellIdx;
      
      // Fluxes are usually stored as OUTFLOW from owner.
      // Forces (pressure, viscous) should be correctly oriented.
      
      const cFlux = terms.convectiveFluxes[fIdx];
      totalConvective = totalConvective.add(isOwner ? cFlux : cFlux.multiply(-1));

      // Forces are surface integrals. 
      // F_p = -p * n * A. n is outward from owner.
      // If we are neighbor, we need to flip the normal, so F_p flips.
      const pForce = terms.pressureForces[fIdx];
      totalPressure = totalPressure.add(isOwner ? pForce : pForce.multiply(-1));

      const vForce = terms.viscousForces[fIdx];
      totalViscous = totalViscous.add(isOwner ? vForce : vForce.multiply(-1));
    }

    // Balance: Accumulation + Net Convective Flux = Net Forces + Sources
    // Imbalance = Accumulation + Convective - (Pressure + Viscous + Body + Sources)
    const rhs = totalPressure.add(totalViscous).add(terms.bodyForce).add(terms.sourceTerms);
    const lhs = terms.accumulation.add(totalConvective);
    const imbalance = lhs.subtract(rhs);

    const norm = Math.max(lhs.magnitude(), rhs.magnitude(), referenceMomentum);
    const normalizedImbalance = new MomentumVector(
      Math.abs(imbalance.x) / norm,
      Math.abs(imbalance.y) / norm,
      Math.abs(imbalance.z) / norm
    );

    return {
      cellId: cellIdx,
      accumulation: terms.accumulation,
      convectiveFlux: totalConvective,
      pressureForce: totalPressure,
      viscousForce: totalViscous,
      bodyForce: terms.bodyForce,
      sourceTerms: terms.sourceTerms,
      imbalance,
      normalizedImbalance,
      finite: imbalance.isFinite(),
      diagnostics
    };
  }
}
