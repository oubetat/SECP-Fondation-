/**
 * PATCH-SECP-073: FEA Package Engine
 * Compiles meshes, FEA solution results, and digital signatures into a unified FEA package.
 */

import { FEAPackage, FEAMesh, StructuralAnalysisResults } from './StructuralPhysicsTypes';
import { StructuralProvenanceEngine } from './StructuralProvenanceEngine';

export class FEAPackageEngine {
  public static compilePackage(
    partId: string,
    mesh: FEAMesh,
    results: StructuralAnalysisResults,
    signedBy: string
  ): FEAPackage {
    const provenance = StructuralProvenanceEngine.createRecord(partId, mesh, results, signedBy);
    
    const isValid = results.converged && mesh.qualityMetrics.isValid;

    return {
      packageId: `pkg-fea-${partId}-${Date.now()}`,
      partId,
      mesh,
      results,
      provenance,
      isValid
    };
  }
}
