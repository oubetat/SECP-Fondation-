/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-061: Laminar Boundary Assembly
 */

import { CFDMesh3D, CFDMeshFace3D } from '../../mesh/CFDMeshTypes';
import { FVMEquationCoefficients } from '../../fvm/FVMTypes';
import { BoundaryConditionSet } from '../../boundary/BoundaryConditionSet';
import { BoundaryConditionDiscretizer } from '../../boundary/BoundaryConditionDiscretizer';
import { BoundaryConditionType, BoundaryFieldType } from '../../boundary/BoundaryConditionTypes';
import { MaterialProperties } from './LaminarSolverTypes';

export class LaminarBoundaryAssembly {
  public static applyBoundaryConditions(
    mesh: CFDMesh3D,
    boundarySet: BoundaryConditionSet,
    coeffs: FVMEquationCoefficients[],
    fieldType: BoundaryFieldType,
    material: MaterialProperties,
    componentIndex: number = 0
  ): void {
    for (const patch of boundarySet.patches) {
      const condition = boundarySet.getConditionForPatch(patch.patchId, fieldType);
      if (!condition) continue;

      for (const faceId of patch.faceIds) {
        const face = mesh.faces.find(f => f.id === faceId);
        if (!face) continue;

        const owner = face.ownerCellId;
        
        // Use the discretizer from PATCH-060
        const disc = BoundaryConditionDiscretizer.discretizeBoundaryFace(
          face,
          patch,
          condition,
          material.density,
          material.viscosity
        );

        // Apply to matrix
        coeffs[owner].aP += disc.matrixDiagonalContribution;
        // Off-diagonal is typically 0 for boundaries unless it's periodic/coupled
        coeffs[owner].b += disc.sourceContribution;
        coeffs[owner].boundaryContribution += disc.sourceContribution;

        // Specific handling for pressure boundaries in momentum equations
        if (fieldType === BoundaryFieldType.PRESSURE && condition.conditionType === BoundaryConditionType.FIXED_PRESSURE) {
           // Handled by pressure solve usually, but might need coupling terms
        }
      }
    }
  }
}
