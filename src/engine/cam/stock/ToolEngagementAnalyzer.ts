import { ToolPose, ToolGeometry, ToolEngagement } from './StockTypes';
import { StockModelRepresentation } from './StockRepresentation';

export class ToolEngagementAnalyzer {
  public static analyzeEngagement(
    segmentIndex: number,
    startPose: ToolPose,
    endPose: ToolPose,
    tool: ToolGeometry,
    removedVolumeMm3: number,
    stockRep: StockModelRepresentation
  ): ToolEngagement {
    // Simplified engagement analysis
    const dx = endPose.tcp.x - startPose.tcp.x;
    const dy = endPose.tcp.y - startPose.tcp.y;
    const dz = endPose.tcp.z - startPose.tcp.z;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const mrr = length > 0 ? (removedVolumeMm3 / 1000) / (length / endPose.feedRateMmMin) : 0;
    const chipLoad = endPose.spindleRpm > 0 ? endPose.feedRateMmMin / (endPose.spindleRpm * tool.fluteCount) : 0;

    return {
      segmentIndex,
      axialDepthMm: Math.abs(dz),
      radialEngagementMm: tool.diameterMm,
      engagementAngleDeg: 180,
      contactType: removedVolumeMm3 > 0 ? 'SLOTTING' : 'AIR_CUT',
      instantaneousMRR_Cm3Min: parseFloat(mrr.toFixed(3)),
      chipLoadMm: parseFloat(chipLoad.toFixed(5)),
      volumeRemovedInSegmentMm3: removedVolumeMm3
    };
  }
}
