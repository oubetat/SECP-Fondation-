/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-069: Mesh Quality Validator and Topology Checks
 */

import { MeshQualityReport } from './MeshTypes';

export enum MeshValidationCode {
  NEGATIVE_VOLUME = 'NEGATIVE_VOLUME',
  EXCESSIVE_SKEWNESS = 'EXCESSIVE_SKEWNESS',
  POOR_ORTHOGONALITY = 'POOR_ORTHOGONALITY',
  TOPOLOGY_CORRUPTION = 'TOPOLOGY_CORRUPTION'
}

export class MeshQualityValidator {
  public static validate(
    report: MeshQualityReport,
    duplicateNodesCount: number
  ): { valid: boolean; error?: MeshValidationCode; detail?: string } {
    if (report.hasNegativeVolume || report.minimumVolume <= 0) {
      return { valid: false, error: MeshValidationCode.NEGATIVE_VOLUME, detail: `Negative cell volume detected: minVolume=${report.minimumVolume}` };
    }

    if (report.skewness > 0.95) {
      return { valid: false, error: MeshValidationCode.EXCESSIVE_SKEWNESS, detail: `Mesh cell skewness exceeds limit: skewness=${report.skewness}` };
    }

    if (report.orthogonality < 10.0) {
      return { valid: false, error: MeshValidationCode.POOR_ORTHOGONALITY, detail: `Mesh face orthogonality is too poor: orthogonality=${report.orthogonality} deg` };
    }

    if (duplicateNodesCount > 0) {
      return { valid: false, error: MeshValidationCode.TOPOLOGY_CORRUPTION, detail: `Duplicate nodes detected in mesh topology: count=${duplicateNodesCount}` };
    }

    return { valid: true };
  }
}
