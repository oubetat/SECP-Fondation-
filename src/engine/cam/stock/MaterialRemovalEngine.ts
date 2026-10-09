/**
 * SECP-260 — Material Removal Engine
 * Executes toolpath segments against the volumetric stock representation,
 * tracking material removal, creating state timeline entries, and generating checkpoints.
 */

import { 
  ToolpathSegment, 
  StockState, 
  StockCheckpoint, 
  IndustrialOsTelemetryEvent,
  StockStage
} from './StockTypes';
import { StockModelRepresentation } from './StockRepresentation';
import { SweptCutterEngine } from './SweptCutterVolume';
import { ToolEngagementAnalyzer } from './ToolEngagementAnalyzer';

export class MaterialRemovalEngine {
  private stockRep: StockModelRepresentation;
  private timeline: StockState[] = [];
  private checkpoints: StockCheckpoint[] = [];
  private telemetryEvents: IndustrialOsTelemetryEvent[] = [];
  private totalRemovedVolMm3: number = 0;
  private airCutCount: number = 0;
  private overcutCount: number = 0;

  constructor(stockRep: StockModelRepresentation) {
    this.stockRep = stockRep;
    this.recordInitialState();
  }

  private recordInitialState(): void {
    const initVol = this.stockRep.getInitialVolumeMm3();
    const initState: StockState = {
      stateId: 'STK-INIT-000',
      timestamp: Date.now(),
      segmentIndex: -1,
      stage: 'INITIAL',
      removedVolumeMm3: 0,
      remainingVolumeMm3: initVol,
      initialVolumeMm3: initVol,
      percentRemoved: 0,
      engagement: {
        segmentIndex: -1,
        axialDepthMm: 0,
        radialEngagementMm: 0,
        engagementAngleDeg: 0,
        contactType: 'AIR_CUT',
        instantaneousMRR_Cm3Min: 0,
        chipLoadMm: 0,
        volumeRemovedInSegmentMm3: 0
      },
      stockHash: `STK-${initVol.toFixed(1)}`
    };

    this.timeline.push(initState);
    this.checkpoints.push({
      checkpointId: 'CHK-000-INIT',
      segmentIndex: -1,
      stage: 'INITIAL',
      timestamp: Date.now(),
      state: initState,
      gridSnapshotRef: 'INIT_RAW_STOCK'
    });

    this.emitTelemetry('STOCK_INITIALIZED', {
      initialVolumeMm3: initVol,
      bounds: this.stockRep.bounds
    });
  }

  /**
   * Simulates cutting along a single toolpath segment
   */
  public simulateSegment(segment: ToolpathSegment, checkpointInterval: number = 10): StockState {
    // 1. Calculate swept volume envelope
    const sweptVolume = SweptCutterEngine.computeSweptVolume(
      segment.segmentIndex,
      segment.startPose,
      segment.endPose,
      segment.tool
    );

    // 2. Carve swept volume from active stock representation
    const carveResult = this.stockRep.carveSweptCutter(sweptVolume);
    this.totalRemovedVolMm3 += carveResult.removedVolumeMm3;

    if (carveResult.isAirCut) {
      this.airCutCount++;
      this.emitTelemetry('AIR_CUT_DETECTED', {
        segmentIndex: segment.segmentIndex,
        operation: segment.operationName
      });
    } else {
      this.emitTelemetry('MATERIAL_REMOVED', {
        segmentIndex: segment.segmentIndex,
        removedVolumeMm3: carveResult.removedVolumeMm3,
        totalRemovedMm3: this.totalRemovedVolMm3
      });
    }

    // 3. Analyze tool engagement & MRR
    const engagement = ToolEngagementAnalyzer.analyzeEngagement(
      segment.segmentIndex,
      segment.startPose,
      segment.endPose,
      segment.tool,
      carveResult.removedVolumeMm3,
      this.stockRep
    );

    // 4. Create state record
    const initVol = this.stockRep.getInitialVolumeMm3();
    const remainingVol = this.stockRep.getRemainingVolumeMm3();
    const percentRemoved = initVol > 0 ? (this.totalRemovedVolMm3 / initVol) * 100 : 0;

    const state: StockState = {
      stateId: `STK-SEG-${segment.segmentIndex}`,
      timestamp: Date.now(),
      segmentIndex: segment.segmentIndex,
      stage: segment.stage,
      removedVolumeMm3: Math.round(this.totalRemovedVolMm3 * 100) / 100,
      remainingVolumeMm3: Math.round(remainingVol * 100) / 100,
      initialVolumeMm3: Math.round(initVol * 100) / 100,
      percentRemoved: Math.round(percentRemoved * 100) / 100,
      engagement,
      stockHash: `STK-${remainingVol.toFixed(1)}-SEG${segment.segmentIndex}`
    };

    this.timeline.push(state);

    // 5. Create Checkpoint if interval reached or stage transition
    const prevStage = this.timeline.length > 1 ? this.timeline[this.timeline.length - 2].stage : 'INITIAL';
    const isStageBoundary = prevStage !== segment.stage;
    const isIntervalCheckpoint = (segment.segmentIndex + 1) % checkpointInterval === 0;

    if (isStageBoundary || isIntervalCheckpoint) {
      const chk: StockCheckpoint = {
        checkpointId: `CHK-${segment.segmentIndex}-${segment.stage}`,
        segmentIndex: segment.segmentIndex,
        stage: segment.stage,
        timestamp: Date.now(),
        state,
        gridSnapshotRef: `SNAPSHOT_SEG_${segment.segmentIndex}`
      };
      this.checkpoints.push(chk);
      this.emitTelemetry('STOCK_CHECKPOINT_CREATED', {
        checkpointId: chk.checkpointId,
        segmentIndex: segment.segmentIndex,
        remainingVol
      });
    }

    this.emitTelemetry('TOOLPATH_SEGMENT_SIMULATED', {
      segmentIndex: segment.segmentIndex,
      stage: segment.stage,
      remainingVolumeMm3: remainingVol
    });

    return state;
  }

  private emitTelemetry(type: IndustrialOsTelemetryEvent['type'], payload: Record<string, any>): void {
    this.telemetryEvents.push({
      eventId: `EVT-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      type,
      timestamp: Date.now(),
      payload
    });
  }

  public getTimeline(): StockState[] {
    return [...this.timeline];
  }

  public getCheckpoints(): StockCheckpoint[] {
    return [...this.checkpoints];
  }

  public getTelemetryEvents(): IndustrialOsTelemetryEvent[] {
    return [...this.telemetryEvents];
  }

  public getAirCutCount(): number {
    return this.airCutCount;
  }

  public getTotalRemovedVolumeMm3(): number {
    return this.totalRemovedVolMm3;
  }
}
