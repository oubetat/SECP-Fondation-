/**
 * SECP Industrial OS v2 — CFD Mesh Infrastructure
 * PATCH-051: CFD Mesh Infrastructure
 */

import { CFDMesh, MeshValidationResult, MeshQualityMetrics } from './CFDMeshTypes';
import { MeshValidator } from './MeshValidator';
import { MeshMetrics } from './MeshMetrics';
import { MeshCanonicalizer } from './MeshCanonicalizer';

export class CFDMeshInfrastructure {
  public static validateMesh(mesh: CFDMesh): MeshValidationResult {
    return MeshValidator.validate(mesh);
  }

  public static calculateMetrics(mesh: CFDMesh): MeshQualityMetrics {
    return MeshMetrics.calculateMetrics(mesh);
  }

  public static getMeshIdentity(mesh: CFDMesh): string {
    return MeshCanonicalizer.calculateHash(mesh);
  }

  /**
   * Create an evidence object for mesh verification.
   */
  public static generateEvidence(mesh: CFDMesh) {
    const validation = this.validateMesh(mesh);
    const metrics = this.calculateMetrics(mesh);
    const meshIdentity = this.getMeshIdentity(mesh);

    return {
      evidenceId: `EVID-MESH-${mesh.meshId}-${Date.now()}`,
      patchId: 'PATCH-051',
      meshIdentity,
      validationResult: validation,
      qualityMetrics: metrics,
      toleranceConfiguration: mesh.toleranceConfig,
      provenance: mesh.provenance,
      timestamp: new Date().toISOString()
    };
  }
}
