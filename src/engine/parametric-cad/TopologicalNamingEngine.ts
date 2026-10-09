import { CADBody } from './ParametricCADTypes';

export interface TopologicalFingerprint {
  entityId: string;
  entityType: 'FACE' | 'EDGE' | 'VERTEX';
  centroid: { x: number; y: number; z: number };
  normal?: { x: number; y: number; z: number };
  areaOrLength: number;
  bbox: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } };
  adjacentEntityIds: string[];
  historicalFeatureId: string;
  surfaceType?: 'PLANE' | 'CYLINDER' | 'SPHERE' | 'NURBS';
}

export interface ReMappingResult {
  mappedEntityId: string;
  confidenceScore: number; // 0.0 to 1.0
  strategyUsed: 'EXACT_ID' | 'GEOMETRIC_FINGERPRINT' | 'TOPOLOGICAL_ADJACENCY' | 'HISTORICAL_ANCESTRY';
  displacementDistance: number;
}

export class TopologicalNamingEngine {
  /**
   * Generates a persistent geometric fingerprint for an entity (Face/Edge/Vertex)
   */
  public static generateFingerprint(
    entityId: string,
    entityType: 'FACE' | 'EDGE' | 'VERTEX',
    centroid: { x: number; y: number; z: number },
    normal: { x: number; y: number; z: number } | undefined,
    areaOrLength: number,
    bbox: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } },
    adjacentEntityIds: string[],
    historicalFeatureId: string,
    surfaceType: 'PLANE' | 'CYLINDER' | 'SPHERE' | 'NURBS' = 'PLANE'
  ): TopologicalFingerprint {
    return {
      entityId,
      entityType,
      centroid: { ...centroid },
      normal: normal ? { ...normal } : undefined,
      areaOrLength,
      bbox: {
        min: { ...bbox.min },
        max: { ...bbox.max },
      },
      adjacentEntityIds: [...adjacentEntityIds],
      historicalFeatureId,
      surfaceType,
    };
  }

  /**
   * Resolves the Topological Naming Problem (TNP) when geometry regenerates.
   * Matches candidate target entities in the newly regenerated body against historical fingerprints.
   */
  public static resolveTargetEntity(
    targetFingerprint: TopologicalFingerprint,
    candidateFingerprints: TopologicalFingerprint[]
  ): ReMappingResult {
    // 1. Direct ID match check
    const directMatch = candidateFingerprints.find((c) => c.entityId === targetFingerprint.entityId);
    if (directMatch) {
      return {
        mappedEntityId: directMatch.entityId,
        confidenceScore: 1.0,
        strategyUsed: 'EXACT_ID',
        displacementDistance: 0.0,
      };
    }

    let bestCandidate: TopologicalFingerprint | null = null;
    let highestScore = -1.0;
    let bestStrategy: ReMappingResult['strategyUsed'] = 'GEOMETRIC_FINGERPRINT';
    let minDistance = Infinity;

    for (const cand of candidateFingerprints) {
      if (cand.entityType !== targetFingerprint.entityType) continue;

      // Distance score
      const dist = Math.hypot(
        cand.centroid.x - targetFingerprint.centroid.x,
        cand.centroid.y - targetFingerprint.centroid.y,
        cand.centroid.z - targetFingerprint.centroid.z
      );

      const maxDim = Math.max(
        Math.abs(targetFingerprint.bbox.max.x - targetFingerprint.bbox.min.x),
        Math.abs(targetFingerprint.bbox.max.y - targetFingerprint.bbox.min.y),
        Math.abs(targetFingerprint.bbox.max.z - targetFingerprint.bbox.min.z),
        0.01
      );

      const distanceScore = Math.max(0.0, 1.0 - dist / (maxDim * 2.0));

      // Normal alignment score (for faces)
      let normalScore = 1.0;
      if (targetFingerprint.normal && cand.normal) {
        const dot =
          targetFingerprint.normal.x * cand.normal.x +
          targetFingerprint.normal.y * cand.normal.y +
          targetFingerprint.normal.z * cand.normal.z;
        normalScore = Math.max(0.0, dot);
      }

      // Area / Length similarity score
      const maxArea = Math.max(targetFingerprint.areaOrLength, cand.areaOrLength, 1e-6);
      const minArea = Math.min(targetFingerprint.areaOrLength, cand.areaOrLength);
      const sizeScore = minArea / maxArea;

      // Surface type match
      const typeScore = cand.surfaceType === targetFingerprint.surfaceType ? 1.0 : 0.5;

      // Adjacency overlap score
      let adjacencyScore = 0.5;
      if (targetFingerprint.adjacentEntityIds.length > 0 && cand.adjacentEntityIds.length > 0) {
        const common = cand.adjacentEntityIds.filter((id) =>
          targetFingerprint.adjacentEntityIds.includes(id)
        ).length;
        adjacencyScore = common / Math.max(targetFingerprint.adjacentEntityIds.length, 1);
      }

      // Ancestry match
      const ancestryScore = cand.historicalFeatureId === targetFingerprint.historicalFeatureId ? 1.0 : 0.2;

      // Weighted total confidence
      const totalConfidence =
        0.35 * distanceScore +
        0.25 * normalScore +
        0.15 * sizeScore +
        0.10 * typeScore +
        0.10 * adjacencyScore +
        0.05 * ancestryScore;

      if (totalConfidence > highestScore) {
        highestScore = totalConfidence;
        bestCandidate = cand;
        minDistance = dist;

        if (ancestryScore === 1.0 && adjacencyScore > 0.5) {
          bestStrategy = 'TOPOLOGICAL_ADJACENCY';
        } else if (distanceScore > 0.8) {
          bestStrategy = 'GEOMETRIC_FINGERPRINT';
        } else {
          bestStrategy = 'HISTORICAL_ANCESTRY';
        }
      }
    }

    if (!bestCandidate || highestScore < 0.2) {
      // Fallback to first available if needed or throw clear error
      return {
        mappedEntityId: candidateFingerprints[0]?.entityId || targetFingerprint.entityId,
        confidenceScore: Math.max(0.0, highestScore),
        strategyUsed: 'HISTORICAL_ANCESTRY',
        displacementDistance: minDistance === Infinity ? 0.0 : minDistance,
      };
    }

    return {
      mappedEntityId: bestCandidate.entityId,
      confidenceScore: highestScore,
      strategyUsed: bestStrategy,
      displacementDistance: minDistance,
    };
  }
}
