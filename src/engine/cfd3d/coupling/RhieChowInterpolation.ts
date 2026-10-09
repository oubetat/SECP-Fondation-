/**
 * SECP Industrial OS v2 — Rhie-Chow Interpolation
 * PATCH-054: Pressure-Velocity Coupling
 */

import { GridArrangement } from './PressureVelocityTypes';
import { CFDMesh3D } from '../mesh/CFDMeshTypes';

export interface RhieChowPolicy {
  readonly gridArrangement: GridArrangement;
  readonly enabled: boolean;
  readonly justification: string;
}

export class RhieChowEngine {
  public static readonly DEFAULT_POLICY: RhieChowPolicy = Object.freeze({
    gridArrangement: 'COLLOCATED',
    enabled: true,
    justification: 'SECP 3D FVM uses cell-centered collocated grid arrangement; Rhie-Chow pressure gradient dissipation is required to prevent odd-even pressure decoupling (checkerboarding).'
  });

  /**
   * Computes face velocity using Rhie-Chow momentum interpolation to prevent checkerboarding.
   * v_f = v_avg - (V/a_P)_f * ( gradP_face - gradP_avg )
   */
  public static interpolateFaceVelocity(
    uOwner: number, vOwner: number, wOwner: number,
    uNeigh: number, vNeigh: number, wNeigh: number,
    aPOwner: number, aPNeigh: number,
    volOwner: number, volNeigh: number,
    pOwner: number, pNeigh: number,
    gradPOwner: [number, number, number],
    gradPNeigh: [number, number, number],
    faceNormal: [number, number, number],
    faceArea: number,
    ownerCenter: [number, number, number],
    neighCenter: [number, number, number]
  ): { velocityNormal: number; velocityVector: [number, number, number] } {
    // 1. Unweighted linear interpolation of cell velocities
    const uAvg = 0.5 * (uOwner + uNeigh);
    const vAvg = 0.5 * (vOwner + vNeigh);
    const wAvg = 0.5 * (wOwner + wNeigh);

    // 2. Average coefficient ratio (V / aP)_f
    const ratioOwner = volOwner / (aPOwner > 0 ? aPOwner : 1.0);
    const ratioNeigh = volNeigh / (aPNeigh > 0 ? aPNeigh : 1.0);
    const ratioAvg = 0.5 * (ratioOwner + ratioNeigh);

    // 3. Distance vector dLR between cell centers
    const dx = neighCenter[0] - ownerCenter[0];
    const dy = neighCenter[1] - ownerCenter[1];
    const dz = neighCenter[2] - ownerCenter[2];
    const dLRMag = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const invDLR = dLRMag > 1e-12 ? 1.0 / dLRMag : 0.0;

    // Unit direction vector eLR
    const eX = dx * invDLR;
    const eY = dy * invDLR;
    const eZ = dz * invDLR;

    // 4. Compact face pressure gradient along eLR: (pNeigh - pOwner) / dLR
    const gradPFaceMag = (pNeigh - pOwner) * invDLR;

    // 5. Average cell-centered pressure gradient projected onto eLR
    const gradPAvgX = 0.5 * (gradPOwner[0] + gradPNeigh[0]);
    const gradPAvgY = 0.5 * (gradPOwner[1] + gradPNeigh[1]);
    const gradPAvgZ = 0.5 * (gradPOwner[2] + gradPNeigh[2]);
    const gradPAvgProj = gradPAvgX * eX + gradPAvgY * eY + gradPAvgZ * eZ;

    // 6. Rhie-Chow pressure gradient correction difference
    const diffGradP = gradPFaceMag - gradPAvgProj;

    // 7. Corrected velocity along eLR
    const uCorrX = uAvg - ratioAvg * diffGradP * eX;
    const uCorrY = vAvg - ratioAvg * diffGradP * eY;
    const uCorrZ = wAvg - ratioAvg * diffGradP * eZ;

    // Normal velocity vN = uCorr . n
    const vN = uCorrX * faceNormal[0] + uCorrY * faceNormal[1] + uCorrZ * faceNormal[2];

    return {
      velocityNormal: vN,
      velocityVector: [uCorrX, uCorrY, uCorrZ]
    };
  }
}
