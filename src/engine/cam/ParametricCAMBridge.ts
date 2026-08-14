/**
 * PATCH-SECP-057 — 057-J: Parametric Manufacturing Bridge
 * Establishes end-to-end digital thread traceability:
 * B-Rep Topology ID -> Manufacturing Feature ID -> Machining Operation ->
 * Candidate Toolpath -> Verification Engine -> Verified CL Data -> Cryptographic Provenance Hash.
 */

import { Vector3D } from '../cadKernel';
import { 
  MachiningOperationConfig, 
  CandidateToolpathTrajectory, 
  VerifiedToolpathTrajectory, 
  CutterLocationDataPackage,
  DigitalThreadTraceabilityNode,
  StockModelBounds
} from './ToolpathTypes';
import { CuttingToolModel } from './CuttingToolModel';
import { CAMStockModel } from './CAMStockModel';
import { ThreeAxisToolpathEngine } from './ThreeAxisToolpathEngine';
import { AdaptiveRoughingEngine } from './AdaptiveRoughingEngine';
import { FinishingToolpathEngine } from './FinishingToolpathEngine';
import { DrillingCycleEngine } from './DrillingCycleEngine';
import { MultiAxisToolpathEngine } from './MultiAxisToolpathEngine';
import { ToolpathVerificationEngine } from './ToolpathVerificationEngine';
import { CutterLocationDataEngine } from './CutterLocationDataEngine';

export class ParametricCAMBridge {
  /**
   * Executes full CAM generation pipeline with end-to-end digital thread traceability
   */
  public static async generateFullCAMThread(
    partId: string,
    topologyId: string,
    featureId: string,
    featureBounds: { xMin: number; xMax: number; yMin: number; yMax: number; bottomZ: number; topZ: number },
    stockBounds: StockModelBounds
  ): Promise<CutterLocationDataPackage> {
    const stockModel = new CAMStockModel(stockBounds);

    // 1. Tool Setup
    const endmill = CuttingToolModel.createTool(
      'tool-em-12',
      '12mm Carbide 4-Flute Endmill',
      'FLAT_ENDMILL',
      12.0,
      4,
      30.0,
      75.0,
      'CARBIDE'
    );

    const ballmill = CuttingToolModel.createTool(
      'tool-bm-08',
      '8mm Solid Carbide Ball Nose Mill',
      'BALL_NOSE',
      8.0,
      2,
      20.0,
      60.0,
      'CARBIDE'
    );

    const drill = CuttingToolModel.createTool(
      'tool-dr-08',
      '8mm Carbide Twist Drill',
      'TWIST_DRILL',
      8.0,
      2,
      40.0,
      80.0,
      'CARBIDE'
    );

    // 2. Machining Operations Definition
    const opFacing: MachiningOperationConfig = {
      operationId: 'op-01-facing',
      name: 'Top Face Cleanup',
      strategy: 'FACING',
      targetFeatureId: featureId,
      topologyId,
      tool: endmill,
      feedsAndSpeeds: {
        surfaceSpeedMMin: 180,
        feedPerToothMm: 0.1,
        spindleRpm: 4770,
        cuttingFeedMmMin: 1908,
        plungeFeedMmMin: 500,
        rapidFeedMmMin: 10000
      },
      stepoverMm: 8.0,
      stepdownMm: 2.0,
      stockToLeaveMm: 0.0,
      clearancePlaneZ: stockBounds.zMax + 20,
      retractPlaneZ: stockBounds.zMax + 5
    };

    const opRoughing: MachiningOperationConfig = {
      operationId: 'op-02-adaptive',
      name: 'Adaptive Pocket Roughing',
      strategy: 'ADAPTIVE_ROUGHING',
      targetFeatureId: featureId,
      topologyId,
      tool: endmill,
      feedsAndSpeeds: {
        surfaceSpeedMMin: 220,
        feedPerToothMm: 0.12,
        spindleRpm: 5835,
        cuttingFeedMmMin: 2800,
        plungeFeedMmMin: 600,
        rapidFeedMmMin: 10000
      },
      stepoverMm: 4.8,
      stepdownMm: 10.0,
      stockToLeaveMm: 0.5,
      clearancePlaneZ: stockBounds.zMax + 20,
      retractPlaneZ: featureBounds.topZ + 5,
      maxEngagementAngleDeg: 45
    };

    const opFinishing: MachiningOperationConfig = {
      operationId: 'op-03-finishing',
      name: '5-Axis Surface Finish Contour',
      strategy: 'FIVE_AXIS_CONTOUR',
      targetFeatureId: featureId,
      topologyId,
      tool: ballmill,
      feedsAndSpeeds: {
        surfaceSpeedMMin: 250,
        feedPerToothMm: 0.08,
        spindleRpm: 9947,
        cuttingFeedMmMin: 1590,
        plungeFeedMmMin: 400,
        rapidFeedMmMin: 10000
      },
      stepoverMm: 0.8,
      stepdownMm: 0.8,
      stockToLeaveMm: 0.0,
      clearancePlaneZ: stockBounds.zMax + 20,
      retractPlaneZ: featureBounds.topZ + 5
    };

    const opDrilling: MachiningOperationConfig = {
      operationId: 'op-04-drilling',
      name: 'Peck Drilling Bore',
      strategy: 'DRILLING_PECK',
      targetFeatureId: featureId,
      topologyId,
      tool: drill,
      feedsAndSpeeds: {
        surfaceSpeedMMin: 90,
        feedPerToothMm: 0.08,
        spindleRpm: 3580,
        cuttingFeedMmMin: 572,
        plungeFeedMmMin: 572,
        rapidFeedMmMin: 10000
      },
      stepoverMm: 8.0,
      stepdownMm: 3.0,
      stockToLeaveMm: 0.0,
      clearancePlaneZ: stockBounds.zMax + 20,
      retractPlaneZ: featureBounds.topZ + 5
    };

    // 3. Generate Candidate Toolpaths
    const candFacing = ThreeAxisToolpathEngine.generateFacingCandidate(opFacing, {
      xMin: stockBounds.xMin,
      xMax: stockBounds.xMax,
      yMin: stockBounds.yMin,
      yMax: stockBounds.yMax,
      stockTopZ: stockBounds.zMax,
      targetTopZ: featureBounds.topZ
    });

    const candRoughing = AdaptiveRoughingEngine.generateAdaptiveRoughing(
      opRoughing,
      featureBounds,
      stockModel
    );

    const surfacePath = Array.from({ length: 20 }, (_, i) => {
      const frac = i / 19;
      const x = featureBounds.xMin + frac * (featureBounds.xMax - featureBounds.xMin);
      const y = (featureBounds.yMin + featureBounds.yMax) / 2;
      const z = featureBounds.bottomZ + Math.sin(frac * Math.PI) * 5;
      return {
        position: { x, y, z },
        normal: { x: 0, y: Math.sin(frac * Math.PI * 0.2), z: Math.cos(frac * Math.PI * 0.2) }
      };
    });

    const candFinishing = MultiAxisToolpathEngine.generateFiveAxisContourCandidate(
      opFinishing,
      surfacePath,
      5.0,
      0.0
    );

    const candDrilling = DrillingCycleEngine.generatePeckDrillingCandidate(opDrilling, {
      x: (featureBounds.xMin + featureBounds.xMax) / 2,
      y: (featureBounds.yMin + featureBounds.yMax) / 2,
      topZ: featureBounds.topZ,
      depthMm: featureBounds.topZ - featureBounds.bottomZ,
      peckIncrementMm: 3.0
    });

    // 4. Independent Verification Step for all candidate toolpaths
    const verifiedFacing = ToolpathVerificationEngine.verifyToolpath(candFacing, featureBounds.topZ, stockBounds);
    const verifiedRoughing = ToolpathVerificationEngine.verifyToolpath(candRoughing, featureBounds.bottomZ, stockBounds);
    const verifiedFinishing = ToolpathVerificationEngine.verifyToolpath(candFinishing, featureBounds.bottomZ, stockBounds);
    const verifiedDrilling = ToolpathVerificationEngine.verifyToolpath(candDrilling, featureBounds.bottomZ, stockBounds);

    const verifiedTrajectories: VerifiedToolpathTrajectory[] = [
      verifiedFacing,
      verifiedRoughing,
      verifiedFinishing,
      verifiedDrilling
    ];

    const operations = [opFacing, opRoughing, opFinishing, opDrilling];

    // 5. Digital Thread Traceability Link
    const traceabilityNodes: DigitalThreadTraceabilityNode[] = operations.map((op, idx) => ({
      topologyId,
      manufacturingFeatureId: featureId,
      operationId: op.operationId,
      candidateToolpathId: verifiedTrajectories[idx].operationId,
      verifiedClPackageHash: `CL-NODE-${idx + 1}`,
      provenanceSignature: `SECP-057-THREAD-${topologyId}-${featureId}`
    }));

    // 6. Construct Final CL Data Package with Cryptographic Provenance Hash
    return await CutterLocationDataEngine.createCLPackage(
      partId,
      operations,
      verifiedTrajectories,
      traceabilityNodes
    );
  }
}
