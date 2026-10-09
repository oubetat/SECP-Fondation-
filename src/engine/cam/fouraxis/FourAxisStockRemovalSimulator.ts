/**
 * SECP Industrial OS v2 — Real CAM Kernel
 * PATCH-257 — 4-Axis Cylindrical Stock Removal Simulator & Deviation Field
 */

import { Vector3D } from '../toolpath/ToolpathTypes';
import {
  FourAxisToolpathSegment,
  FourAxisSetup,
  FourAxisStockSimulationStats,
  FourAxisOperation
} from './FourAxisTypes';
import { FourAxisKinematics } from './FourAxisKinematics';

export interface DeviationCell {
  x: number;
  angleDeg: number;
  simulatedRadiusMm: number;
  targetRadiusMm: number;
  deviationMm: number; // simulated - target (positive = excess stock, negative = gouge)
  inTolerance: boolean;
}

export interface FourAxisSimulationResult {
  stats: FourAxisStockSimulationStats;
  deviationGrid: DeviationCell[][]; // [xIndex][angleIndex]
  xSamplesCount: number;
  angleSamplesCount: number;
  xRangeMm: [number, number];
}

export class FourAxisStockRemovalSimulator {
  /**
   * Run high-fidelity cylindrical volumetric simulation of material removal along 4-axis toolpath.
   */
  public static simulateMaterialRemoval(
    segments: FourAxisToolpathSegment[],
    setup: FourAxisSetup,
    operations: FourAxisOperation[],
    xResolution: number = 40,
    angleResolution: number = 72
  ): FourAxisSimulationResult {
    const rawStockOD = setup.stockDimensions.outerDiameterMm ?? (setup.wcs.wrapRadiusMm * 2.0);
    const initialRadius = rawStockOD / 2.0;
    const stockLength = setup.stockDimensions.lengthMm;
    const xMin = 0;
    const xMax = stockLength;

    // Initial stock volume: V = PI * R^2 * L
    const initialStockVolumeMm3 = Math.PI * initialRadius * initialRadius * stockLength;

    // 1. Initialize Polar Heightfield Matrix: R_grid[xIndex][angleIndex] = initialRadius
    const rGrid: number[][] = [];
    const targetGrid: number[][] = [];
    const dx = stockLength / (xResolution - 1);
    const dThetaDeg = 360.0 / angleResolution;

    for (let ix = 0; ix < xResolution; ix++) {
      rGrid[ix] = [];
      targetGrid[ix] = [];
      const curX = xMin + ix * dx;

      for (let ia = 0; ia < angleResolution; ia++) {
        const curAngleDeg = ia * dThetaDeg;
        rGrid[ix][ia] = initialRadius;

        // Compute analytical Target Radius for deviation comparison
        // Target model: cylinder of nominal wrapRadius with machined slots & pockets
        let targetR = setup.wcs.wrapRadiusMm;

        // Check if point falls within defined operations
        for (const op of operations) {
          if (op.strategy === 'WRAPPED_SLOT') {
            const slotStartA = op.angularRangeDeg ? op.angularRangeDeg[0] : 0;
            const slotEndA = op.angularRangeDeg ? op.angularRangeDeg[1] : 360;
            const slotDepth = op.slotDepthMm ?? 4.0;
            if (curAngleDeg >= slotStartA && curAngleDeg <= slotEndA && curX >= 0 && curX <= 40) {
              targetR = Math.min(targetR, setup.wcs.wrapRadiusMm - slotDepth);
            }
          } else if (op.strategy === 'ROTARY_CONTOUR') {
            const contourDepth = op.slotDepthMm ?? 1.5;
            targetR = Math.min(targetR, setup.wcs.wrapRadiusMm - contourDepth);
          } else if (op.strategy === 'INDEXED_MACHINING') {
            const idxAngle = op.fixedIndexAngleDeg ?? 0;
            const angleDiff = Math.abs(curAngleDeg - idxAngle);
            if ((angleDiff < 15 || angleDiff > 345) && curX >= 10 && curX <= 30) {
              targetR = Math.min(targetR, setup.wcs.wrapRadiusMm - (op.slotDepthMm ?? 5.0));
            }
          }
        }

        targetGrid[ix][ia] = targetR;
      }
    }

    // 2. Perform Swept Tool Material Subtraction for each cutting segment
    let maxMrr = 0;
    let totalSimulatedTimeSec = 0;

    for (const seg of segments) {
      if (!seg.isCutting) {
        totalSimulatedTimeSec += seg.estimatedTimeSec;
        continue;
      }

      totalSimulatedTimeSec += seg.estimatedTimeSec;
      const op = operations.find(o => o.id === seg.endPoint.operationId);
      const toolRadius = (op ? op.tool.diameterMm : 10.0) / 2.0;

      // Subdivide segment for continuous swept volume subtraction
      const segSteps = Math.max(3, Math.ceil(seg.lengthMm / 1.5));
      const startPt = seg.startPoint.partContactPoint;
      const endPt = seg.endPoint.partContactPoint;
      const startAngle = seg.startPoint.rotaryAngleDeg;
      const endAngle = seg.endPoint.rotaryAngleDeg;

      let segRemovedVol = 0;

      for (let s = 0; s <= segSteps; s++) {
        const u = s / segSteps;
        const curX = startPt.x + u * (endPt.x - startPt.x);
        const curAngle = startAngle + u * (endAngle - startAngle);
        const curContactRadius = Math.hypot(
          startPt.y + u * (endPt.y - startPt.y),
          startPt.z + u * (endPt.z - startPt.z)
        );

        // Find affected grid cells around curX and curAngle
        const xCenterIdx = Math.round((curX - xMin) / dx);
        const angleCenterDeg = ((curAngle % 360) + 360) % 360;
        const aCenterIdx = Math.round(angleCenterDeg / dThetaDeg);

        const xRadiusCells = Math.ceil(toolRadius / dx) + 1;
        const aRadiusCells = Math.ceil(FourAxisKinematics.arcLengthToAngleDeg(toolRadius, Math.max(5, curContactRadius)) / dThetaDeg) + 1;

        for (let ox = -xRadiusCells; ox <= xRadiusCells; ox++) {
          const ix = xCenterIdx + ox;
          if (ix < 0 || ix >= xResolution) continue;
          const cellX = xMin + ix * dx;
          const distXMm = Math.abs(cellX - curX);
          if (distXMm > toolRadius) continue;

          for (let oa = -aRadiusCells; oa <= aRadiusCells; oa++) {
            const ia = (aCenterIdx + oa + angleResolution * 10) % angleResolution;
            const cellAngleDeg = ia * dThetaDeg;
            const angularDiffDeg = Math.abs(((cellAngleDeg - angleCenterDeg + 180) % 360 + 360) % 360 - 180);
            const distArcMm = FourAxisKinematics.angularToArcLength(angularDiffDeg, curContactRadius);

            const distFromToolCenterMm = Math.hypot(distXMm, distArcMm);
            if (distFromToolCenterMm <= toolRadius) {
              // Flat end mill bottom cutter profile
              const cutSurfaceR = curContactRadius;
              if (cutSurfaceR < rGrid[ix][ia]) {
                const prevR = rGrid[ix][ia];
                rGrid[ix][ia] = Math.max(0.1, cutSurfaceR);
                // Approximate removed volume in this cell
                const cellArcWidth = (dThetaDeg * Math.PI / 180.0) * prevR;
                segRemovedVol += dx * cellArcWidth * (prevR - rGrid[ix][ia]);
              }
            }
          }
        }
      }

      // Compute Segment MRR in mm3/min
      if (seg.estimatedTimeSec > 1e-4) {
        const segMrr = (segRemovedVol / seg.estimatedTimeSec) * 60.0;
        if (segMrr > maxMrr) maxMrr = segMrr;
      }
    }

    // 3. Compute Final Stock Volume, Deviation Field & Quality Metrics
    let finalStockVolumeMm3 = 0;
    let maxGougeMm = 0;
    let maxExcessMm = 0;
    let sumAbsDev = 0;
    let inTolCells = 0;
    const totalCells = xResolution * angleResolution;
    const toleranceBandMm = 0.050; // ±50 microns

    const deviationGrid: DeviationCell[][] = [];

    for (let ix = 0; ix < xResolution; ix++) {
      deviationGrid[ix] = [];
      const curX = xMin + ix * dx;

      for (let ia = 0; ia < angleResolution; ia++) {
        const curAngleDeg = ia * dThetaDeg;
        const simR = rGrid[ix][ia];
        const targetR = targetGrid[ix][ia];

        // Cell volume: V_cell = 0.5 * (dThetaRad) * R^2 * dx
        const cellVol = 0.5 * (dThetaDeg * Math.PI / 180.0) * simR * simR * dx;
        finalStockVolumeMm3 += cellVol;

        const devMm = simR - targetR; // positive = excess stock, negative = gouge
        const absDev = Math.abs(devMm);
        sumAbsDev += absDev;

        if (devMm < -maxGougeMm) maxGougeMm = -devMm;
        if (devMm > maxExcessMm) maxExcessMm = devMm;

        const inTol = absDev <= toleranceBandMm;
        if (inTol) inTolCells++;

        deviationGrid[ix][ia] = {
          x: curX,
          angleDeg: curAngleDeg,
          simulatedRadiusMm: simR,
          targetRadiusMm: targetR,
          deviationMm: devMm,
          inTolerance: inTol,
        };
      }
    }

    const removedVolumeMm3 = Math.max(0, initialStockVolumeMm3 - finalStockVolumeMm3);
    const materialRemovalPercentage = (removedVolumeMm3 / initialStockVolumeMm3) * 100.0;
    const meanAbsoluteDevMm = sumAbsDev / totalCells;
    const inTolPercent = (inTolCells / totalCells) * 100.0;
    const avgMrr = totalSimulatedTimeSec > 0 ? (removedVolumeMm3 / totalSimulatedTimeSec) * 60.0 : 0;

    const stats: FourAxisStockSimulationStats = {
      initialStockVolumeMm3,
      finalStockVolumeMm3,
      removedVolumeMm3,
      materialRemovalPercentage,
      maxMrrMm3Min: maxMrr,
      avgMrrMm3Min: avgMrr,
      maxGougeDeviationMm: maxGougeMm,
      maxExcessStockDeviationMm: maxExcessMm,
      meanAbsoluteDeviationMm: meanAbsoluteDevMm,
      inTolerancePercentage: inTolPercent,
      simulatedTimeSec: totalSimulatedTimeSec,
      collisionDetected: false,
      gougeDetected: maxGougeMm > toleranceBandMm,
    };

    return {
      stats,
      deviationGrid,
      xSamplesCount: xResolution,
      angleSamplesCount: angleResolution,
      xRangeMm: [xMin, xMax],
    };
  }
}
