/**
 * PATCH-SECP-057 — 057-A: CAM Geometry & Stock Model
 * Represents initial raw stock, tracks volumetric material removal per machining pass,
 * and maintains remaining stock state throughout the CAM digital thread.
 */

import { Vector3D } from '../cadKernel';
import { StockModelBounds, MaterialRemovalPassResult, CutterLocationPoint } from './ToolpathTypes';

export class CAMStockModel {
  private initialBounds: StockModelBounds;
  private currentBounds: StockModelBounds;
  private totalInitialVolumeMm3: number;
  private totalRemovedVolumeMm3: number = 0;
  private passHistory: MaterialRemovalPassResult[] = [];

  constructor(bounds: StockModelBounds) {
    this.initialBounds = { ...bounds };
    this.currentBounds = { ...bounds };
    const dx = bounds.xMax - bounds.xMin;
    const dy = bounds.yMax - bounds.yMin;
    const dz = bounds.zMax - bounds.zMin;
    this.totalInitialVolumeMm3 = dx * dy * dz;
  }

  public getInitialVolumeMm3(): number {
    return this.totalInitialVolumeMm3;
  }

  public getRemainingVolumeMm3(): number {
    return Math.max(0, this.totalInitialVolumeMm3 - this.totalRemovedVolumeMm3);
  }

  public getRemovedVolumeMm3(): number {
    return this.totalRemovedVolumeMm3;
  }

  public getCurrentBounds(): StockModelBounds {
    return { ...this.currentBounds };
  }

  /**
   * Simulates a material removal pass given cutter location points, tool diameter, and depth of cut
   */
  public simulatePass(
    passIndex: number,
    toolPoints: CutterLocationPoint[],
    toolDiameterMm: number,
    axialDepthMm: number
  ): MaterialRemovalPassResult {
    const cuttingPoints = toolPoints.filter(p => p.moveType === 'CUTTING' || p.moveType === 'ADAPTIVE_TROCHOIDAL');
    let passLengthMm = 0;

    for (let i = 1; i < cuttingPoints.length; i++) {
      const p1 = cuttingPoints[i - 1].position;
      const p2 = cuttingPoints[i].position;
      passLengthMm += Math.hypot(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z);
    }

    // Effective cut width (nominal stepover ~ 45% D)
    const effectiveWidthMm = toolDiameterMm * 0.45;
    const passVolumeMm3 = passLengthMm * effectiveWidthMm * axialDepthMm;

    this.totalRemovedVolumeMm3 += passVolumeMm3;

    // Update current stock Z bound if facing or stepdown cuts occur
    const minZInPass = Math.min(...toolPoints.map(p => p.position.z));
    if (minZInPass < this.currentBounds.zMax) {
      this.currentBounds.zMax = Math.max(this.currentBounds.zMin, minZInPass);
    }

    const remainingVolume = this.getRemainingVolumeMm3();
    const maxRemainingDepth = Math.max(0, this.currentBounds.zMax - this.initialBounds.zMin);

    const result: MaterialRemovalPassResult = {
      passIndex,
      removedVolumeMm3: Number(passVolumeMm3.toFixed(2)),
      remainingStockVolumeMm3: Number(remainingVolume.toFixed(2)),
      maxRemainingDepthMm: Number(maxRemainingDepth.toFixed(2))
    };

    this.passHistory.push(result);
    return result;
  }

  public getPassHistory(): MaterialRemovalPassResult[] {
    return [...this.passHistory];
  }
}
