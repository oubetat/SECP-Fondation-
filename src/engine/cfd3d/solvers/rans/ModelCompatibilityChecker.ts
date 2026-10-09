/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-063: Model Compatibility Checker
 */

import { TurbulenceModel } from './TurbulenceModelContract';
import { CFDMesh3D } from '../../mesh/CFDMeshTypes';
import { BoundaryConditionSet } from '../../boundary/BoundaryConditionSet';

export class ModelCompatibilityChecker {
  public static check(
    model: TurbulenceModel,
    mesh: CFDMesh3D,
    boundarySet: BoundaryConditionSet,
    solverType: string
  ): { compatible: boolean; error?: string } {
    // Check supported solver regimes
    if (solverType === 'COMPRESSIBLE' && !model.capabilities.compressible) {
      return { compatible: false, error: 'INVALID_CONFIGURATION: Model does not support compressible flows' };
    }

    // Check mesh compliance
    if (mesh.cells.length === 0) {
      return { compatible: false, error: 'INVALID_CONFIGURATION: Mesh has no cells' };
    }

    return { compatible: true };
  }
}
