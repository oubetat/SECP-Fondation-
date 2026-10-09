/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-060: Periodic Boundary Condition
 */

import { BoundaryPatch } from './BoundaryPatch';
import { Vector3D, BoundaryDiagnosticCode } from './BoundaryConditionTypes';

export interface PeriodicBCValidationResult {
  readonly valid: boolean;
  readonly diagnostics: readonly string[];
  readonly code?: BoundaryDiagnosticCode;
}

export interface FacePairing {
  readonly masterFaceId: number;
  readonly slaveFaceId: number;
}

export class PeriodicBoundaryCondition {
  public readonly boundaryConditionId: string;
  public readonly masterPatchId: string;
  public readonly slavePatchId: string;
  public readonly translationVector: Vector3D;
  public readonly faceMap: readonly FacePairing[];

  constructor(
    boundaryConditionId: string,
    masterPatchId: string,
    slavePatchId: string,
    translationVector: Vector3D,
    faceMap: readonly FacePairing[] = []
  ) {
    this.boundaryConditionId = boundaryConditionId;
    this.masterPatchId = masterPatchId;
    this.slavePatchId = slavePatchId;
    this.translationVector = Object.freeze([...translationVector]) as Vector3D;
    this.faceMap = Object.freeze([...faceMap]);
  }

  public validateMapping(masterPatch: BoundaryPatch, slavePatch: BoundaryPatch): PeriodicBCValidationResult {
    const diagnostics: string[] = [];

    if (!masterPatch || !slavePatch) {
      diagnostics.push(`Periodic boundary requires valid master and slave patches.`);
      return { valid: false, diagnostics, code: BoundaryDiagnosticCode.PERIODIC_MAPPING_UNPROVEN };
    }

    if (Math.abs(masterPatch.area - slavePatch.area) > 1e-6 * Math.max(masterPatch.area, slavePatch.area)) {
      diagnostics.push(`Periodic master patch area (${masterPatch.area}) does not match slave patch area (${slavePatch.area}).`);
      return { valid: false, diagnostics, code: BoundaryDiagnosticCode.PERIODIC_MAPPING_UNPROVEN };
    }

    if (masterPatch.faceIds.length !== slavePatch.faceIds.length) {
      diagnostics.push(`Periodic face count mismatch: master has ${masterPatch.faceIds.length} faces, slave has ${slavePatch.faceIds.length} faces.`);
      return { valid: false, diagnostics, code: BoundaryDiagnosticCode.PERIODIC_MAPPING_UNPROVEN };
    }

    if (this.faceMap.length !== masterPatch.faceIds.length) {
      diagnostics.push(`Periodic face map incomplete: ${this.faceMap.length} pairs mapped for ${masterPatch.faceIds.length} faces.`);
      return { valid: false, diagnostics, code: BoundaryDiagnosticCode.PERIODIC_MAPPING_UNPROVEN };
    }

    return { valid: true, diagnostics: Object.freeze(diagnostics) };
  }
}
