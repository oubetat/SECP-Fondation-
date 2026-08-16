/**
 * SECP-098 — Independent Toolpath Verification Engine
 * Checks toolpaths for geometric validity, continuity, segment errors, 
 * and machining constraints.
 */

import { Vector3D } from '../cadKernel';
import { 
  CandidateToolpathTrajectory, 
  VerifiedToolpathTrajectory, 
  ToolpathVerificationReport, 
  VerificationIssue, 
  StockModel,
  VerificationFailureType
} from './ToolpathTypes';
import { generateDeterministicHash } from '../../lib/hash';

export class ToolpathVerificationEngine {
  private static readonly MIN_SEGMENT_LENGTH_TOLERANCE = 1e-7;
  private static readonly CONTINUITY_TOLERANCE = 10.0;

  /**
   * Independently verifies a candidate toolpath trajectory.
   */
  public static async verifyToolpathAsync(
    candidate: CandidateToolpathTrajectory,
    partFloorZ: number,
    stock: StockModel
  ): Promise<VerifiedToolpathTrajectory> {
    const issues: VerificationIssue[] = [];
    
    const metrics = {
      totalLengthMm: candidate.totalLengthMm,
      segmentCount: candidate.points.length,
      minSegmentLengthMm: Infinity,
      zeroLengthSegments: 0,
      continuityGaps: 0,
      maxCoordinateDeviationMm: 0,
      stockViolations: 0,
      invalidSegments: 0
    };

    // 1. Basic Continuity and Segment Validity
    for (let i = 1; i < candidate.points.length; i++) {
      const p1 = candidate.points[i - 1].position;
      const p2 = candidate.points[i].position;
      
      // NaN/Infinity Check
      if (!this.isValidVector(p1) || !this.isValidVector(p2)) {
        metrics.invalidSegments++;
        issues.push({
          pointIndex: i,
          issueType: 'INVALID_SEGMENT',
          location: p2,
          description: 'NaN or Infinity detected in coordinates.',
          severity: 'CRITICAL'
        });
        continue;
      }

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dz = p2.z - p1.z;
      const segmentLength = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (segmentLength < metrics.minSegmentLengthMm && segmentLength > 0) {
        metrics.minSegmentLengthMm = segmentLength;
      }

      // Detection of Zero-Length / Duplicate Points
      if (segmentLength < this.MIN_SEGMENT_LENGTH_TOLERANCE) {
        metrics.zeroLengthSegments++;
        issues.push({
          pointIndex: i,
          issueType: 'ZERO_LENGTH_SEGMENT',
          location: p2,
          description: `Zero-length segment detected (length: ${segmentLength.toFixed(10)}mm). Consecutive points are effectively identical.`,
          severity: 'WARNING'
        });
      }

      // Continuity Check: Must NOT use zero-length segments as proof of continuity
      // If we had a jump before this, a zero length segment here doesn't "fix" it.
      // But in a simple sequential walk, we just check each segment.
      if (segmentLength > this.CONTINUITY_TOLERANCE) {
         // This is a large jump, possibly a link move or a gap
         if (candidate.points[i].moveType === 'CUTTING') {
            metrics.continuityGaps++;
            issues.push({
              pointIndex: i,
              issueType: 'CONTINUITY_GAP',
              location: p2,
              description: `Large continuity gap in cutting move: ${segmentLength.toFixed(4)}mm`,
              severity: 'WARNING'
            });
         }
      }
    }

    // 2. Stock Boundary Compliance
    candidate.points.forEach((pt, idx) => {
      const pos = pt.position;
      if (
        pos.x < stock.bounds.xMin - 50 || pos.x > stock.bounds.xMax + 50 ||
        pos.y < stock.bounds.yMin - 50 || pos.y > stock.bounds.yMax + 50 ||
        pos.z < stock.bounds.zMin - 10 || pos.z > stock.bounds.zMax + 100
      ) {
        metrics.stockViolations++;
        issues.push({
          pointIndex: idx,
          issueType: 'STOCK_VIOLATION',
          location: pos,
          description: `Point exceeds safe stock boundary: [${pos.x}, ${pos.y}, ${pos.z}]`,
          severity: 'CRITICAL'
        });
      }

      // Gouge Check (Simplified)
      if (pt.moveType === 'CUTTING' && pos.z < partFloorZ - 0.01) {
        issues.push({
          pointIndex: idx,
          issueType: 'GOUGE_PART',
          location: pos,
          description: `Tool gouges below part floor: ${pos.z} < ${partFloorZ}`,
          severity: 'CRITICAL'
        });
      }
    });

    const isValid = issues.filter(i => i.severity === 'CRITICAL').length === 0;
    const provenanceHash = await generateDeterministicHash({
      operationId: candidate.operationId,
      metrics,
      isValid,
      trajectoryHash: candidate.provenance.trajectoryHash
    });

    const report: ToolpathVerificationReport = {
      operationId: candidate.operationId,
      isValid,
      metrics: {
        ...metrics,
        minSegmentLengthMm: metrics.minSegmentLengthMm === Infinity ? 0 : metrics.minSegmentLengthMm
      },
      issues,
      verifiedAt: new Date().toISOString(),
      provenanceHash
    };

    return {
      ...candidate,
      verificationReport: report
    };
  }

  private static isValidVector(v: Vector3D): boolean {
    return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
  }
}
