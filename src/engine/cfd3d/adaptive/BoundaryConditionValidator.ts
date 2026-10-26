/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * G1-B2: Boundary Condition Validator Bridge
 *
 * Bridges the Adaptive CFD orchestrator to the Production Boundary Condition Validator.
 * Handles type mapping between FvmMesh3D/CaseDefinition3D and the Production Validation Domain.
 */

import { FvmMesh3D } from '../Fvm3DTypes';
import { CaseDefinition3D, BoundaryConditionDef } from './AdaptiveCFDTypes';
import { 
  BoundaryConditionValidator as ProductionValidator,
  ComprehensiveValidationResult 
} from '../boundary/BoundaryConditionValidator';
import { 
  BoundaryConditionIdentity, 
  BoundaryConditionType, 
  BoundaryFieldType, 
  PhysicsDomain,
  BoundaryDiagnosticCode
} from '../boundary/BoundaryConditionTypes';
import { BoundaryPatch } from '../boundary/BoundaryPatch';
import { CFDMesh3D, CFDMeshFace3D, CFDMeshCell3D } from '../mesh/CFDMeshTypes';

export interface BCValidationReport {
  isValid: boolean;
  issues: string[];
  diagnostics: readonly string[];
  codes: readonly BoundaryDiagnosticCode[];
}

export class BoundaryConditionValidator {
  /**
   * Bridges Adaptive CFD case definition to Production Validation Engine
   */
  public static validate(mesh: FvmMesh3D, caseDef: CaseDefinition3D): BCValidationReport {
    // 1. Map Mesh to production CFDMesh3D
    const prodMesh: CFDMesh3D = {
      meshId: mesh.meshId,
      cells: mesh.cells.map(c => ({
        id: c.cellId,
        volume: c.volume,
        faceIds: c.faceIds,
        center: [c.centroid.x, c.centroid.y, c.centroid.z]
      }) as CFDMeshCell3D),
      faces: mesh.faces.map(f => ({
        id: f.faceId,
        ownerCellId: f.ownerCellId,
        neighborCellId: f.neighborCellId === -1 ? null : f.neighborCellId,
        area: f.area,
        normal: [f.normal.x, f.normal.y, f.normal.z],
        isBoundary: f.neighborCellId === -1 || f.neighborCellId === null,
        center: [f.centroid.x, f.centroid.y, f.centroid.z],
        boundaryType: f.boundaryType
      }) as CFDMeshFace3D)
    };

    // 2. Synthesize Patches from Mesh (Grouping by boundaryType)
    const patchFaceMap = new Map<string, number[]>();
    for (const face of prodMesh.faces) {
      if (face.isBoundary) {
        const type = (face as any).boundaryType || 'WALL';
        if (!patchFaceMap.has(type)) patchFaceMap.set(type, []);
        patchFaceMap.get(type)!.push(face.id);
      }
    }

    const patches: BoundaryPatch[] = [];
    for (const [type, faceIds] of patchFaceMap.entries()) {
      // Compute aggregate patch properties
      let totalArea = 0;
      let avgNormal: [number, number, number] = [0, 0, 0];
      
      for (const fid of faceIds) {
        const face = prodMesh.faces[fid];
        totalArea += face.area;
        avgNormal[0] += face.normal[0] * face.area;
        avgNormal[1] += face.normal[1] * face.area;
        avgNormal[2] += face.normal[2] * face.area;
      }

      // Normalize avg normal
      const mag = Math.sqrt(avgNormal[0]**2 + avgNormal[1]**2 + avgNormal[2]**2);
      if (mag > 1e-12) {
        avgNormal[0] /= mag;
        avgNormal[1] /= mag;
        avgNormal[2] /= mag;
      }

      patches.push(new BoundaryPatch(
        type, // Using boundaryType as patchId for this bridge
        `Patch_${type}`,
        faceIds,
        totalArea,
        avgNormal
      ));
    }

    // 3. Map Case BCs to Production BoundaryConditionIdentity
    const boundaryConditions: BoundaryConditionIdentity[] = [];
    
    // Support both Array and Record formats from CaseDefinition3D
    const bcList = Array.isArray(caseDef.boundaryConditions) 
      ? caseDef.boundaryConditions 
      : Object.values(caseDef.boundaryConditions);

    for (const bcDef of bcList) {
      // Map BoundaryType to production BoundaryConditionType
      const condType = this.mapToProductionType(bcDef.type);
      
      // Determine field type (primary field for the BC)
      const fieldType = this.inferFieldType(bcDef);

      boundaryConditions.push({
        boundaryConditionId: bcDef.name || bcDef.patchId,
        boundaryPatchId: bcDef.patchId || bcDef.type, // Fallback to type if no patchId
        conditionType: condType,
        fieldType: fieldType,
        parameters: {
          value: bcDef.velocity ? [bcDef.velocity.x, bcDef.velocity.y, bcDef.velocity.z] : undefined,
          referenceValue: bcDef.pressurePa ?? bcDef.temperatureK,
          ...bcDef
        }
      });
    }

    // 4. Determine Physics Domain
    const domain = caseDef.flowRegime === 'INCOMPRESSIBLE' 
      ? PhysicsDomain.INCOMPRESSIBLE_NAVIER_STOKES 
      : PhysicsDomain.COMPRESSIBLE_NAVIER_STOKES;

    // 5. Execute Production Validation
    const prodResult = ProductionValidator.validateSystem(
      prodMesh,
      patches,
      boundaryConditions,
      domain
    );

    return {
      isValid: prodResult.valid,
      issues: [...prodResult.diagnostics],
      diagnostics: prodResult.diagnostics,
      codes: prodResult.codes
    };
  }

  private static mapToProductionType(type: string): BoundaryConditionType {
    switch (type) {
      case 'INLET': return BoundaryConditionType.VELOCITY_INLET;
      case 'VELOCITY_INLET': return BoundaryConditionType.VELOCITY_INLET;
      case 'PRESSURE_INLET': return BoundaryConditionType.PRESSURE_INLET;
      case 'OUTLET': return BoundaryConditionType.PRESSURE_OUTLET;
      case 'PRESSURE_OUTLET': return BoundaryConditionType.PRESSURE_OUTLET;
      case 'WALL': return BoundaryConditionType.NO_SLIP_WALL;
      case 'WALL_NO_SLIP': return BoundaryConditionType.NO_SLIP_WALL;
      case 'WALL_SLIP': return BoundaryConditionType.SLIP_WALL;
      case 'SYMMETRY': return BoundaryConditionType.SYMMETRY;
      default: return BoundaryConditionType.NO_SLIP_WALL;
    }
  }

  private static inferFieldType(bc: BoundaryConditionDef): BoundaryFieldType {
    if (bc.velocity || bc.u !== undefined) return BoundaryFieldType.VELOCITY;
    if (bc.pressurePa !== undefined) return BoundaryFieldType.PRESSURE;
    if (bc.temperatureK !== undefined) return BoundaryFieldType.TEMPERATURE;
    return BoundaryFieldType.VELOCITY; // Default
  }
}
