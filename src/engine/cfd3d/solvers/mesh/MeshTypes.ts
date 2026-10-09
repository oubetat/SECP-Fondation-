/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-069: Mesh Independence Types and Definitions
 */

export interface MeshLevel {
  readonly meshId: string;
  readonly levelIndex: number;
  readonly cellCount: number;
  readonly faceCount: number;
  readonly nodeCount: number;
  readonly characteristicLength: number;
  readonly meshHash: string;
}

export interface MeshFamily {
  readonly familyId: string;
  readonly familyVersion: string;
  readonly baseMeshId: string;
  readonly refinementMethod: string;
  readonly refinementRatio: number;
  readonly dimension: number;
  readonly topologyType: string;
  readonly geometryHash: string;
  readonly levels: readonly MeshLevel[];
}

export interface MeshQualityReport {
  readonly skewness: number;
  readonly orthogonality: number;
  readonly aspectRatio: number;
  readonly minimumVolume: number;
  readonly hasNegativeVolume: boolean;
}

export interface QuantityOfInterest {
  readonly qoiId: string;
  readonly field: string;
  readonly region: string;
  readonly value: number;
}
