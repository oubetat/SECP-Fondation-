/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * G1-B3: Mesh Diagnostics Engine Bridge
 *
 * Bridges the Adaptive CFD orchestrator to the FVM Mesh Generator audit logic.
 * Ensures numerical mesh quality (skewness, aspect ratio, non-orthogonality) is verified
 * before solver initialization.
 */

import { FvmMesh3D } from '../Fvm3DTypes';
import { MeshQualityReport } from './AdaptiveCFDTypes';
import { Fvm3DMeshGenerator } from '../Fvm3DMeshGenerator';

export class MeshDiagnosticsEngine {
  /**
   * Evaluates mesh quality by bridging to the production FVM Audit Engine.
   */
  public static evaluateMeshQuality(mesh: FvmMesh3D): MeshQualityReport {
    const audit = Fvm3DMeshGenerator.auditMeshQuality(mesh.cells, mesh.faces);

    const criticalErrors: string[] = [];
    if (!audit.hasPositiveVolumes) criticalErrors.push('Negative or zero cell volumes detected.');
    if (!audit.hasNonzeroAreas) criticalErrors.push('Zero area faces detected.');
    if (audit.maxAspectRatio > 1000) criticalErrors.push(`Extreme aspect ratio detected: ${audit.maxAspectRatio.toFixed(2)}`);
    if (audit.maxSkewness > 0.95) criticalErrors.push(`Extreme skewness detected: ${audit.maxSkewness.toFixed(3)}`);
    if (audit.maxNonOrthogonalityDeg > 85) criticalErrors.push(`Critical non-orthogonality detected: ${audit.maxNonOrthogonalityDeg.toFixed(2)} deg`);

    const warnings: string[] = [];
    if (audit.maxAspectRatio > 100) warnings.push('High aspect ratio cells present.');
    if (audit.maxSkewness > 0.8) warnings.push('High skewness cells present.');
    if (audit.maxNonOrthogonalityDeg > 70) warnings.push('High non-orthogonality present.');

    // Map MeshQualityReport3D to MeshQualityReport
    return {
      isValid: audit.passed && criticalErrors.length === 0,
      totalCells: audit.totalCells,
      totalFaces: audit.totalFaces,
      totalNodes: mesh.nodes?.length || 0,
      boundaryFaces: audit.totalBoundaryFaces,
      internalFaces: audit.totalFaces - audit.totalBoundaryFaces,
      maxNonOrthogonalityDeg: audit.maxNonOrthogonalityDeg,
      avgNonOrthogonalityDeg: 0, // Not provided by current audit
      maxSkewness: audit.maxSkewness,
      avgSkewness: 0, // Not provided by current audit
      maxAspectRatio: audit.maxAspectRatio,
      maxCellVolumeRatio: 0, // Not provided by current audit
      minCellVolumeM3: audit.minCellVolume,
      maxCellVolumeM3: audit.maxCellVolume,
      qualityGrade: this.mapQualityGrade(audit.meshQualityStatus, criticalErrors.length > 0),
      warnings,
      criticalErrors
    };
  }

  private static mapQualityGrade(
    status: 'EXCELLENT' | 'GOOD' | 'ACCEPTABLE' | 'DEGENERATE',
    hasCritical: boolean
  ): 'EXCELLENT' | 'GOOD' | 'ACCEPTABLE' | 'DEGRADED' | 'UNSUITABLE' {
    if (hasCritical || status === 'DEGENERATE') return 'UNSUITABLE';
    switch (status) {
      case 'EXCELLENT': return 'EXCELLENT';
      case 'GOOD': return 'GOOD';
      case 'ACCEPTABLE': return 'ACCEPTABLE';
      default: return 'DEGRADED';
    }
  }
}
