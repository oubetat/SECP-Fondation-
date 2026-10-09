/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-263 — Toolpath Comparator & Geometric Deviation Engine
 * 
 * Compares Reconstructed NC Motions against original CAM Toolpath Segments.
 * Calculates Max, RMS, and Mean 3D spatial deviations, detects missing toolpath
 * segments, and identifies unexpected or dangerous extra motions.
 */

import { Vector3D } from '../../cadKernel';
import { ToolpathSegment } from '../ToolpathTypes';
import { NCSourceMap } from '../post-processor/PostTypes';
import { MachineMotionSequence, ToolpathDeviationReport, ToolpathDeviationPoint, VerificationIssue, VerificationTolerances, DEFAULT_VERIFICATION_TOLERANCES } from './GCodeVerificationTypes';

export class ToolpathComparator {
  /**
   * Compare reconstructed NC motion sequence with reference CAM toolpath segments
   */
  public static compareToolpaths(
    motion: MachineMotionSequence,
    referenceSegments?: ToolpathSegment[],
    sourceMap?: NCSourceMap,
    tolerances: VerificationTolerances = DEFAULT_VERIFICATION_TOLERANCES
  ): { report: ToolpathDeviationReport; issues: VerificationIssue[] } {
    const issues: VerificationIssue[] = [];
    let issueCounter = 1;

    const deviations: ToolpathDeviationPoint[] = [];
    let maxDev = 0;
    let maxDevStep = 0;
    let maxDevLine = 0;
    let sumDev = 0;
    let sumSqDev = 0;

    const cuttingNcSteps = motion.steps.filter(s => s.isCutting);

    if (!referenceSegments || referenceSegments.length === 0) {
      return {
        report: {
          comparedPointsCount: 0,
          maxDeviationMm: 0,
          maxDeviationStepIndex: 0,
          maxDeviationLine: 0,
          meanDeviationMm: 0,
          rmsDeviationMm: 0,
          isWithinTolerance: true,
          toleranceMm: tolerances.maxAllowedToolpathDeviationMm,
          unmatchedToolpathSegmentsCount: 0,
          unmatchedNcMotionCount: 0,
          deviations: []
        },
        issues
      };
    }

    const matchedSegmentIds = new Set<string>();

    // 1. Point-to-Point and Point-to-Segment Geometric Comparison
    for (let i = 0; i < cuttingNcSteps.length; i++) {
      const step = cuttingNcSteps[i];
      const ncPt: Vector3D = {
        x: step.endPoint.x,
        y: step.endPoint.y,
        z: step.endPoint.z
      };

      // Try source map first if available
      let matchedRefPt: Vector3D | null = null;
      let matchedRefSegId: string | undefined;

      if (sourceMap && step.lineIndex < sourceMap.entries.length) {
        const entry = sourceMap.entries[step.lineIndex];
        if (entry && entry.sourceToolpathSegmentId) {
          const seg = referenceSegments.find(s => s.id === entry.sourceToolpathSegmentId);
          if (seg) {
            matchedRefPt = seg.endPoint;
            matchedRefSegId = seg.id;
            matchedSegmentIds.add(seg.id);
          }
        }
      }

      // Fallback: Closest toolpath segment endPoint
      if (!matchedRefPt) {
        let minDist = Infinity;
        for (const seg of referenceSegments) {
          const dist = Math.sqrt(
            Math.pow(ncPt.x - seg.endPoint.x, 2) +
            Math.pow(ncPt.y - seg.endPoint.y, 2) +
            Math.pow(ncPt.z - seg.endPoint.z, 2)
          );
          if (dist < minDist) {
            minDist = dist;
            matchedRefPt = seg.endPoint;
            matchedRefSegId = seg.id;
          }
        }
        if (matchedRefSegId) {
          matchedSegmentIds.add(matchedRefSegId);
        }
      }

      if (matchedRefPt) {
        const dev = Math.sqrt(
          Math.pow(ncPt.x - matchedRefPt.x, 2) +
          Math.pow(ncPt.y - matchedRefPt.y, 2) +
          Math.pow(ncPt.z - matchedRefPt.z, 2)
        );

        if (dev > maxDev) {
          maxDev = dev;
          maxDevStep = step.stepIndex;
          maxDevLine = step.lineIndex;
        }

        sumDev += dev;
        sumSqDev += dev * dev;

        deviations.push({
          ncStepIndex: step.stepIndex,
          lineIndex: step.lineIndex,
          toolpathSegmentId: matchedRefSegId,
          ncPosition: ncPt,
          toolpathPosition: matchedRefPt,
          deviationMm: dev
        });

        if (dev > tolerances.maxAllowedToolpathDeviationMm) {
          issues.push({
            id: `ISSUE-DEV-${issueCounter++}`,
            code: 'TOOLPATH_DEVIATION_EXCEEDED',
            severity: 'CRITICAL',
            lineIndex: step.lineIndex,
            sequenceNumber: step.sequenceNumber,
            rawGCode: step.rawText,
            actualValue: `${dev.toFixed(4)} mm`,
            expectedValue: `<= ${tolerances.maxAllowedToolpathDeviationMm.toFixed(4)} mm`,
            message: `Spatial deviation between G-Code position and CAM toolpath (${dev.toFixed(4)}mm) exceeds allowed tolerance (${tolerances.maxAllowedToolpathDeviationMm}mm).`,
            recommendation: `Check post-processor decimal formatting or arc approximation tolerance.`
          });
        }
      }
    }

    // 2. Detect Missing Motions (CAM toolpath segment has no corresponding NC motion)
    const missingSegments = referenceSegments.filter(s => !matchedSegmentIds.has(s.id));
    if (missingSegments.length > 0 && cuttingNcSteps.length < referenceSegments.length) {
      issues.push({
        id: `ISSUE-MISSING-${issueCounter++}`,
        code: 'MISSING_TOOLPATH_MOTION',
        severity: 'CRITICAL',
        lineIndex: 0,
        actualValue: `${cuttingNcSteps.length} NC cutting steps`,
        expectedValue: `${referenceSegments.length} CAM segments`,
        message: `Detected ${missingSegments.length} missing CAM toolpath segment(s) not represented in posted G-Code program.`,
        recommendation: `Ensure all CAM operations are included during post-processing.`
      });
    }

    // 3. Detect Extra Unplanned Cutting Motions
    if (cuttingNcSteps.length > referenceSegments.length + 5 && referenceSegments.length > 0) {
      issues.push({
        id: `ISSUE-EXTRA-${issueCounter++}`,
        code: 'EXTRA_DANGEROUS_MOTION',
        severity: 'WARNING',
        lineIndex: 0,
        actualValue: `${cuttingNcSteps.length} NC moves`,
        expectedValue: `${referenceSegments.length} CAM segments`,
        message: `NC program contains ${cuttingNcSteps.length - referenceSegments.length} extra cutting motions not present in source toolpath.`
      });
    }

    const comparedCount = deviations.length;
    const meanDev = comparedCount > 0 ? sumDev / comparedCount : 0;
    const rmsDev = comparedCount > 0 ? Math.sqrt(sumSqDev / comparedCount) : 0;

    const report: ToolpathDeviationReport = {
      comparedPointsCount: comparedCount,
      maxDeviationMm: maxDev,
      maxDeviationStepIndex: maxDevStep,
      maxDeviationLine: maxDevLine,
      meanDeviationMm: meanDev,
      rmsDeviationMm: rmsDev,
      isWithinTolerance: maxDev <= tolerances.maxAllowedToolpathDeviationMm,
      toleranceMm: tolerances.maxAllowedToolpathDeviationMm,
      unmatchedToolpathSegmentsCount: missingSegments.length,
      unmatchedNcMotionCount: Math.max(0, cuttingNcSteps.length - matchedSegmentIds.size),
      deviations
    };

    return { report, issues };
  }
}
