/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-060: Verification Primitives Engine
 */

import { CFDMesh3D, CFDFace3D } from '../mesh/CFDMeshTypes';
import {
  BoundaryConditionIdentity,
  PhysicsDomain,
  BoundaryFieldType,
  BoundaryConditionType,
  DiscretizationContribution,
  Vector3D,
  BoundaryDiagnosticCode
} from './BoundaryConditionTypes';
import { BoundaryPatch } from './BoundaryPatch';
import { BoundaryConditionApplicability } from './BoundaryConditionApplicability';
import { BoundaryConditionValidator } from './BoundaryConditionValidator';
import { PeriodicBoundaryCondition } from './PeriodicBoundaryCondition';
import { BoundaryConditionDiscretizer } from './BoundaryConditionDiscretizer';

export interface VerificationPrimitiveResult {
  readonly valid: boolean;
  readonly diagnostics: readonly string[];
  readonly code?: BoundaryDiagnosticCode;
}

export class BoundaryConditionVerification {
  public static verifyBoundaryPatch(patch: BoundaryPatch, mesh: CFDMesh3D): VerificationPrimitiveResult {
    return patch.validate(mesh);
  }

  public static verifyBoundaryCoverage(mesh: CFDMesh3D, patches: readonly BoundaryPatch[]): VerificationPrimitiveResult {
    const boundaryFaces = mesh.faces.filter(f => f.isBoundary || f.neighborCellId === null || f.neighborCellId === undefined);
    const assigned = new Set<number>();

    for (const p of patches) {
      for (const fid of p.faceIds) {
        assigned.add(fid);
      }
    }

    const unassigned = boundaryFaces.filter(f => !assigned.has(f.id));
    if (unassigned.length > 0) {
      return {
        valid: false,
        diagnostics: [`${unassigned.length} boundary faces unassigned.`],
        code: BoundaryDiagnosticCode.UNASSIGNED_BOUNDARY_FACE
      };
    }

    return { valid: true, diagnostics: [] };
  }

  public static verifyBoundaryIdentity(bc: BoundaryConditionIdentity): VerificationPrimitiveResult {
    const diagnostics: string[] = [];

    if (!bc.boundaryConditionId || !bc.boundaryPatchId) {
      diagnostics.push('Boundary condition missing ID or Patch ID.');
      return { valid: false, diagnostics, code: BoundaryDiagnosticCode.INVALID_BOUNDARY_CONDITION };
    }

    if (!bc.units) {
      diagnostics.push('Boundary condition missing units definition.');
      return { valid: false, diagnostics, code: BoundaryDiagnosticCode.INVALID_PHYSICAL_DIMENSIONS };
    }

    if (!bc.provenance || !bc.provenance.hash) {
      diagnostics.push('Boundary condition missing provenance or hash.');
      return { valid: false, diagnostics, code: BoundaryDiagnosticCode.INVALID_BOUNDARY_CONDITION };
    }

    return { valid: true, diagnostics: [] };
  }

  public static verifyBoundaryApplicability(
    bc: BoundaryConditionIdentity,
    fieldType: BoundaryFieldType,
    domain: PhysicsDomain
  ): VerificationPrimitiveResult {
    const res = BoundaryConditionApplicability.checkApplicability(bc.conditionType, fieldType, domain);
    return { valid: res.applicable, diagnostics: res.diagnostics, code: res.code };
  }

  public static verifyBoundaryDimensions(bc: BoundaryConditionIdentity): VerificationPrimitiveResult {
    if (!bc.units || bc.units.trim() === '') {
      return {
        valid: false,
        diagnostics: ['Missing boundary condition physical units.'],
        code: BoundaryDiagnosticCode.INVALID_PHYSICAL_DIMENSIONS
      };
    }
    return { valid: true, diagnostics: [] };
  }

  public static verifyBoundaryCompatibility(bcs: readonly BoundaryConditionIdentity[]): VerificationPrimitiveResult {
    const patchFieldMap = new Map<string, BoundaryConditionIdentity[]>();

    for (const bc of bcs) {
      const key = `${bc.boundaryPatchId}:${bc.fieldType}`;
      if (!patchFieldMap.has(key)) {
        patchFieldMap.set(key, []);
      }
      patchFieldMap.get(key)!.push(bc);
    }

    for (const [key, list] of patchFieldMap.entries()) {
      if (list.length > 1) {
        return {
          valid: false,
          diagnostics: [`Conflicting/duplicate boundary conditions for ${key}.`],
          code: BoundaryDiagnosticCode.CONFLICTING_BOUNDARY_CONDITIONS
        };
      }
    }

    return { valid: true, diagnostics: [] };
  }

  public static verifyPressureReference(
    bcs: readonly BoundaryConditionIdentity[],
    domain: PhysicsDomain
  ): VerificationPrimitiveResult {
    if (domain !== PhysicsDomain.INCOMPRESSIBLE_NAVIER_STOKES) {
      return { valid: true, diagnostics: [] };
    }

    const pressBCs = bcs.filter(b => b.fieldType === BoundaryFieldType.PRESSURE);
    const hasFixed = pressBCs.some(b =>
      b.conditionType === BoundaryConditionType.FIXED_PRESSURE ||
      b.conditionType === BoundaryConditionType.PRESSURE_OUTLET ||
      b.conditionType === BoundaryConditionType.PRESSURE_INLET
    );
    const hasRef = pressBCs.some(b => b.parameters.referenceValue !== undefined);

    if (!hasFixed && !hasRef) {
      return {
        valid: false,
        diagnostics: ['Pressure reference missing for incompressible flow.'],
        code: BoundaryDiagnosticCode.PRESSURE_REFERENCE_MISSING
      };
    }

    return { valid: true, diagnostics: [] };
  }

  public static verifyPeriodicMapping(
    periodicBC: PeriodicBoundaryCondition,
    masterPatch: BoundaryPatch,
    slavePatch: BoundaryPatch
  ): VerificationPrimitiveResult {
    const res = periodicBC.validateMapping(masterPatch, slavePatch);
    return { valid: res.valid, diagnostics: res.diagnostics, code: res.code };
  }

  public static verifyBoundaryNormals(patch: BoundaryPatch, mesh: CFDMesh3D): VerificationPrimitiveResult {
    const res = patch.validate(mesh);
    return { valid: res.valid, diagnostics: res.diagnostics, code: res.code };
  }

  public static verifyBoundaryFlux(
    face: CFDFace3D,
    bc: BoundaryConditionIdentity,
    density: number = 1.2
  ): VerificationPrimitiveResult {
    if (bc.conditionType === BoundaryConditionType.VELOCITY_INLET || bc.conditionType === BoundaryConditionType.FIXED_VELOCITY) {
      const vel = (bc.parameters.value as Vector3D) || [0, 0, 0];
      const uDotN = vel[0] * face.normal[0] + vel[1] * face.normal[1] + vel[2] * face.normal[2];
      const expectedFlux = density * uDotN * face.area;
      if (!Number.isFinite(expectedFlux)) {
        return {
          valid: false,
          diagnostics: ['Boundary flux is non-finite.'],
          code: BoundaryDiagnosticCode.BOUNDARY_FLUX_MISMATCH
        };
      }
    }
    return { valid: true, diagnostics: [] };
  }

  public static verifyBoundaryDiscretization(
    bc: BoundaryConditionIdentity,
    disc: DiscretizationContribution
  ): VerificationPrimitiveResult {
    if (disc.boundaryConditionId !== bc.boundaryConditionId) {
      return {
        valid: false,
        diagnostics: ['Discretization contribution ID does not match boundary condition ID.'],
        code: BoundaryDiagnosticCode.BOUNDARY_FLUX_MISMATCH
      };
    }
    return { valid: true, diagnostics: [] };
  }

  public static verifyBoundaryRecomputation(
    bc: BoundaryConditionIdentity,
    face: CFDFace3D,
    patch: BoundaryPatch,
    storedDisc: DiscretizationContribution
  ): VerificationPrimitiveResult {
    const recomputed = BoundaryConditionDiscretizer.discretizeBoundaryFace(face, patch, bc);
    const diffFlux = Math.abs(recomputed.faceFlux - storedDisc.faceFlux);
    if (diffFlux > 1e-10) {
      return {
        valid: false,
        diagnostics: [`Recomputed flux (${recomputed.faceFlux}) mismatch with stored (${storedDisc.faceFlux}).`],
        code: BoundaryDiagnosticCode.BOUNDARY_RECOMPUTATION_MISMATCH
      };
    }
    return { valid: true, diagnostics: [] };
  }

  public static verifyBoundaryDeterminism(patch: BoundaryPatch, bc: BoundaryConditionIdentity): VerificationPrimitiveResult {
    const hash1 = patch.geometricHash;
    const hash2 = patch.geometricHash;
    if (hash1 !== hash2) {
      return {
        valid: false,
        diagnostics: ['Boundary patch hash is non-deterministic.'],
        code: BoundaryDiagnosticCode.INVALID_BOUNDARY_PATCH
      };
    }
    return { valid: true, diagnostics: [] };
  }

  public static verifyNoDuplicateBoundaryConditions(bcs: readonly BoundaryConditionIdentity[]): VerificationPrimitiveResult {
    const set = new Set<string>();
    for (const bc of bcs) {
      const key = `${bc.boundaryPatchId}:${bc.fieldType}:${bc.conditionType}`;
      if (set.has(key)) {
        return {
          valid: false,
          diagnostics: [`Duplicate boundary condition found: ${key}`],
          code: BoundaryDiagnosticCode.DUPLICATE_BOUNDARY_CONDITION
        };
      }
      set.add(key);
    }
    return { valid: true, diagnostics: [] };
  }

  public static verifyNoOverConstraint(bcs: readonly BoundaryConditionIdentity[]): VerificationPrimitiveResult {
    return this.verifyBoundaryCompatibility(bcs);
  }

  public static verifyNoUnderConstraint(
    bcs: readonly BoundaryConditionIdentity[],
    domain: PhysicsDomain
  ): VerificationPrimitiveResult {
    return this.verifyPressureReference(bcs, domain);
  }
}
