import { MachineAxisToolpath } from "../post/types";
import {
  ParsedNCBlock,
  ReverseTraceabilityMapping,
  TraceabilityErrorCode,
  TraceabilityMapping
} from "./types";

export interface TraceabilityReport {
  isFullyTraceable: boolean;
  coveragePercentage: number;
  orphanBlocks: TraceabilityMapping[];
  missingMotions: ReverseTraceabilityMapping[];
  unexpectedMotions: TraceabilityMapping[];
  forwardMappings: TraceabilityMapping[];
  reverseMappings: ReverseTraceabilityMapping[];
  errors: {
    code: TraceabilityErrorCode;
    lineNumber?: number;
    segmentIndex?: number;
    message: string;
  }[];
}

export class SourceTraceabilityEngine {
  /**
   * Performs bi-directional traceability analysis between source CAM trajectory and NC blocks.
   */
  public analyzeTraceability(
    sourceToolpath: MachineAxisToolpath,
    blocks: ParsedNCBlock[],
    reconstructedMotionIndices: number[]
  ): TraceabilityReport {
    const forwardMappings: TraceabilityMapping[] = [];
    const reverseMappings: ReverseTraceabilityMapping[] = [];
    const orphanBlocks: TraceabilityMapping[] = [];
    const missingMotions: ReverseTraceabilityMapping[] = [];
    const unexpectedMotions: TraceabilityMapping[] = [];
    const errors: TraceabilityReport["errors"] = [];

    const sourcePoints = sourceToolpath.points;
    let currentSrcIdx = 0;

    // Track which source points got mapped
    const mappedSourceIndices = new Set<number>();

    for (let bIdx = 0; bIdx < blocks.length; bIdx++) {
      const block = blocks[bIdx];
      if (block.isProgramDelimiter) continue;

      const hasMotionCoord = "X" in block.parameters || "Y" in block.parameters || "Z" in block.parameters;
      const isMotionG = block.words.some(w => w.letter === "G" && [0, 1, 2, 3].includes(Number(w.value)));

      if (hasMotionCoord) {
        if (currentSrcIdx < sourcePoints.length) {
          const srcPt = sourcePoints[currentSrcIdx];

          const mapping: TraceabilityMapping = {
            ncBlockLineNumber: block.lineNumber,
            ncBlockText: block.sourceText,
            sourceSegmentIndex: currentSrcIdx,
            sourceOperationId: srcPt.operationId ?? "DEFAULT_OP",
            isOrphan: false,
            isUnexpected: false,
            mappingConfidence: 1.0
          };

          forwardMappings.push(mapping);
          mappedSourceIndices.add(currentSrcIdx);
          currentSrcIdx++;
        } else {
          // Extra unexpected motion block beyond source points
          const orphanMap: TraceabilityMapping = {
            ncBlockLineNumber: block.lineNumber,
            ncBlockText: block.sourceText,
            isOrphan: true,
            isUnexpected: true,
            mappingConfidence: 0.0
          };
          forwardMappings.push(orphanMap);
          orphanBlocks.push(orphanMap);
          unexpectedMotions.push(orphanMap);
          errors.push({
            code: TraceabilityErrorCode.UNEXPECTED_MOTION,
            lineNumber: block.lineNumber,
            message: `Extra motion block at line ${block.lineNumber} ('${block.sourceText}') not found in source toolpath`
          });
        }
      } else {
        // Setup/Auxiliary block
        forwardMappings.push({
          ncBlockLineNumber: block.lineNumber,
          ncBlockText: block.sourceText,
          isOrphan: false,
          isUnexpected: false,
          mappingConfidence: 1.0
        });
      }
    }

    // Build Reverse Mappings
    for (let sIdx = 0; sIdx < sourcePoints.length; sIdx++) {
      const isMapped = mappedSourceIndices.has(sIdx);
      const revMap: ReverseTraceabilityMapping = {
        sourceSegmentIndex: sIdx,
        sourcePoint: sourcePoints[sIdx],
        correspondingNCBlocks: isMapped ? [forwardMappings.find(m => m.sourceSegmentIndex === sIdx)?.ncBlockLineNumber ?? 0] : [],
        isMissingInNC: !isMapped
      };
      reverseMappings.push(revMap);

      if (!isMapped) {
        missingMotions.push(revMap);
        errors.push({
          code: TraceabilityErrorCode.MISSING_REQUIRED_MOTION,
          segmentIndex: sIdx,
          message: `Source trajectory point #${sIdx} (${sourcePoints[sIdx].motionType}) has no corresponding NC block in G-code`
        });
      }
    }

    const coverage = sourcePoints.length > 0
      ? (mappedSourceIndices.size / sourcePoints.length) * 100
      : 100;

    const isFullyTraceable = errors.length === 0 && coverage >= 99.9;

    return {
      isFullyTraceable,
      coveragePercentage: coverage,
      orphanBlocks,
      missingMotions,
      unexpectedMotions,
      forwardMappings,
      reverseMappings,
      errors
    };
  }
}
