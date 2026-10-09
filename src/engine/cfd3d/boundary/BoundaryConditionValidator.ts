/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-060: Mutual Compatibility & System Constraint Validator
 */

import { CFDMesh3D } from '../mesh/CFDMeshTypes';
import {
  BoundaryConditionIdentity,
  BoundaryFieldType,
  PhysicsDomain,
  BoundaryConditionType,
  BoundaryDiagnosticCode
} from './BoundaryConditionTypes';
import { BoundaryPatch } from './BoundaryPatch';
import { BoundaryConditionApplicability } from './BoundaryConditionApplicability';

export interface ComprehensiveValidationResult {
  readonly valid: boolean;
  readonly coverageComplete: boolean;
  readonly systemConstrained: boolean;
  readonly diagnostics: readonly string[];
  readonly codes: readonly BoundaryDiagnosticCode[];
}

export class BoundaryConditionValidator {
  public static validateSystem(
    mesh: CFDMesh3D,
    patches: readonly BoundaryPatch[],
    boundaryConditions: readonly BoundaryConditionIdentity[],
    physicsDomain: PhysicsDomain = PhysicsDomain.INCOMPRESSIBLE_NAVIER_STOKES
  ): ComprehensiveValidationResult {
    const diagnostics: string[] = [];
    const codes: BoundaryDiagnosticCode[] = [];

    // 1. Check Coverage: every boundary face in mesh must be assigned to at least 1 patch
    const boundaryFacesInMesh = mesh.faces.filter(f => f.isBoundary || f.neighborCellId === null || f.neighborCellId === undefined);
    const assignedFaces = new Set<number>();

    for (const patch of patches) {
      for (const fid of patch.faceIds) {
        assignedFaces.add(fid);
      }
    }

    const unassignedFaces = boundaryFacesInMesh.filter(f => !assignedFaces.has(f.id));
    if (unassignedFaces.length > 0) {
      diagnostics.push(`${unassignedFaces.length} boundary faces are unassigned to any Boundary Patch (e.g. face ID ${unassignedFaces[0].id}).`);
      codes.push(BoundaryDiagnosticCode.UNASSIGNED_BOUNDARY_FACE);
    }

    // 2. Check duplicates & over-constraints per patch & field
    const patchFieldMap = new Map<string, BoundaryConditionIdentity[]>();

    for (const bc of boundaryConditions) {
      const key = `${bc.boundaryPatchId}:${bc.fieldType}`;
      if (!patchFieldMap.has(key)) {
        patchFieldMap.set(key, []);
      }
      patchFieldMap.get(key)!.push(bc);
    }

    for (const [key, bcs] of patchFieldMap.entries()) {
      if (bcs.length > 1) {
        // Duplicate condition types or conflicting types
        const types = bcs.map(b => b.conditionType);
        const uniqueTypes = new Set(types);
        if (uniqueTypes.size < types.length) {
          diagnostics.push(`Duplicate boundary condition definition detected for patch field '${key}'.`);
          codes.push(BoundaryDiagnosticCode.DUPLICATE_BOUNDARY_CONDITION);
        } else {
          diagnostics.push(`Over-constrained boundary detected: multiple conditions (${Array.from(uniqueTypes).join(', ')}) defined for patch field '${key}'.`);
          codes.push(BoundaryDiagnosticCode.OVERCONSTRAINED_BOUNDARY);
        }
      }
    }

    // 3. Check applicability
    for (const bc of boundaryConditions) {
      const app = BoundaryConditionApplicability.checkApplicability(bc.conditionType, bc.fieldType, physicsDomain);
      if (!app.applicable) {
        diagnostics.push(...app.diagnostics);
        if (app.code) codes.push(app.code);
      }
    }

    // 4. Check Under-constrained system & Pressure Reference
    if (physicsDomain === PhysicsDomain.INCOMPRESSIBLE_NAVIER_STOKES) {
      const pressureBCs = boundaryConditions.filter(bc => bc.fieldType === BoundaryFieldType.PRESSURE);
      const hasFixedPressure = pressureBCs.some(
        bc => bc.conditionType === BoundaryConditionType.FIXED_PRESSURE ||
              bc.conditionType === BoundaryConditionType.PRESSURE_OUTLET ||
              bc.conditionType === BoundaryConditionType.PRESSURE_INLET
      );
      const hasReferencePressure = pressureBCs.some(bc => bc.parameters.referenceValue !== undefined);

      if (!hasFixedPressure && !hasReferencePressure) {
        diagnostics.push(`Incompressible flow formulation has no pressure reference or fixed pressure boundary condition.`);
        codes.push(BoundaryDiagnosticCode.PRESSURE_REFERENCE_MISSING);
        codes.push(BoundaryDiagnosticCode.UNDERCONSTRAINED_BOUNDARY_SYSTEM);
      }
    }

    const valid = codes.length === 0;
    const coverageComplete = unassignedFaces.length === 0;
    const systemConstrained = !codes.includes(BoundaryDiagnosticCode.UNDERCONSTRAINED_BOUNDARY_SYSTEM) &&
                              !codes.includes(BoundaryDiagnosticCode.PRESSURE_REFERENCE_MISSING);

    return {
      valid,
      coverageComplete,
      systemConstrained,
      diagnostics: Object.freeze(diagnostics),
      codes: Object.freeze(codes)
    };
  }
}
