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
import { CAMProvenanceEngine } from './CAMProvenanceEngine';
import { CanonicalDerivedArtifactBinding } from '../topology/CanonicalDerivedArtifactBinding';
import { CollisionAuthority, CanonicalCollisionInput } from '../collision-authority';
import { ExactNarrowPhaseProvider } from '../collision-authority/narrow-phase/ExactNarrowPhaseProvider';

export class ToolpathVerificationEngine {
  private static readonly MIN_SEGMENT_LENGTH_TOLERANCE = 1e-7;
  private static readonly CONTINUITY_TOLERANCE = 10.0;

  /**
   * Independently verifies a candidate toolpath trajectory.
   * Enforces fail-closed derived artifact binding against the target CAD revision.
   */
  public static async verifyToolpathAsync(
    candidate: CandidateToolpathTrajectory,
    partFloorZ: number,
    stock: StockModel,
    targetCadRevisionHash?: string,
    targetGeometryHash?: string
  ): Promise<VerifiedToolpathTrajectory> {
    const issues: VerificationIssue[] = [];

    // 0. Enforce Canonical Derived Toolpath Artifact Binding
    if (targetCadRevisionHash) {
      if (!candidate.provenance?.derivedArtifactBinding) {
        issues.push({
          pointIndex: 0,
          issueType: 'MISSING_DERIVED_BINDING',
          location: candidate.points[0]?.position || { x: 0, y: 0, z: 0 },
          description: `Toolpath trajectory for operation '${candidate.operationId}' lacks required CanonicalDerivedArtifactBinding for target revision '${targetCadRevisionHash}'.`,
          severity: 'CRITICAL'
        });
      } else {
        const verifyRes = CanonicalDerivedArtifactBinding.verifyBinding(
          candidate.provenance.derivedArtifactBinding,
          targetCadRevisionHash,
          targetGeometryHash
        );
        if (!verifyRes.isValid) {
          issues.push({
            pointIndex: 0,
            issueType: 'INVALID_DERIVED_BINDING',
            location: candidate.points[0]?.position || { x: 0, y: 0, z: 0 },
            description: `Toolpath derived artifact binding verification failed: ${verifyRes.failureReason}${verifyRes.mismatchDetails ? ` (${verifyRes.mismatchDetails})` : ''}`,
            severity: 'CRITICAL'
          });
        }
      }
    }
    
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

      // Gouge Check via CollisionAuthority
      if (pt.moveType === 'CUTTING' && pos.z < partFloorZ - 0.01) {
        const canonicalInput: CanonicalCollisionInput = {
          domain: 'CAM_MULTI_AXIS',
          coordinateFrame: 'WCS',
          units: 'MILLIMETERS',
          toleranceProfile: { linearToleranceMm: 0.005, angularToleranceDeg: 0.5, clearanceWarningMarginMm: 2.0, safeClearanceMarginMm: 0.5 },
          cadRevisionId: candidate.operationId,
          toolAssembly: { cutterDiameterMm: 10.0, fluteLengthMm: 30.0, stickoutMm: 50.0, shankDiameterMm: 10.0 },
          motionSegment: { startTcp: pos, startOrientation: { x: 0, y: 0, z: 1 }, endTcp: pos, endOrientation: { x: 0, y: 0, z: 1 }, motionType: 'CUTTING' },
          geometry: {
            tessellatedTriangles: [
              { v0: { x: -1000, y: -1000, z: partFloorZ }, v1: { x: 1000, y: -1000, z: partFloorZ }, v2: { x: 1000, y: 1000, z: partFloorZ } },
              { v0: { x: -1000, y: -1000, z: partFloorZ }, v1: { x: 1000, y: 1000, z: partFloorZ }, v2: { x: -1000, y: 1000, z: partFloorZ } }
            ]
          }
        };
        const canonicalRes = CollisionAuthority.evaluateSync(canonicalInput, ExactNarrowPhaseProvider.PROVIDER_ID);

        issues.push({
          pointIndex: idx,
          issueType: 'GOUGE_PART',
          location: pos,
          description: `Tool gouges below part floor: ${pos.z} < ${partFloorZ} (Canonical Status: ${canonicalRes.status})`,
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

    const verifiedTrajectory: VerifiedToolpathTrajectory = {
      ...candidate,
      verificationReport: report
    };

    // If valid, issue the Truth Certificate
    if (isValid) {
      const certificate = await CAMProvenanceEngine.issueTruthCertificate(
        candidate.provenance,
        candidate.operationId
      );
      console.log(`[SECP CAM] Issued Truth Certificate: ${certificate.certificateId}`);
      // In a real system, we would store this in the Evidence Ledger
    }

    return verifiedTrajectory;
  }

  private static isValidVector(v: Vector3D): boolean {
    return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
  }
}
