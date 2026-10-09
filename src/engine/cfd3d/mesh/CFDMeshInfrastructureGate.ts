/**
 * SECP Industrial OS v2 — CFD Mesh Infrastructure Gate
 * PATCH-051: CFD Mesh Infrastructure
 */

import { CFDMesh, MeshVerdict } from './CFDMeshTypes';
import { CFDMeshInfrastructure } from './CFDMeshInfrastructure';

export class CFDMeshInfrastructureGate {
  public static evaluateGate(mesh: CFDMesh): { verdict: MeshVerdict; diagnostic: string; fvmReady: boolean } {
    const validation = CFDMeshInfrastructure.validateMesh(mesh);
    
    let diagnostic = '';
    if (validation.verdict === MeshVerdict.PASS) {
      diagnostic = 'Mesh infrastructure verified. Topology, geometry, and connectivity are valid.';
    } else {
      diagnostic = `Mesh infrastructure verification failed: ${validation.errors.join('; ')}`;
    }

    return {
      verdict: validation.verdict,
      diagnostic,
      fvmReady: validation.fvmReady
    };
  }
}
