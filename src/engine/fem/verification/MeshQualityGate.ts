/**
 * SECP Industrial OS — Engineering Truth Platform
 * PATCH-240 — Mesh Quality Gate
 */

import { FEMMesh } from '../mesh/FEMMesh';
import { FEMMeshQualityCalculator } from '../mesh/FEMMeshQuality';

export interface MeshGateReport {
  passed: boolean;
  meshId: string;
  overallClassification: string;
  metrics: {
    maxAspectRatio: number;
    minVolume: number;
    poorElementRatio: number;
    invalidCount: number;
  };
  verdict: 'MESH_VALID' | 'MESH_INVALID' | 'MESH_POOR';
}

/**
 * MeshQualityGate: Performs rigorous element quality screening.
 */
export class MeshQualityGate {
  public static verify(mesh: FEMMesh): MeshGateReport {
    const quality = FEMMeshQualityCalculator.analyze(mesh.nodes, mesh.elements);
    const poorRatio = quality.poorCount / Math.max(1, mesh.elements.length);
    const isInvalid = quality.invalidCount > 0;
    const isPoor = poorRatio > 0.10; 
    
    let verdict: 'MESH_VALID' | 'MESH_INVALID' | 'MESH_POOR' = 'MESH_VALID';
    if (isInvalid) verdict = 'MESH_INVALID';
    else if (isPoor) verdict = 'MESH_POOR';

    return {
      passed: verdict !== 'MESH_INVALID',
      meshId: mesh.id,
      overallClassification: quality.overallClassification,
      metrics: {
        maxAspectRatio: quality.maxAspectRatio,
        minVolume: quality.minAreaVolume,
        poorElementRatio: poorRatio,
        invalidCount: quality.invalidCount
      },
      verdict
    };
  }
}
