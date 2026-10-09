/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-060: Boundary Patch Model
 */

import { CFDMesh3D } from '../mesh/CFDMeshTypes';
import {
  BoundaryPatchIdentity,
  Vector3D,
  BoundaryDiagnosticCode
} from './BoundaryConditionTypes';

export interface PatchValidationResult {
  readonly valid: boolean;
  readonly diagnostics: readonly string[];
  readonly code?: BoundaryDiagnosticCode;
}

export class BoundaryPatch implements BoundaryPatchIdentity {
  public readonly patchId: string;
  public readonly name: string;
  public readonly faceIds: readonly number[];
  public readonly area: number;
  public readonly outwardNormal: Vector3D;
  public readonly connectivity: readonly number[];
  public readonly geometricHash: string;
  public readonly topologyHash: string;

  constructor(
    patchId: string,
    name: string,
    faceIds: readonly number[],
    area: number,
    outwardNormal: Vector3D,
    connectivity: readonly number[] = [],
    geometricHash?: string,
    topologyHash?: string
  ) {
    this.patchId = patchId;
    this.name = name;
    this.faceIds = Object.freeze([...faceIds]);
    this.area = area;
    this.outwardNormal = Object.freeze([...outwardNormal]) as Vector3D;
    this.connectivity = Object.freeze([...connectivity]);
    this.geometricHash = geometricHash || BoundaryPatch.computeHash(`${patchId}:${area}:${outwardNormal.join(',')}`);
    this.topologyHash = topologyHash || BoundaryPatch.computeHash(`${patchId}:${faceIds.join(',')}`);
  }

  public validate(mesh: CFDMesh3D): PatchValidationResult {
    const diagnostics: string[] = [];

    // 1. Check faceIds presence and emptiness
    if (this.faceIds.length === 0) {
      diagnostics.push(`Patch '${this.patchId}' contains zero face IDs.`);
      return { valid: false, diagnostics, code: BoundaryDiagnosticCode.INVALID_BOUNDARY_PATCH };
    }

    // 2. Check duplicate faceIds
    const uniqueFaces = new Set(this.faceIds);
    if (uniqueFaces.size !== this.faceIds.length) {
      diagnostics.push(`Patch '${this.patchId}' contains duplicate face IDs.`);
      return { valid: false, diagnostics, code: BoundaryDiagnosticCode.INVALID_BOUNDARY_PATCH };
    }

    // 3. Check face existence, boundary status, and area
    const meshFaceMap = new Map(mesh.faces.map(f => [f.id, f]));
    let calculatedArea = 0;

    for (const faceId of this.faceIds) {
      const face = meshFaceMap.get(faceId);
      if (!face) {
        diagnostics.push(`Patch '${this.patchId}' refers to non-existent mesh face ID ${faceId}.`);
        return { valid: false, diagnostics, code: BoundaryDiagnosticCode.INVALID_BOUNDARY_PATCH };
      }

      // Must be boundary face (neighborCellId === null or isBoundary === true)
      if (face.neighborCellId !== null && face.neighborCellId !== undefined) {
        diagnostics.push(`Patch '${this.patchId}' contains internal face ID ${faceId} (neighbor cell ${face.neighborCellId}).`);
        return { valid: false, diagnostics, code: BoundaryDiagnosticCode.INVALID_BOUNDARY_PATCH };
      }

      if (!face.isBoundary) {
        diagnostics.push(`Patch '${this.patchId}' face ID ${faceId} is not marked as boundary face.`);
        return { valid: false, diagnostics, code: BoundaryDiagnosticCode.INVALID_BOUNDARY_PATCH };
      }

      if (face.area <= 0 || !Number.isFinite(face.area)) {
        diagnostics.push(`Patch '${this.patchId}' face ID ${faceId} has non-positive or non-finite area (${face.area}).`);
        return { valid: false, diagnostics, code: BoundaryDiagnosticCode.INVALID_BOUNDARY_PATCH };
      }

      calculatedArea += face.area;
    }

    // 4. Area check
    if (this.area <= 0 || !Number.isFinite(this.area)) {
      diagnostics.push(`Patch '${this.patchId}' area is non-positive or non-finite (${this.area}).`);
      return { valid: false, diagnostics, code: BoundaryDiagnosticCode.INVALID_BOUNDARY_PATCH };
    }

    if (Math.abs(this.area - calculatedArea) > 1e-6 * Math.max(this.area, calculatedArea)) {
      diagnostics.push(`Patch '${this.patchId}' area (${this.area}) mismatches sum of face areas (${calculatedArea}).`);
      return { valid: false, diagnostics, code: BoundaryDiagnosticCode.INVALID_BOUNDARY_PATCH };
    }

    // 5. Normal vector check
    const [nx, ny, nz] = this.outwardNormal;
    if (!Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nz)) {
      diagnostics.push(`Patch '${this.patchId}' outward normal contains non-finite values (${nx}, ${ny}, ${nz}).`);
      return { valid: false, diagnostics, code: BoundaryDiagnosticCode.INVALID_BOUNDARY_NORMAL };
    }

    const norm = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (Math.abs(norm - 1.0) > 1e-4) {
      diagnostics.push(`Patch '${this.patchId}' outward normal is not unit length (magnitude ${norm}).`);
      return { valid: false, diagnostics, code: BoundaryDiagnosticCode.INVALID_BOUNDARY_NORMAL };
    }

    return { valid: true, diagnostics: Object.freeze(diagnostics) };
  }

  private static computeHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return `patch-hash-${Math.abs(hash).toString(16)}`;
  }
}
