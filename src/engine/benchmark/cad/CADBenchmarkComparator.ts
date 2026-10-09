/**
 * SECP Industrial OS v2 — CAD Benchmark Battery
 * Benchmark Comparator Engine
 */

import { BenchmarkComparisonResult, BenchmarkTolerance, BenchmarkVerdict } from './types';

export class CADBenchmarkComparator {
  /**
   * Compare scalar number against oracle value
   */
  public static compareScalar(
    actual: number,
    expected: number,
    tolerance: BenchmarkTolerance
  ): BenchmarkComparisonResult {
    if (!Number.isFinite(actual) || !Number.isFinite(expected)) {
      return {
        oracleMatch: false,
        maxAbsoluteError: Math.abs(actual - expected) || 999999,
        maxRelativeError: 1.0,
        deviationDescription: `Non-finite value encountered: actual=${actual}, expected=${expected}`,
        topologyMatched: true
      };
    }

    const absError = Math.abs(actual - expected);
    const relError = expected !== 0 ? absError / Math.abs(expected) : absError;

    const geomTol = typeof tolerance === 'number' ? tolerance : (tolerance?.geometricDistanceTol ?? 1e-6);
    const relTol = typeof tolerance === 'number' ? tolerance : (tolerance?.relativeTol ?? 1e-6);

    const match = absError <= geomTol || relError <= relTol;

    return {
      oracleMatch: match,
      maxAbsoluteError: absError,
      maxRelativeError: relError,
      deviationDescription: match ? undefined : `Absolute error ${absError.toExponential(3)} exceeds tolerance ${geomTol}`,
      topologyMatched: true
    };
  }

  /**
   * Compare 3D Vector / Coordinate against oracle
   */
  public static comparePoint3D(
    actual: { x: number; y: number; z: number },
    expected: { x: number; y: number; z: number },
    tolerance: BenchmarkTolerance | number
  ): BenchmarkComparisonResult {
    if (!actual || !expected) {
      return {
        oracleMatch: false,
        maxAbsoluteError: Infinity,
        maxRelativeError: 1.0,
        deviationDescription: 'Null point encountered',
        topologyMatched: false
      };
    }

    const dx = Math.abs(actual.x - expected.x);
    const dy = Math.abs(actual.y - expected.y);
    const dz = Math.abs(actual.z - expected.z);
    const maxAbs = Math.max(dx, dy, dz);
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const geomTol = typeof tolerance === 'number' ? tolerance : (tolerance?.geometricDistanceTol ?? 1e-6);
    const match = dist <= geomTol;

    return {
      oracleMatch: match,
      maxAbsoluteError: dist,
      maxRelativeError: dist,
      deviationDescription: match ? undefined : `Point distance ${dist.toFixed(6)} exceeds geometric tolerance ${geomTol}`,
      topologyMatched: true
    };
  }

  /**
   * Compare Topology Invariants (Euler Characteristic, Manifoldness)
   */
  public static compareTopology(
    actualTopology: { eulerChar?: number; isManifold?: boolean; faceCount?: number },
    expectedTopology: { eulerChar?: number; isManifold?: boolean; faceCount?: number }
  ): BenchmarkComparisonResult {
    let matched = true;
    const reasons: string[] = [];

    if (expectedTopology.eulerChar !== undefined && actualTopology.eulerChar !== expectedTopology.eulerChar) {
      matched = false;
      reasons.push(`Euler characteristic mismatch: got ${actualTopology.eulerChar}, expected ${expectedTopology.eulerChar}`);
    }

    if (expectedTopology.isManifold !== undefined && actualTopology.isManifold !== expectedTopology.isManifold) {
      matched = false;
      reasons.push(`Manifold status mismatch: got ${actualTopology.isManifold}, expected ${expectedTopology.isManifold}`);
    }

    if (expectedTopology.faceCount !== undefined && actualTopology.faceCount !== expectedTopology.faceCount) {
      matched = false;
      reasons.push(`Face count mismatch: got ${actualTopology.faceCount}, expected ${expectedTopology.faceCount}`);
    }

    return {
      oracleMatch: matched,
      maxAbsoluteError: matched ? 0 : 1,
      maxRelativeError: matched ? 0 : 1,
      deviationDescription: reasons.length > 0 ? reasons.join('; ') : undefined,
      topologyMatched: matched
    };
  }
}
