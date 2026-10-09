import { CFDMesh, MeshDiagnostic, MeshValidationResult, MeshVerdict } from './CFDMeshTypes';
import { MeshTopology } from './MeshTopology';
import { MeshMetrics } from './MeshMetrics';

export class MeshValidator {
  public static validate(mesh: CFDMesh): MeshValidationResult {
    const errors: string[] = [];
    const diagnostics: MeshDiagnostic[] = [];
    let isInvalid = false;

    // 1. Check for NaN or non-finite node coordinates
    for (const node of mesh.nodes || []) {
      if (!node.coords || node.coords.some(c => typeof c !== 'number' || !Number.isFinite(c))) {
        errors.push(`Node ${node.id} has non-finite/NaN coordinates`);
        if (!diagnostics.includes(MeshDiagnostic.INVALID_GEOMETRY)) {
          diagnostics.push(MeshDiagnostic.INVALID_GEOMETRY);
        }
      }
    }

    // 2. Validate topology references
    const refCheck = MeshTopology.validateReferences(
      mesh.nodes || [], 
      mesh.faces || [], 
      mesh.cells || [], 
      mesh.boundaries || []
    );
    if (!refCheck.valid) {
      errors.push(...refCheck.errors);
      if (refCheck.diagnostic) {
        if (!diagnostics.includes(refCheck.diagnostic)) {
          diagnostics.push(refCheck.diagnostic);
        }
        if (refCheck.diagnostic === MeshDiagnostic.OUT_OF_BOUNDS_INDEX || refCheck.diagnostic === MeshDiagnostic.DUPLICATE_ID) {
          isInvalid = true;
        }
      }
    }

    // 3. Orientation check
    const orientCheck = MeshTopology.checkOrientation(
      mesh.faces || [], 
      mesh.cells || [], 
      mesh.nodes || []
    );
    if (!orientCheck.valid) {
      errors.push(...orientCheck.errors);
      if (orientCheck.diagnostic && !diagnostics.includes(orientCheck.diagnostic)) {
        diagnostics.push(orientCheck.diagnostic);
      }
    }

    // 4. Calculate metrics and check cell volumes & face areas if topology is valid enough
    if (!isInvalid) {
      try {
        const metrics = MeshMetrics.calculateMetrics(mesh);
        
        if (metrics.degenerateCellCount > 0) {
          errors.push(`Degenerate cell detected (${metrics.degenerateCellCount} cells with volume <= tolerance)`);
          if (!diagnostics.includes(MeshDiagnostic.DEGENERATE_MESH)) {
            diagnostics.push(MeshDiagnostic.DEGENERATE_MESH);
          }
        }
        
        if (metrics.invertedCellCount > 0) {
          errors.push(`Inverted cell detected (${metrics.invertedCellCount} cells with negative or non-finite volume)`);
          if (!diagnostics.includes(MeshDiagnostic.INVALID_GEOMETRY)) {
            diagnostics.push(MeshDiagnostic.INVALID_GEOMETRY);
          }
        }

        if (metrics.zeroAreaFaceCount > 0) {
          errors.push(`Zero-area face detected (${metrics.zeroAreaFaceCount} faces)`);
          if (!diagnostics.includes(MeshDiagnostic.INVALID_GEOMETRY)) {
            diagnostics.push(MeshDiagnostic.INVALID_GEOMETRY);
          }
        }

        if (metrics.nonManifoldFaceCount > 0) {
          errors.push(`Non-manifold face detected (${metrics.nonManifoldFaceCount} faces)`);
          if (!diagnostics.includes(MeshDiagnostic.NON_MANIFOLD_MESH)) {
            diagnostics.push(MeshDiagnostic.NON_MANIFOLD_MESH);
          }
        }
      } catch (err: any) {
        errors.push(`Geometry calculation error: ${err.message}`);
        if (!diagnostics.includes(MeshDiagnostic.INVALID_GEOMETRY)) {
          diagnostics.push(MeshDiagnostic.INVALID_GEOMETRY);
        }
      }
    }

    let verdict = MeshVerdict.PASS;
    if (errors.length > 0) {
      verdict = isInvalid ? MeshVerdict.INVALID : MeshVerdict.FAIL;
    }

    return {
      verdict,
      diagnostics,
      errors,
      fvmReady: verdict === MeshVerdict.PASS
    };
  }
}
