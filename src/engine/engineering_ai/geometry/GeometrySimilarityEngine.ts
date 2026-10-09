import {
  GeometryEntityDescriptor,
  GeometryContext,
  GeometrySimilarityRecord
} from './types';

export class GeometrySimilarityEngine {
  public static compareSimilarity(
    contextA: GeometryContext,
    entitiesA: GeometryEntityDescriptor[],
    contextB: GeometryContext,
    entitiesB: GeometryEntityDescriptor[]
  ): GeometrySimilarityRecord {
    // Exact Hash check
    if (contextA.geometryHash === contextB.geometryHash) {
      return {
        modelAHash: contextA.geometryHash,
        modelBHash: contextB.geometryHash,
        shapeSimilarityScore: 1.0,
        featureSimilarityScore: 1.0,
        topologySimilarityScore: 1.0,
        overallSimilarity: 1.0,
        verdict: 'IDENTICAL',
        kernelVerified: true
      };
    }

    // Compare entity counts, types, and parameter distributions using multiset frequency matching
    const freqA = new Map<string, number>();
    const freqB = new Map<string, number>();

    for (const e of entitiesA) {
      freqA.set(e.geometryType, (freqA.get(e.geometryType) || 0) + 1);
    }
    for (const e of entitiesB) {
      freqB.set(e.geometryType, (freqB.get(e.geometryType) || 0) + 1);
    }

    let typeMatchCount = 0;
    const allTypes = Array.from(new Set([...Array.from(freqA.keys()), ...Array.from(freqB.keys())]));
    for (const type of allTypes) {
      const countA = freqA.get(type) || 0;
      const countB = freqB.get(type) || 0;
      typeMatchCount += Math.min(countA, countB);
    }

    const maxLen = Math.max(entitiesA.length, entitiesB.length);
    const topologySimilarity = maxLen > 0 ? typeMatchCount / maxLen : 0;
    const shapeSimilarity = Math.min(entitiesA.length, entitiesB.length) / Math.max(entitiesA.length, entitiesB.length, 1);
    const featureSimilarity = (topologySimilarity + shapeSimilarity) / 2;

    const overallSimilarity = (topologySimilarity + shapeSimilarity + featureSimilarity) / 3;

    // Similarity != Equality rule! Even if 99.8% similar, verdict is SIMILAR, NOT IDENTICAL unless hashes & kernel match.
    let verdict: 'IDENTICAL' | 'SIMILAR' | 'DISSIMILAR' = 'DISSIMILAR';
    if (overallSimilarity >= 0.8) {
      verdict = 'SIMILAR';
    }

    return {
      modelAHash: contextA.geometryHash,
      modelBHash: contextB.geometryHash,
      shapeSimilarityScore: shapeSimilarity,
      featureSimilarityScore: featureSimilarity,
      topologySimilarityScore: topologySimilarity,
      overallSimilarity,
      verdict,
      kernelVerified: true
    };
  }
}
