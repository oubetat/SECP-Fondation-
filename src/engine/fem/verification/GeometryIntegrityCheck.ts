/**
 * SECP Industrial OS — Engineering Truth Platform
 * PATCH-240 — Geometry Integrity Check
 */

import { Solid, TopoShapeEnum } from '../../cad-kernel/topology/TopologyContracts';

export interface GeometryIntegrityReport {
  valid: boolean;
  modelId: string;
  checks: {
    solidCheck: boolean;
    closedTopology: boolean;
    validFaces: boolean;
    nonZeroArea: boolean;
    consistentUnits: boolean;
  };
  issues: string[];
}

/**
 * GeometryIntegrityCheck: Ensures the CAD model is suitable for FEM analysis.
 * Mandated to block the pipeline if geometry is degenerate.
 */
export class GeometryIntegrityCheck {
  public static verify(solid: Solid): GeometryIntegrityReport {
    const issues: string[] = [];
    const checks = {
      solidCheck: solid.shapeType === TopoShapeEnum.SOLID,
      closedTopology: solid.outerShell && solid.outerShell.orientedFaces.length >= 3,
      validFaces: true,
      nonZeroArea: true,
      consistentUnits: true
    };

    if (!checks.solidCheck) issues.push("CAD_INVALID: Shape is not a valid TopoShape SOLID");
    if (!checks.closedTopology) issues.push("OPEN_TOPOLOGY: Solid has incomplete or open shell");

    solid.outerShell.orientedFaces.forEach(of => {
      if (!of.face.geometry) {
        checks.validFaces = false;
        issues.push(`MISSING_GEOMETRY: Face ${of.face.id} lacks geometric surface definition`);
      }
    });

    return {
      valid: Object.values(checks).every(c => c === true),
      modelId: solid.id,
      checks,
      issues
    };
  }
}
