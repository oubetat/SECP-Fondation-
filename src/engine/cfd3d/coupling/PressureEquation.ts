/**
 * SECP Industrial OS v2 — Pressure Correction Equation Assembly
 * PATCH-054: Pressure-Velocity Coupling
 */

import { CFDMesh3D, BoundaryType } from '../mesh/CFDMeshTypes';
import { 
  PressureCorrectionSystem, 
  PressureReferencePolicy, 
  MomentumCoefficients 
} from './PressureVelocityTypes';
import { CouplingDiagnostic, CouplingDiagnosticsHelper } from './CouplingDiagnostics';

export class PressureEquationEngine {

  /**
   * Assembles the Poisson-like Pressure Correction Equation System: A_p * p' = b
   */
  public static assembleSystem(
    mesh: CFDMesh3D,
    density: number,
    predictedFaceFluxes: Float64Array, // m_f* per face
    momentumCoeffs: MomentumCoefficients,
    referencePolicy: PressureReferencePolicy
  ): PressureCorrectionSystem {
    const diagnostics: string[] = [];
    const numCells = mesh.cells.length;

    const aP = new Float64Array(numCells);
    const aN: Map<number, number>[] = Array.from({ length: numCells }, () => new Map());
    const b = new Float64Array(numCells);

    // 1. Calculate mass defect (b_P) and face pressure-coupling coefficients for interior faces
    for (let fIdx = 0; fIdx < mesh.faces.length; fIdx++) {
      const face = mesh.faces[fIdx];
      const mStar = predictedFaceFluxes[fIdx];

      if (face.isBoundary) {
        // Boundary face mass flux contributes to b_P
        if (face.ownerCellId >= 0 && face.ownerCellId < numCells) {
          b[face.ownerCellId] -= mStar; // Outward mass flux reduces mass in cell
        }
        continue;
      }

      const owner = face.ownerCellId;
      const neighbor = face.neighborCellId;

      if (owner < 0 || owner >= numCells || neighbor === null || neighbor < 0 || neighbor >= numCells) {
        diagnostics.push(`Invalid face connectivity at interior face ${fIdx}`);
        continue;
      }

      // Net mass flux out of owner (+) into neighbor (-)
      b[owner] -= mStar;
      b[neighbor] += mStar;

      // Distance dLR between cell centers
      const oCenter = mesh.cells[owner].center;
      const nCenter = mesh.cells[neighbor].center;
      const dx = nCenter[0] - oCenter[0];
      const dy = nCenter[1] - oCenter[1];
      const dz = nCenter[2] - oCenter[2];
      const dLR = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const invDLR = dLR > 1e-12 ? 1.0 / dLR : 0.0;

      // Face (V / aP)_f coefficient ratio
      const volO = momentumCoeffs.vol[owner];
      const volN = momentumCoeffs.vol[neighbor];
      const aPO = momentumCoeffs.aP[owner] > 0 ? momentumCoeffs.aP[owner] : 1.0;
      const aPN = momentumCoeffs.aP[neighbor] > 0 ? momentumCoeffs.aP[neighbor] : 1.0;

      const dP_f = 0.5 * ((volO / aPO) + (volN / aPN));

      // Transmissibility coeff = rho * dP_f * faceArea / dLR
      const faceCoeff = density * dP_f * face.area * invDLR;

      aN[owner].set(neighbor, faceCoeff);
      aN[neighbor].set(owner, faceCoeff);

      aP[owner] += faceCoeff;
      aP[neighbor] += faceCoeff;
    }

    // 2. Validate Pressure Reference Policy
    let hasDirichletPressureBoundary = false;
    for (const bc of mesh.boundaryConditions) {
      if (bc.type === BoundaryType.OUTLET) {
        hasDirichletPressureBoundary = true;
        break;
      }
    }

    if (referencePolicy.type === 'FIXED_CELL') {
      const refCell = referencePolicy.referenceCellId ?? 0;
      if (refCell >= 0 && refCell < numCells) {
        // Pin reference cell pressure correction to 0
        aP[refCell] = 1.0;
        aN[refCell].clear();
        b[refCell] = 0.0;
      } else {
        diagnostics.push(`Invalid reference cell ID ${refCell}`);
        return { aP, aN, b, valid: false, diagnostics };
      }
    } else if (!hasDirichletPressureBoundary && referencePolicy.type === 'NONE') {
      diagnostics.push(CouplingDiagnostic.MISSING_PRESSURE_REFERENCE);
      diagnostics.push(CouplingDiagnostic.SINGULAR_PRESSURE_MATRIX);
      return {
        aP,
        aN,
        b,
        valid: false,
        diagnostics
      };
    }

    // Check finite values in system
    if (!CouplingDiagnosticsHelper.isFiniteArray(aP) || !CouplingDiagnosticsHelper.isFiniteArray(b)) {
      diagnostics.push(CouplingDiagnostic.NON_FINITE_VALUE);
      return { aP, aN, b, valid: false, diagnostics };
    }

    return {
      aP,
      aN,
      b,
      valid: true,
      diagnostics: []
    };
  }
}
