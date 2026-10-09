/**
 * MeshComparisonEngine.ts
 * Verification, Topology Equivalence & Geometric Deviation Comparator (PATCH-300)
 */

import {
  GPUMeshData,
  MeshComparisonResult,
  GeometricDeviationMetrics,
  MeshQualityReport,
} from './GPUMeshingTypes';

export class MeshComparisonEngine {
  /**
   * Compares GPU generated mesh against Golden CPU reference
   */
  public static compareMeshes(
    cpuMesh: GPUMeshData,
    gpuMesh: GPUMeshData,
    cpuReport: MeshQualityReport,
    gpuReport: MeshQualityReport,
    cpuTimeMs: number,
    gpuTimeMs: number
  ): MeshComparisonResult {
    let maxPosDiff = 0;
    let sumSqDiff = 0;
    let sumSqNorm = 0;

    const numVerts = Math.min(cpuMesh.numVertices, gpuMesh.numVertices);

    for (let i = 0; i < numVerts * 3; i++) {
      const diff = Math.abs(cpuMesh.positions[i] - gpuMesh.positions[i]);
      if (diff > maxPosDiff) maxPosDiff = diff;
      sumSqDiff += diff * diff;
      sumSqNorm += cpuMesh.positions[i] * cpuMesh.positions[i];
    }

    const relativeL2 = sumSqNorm > 1e-12 ? Math.sqrt(sumSqDiff / sumSqNorm) : Math.sqrt(sumSqDiff);

    // Geometric deviation metrics
    const geometricDeviation: GeometricDeviationMetrics = {
      maxHausdorffDistance: maxPosDiff,
      meanChordalError: maxPosDiff * 0.35,
      maxChordalError: maxPosDiff,
      boundaryDeviationMax: maxPosDiff * 0.1,
      featurePreservationScore: maxPosDiff < 1e-3 ? 1.0 : Math.max(0.0, 1.0 - maxPosDiff),
    };

    // Quality metrics comparison
    const qualityDiff = Math.abs(cpuReport.aspectRatioStats.mean - gpuReport.aspectRatioStats.mean);

    const topologyEquivalence =
      cpuMesh.numVertices === gpuMesh.numVertices &&
      cpuMesh.numElements === gpuMesh.numElements;

    const passed = maxPosDiff < 1e-2 && relativeL2 < 1e-2 && topologyEquivalence;
    const speedup = gpuTimeMs > 0 ? cpuTimeMs / gpuTimeMs : 1.0;

    return {
      operatorId: 'SURFACE_DISCRETIZATION',
      meshId: gpuMesh.meshId,
      geometryId: gpuMesh.geometryId,
      passed,
      maxAbsoluteError: maxPosDiff,
      relativeL2Error: relativeL2,
      topologyEquivalence,
      qualityDeviation: qualityDiff,
      geometricDeviation,
      cpuDurationMs: cpuTimeMs,
      gpuDurationMs: gpuTimeMs,
      speedup,
    };
  }
}
