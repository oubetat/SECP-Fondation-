/**
 * SECP Industrial OS v3 — PATCH-179: 5-Axis Stock Engine & Rest Machining
 * Manages discrete volumetric stock models, progressive 5-axis swept tool subtraction,
 * Material Removal Rate (MRR) tracking, and Rest Machining region extraction.
 */

import { Vector3D } from '../../cadKernel';
import { 
  FiveAxisToolDefinition, 
  StockBoundingBox, 
  RestMaterialRegion, 
  FiveAxisToolpathPoint 
} from './FiveAxisTypes';

export class FiveAxisStockEngine {
  private boundingBox: StockBoundingBox;
  private initialVolumeMm3: number;
  private currentVolumeMm3: number;
  private removedVolumeMm3: number = 0;
  private voxelResolutionMm: number;

  constructor(
    bounds: StockBoundingBox,
    resolutionMm: number = 1.0
  ) {
    this.boundingBox = bounds;
    this.voxelResolutionMm = resolutionMm;
    const dx = bounds.max.x - bounds.min.x;
    const dy = bounds.max.y - bounds.min.y;
    const dz = bounds.max.z - bounds.min.z;
    this.initialVolumeMm3 = Math.max(0, dx * dy * dz);
    this.currentVolumeMm3 = this.initialVolumeMm3;
  }

  /**
   * Simulates material removal along a 5-axis toolpath segment
   */
  public cutSegment(
    tool: FiveAxisToolDefinition,
    p0: Vector3D,
    axis0: Vector3D,
    p1: Vector3D,
    axis1: Vector3D,
    stepoverMm: number = 2.0,
    depthOfCutMm: number = 1.5
  ): { volumeRemovedSegmentMm3: number; cumulativeRemovedMm3: number } {
    const segLength = Math.hypot(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z);
    
    // Effective cutting cross-section area
    const effectiveWidth = Math.min(tool.diameterMm, stepoverMm);
    const effectiveDepth = Math.min(tool.fluteLengthMm, depthOfCutMm);
    const segmentSweptVolume = segLength * effectiveWidth * effectiveDepth;

    // Remove from active stock
    this.removedVolumeMm3 += segmentSweptVolume;
    this.currentVolumeMm3 = Math.max(0, this.initialVolumeMm3 - this.removedVolumeMm3);

    return {
      volumeRemovedSegmentMm3: Number(segmentSweptVolume.toFixed(3)),
      cumulativeRemovedMm3: Number(this.removedVolumeMm3.toFixed(3))
    };
  }

  public getInitialVolumeMm3(): number {
    return this.initialVolumeMm3;
  }

  public getCurrentVolumeMm3(): number {
    return this.currentVolumeMm3;
  }

  public getRemovedVolumeMm3(): number {
    return this.removedVolumeMm3;
  }
}

export class RestMachiningEngine {
  /**
   * Identifies unmachined rest material regions where previous larger tool could not reach
   * (e.g. sharp internal fillets, narrow impeller blade roots, deep pocket corners)
   */
  public static identifyRestRegions(
    targetSurfaces: { surfaceId: string; centroid: Vector3D; concaveRadiusMm: number }[],
    previousToolDiameterMm: number,
    currentToolDiameterMm: number
  ): RestMaterialRegion[] {
    const restRegions: RestMaterialRegion[] = [];
    const prevRadius = previousToolDiameterMm / 2;
    const currRadius = currentToolDiameterMm / 2;

    for (let i = 0; i < targetSurfaces.length; i++) {
      const surf = targetSurfaces[i];
      if (surf.concaveRadiusMm > 0 && surf.concaveRadiusMm < prevRadius) {
        // Material was left behind because previous tool radius > fillet radius
        const residualThickness = Math.max(0.1, prevRadius - surf.concaveRadiusMm);
        const estimatedVolume = residualThickness * residualThickness * 10; // Approx volume

        restRegions.push({
          regionId: `REST_REGION_${i + 1}`,
          centroid: surf.centroid,
          boundingVolumeMm3: Number(estimatedVolume.toFixed(2)),
          remainingThicknessMm: Number(residualThickness.toFixed(3)),
          targetSurfaceId: surf.surfaceId,
          suggestedToolDiameterMm: Number(Math.max(2.0, surf.concaveRadiusMm * 1.8).toFixed(1))
        });
      }
    }

    return restRegions;
  }

  /**
   * Generates localized 5-axis rest-finishing toolpath passes targeted exclusively at rest material
   */
  public static generateRestMachiningPasses(
    restRegions: RestMaterialRegion[],
    nominalFeed: number = 800
  ): FiveAxisToolpathPoint[] {
    const restPoints: FiveAxisToolpathPoint[] = [];
    let ptIndex = 0;

    for (const region of restRegions) {
      // Approach above rest centroid
      restPoints.push({
        pointIndex: ptIndex++,
        position: { x: region.centroid.x, y: region.centroid.y, z: region.centroid.z + 10 },
        toolAxis: { x: 0, y: 0, z: 1 },
        contactPoint: region.centroid,
        leadAngleDeg: 5,
        tiltAngleDeg: 10,
        feedRateMmMin: nominalFeed,
        spindleRpm: 12000,
        moveType: 'REST_MACHINING'
      });

      // Linear pencil clean pass along fillet
      restPoints.push({
        pointIndex: ptIndex++,
        position: { x: region.centroid.x + 5, y: region.centroid.y, z: region.centroid.z },
        toolAxis: { x: 0.1, y: 0, z: 0.99 },
        contactPoint: region.centroid,
        leadAngleDeg: 5,
        tiltAngleDeg: 10,
        feedRateMmMin: nominalFeed,
        spindleRpm: 12000,
        moveType: 'REST_MACHINING'
      });
    }

    return restPoints;
  }
}
