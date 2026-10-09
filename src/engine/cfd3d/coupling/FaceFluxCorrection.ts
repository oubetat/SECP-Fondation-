/**
 * SECP Industrial OS v2 — Face Mass Flux Calculation and Correction
 * PATCH-054: Pressure-Velocity Coupling
 */

import { CFDMesh3D, BoundaryType } from '../mesh/CFDMeshTypes';
import { 
  MomentumCoefficients, 
  FaceFluxField, 
  VelocityField 
} from './PressureVelocityTypes';
import { RhieChowEngine } from './RhieChowInterpolation';
import { CouplingDiagnostic, CouplingDiagnosticsHelper } from './CouplingDiagnostics';

export class FaceFluxEngine {

  /**
   * Computes predicted face mass flux field m_f* using Rhie-Chow interpolation for collocated mesh.
   */
  public static computePredictedFaceFlux(
    mesh: CFDMesh3D,
    density: number,
    uStar: Float64Array,
    vStar: Float64Array,
    wStar: Float64Array,
    pressure: Float64Array,
    gradP: Float64Array,
    coeffs: MomentumCoefficients
  ): Float64Array {
    const numFaces = mesh.faces.length;
    const predictedFlux = new Float64Array(numFaces);

    for (let fIdx = 0; fIdx < numFaces; fIdx++) {
      const face = mesh.faces[fIdx];
      const owner = face.ownerCellId;

      if (face.isBoundary) {
        // Boundary face: handle based on boundary condition type
        const bc = mesh.boundaryConditions.find(b => b.faceIds.includes(fIdx));
        if (bc && (bc.type === BoundaryType.INLET || bc.type === BoundaryType.WALL || bc.type === BoundaryType.SYMMETRY)) {
          if (bc.type === BoundaryType.WALL || bc.type === BoundaryType.SYMMETRY) {
            predictedFlux[fIdx] = 0; // Zero mass flux across wall
            continue;
          }
        }

        // Default boundary flux from owner cell velocity projected on face normal
        const uO = uStar[owner];
        const vO = vStar[owner];
        const wO = wStar[owner];
        const vN = uO * face.normal[0] + vO * face.normal[1] + wO * face.normal[2];
        predictedFlux[fIdx] = density * vN * face.area;
        continue;
      }

      const neighbor = face.neighborCellId;
      if (neighbor === null) continue;

      // Interior face: Rhie-Chow momentum interpolation
      const uO = uStar[owner]; const vO = vStar[owner]; const wO = wStar[owner];
      const uN = uStar[neighbor]; const vN = vStar[neighbor]; const wN = wStar[neighbor];

      const aPO = coeffs.aP[owner];
      const aPN = coeffs.aP[neighbor];
      const volO = coeffs.vol[owner];
      const volN = coeffs.vol[neighbor];

      const pO = pressure[owner];
      const pN = pressure[neighbor];

      const gPO: [number, number, number] = [gradP[3 * owner + 0], gradP[3 * owner + 1], gradP[3 * owner + 2]];
      const gPN: [number, number, number] = [gradP[3 * neighbor + 0], gradP[3 * neighbor + 1], gradP[3 * neighbor + 2]];

      const rcRes = RhieChowEngine.interpolateFaceVelocity(
        uO, vO, wO, uN, vN, wN,
        aPO, aPN, volO, volN,
        pO, pN, gPO, gPN,
        face.normal, face.area,
        mesh.cells[owner].center,
        mesh.cells[neighbor].center
      );

      predictedFlux[fIdx] = density * rcRes.velocityNormal * face.area;
    }

    return predictedFlux;
  }

  /**
   * Computes face mass flux correction m_f' and updates total face mass flux: m_f = m_f* + m_f'
   */
  public static computeCorrectedFaceFlux(
    mesh: CFDMesh3D,
    density: number,
    predictedFlux: Float64Array,
    pPrime: Float64Array, // pressure correction
    coeffs: MomentumCoefficients
  ): FaceFluxField {
    const numFaces = mesh.faces.length;
    const fluxCorrection = new Float64Array(numFaces);
    const correctedFlux = new Float64Array(numFaces);

    for (let fIdx = 0; fIdx < numFaces; fIdx++) {
      const face = mesh.faces[fIdx];
      const owner = face.ownerCellId;

      if (face.isBoundary) {
        // Boundary face mass flux correction is 0 (or dictated by prescribed boundary condition)
        fluxCorrection[fIdx] = 0;
        correctedFlux[fIdx] = predictedFlux[fIdx];
        continue;
      }

      const neighbor = face.neighborCellId;
      if (neighbor === null) continue;

      // Distance dLR between cell centers
      const oCenter = mesh.cells[owner].center;
      const nCenter = mesh.cells[neighbor].center;
      const dx = nCenter[0] - oCenter[0];
      const dy = nCenter[1] - oCenter[1];
      const dz = nCenter[2] - oCenter[2];
      const dLR = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const invDLR = dLR > 1e-12 ? 1.0 / dLR : 0.0;

      // (V / aP)_f
      const volO = coeffs.vol[owner];
      const volN = coeffs.vol[neighbor];
      const aPO = coeffs.aP[owner] > 0 ? coeffs.aP[owner] : 1.0;
      const aPN = coeffs.aP[neighbor] > 0 ? coeffs.aP[neighbor] : 1.0;
      const dP_f = 0.5 * ((volO / aPO) + (volN / aPN));

      // m_f' = - rho * dP_f * area * (p'_neighbor - p'_owner) / dLR
      const dpPrime = pPrime[neighbor] - pPrime[owner];
      const mPrime = -density * dP_f * face.area * dpPrime * invDLR;

      fluxCorrection[fIdx] = mPrime;
      correctedFlux[fIdx] = predictedFlux[fIdx] + mPrime;
    }

    return {
      predictedFlux,
      correctedFlux,
      fluxCorrection
    };
  }
}
