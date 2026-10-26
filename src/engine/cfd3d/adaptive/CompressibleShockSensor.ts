/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * G1-B6: Compressible Shock Sensor
 *
 * Provides automated detection of shock waves and strong pressure gradients
 * in compressible flows using local field analysis (Mach, Pressure Gradients).
 */

import { FvmMesh3D } from '../Fvm3DTypes';
import { FluidPhysicalProperties, ShockSensorReport } from './AdaptiveCFDTypes';

export class CompressibleShockSensor {
  /**
   * Detects shocks by analyzing local flow gradients.
   */
  public static detectShocks(
    mesh: FvmMesh3D,
    u: number[],
    v: number[],
    w: number[],
    p: number[],
    fluid: FluidPhysicalProperties
  ): ShockSensorReport {
    const numCells = mesh.cells.length;
    let maxGradP = 0;
    let maxMach = 0;
    let shockCellCount = 0;
    
    const gamma = fluid.specificHeatRatioGamma || 1.4;
    const R = fluid.specificGasConstantR || 287.05;
    const T_ref = fluid.referenceTemperatureK || 300.0;
    const soundSpeedRef = Math.sqrt(gamma * R * T_ref);

    for (let i = 0; i < numCells; i++) {
      const cell = mesh.cells[i];
      const velMag = Math.hypot(u[i], v[i], w[i]);
      const localMach = velMag / soundSpeedRef; // Simplified sound speed
      
      if (localMach > maxMach) maxMach = localMach;

      // Local pressure gradient estimate (max diff with neighbors)
      let localMaxDiffP = 0;
      for (const nId of cell.neighborCellIds) {
        if (nId !== -1) {
          const diff = Math.abs(p[i] - p[nId]);
          if (diff > localMaxDiffP) localMaxDiffP = diff;
        }
      }

      if (localMaxDiffP > maxGradP) maxGradP = localMaxDiffP;

      // Detection threshold: Mach > 1 AND significant pressure gradient
      if (localMach > 0.95 && localMaxDiffP > 1000.0) {
        shockCellCount++;
      }
    }

    return {
      maxDucrosSensor: 0.0, // placeholder
      maxPressureGradient: maxGradP,
      shockDetected: shockCellCount > 0,
      shockFrontCellCount: shockCellCount,
      highestLocalMach: maxMach
    };
  }
}
