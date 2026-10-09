/**
 * SECP Industrial OS v2 — Pressure and Velocity Field Correction
 * PATCH-054: Pressure-Velocity Coupling
 */

import { CFDMesh3D } from '../mesh/CFDMeshTypes';
import { 
  PressureField, 
  VelocityField, 
  UnderRelaxationConfig, 
  MomentumCoefficients 
} from './PressureVelocityTypes';
import { CouplingDiagnosticsHelper } from './CouplingDiagnostics';

export class PressureCorrectionEngine {

  /**
   * Applies pressure correction: p = p* + alpha_p * p'
   */
  public static correctPressure(
    currentPressure: Float64Array,
    pPrime: Float64Array,
    relaxation: UnderRelaxationConfig
  ): PressureField {
    const numCells = currentPressure.length;
    const newPressure = new Float64Array(numCells);
    const alphaP = relaxation.pressureRelaxation;

    for (let c = 0; c < numCells; c++) {
      newPressure[c] = currentPressure[c] + alphaP * pPrime[c];
    }

    return {
      pressure: newPressure,
      correction: pPrime,
      underRelaxation: alphaP
    };
  }

  /**
   * Applies velocity correction: u = u* + u' where u' = - (V/aP) * grad(p')
   */
  public static correctVelocity(
    mesh: CFDMesh3D,
    uStar: Float64Array,
    vStar: Float64Array,
    wStar: Float64Array,
    pPrimeGrad: Float64Array, // [3 * c + 0/1/2]
    coeffs: MomentumCoefficients,
    relaxation: UnderRelaxationConfig
  ): VelocityField {
    const numCells = mesh.cells.length;
    const uNew = new Float64Array(numCells);
    const vNew = new Float64Array(numCells);
    const wNew = new Float64Array(numCells);

    const uPrime = new Float64Array(numCells);
    const vPrime = new Float64Array(numCells);
    const wPrime = new Float64Array(numCells);

    for (let c = 0; c < numCells; c++) {
      const vol = coeffs.vol[c];
      const aP = coeffs.aP[c] > 0 ? coeffs.aP[c] : 1.0;
      const ratio = vol / aP;

      const dpX = pPrimeGrad[3 * c + 0];
      const dpY = pPrimeGrad[3 * c + 1];
      const dpZ = pPrimeGrad[3 * c + 2];

      const alphaU = relaxation.velocityRelaxation;

      // u' = - alpha_u * (V / aP) * grad(p')
      uPrime[c] = -alphaU * ratio * dpX;
      vPrime[c] = -alphaU * ratio * dpY;
      wPrime[c] = -alphaU * ratio * dpZ;

      uNew[c] = uStar[c] + uPrime[c];
      vNew[c] = vStar[c] + vPrime[c];
      wNew[c] = wStar[c] + wPrime[c];

    }

    return {
      u: uNew,
      v: vNew,
      w: wNew,
      uCorrection: uPrime,
      vCorrection: vPrime,
      wCorrection: wPrime
    };
  }
}
