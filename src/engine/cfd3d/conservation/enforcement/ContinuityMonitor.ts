/**
 * SECP Industrial OS v2 — Continuity Enforcement Monitor
 * Phase 16 (PATCH-175)
 *
 * Real-time cell-wise face flux summation (div(u) = 0),
 * computing maximum, mean, and RMS continuity defects, plus worst cell/face localization.
 */

import { FvmMesh3D } from '../../Fvm3DTypes';
import {
  ContinuityMetrics,
  LocalDefectRecord
} from './ConservationEnforcementTypes';

export class ContinuityMonitor {
  public static evaluate(
    mesh: FvmMesh3D,
    u: number[],
    v: number[],
    w: number[],
    rho: number
  ): ContinuityMetrics {
    const numCells = mesh.cells.length;
    const cellDefects = new Float64Array(numCells);
    let sumDefects = 0.0;
    let sumSquaredDefects = 0.0;
    let maxDefect = 0.0;
    let worstCellId = 0;

    let worstFaceId = 0;
    let worstFaceFlux = 0.0;

    // 1. Compute face fluxes
    for (let fId = 0; fId < mesh.faces.length; fId++) {
      const face = mesh.faces[fId];
      const ownerId = face.ownerCellId;
      const neighId = face.neighborCellId;

      let faceU = u[ownerId];
      let faceV = v[ownerId];
      let faceW = w[ownerId];

      if (neighId !== -1) {
        faceU = 0.5 * (u[ownerId] + u[neighId]);
        faceV = 0.5 * (v[ownerId] + v[neighId]);
        faceW = 0.5 * (w[ownerId] + w[neighId]);
      } else if (face.boundaryType === 'INLET' && face.u_bc !== undefined) {
        faceU = face.u_bc;
      } else if (face.boundaryType && face.boundaryType.startsWith('WALL')) {
        faceU = 0.0;
        faceV = 0.0;
        faceW = 0.0;
      }

      const dotVn = faceU * face.normal.x + faceV * face.normal.y + faceW * face.normal.z;
      const flux = rho * face.area * dotVn;

      if (Math.abs(flux) > worstFaceFlux) {
        worstFaceFlux = Math.abs(flux);
        worstFaceId = fId;
      }

      // Add to owner (outward normal)
      cellDefects[ownerId] += flux;

      // Subtract from neighbor (inward normal relative to neighbor)
      if (neighId !== -1) {
        cellDefects[neighId] -= flux;
      }
    }

    // 2. Aggregate statistics across cells
    let globalImbalance = 0.0;
    for (let c = 0; c < numCells; c++) {
      const defect = cellDefects[c];
      const absDefect = Math.abs(defect);
      globalImbalance += defect;
      sumDefects += absDefect;
      sumSquaredDefects += defect * defect;

      if (absDefect > maxDefect) {
        maxDefect = absDefect;
        worstCellId = c;
      }
    }

    const meanDefect = sumDefects / Math.max(1, numCells);
    const rmsDefect = Math.sqrt(sumSquaredDefects / Math.max(1, numCells));

    const cellObj = mesh.cells[worstCellId];
    const worstCell: LocalDefectRecord = {
      cellId: worstCellId,
      faceId: worstFaceId,
      region: worstCellId < numCells / 2 ? 'INTERIOR_INLET_REGION' : 'INTERIOR_OUTLET_REGION',
      equation: 'MASS_CONTINUITY_DIV_U',
      errorMagnitude: maxDefect,
      coordinates: cellObj ? { x: cellObj.centroid.x, y: cellObj.centroid.y, z: cellObj.centroid.z } : { x: 0, y: 0, z: 0 }
    };

    const passed = rmsDefect < 1e-2 && Math.abs(globalImbalance) < 5e-3;

    return {
      maximumContinuityDefectKgS: maxDefect,
      meanContinuityDefectKgS: meanDefect,
      rmsContinuityDefectKgS: rmsDefect,
      globalContinuityImbalanceKgS: Math.abs(globalImbalance),
      worstCell,
      worstFace: { faceId: worstFaceId, errorMagnitude: worstFaceFlux },
      passed
    };
  }
}
