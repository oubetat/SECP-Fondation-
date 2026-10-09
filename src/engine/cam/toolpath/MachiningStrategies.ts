/**
 * SECP Industrial OS v2 — CAM Production Engine
 * PATCH-256 — Machining Strategies Implementation
 */

import {
  Vector3D,
  CuttingTool,
  CuttingParameters,
  ToolPosition,
  ToolpathSegment,
  MotionType,
  EntryStrategyType,
  MachiningBoundary,
  CoolantState,
} from './ToolpathTypes';

export class MachiningStrategies {
  /**
   * 1. FACING STRATEGY: Clears workpiece top surface with zigzag/one-way raster and smooth lead-in/out
   */
  public static generateFacingToolpath(
    stockBounds: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number },
    targetZ: number,
    tool: CuttingTool,
    params: CuttingParameters,
    safeZ: number = stockBounds.maxZ + 5.0,
    retractZ: number = stockBounds.maxZ + 2.0
  ): ToolPosition[] {
    const positions: ToolPosition[] = [];
    const radius = tool.diameterMm / 2;
    const stepover = params.stepoverMm;

    // Overhang by 1.1x tool radius to ensure full cleanup without leaving burrs
    const startX = stockBounds.minX - radius * 1.1;
    const endX = stockBounds.maxX + radius * 1.1;
    const startY = stockBounds.minY + radius * 0.2;
    const endY = stockBounds.maxY - radius * 0.2;

    let segmentIdx = 0;

    // Initial positioning at Safe Plane
    positions.push({
      x: startX,
      y: startY,
      z: safeZ,
      feedMmMin: params.rapidFeedMmMin,
      spindleRpm: params.spindleRpm,
      motionType: MotionType.RAPID,
      coolant: params.coolant,
      segmentIndex: segmentIdx++,
    });

    // Move down to Retract Plane
    positions.push({
      x: startX,
      y: startY,
      z: retractZ,
      feedMmMin: params.rapidFeedMmMin,
      spindleRpm: params.spindleRpm,
      motionType: MotionType.RAPID,
      coolant: params.coolant,
      segmentIndex: segmentIdx++,
    });

    // Plunge down to Target Z
    positions.push({
      x: startX,
      y: startY,
      z: targetZ,
      feedMmMin: params.plungeFeedMmMin,
      spindleRpm: params.spindleRpm,
      motionType: MotionType.PLUNGE,
      coolant: params.coolant,
      segmentIndex: segmentIdx++,
    });

    let currentY = startY;
    let direction = 1; // 1: Left-to-Right, -1: Right-to-Left

    while (currentY <= endY + stepover * 0.5) {
      const currentStartX = direction === 1 ? startX : endX;
      const currentEndX = direction === 1 ? endX : startX;

      // Linear Cutting Pass
      positions.push({
        x: currentEndX,
        y: currentY,
        z: targetZ,
        feedMmMin: params.cuttingFeedMmMin,
        spindleRpm: params.spindleRpm,
        motionType: MotionType.FEED,
        coolant: params.coolant,
        segmentIndex: segmentIdx++,
      });

      currentY += stepover;
      if (currentY <= endY + stepover * 0.5) {
        // Stepover connection move (Smooth 180° arc or direct feed transition)
        positions.push({
          x: currentEndX,
          y: Math.min(currentY, endY + radius * 0.5),
          z: targetZ,
          feedMmMin: params.cuttingFeedMmMin,
          spindleRpm: params.spindleRpm,
          motionType: MotionType.FEED,
          coolant: params.coolant,
          segmentIndex: segmentIdx++,
        });
      }
      direction *= -1;
    }

    // Final Retract
    const lastPos = positions[positions.length - 1];
    positions.push({
      x: lastPos.x,
      y: lastPos.y,
      z: retractZ,
      feedMmMin: params.rapidFeedMmMin,
      spindleRpm: params.spindleRpm,
      motionType: MotionType.RETRACT,
      coolant: params.coolant,
      segmentIndex: segmentIdx++,
    });

    positions.push({
      x: lastPos.x,
      y: lastPos.y,
      z: safeZ,
      feedMmMin: params.rapidFeedMmMin,
      spindleRpm: params.spindleRpm,
      motionType: MotionType.RAPID,
      coolant: CoolantState.OFF,
      segmentIndex: segmentIdx++,
    });

    return positions;
  }

  /**
   * 2. POCKET MILLING STRATEGY: Multi-Z level roughing with Helical/Ramp entry and offset clearing
   */
  public static generatePocketToolpath(
    pocketBoundary: { minX: number; maxX: number; minY: number; maxY: number; topZ: number; floorZ: number },
    tool: CuttingTool,
    params: CuttingParameters,
    safeZ: number = pocketBoundary.topZ + 5.0,
    retractZ: number = pocketBoundary.topZ + 2.0
  ): ToolPosition[] {
    const positions: ToolPosition[] = [];
    const toolRadius = tool.diameterMm / 2;
    const stepover = params.stepoverMm;
    const stepdown = Math.max(0.2, params.stepdownMm);
    const totalDepth = pocketBoundary.topZ - pocketBoundary.floorZ;

    // Pocket inner machining boundary accounting for tool radius and wall stock
    const innerMinX = pocketBoundary.minX + toolRadius + params.stockToLeaveWallMm;
    const innerMaxX = pocketBoundary.maxX - toolRadius - params.stockToLeaveWallMm;
    const innerMinY = pocketBoundary.minY + toolRadius + params.stockToLeaveWallMm;
    const innerMaxY = pocketBoundary.maxY - toolRadius - params.stockToLeaveWallMm;

    if (innerMaxX <= innerMinX || innerMaxY <= innerMinY) {
      // Tool too large for pocket!
      return [];
    }

    let segmentIdx = 0;
    const centerX = (innerMinX + innerMaxX) / 2;
    const centerY = (innerMinY + innerMaxY) / 2;

    // Initial safe approach
    positions.push({
      x: centerX,
      y: centerY,
      z: safeZ,
      feedMmMin: params.rapidFeedMmMin,
      spindleRpm: params.spindleRpm,
      motionType: MotionType.RAPID,
      coolant: params.coolant,
      segmentIndex: segmentIdx++,
    });

    let currentZ = pocketBoundary.topZ;

    // Multi-Z Stepdown Loop
    while (currentZ > pocketBoundary.floorZ + 1e-4) {
      const nextZ = Math.max(pocketBoundary.floorZ, currentZ - stepdown);

      // Entry Strategy: HELIX or RAMP or PLUNGE
      if (params.entryStrategy === EntryStrategyType.HELIX) {
        const helixR = Math.min(params.helixRadiusMm || 2.0, (innerMaxX - innerMinX) * 0.25);
        const pitch = params.helixPitchMm || 1.5;
        const helixTurns = Math.max(1, Math.ceil((currentZ - nextZ) / pitch));

        for (let turn = 0; turn < helixTurns; turn++) {
          const zStart = currentZ - (turn * (currentZ - nextZ)) / helixTurns;
          const zEnd = currentZ - ((turn + 1) * (currentZ - nextZ)) / helixTurns;

          // Approximate circular helical move with 8 chordal points per turn
          for (let step = 0; step <= 8; step++) {
            const angle = (step / 8) * 2 * Math.PI;
            const hx = centerX + helixR * Math.cos(angle);
            const hy = centerY + helixR * Math.sin(angle);
            const hz = zStart + (zEnd - zStart) * (step / 8);

            positions.push({
              x: hx,
              y: hy,
              z: hz,
              feedMmMin: params.rampFeedMmMin,
              spindleRpm: params.spindleRpm,
              motionType: MotionType.HELIX,
              coolant: params.coolant,
              segmentIndex: segmentIdx++,
            });
          }
        }
      } else {
        // Direct Plunge to level
        positions.push({
          x: centerX,
          y: centerY,
          z: nextZ,
          feedMmMin: params.plungeFeedMmMin,
          spindleRpm: params.spindleRpm,
          motionType: MotionType.PLUNGE,
          coolant: params.coolant,
          segmentIndex: segmentIdx++,
        });
      }

      // Spiral Outward / Concentric Offset Clearing at nextZ
      let curOffset = stepover;
      const maxOffset = Math.max(centerX - innerMinX, centerY - innerMinY);

      while (curOffset <= maxOffset + stepover) {
        const x0 = Math.max(innerMinX, centerX - curOffset);
        const x1 = Math.min(innerMaxX, centerX + curOffset);
        const y0 = Math.max(innerMinY, centerY - curOffset);
        const y1 = Math.min(innerMaxY, centerY + curOffset);

        // Rectangular loop
        positions.push({ x: x0, y: y0, z: nextZ, feedMmMin: params.cuttingFeedMmMin, spindleRpm: params.spindleRpm, motionType: MotionType.FEED, coolant: params.coolant, segmentIndex: segmentIdx++ });
        positions.push({ x: x1, y: y0, z: nextZ, feedMmMin: params.cuttingFeedMmMin, spindleRpm: params.spindleRpm, motionType: MotionType.FEED, coolant: params.coolant, segmentIndex: segmentIdx++ });
        positions.push({ x: x1, y: y1, z: nextZ, feedMmMin: params.cuttingFeedMmMin, spindleRpm: params.spindleRpm, motionType: MotionType.FEED, coolant: params.coolant, segmentIndex: segmentIdx++ });
        positions.push({ x: x0, y: y1, z: nextZ, feedMmMin: params.cuttingFeedMmMin, spindleRpm: params.spindleRpm, motionType: MotionType.FEED, coolant: params.coolant, segmentIndex: segmentIdx++ });
        positions.push({ x: x0, y: y0, z: nextZ, feedMmMin: params.cuttingFeedMmMin, spindleRpm: params.spindleRpm, motionType: MotionType.FEED, coolant: params.coolant, segmentIndex: segmentIdx++ });

        curOffset += stepover;
      }

      // Transition to next Z
      currentZ = nextZ;
    }

    // Final Retract
    const last = positions[positions.length - 1];
    positions.push({
      x: last.x,
      y: last.y,
      z: retractZ,
      feedMmMin: params.rapidFeedMmMin,
      spindleRpm: params.spindleRpm,
      motionType: MotionType.RETRACT,
      coolant: params.coolant,
      segmentIndex: segmentIdx++,
    });

    positions.push({
      x: last.x,
      y: last.y,
      z: safeZ,
      feedMmMin: params.rapidFeedMmMin,
      spindleRpm: params.spindleRpm,
      motionType: MotionType.RAPID,
      coolant: CoolantState.OFF,
      segmentIndex: segmentIdx++,
    });

    return positions;
  }

  /**
   * 3b. CONTOUR FINISHING STRATEGY: Pocket/Feature Wall perimeter finishing passes
   */
  public static generateContourFinishingToolpath(
    bounds: { minX: number; maxX: number; minY: number; maxY: number; topZ: number; floorZ: number },
    tool: CuttingTool,
    params: CuttingParameters,
    safeZ: number = bounds.topZ + 5.0,
    retractZ: number = bounds.topZ + 2.0
  ): ToolPosition[] {
    const profile = [
      { x: bounds.minX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.maxY },
      { x: bounds.minX, y: bounds.maxY },
      { x: bounds.minX, y: bounds.minY }
    ];
    return this.generateContourToolpath(
      profile,
      bounds.topZ,
      bounds.floorZ,
      tool,
      params,
      false,
      safeZ,
      retractZ
    );
  }

  /**
   * 3. CONTOUR MILLING STRATEGY: External or Internal profile with radius compensation & multiple depth passes
   */
  public static generateContourToolpath(
    profilePoints: { x: number; y: number }[],
    topZ: number,
    bottomZ: number,
    tool: CuttingTool,
    params: CuttingParameters,
    isExternal: boolean = true,
    safeZ: number = topZ + 5.0,
    retractZ: number = topZ + 2.0
  ): ToolPosition[] {
    const positions: ToolPosition[] = [];
    if (profilePoints.length < 3) return positions;

    const toolRadius = tool.diameterMm / 2;
    const offsetDistance = isExternal ? toolRadius : -toolRadius;
    const stepdown = Math.max(0.5, params.stepdownMm);
    let segmentIdx = 0;

    // Offset contour points normal to edges
    const offsetPath: { x: number; y: number }[] = [];
    const n = profilePoints.length;

    for (let i = 0; i < n; i++) {
      const pPrev = profilePoints[(i - 1 + n) % n];
      const pCurr = profilePoints[i];
      const pNext = profilePoints[(i + 1) % n];

      const dx1 = pCurr.x - pPrev.x;
      const dy1 = pCurr.y - pPrev.y;
      const len1 = Math.hypot(dx1, dy1) || 1;
      const nx1 = -dy1 / len1;
      const ny1 = dx1 / len1;

      const dx2 = pNext.x - pCurr.x;
      const dy2 = pNext.y - pCurr.y;
      const len2 = Math.hypot(dx2, dy2) || 1;
      const nx2 = -dy2 / len2;
      const ny2 = dx2 / len2;

      const avgNx = (nx1 + nx2) / 2;
      const avgNy = (ny1 + ny2) / 2;
      const avgLen = Math.hypot(avgNx, avgNy) || 1;

      offsetPath.push({
        x: pCurr.x + (avgNx / avgLen) * offsetDistance,
        y: pCurr.y + (avgNy / avgLen) * offsetDistance,
      });
    }

    const startPt = offsetPath[0];

    // Safe approach
    positions.push({
      x: startPt.x,
      y: startPt.y,
      z: safeZ,
      feedMmMin: params.rapidFeedMmMin,
      spindleRpm: params.spindleRpm,
      motionType: MotionType.RAPID,
      coolant: params.coolant,
      segmentIndex: segmentIdx++,
    });

    let currentZ = topZ;
    while (currentZ > bottomZ + 1e-4) {
      const nextZ = Math.max(bottomZ, currentZ - stepdown);

      // Plunge to next Z
      positions.push({
        x: startPt.x,
        y: startPt.y,
        z: nextZ,
        feedMmMin: params.plungeFeedMmMin,
        spindleRpm: params.spindleRpm,
        motionType: MotionType.PLUNGE,
        coolant: params.coolant,
        segmentIndex: segmentIdx++,
      });

      // Follow full contour loop
      for (let i = 1; i < offsetPath.length; i++) {
        positions.push({
          x: offsetPath[i].x,
          y: offsetPath[i].y,
          z: nextZ,
          feedMmMin: params.cuttingFeedMmMin,
          spindleRpm: params.spindleRpm,
          motionType: MotionType.FEED,
          coolant: params.coolant,
          segmentIndex: segmentIdx++,
        });
      }

      // Close the loop
      positions.push({
        x: startPt.x,
        y: startPt.y,
        z: nextZ,
        feedMmMin: params.cuttingFeedMmMin,
        spindleRpm: params.spindleRpm,
        motionType: MotionType.FEED,
        coolant: params.coolant,
        segmentIndex: segmentIdx++,
      });

      currentZ = nextZ;
    }

    // Retract
    positions.push({
      x: startPt.x,
      y: startPt.y,
      z: retractZ,
      feedMmMin: params.rapidFeedMmMin,
      spindleRpm: params.spindleRpm,
      motionType: MotionType.RETRACT,
      coolant: params.coolant,
      segmentIndex: segmentIdx++,
    });

    positions.push({
      x: startPt.x,
      y: startPt.y,
      z: safeZ,
      feedMmMin: params.rapidFeedMmMin,
      spindleRpm: params.spindleRpm,
      motionType: MotionType.RAPID,
      coolant: CoolantState.OFF,
      segmentIndex: segmentIdx++,
    });

    return positions;
  }

  /**
   * 4. HOLE DRILLING STRATEGY: Spot drill & G83 Peck Drilling with chip clearing
   */
  public static generateDrillingToolpath(
    holeCenter: { x: number; y: number },
    topZ: number,
    depthMm: number,
    tool: CuttingTool,
    params: CuttingParameters,
    isPeckDrilling: boolean = true,
    peckDepthMm: number = 2.5,
    safeZ: number = topZ + 5.0,
    retractZ: number = topZ + 2.0
  ): ToolPosition[] {
    const positions: ToolPosition[] = [];
    const targetBottomZ = topZ - depthMm;
    let segmentIdx = 0;

    // Rapid to hole center at safe plane
    positions.push({
      x: holeCenter.x,
      y: holeCenter.y,
      z: safeZ,
      feedMmMin: params.rapidFeedMmMin,
      spindleRpm: params.spindleRpm,
      motionType: MotionType.RAPID,
      coolant: params.coolant,
      segmentIndex: segmentIdx++,
    });

    // Rapid to retract plane
    positions.push({
      x: holeCenter.x,
      y: holeCenter.y,
      z: retractZ,
      feedMmMin: params.rapidFeedMmMin,
      spindleRpm: params.spindleRpm,
      motionType: MotionType.RAPID,
      coolant: params.coolant,
      segmentIndex: segmentIdx++,
    });

    if (!isPeckDrilling || depthMm <= peckDepthMm) {
      // Direct Single-pass drilling
      positions.push({
        x: holeCenter.x,
        y: holeCenter.y,
        z: targetBottomZ,
        feedMmMin: params.plungeFeedMmMin,
        spindleRpm: params.spindleRpm,
        motionType: MotionType.FEED,
        coolant: params.coolant,
        segmentIndex: segmentIdx++,
      });
    } else {
      // G83 Deep Hole Peck Drilling with chip breaking
      let currentZ = topZ;
      while (currentZ > targetBottomZ + 1e-4) {
        const nextZ = Math.max(targetBottomZ, currentZ - peckDepthMm);

        // Feed cut down to next peck depth
        positions.push({
          x: holeCenter.x,
          y: holeCenter.y,
          z: nextZ,
          feedMmMin: params.plungeFeedMmMin,
          spindleRpm: params.spindleRpm,
          motionType: MotionType.FEED,
          coolant: params.coolant,
          segmentIndex: segmentIdx++,
        });

        // Rapid retract to clear chips
        positions.push({
          x: holeCenter.x,
          y: holeCenter.y,
          z: retractZ,
          feedMmMin: params.rapidFeedMmMin,
          spindleRpm: params.spindleRpm,
          motionType: MotionType.RETRACT,
          coolant: params.coolant,
          segmentIndex: segmentIdx++,
        });

        // Rapid back down to just above previous peck
        if (nextZ > targetBottomZ) {
          positions.push({
            x: holeCenter.x,
            y: holeCenter.y,
            z: nextZ + 0.5,
            feedMmMin: params.rapidFeedMmMin,
            spindleRpm: params.spindleRpm,
            motionType: MotionType.RAPID,
            coolant: params.coolant,
            segmentIndex: segmentIdx++,
          });
        }

        currentZ = nextZ;
      }
    }

    // Final Retract
    positions.push({
      x: holeCenter.x,
      y: holeCenter.y,
      z: retractZ,
      feedMmMin: params.rapidFeedMmMin,
      spindleRpm: params.spindleRpm,
      motionType: MotionType.RETRACT,
      coolant: params.coolant,
      segmentIndex: segmentIdx++,
    });

    positions.push({
      x: holeCenter.x,
      y: holeCenter.y,
      z: safeZ,
      feedMmMin: params.rapidFeedMmMin,
      spindleRpm: params.spindleRpm,
      motionType: MotionType.RAPID,
      coolant: CoolantState.OFF,
      segmentIndex: segmentIdx++,
    });

    return positions;
  }

  /**
   * 5. SLOT MILLING STRATEGY: Centerline or width-aware multi-depth passes
   */
  public static generateSlotToolpath(
    start: { x: number; y: number },
    end: { x: number; y: number },
    slotWidthMm: number,
    topZ: number,
    floorZ: number,
    tool: CuttingTool,
    params: CuttingParameters,
    safeZ: number = topZ + 5.0,
    retractZ: number = topZ + 2.0
  ): ToolPosition[] {
    const positions: ToolPosition[] = [];
    const stepdown = Math.max(0.4, params.stepdownMm);
    let segmentIdx = 0;

    // Approach
    positions.push({
      x: start.x,
      y: start.y,
      z: safeZ,
      feedMmMin: params.rapidFeedMmMin,
      spindleRpm: params.spindleRpm,
      motionType: MotionType.RAPID,
      coolant: params.coolant,
      segmentIndex: segmentIdx++,
    });

    let currentZ = topZ;
    let forward = true;

    while (currentZ > floorZ + 1e-4) {
      const nextZ = Math.max(floorZ, currentZ - stepdown);
      const pEntry = forward ? start : end;
      const pExit = forward ? end : start;

      // Ramp entry into slot
      positions.push({
        x: pEntry.x,
        y: pEntry.y,
        z: nextZ,
        feedMmMin: params.rampFeedMmMin,
        spindleRpm: params.spindleRpm,
        motionType: MotionType.RAMP,
        coolant: params.coolant,
        segmentIndex: segmentIdx++,
      });

      // Linear Slot pass
      positions.push({
        x: pExit.x,
        y: pExit.y,
        z: nextZ,
        feedMmMin: params.cuttingFeedMmMin,
        spindleRpm: params.spindleRpm,
        motionType: MotionType.FEED,
        coolant: params.coolant,
        segmentIndex: segmentIdx++,
      });

      forward = !forward;
      currentZ = nextZ;
    }

    // Retract
    const last = positions[positions.length - 1];
    positions.push({
      x: last.x,
      y: last.y,
      z: retractZ,
      feedMmMin: params.rapidFeedMmMin,
      spindleRpm: params.spindleRpm,
      motionType: MotionType.RETRACT,
      coolant: params.coolant,
      segmentIndex: segmentIdx++,
    });

    positions.push({
      x: last.x,
      y: last.y,
      z: safeZ,
      feedMmMin: params.rapidFeedMmMin,
      spindleRpm: params.spindleRpm,
      motionType: MotionType.RAPID,
      coolant: CoolantState.OFF,
      segmentIndex: segmentIdx++,
    });

    return positions;
  }
}
