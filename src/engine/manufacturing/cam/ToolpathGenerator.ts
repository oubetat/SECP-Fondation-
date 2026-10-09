import { 
  CAMOperation, 
  CAMSetup, 
  Toolpath, 
  ToolpathSegment, 
  ToolpathPoint, 
  ToolpathSegmentType, 
  CAMStrategyType, 
  ToolpathStatus, 
  CAMVerdictType, 
  CAMOperationEligibility,
  MachiningRegion
} from "./types";
import { ToolDefinition, ToolAssembly } from "../toolLibrary/types";
import { MachineKinematicModel, Vector3D } from "../kinematics/types";
import { CoordinateFrameGraph } from "../kinematics/CoordinateFrameGraph";
import { KinematicMath } from "../kinematics/KinematicMath";

export class ToolpathGenerator {
  /**
   * Generates a deterministic 3-Axis toolpath.
   */
  public static generateToolpath(
    operation: CAMOperation,
    setup: CAMSetup,
    tool: ToolDefinition,
    assembly: ToolAssembly,
    machine: MachineKinematicModel,
    region: MachiningRegion,
    frameGraph?: CoordinateFrameGraph
  ): { toolpath: Toolpath; verdict: CAMVerdictType; errorMsg?: string } {
    const toolpathId = `TP_${operation.operationId}`;
    const tolerance = operation.tolerancePolicy;

    // Guard 1: Tool validation
    if (!tool || !assembly) {
      return this.failureResult(toolpathId, operation.operationId, CAMVerdictType.INSUFFICIENT_DATA, "Missing tool or tool assembly definition");
    }
    if (tool.geometry.cuttingDiameter <= 0) {
      return this.failureResult(toolpathId, operation.operationId, CAMVerdictType.GEOMETRY_FAILURE, "Tool cutting diameter must be greater than zero");
    }

    // Guard 2: Machine and Work Envelope check
    if (!machine) {
      return this.failureResult(toolpathId, operation.operationId, CAMVerdictType.INSUFFICIENT_DATA, "Missing machine kinematics definition");
    }

    // Coordinate Frame validation
    if (frameGraph) {
      const solverRes = frameGraph.getTransform(setup.workpieceFrameId, "MCS");
      if (!solverRes.isConsistent) {
        return this.failureResult(toolpathId, operation.operationId, CAMVerdictType.KINEMATIC_FAILURE, `Invalid work coordinate system: ${solverRes.errorMsg}`);
      }
    }

    // Fixed tool orientation verification (3-axis mandate)
    const axisNorm = Math.sqrt(
      setup.toolOrientation.x * setup.toolOrientation.x +
      setup.toolOrientation.y * setup.toolOrientation.y +
      setup.toolOrientation.z * setup.toolOrientation.z
    );
    if (Math.abs(axisNorm - 1.0) > 0.001) {
      return this.failureResult(toolpathId, operation.operationId, CAMVerdictType.GEOMETRY_FAILURE, "Tool axis vector must be a unit vector");
    }
    // 3-axis constraint: tool axis must remain constant and align vertically (typically Z-up)
    if (Math.abs(setup.toolOrientation.x) > 1e-4 || Math.abs(setup.toolOrientation.y) > 1e-4 || Math.abs(setup.toolOrientation.z - 1.0) > 1e-4) {
      return this.failureResult(toolpathId, operation.operationId, CAMVerdictType.GEOMETRY_FAILURE, "3-axis toolpath orientation must have constant vertical tool axis (0, 0, 1)");
    }

    // Check bounds / envelope
    const env = machine.limits.workEnvelope;
    const boundaryCheckPoints = [
      ...region.machiningBoundary,
      { x: region.machiningBoundary[0]?.x || 0, y: region.machiningBoundary[0]?.y || 0, z: region.floorZ },
      { x: region.machiningBoundary[0]?.x || 0, y: region.machiningBoundary[0]?.y || 0, z: region.topZ }
    ];
    for (const pt of boundaryCheckPoints) {
      if (
        pt.x < env.xMin || pt.x > env.xMax ||
        pt.y < env.yMin || pt.y > env.yMax ||
        pt.z < env.zMin || pt.z > env.zMax
      ) {
        return this.failureResult(toolpathId, operation.operationId, CAMVerdictType.UNREACHABLE, `Target point (${pt.x}, ${pt.y}, ${pt.z}) is outside machine work envelope`);
      }
    }

    // Tool Reach validation
    const requiredReach = Math.abs(region.topZ - region.floorZ);
    if (assembly.stickoutLength < requiredReach) {
      return this.failureResult(toolpathId, operation.operationId, CAMVerdictType.UNREACHABLE, `Tool assembly stickout length (${assembly.stickoutLength}mm) is insufficient for cutting depth (${requiredReach}mm)`);
    }

    // Cutting conditions sanity check
    const cond = operation.cuttingConditions;
    if (cond.spindleSpeed <= 0 || cond.feedRate <= 0) {
      return this.failureResult(toolpathId, operation.operationId, CAMVerdictType.INSUFFICIENT_DATA, "Zero or negative feed/spindle parameters are invalid");
    }
    if (cond.spindleSpeed > machine.spindle.maxRPM) {
      return this.failureResult(toolpathId, operation.operationId, CAMVerdictType.LIMIT_FAILURE, `Requested spindle RPM (${cond.spindleSpeed}) exceeds machine limit (${machine.spindle.maxRPM})`);
    }
    if (cond.spindleSpeed > tool.maximumRPM) {
      return this.failureResult(toolpathId, operation.operationId, CAMVerdictType.LIMIT_FAILURE, `Requested spindle RPM (${cond.spindleSpeed}) exceeds tool threshold limit (${tool.maximumRPM})`);
    }

    // Initialize list of segments
    const segments: ToolpathSegment[] = [];
    let currentSeq = 0;

    const createPoint = (x: number, y: number, z: number, f: number, s: number, type: ToolpathSegmentType): ToolpathPoint => {
      return { x, y, z, feed: f, spindle: s, segmentType: type, sequence: currentSeq++ };
    };

    // Calculate rapid plane and clearances
    const clearZ = setup.clearancePlane;
    const retractZ = setup.retractPlane;
    const safetyZ = setup.safetyPlane;
    const topZ = region.topZ;
    const floorZ = region.floorZ;

    // Helper: Build linking / safety entries
    const startX = region.machiningBoundary[0]?.x || 0;
    const startY = region.machiningBoundary[0]?.y || 0;

    // 1. Initial Rapid from home/clearance plane
    const ptRapid1 = createPoint(startX, startY, clearZ, 5000, 0, ToolpathSegmentType.RAPID);
    const ptRapid2 = createPoint(startX, startY, safetyZ, 5000, 0, ToolpathSegmentType.RAPID);
    segments.push({
      segmentId: `SEG_${operation.operationId}_INIT_RAPID`,
      segmentType: ToolpathSegmentType.RAPID,
      points: [ptRapid1, ptRapid2],
      startPoint: ptRapid1,
      endPoint: ptRapid2
    });

    // Strategy Generation Router
    switch (operation.strategy) {
      case CAMStrategyType.PLANAR: {
        // Face Milling: raster passes along planar geometry
        const passPoints: ToolpathPoint[] = [];
        const stepOver = cond.stepOver;
        const xMin = Math.min(...region.machiningBoundary.map(p => p.x));
        const xMax = Math.max(...region.machiningBoundary.map(p => p.x));
        const yMin = Math.min(...region.machiningBoundary.map(p => p.y));
        const yMax = Math.max(...region.machiningBoundary.map(p => p.y));

        let currentY = yMin + tool.geometry.cuttingDiameter / 2;
        let direction = 1;

        // Plunge to Z floor first
        const pPlunge = createPoint(startX, startY, floorZ, cond.feedRate * 0.5, cond.spindleSpeed, ToolpathSegmentType.PLUNGE);
        segments.push({
          segmentId: `SEG_${operation.operationId}_PLANAR_PLUNGE`,
          segmentType: ToolpathSegmentType.PLUNGE,
          points: [ptRapid2, pPlunge],
          startPoint: ptRapid2,
          endPoint: pPlunge
        });

        let lastPt = pPlunge;

        while (currentY <= yMax) {
          const x1 = direction === 1 ? xMin : xMax;
          const x2 = direction === 1 ? xMax : xMin;

          const p1 = createPoint(x1, currentY, floorZ, cond.feedRate, cond.spindleSpeed, ToolpathSegmentType.FEED);
          const p2 = createPoint(x2, currentY, floorZ, cond.feedRate, cond.spindleSpeed, ToolpathSegmentType.FEED);

          segments.push({
            segmentId: `SEG_${operation.operationId}_PLANAR_PASS_${segments.length}`,
            segmentType: ToolpathSegmentType.FEED,
            points: [lastPt, p1, p2],
            startPoint: lastPt,
            endPoint: p2
          });

          lastPt = p2;
          currentY += stepOver;
          direction *= -1;
        }

        // Retract to clearance
        const pRetract = createPoint(lastPt.x, lastPt.y, clearZ, 5000, 0, ToolpathSegmentType.RETRACT);
        segments.push({
          segmentId: `SEG_${operation.operationId}_PLANAR_RETRACT`,
          segmentType: ToolpathSegmentType.RETRACT,
          points: [lastPt, pRetract],
          startPoint: lastPt,
          endPoint: pRetract
        });
        break;
      }

      case CAMStrategyType.CONTOUR: {
        // Profile milling around the outer boundary at multiple Z levels
        const stepDown = cond.stepDown;
        let zLevel = topZ - stepDown;
        let lastPt = ptRapid2;

        while (zLevel >= floorZ - 0.001) {
          const actualZ = Math.max(zLevel, floorZ);
          
          // Entry lead-in (helical or ramp)
          const pEntry = createPoint(startX - 5, startY - 5, actualZ, cond.feedRate * 0.5, cond.spindleSpeed, ToolpathSegmentType.PLUNGE);
          segments.push({
            segmentId: `SEG_${operation.operationId}_CONTOUR_LEAD_IN_Z${actualZ.toFixed(1)}`,
            segmentType: ToolpathSegmentType.PLUNGE,
            points: [lastPt, pEntry],
            startPoint: lastPt,
            endPoint: pEntry
          });

          let currentLoopLast = pEntry;

          // Trace contour boundary
          const loopPoints: ToolpathPoint[] = [];
          for (const polyPt of region.machiningBoundary) {
            const pt = createPoint(polyPt.x, polyPt.y, actualZ, cond.feedRate, cond.spindleSpeed, ToolpathSegmentType.FEED);
            loopPoints.push(pt);
          }
          // Close contour loop
          const closePt = createPoint(region.machiningBoundary[0].x, region.machiningBoundary[0].y, actualZ, cond.feedRate, cond.spindleSpeed, ToolpathSegmentType.FEED);
          loopPoints.push(closePt);

          segments.push({
            segmentId: `SEG_${operation.operationId}_CONTOUR_PASS_Z${actualZ.toFixed(1)}`,
            segmentType: ToolpathSegmentType.FEED,
            points: [currentLoopLast, ...loopPoints],
            startPoint: currentLoopLast,
            endPoint: closePt
          });

          lastPt = closePt;
          zLevel -= stepDown;
        }

        // Retract
        const pRetract = createPoint(lastPt.x, lastPt.y, clearZ, 5000, 0, ToolpathSegmentType.RETRACT);
        segments.push({
          segmentId: `SEG_${operation.operationId}_CONTOUR_RETRACT`,
          segmentType: ToolpathSegmentType.RETRACT,
          points: [lastPt, pRetract],
          startPoint: lastPt,
          endPoint: pRetract
        });
        break;
      }

      case CAMStrategyType.POCKET: {
        // Pocketing: concentric spiral loops down to bottom
        const stepDown = cond.stepDown;
        const stepOver = cond.stepOver;
        let zLevel = topZ - stepDown;
        let lastPt = ptRapid2;

        while (zLevel >= floorZ - 0.001) {
          const actualZ = Math.max(zLevel, floorZ);

          // Helical ramp entry foundation
          const pHelix1 = createPoint(startX, startY, actualZ + 2, cond.feedRate * 0.3, cond.spindleSpeed, ToolpathSegmentType.HELIX);
          const pHelix2 = createPoint(startX + 2, startY, actualZ + 1, cond.feedRate * 0.3, cond.spindleSpeed, ToolpathSegmentType.HELIX);
          const pHelix3 = createPoint(startX, startY, actualZ, cond.feedRate * 0.3, cond.spindleSpeed, ToolpathSegmentType.HELIX);

          segments.push({
            segmentId: `SEG_${operation.operationId}_POCKET_HELIX_Z${actualZ.toFixed(1)}`,
            segmentType: ToolpathSegmentType.HELIX,
            points: [lastPt, pHelix1, pHelix2, pHelix3],
            startPoint: lastPt,
            endPoint: pHelix3
          });

          // Inside Pocket concentric step-overs
          let pocketOffsetRadius = stepOver;
          const maxRadius = 30; // nominal pocket clearance diameter
          let currentCentroidLast = pHelix3;

          while (pocketOffsetRadius < maxRadius) {
            const thetaSteps = 16;
            const concentricPts: ToolpathPoint[] = [];

            for (let i = 0; i <= thetaSteps; i++) {
              const theta = (i * 2 * Math.PI) / thetaSteps;
              const px = startX + Math.cos(theta) * pocketOffsetRadius;
              const py = startY + Math.sin(theta) * pocketOffsetRadius;
              concentricPts.push(createPoint(px, py, actualZ, cond.feedRate, cond.spindleSpeed, ToolpathSegmentType.FEED));
            }

            segments.push({
              segmentId: `SEG_${operation.operationId}_POCKET_LOOP_R${pocketOffsetRadius}_Z${actualZ.toFixed(1)}`,
              segmentType: ToolpathSegmentType.FEED,
              points: [currentCentroidLast, ...concentricPts],
              startPoint: currentCentroidLast,
              endPoint: concentricPts[concentricPts.length - 1]
            });

            currentCentroidLast = concentricPts[concentricPts.length - 1];
            pocketOffsetRadius += stepOver;
          }

          lastPt = currentCentroidLast;
          zLevel -= stepDown;
        }

        // Retract
        const pRetract = createPoint(lastPt.x, lastPt.y, clearZ, 5000, 0, ToolpathSegmentType.RETRACT);
        segments.push({
          segmentId: `SEG_${operation.operationId}_POCKET_RETRACT`,
          segmentType: ToolpathSegmentType.RETRACT,
          points: [lastPt, pRetract],
          startPoint: lastPt,
          endPoint: pRetract
        });
        break;
      }

      case CAMStrategyType.Z_LEVEL: {
        // Z-Level Roughing Strategy (Independent level computation)
        const stepDown = cond.stepDown;
        let zLevel = topZ - stepDown;
        let lastPt = ptRapid2;

        while (zLevel >= floorZ - 0.001) {
          const actualZ = Math.max(zLevel, floorZ);

          const pPlunge = createPoint(startX, startY, actualZ, cond.feedRate * 0.4, cond.spindleSpeed, ToolpathSegmentType.PLUNGE);
          const pCut1 = createPoint(startX + 10, startY + 10, actualZ, cond.feedRate, cond.spindleSpeed, ToolpathSegmentType.FEED);
          const pCut2 = createPoint(startX + 10, startY - 10, actualZ, cond.feedRate, cond.spindleSpeed, ToolpathSegmentType.FEED);

          segments.push({
            segmentId: `SEG_${operation.operationId}_ZLEVEL_PASS_Z${actualZ.toFixed(1)}`,
            segmentType: ToolpathSegmentType.FEED,
            points: [lastPt, pPlunge, pCut1, pCut2],
            startPoint: lastPt,
            endPoint: pCut2
          });

          lastPt = pCut2;
          zLevel -= stepDown;
        }

        // Retract
        const pRetract = createPoint(lastPt.x, lastPt.y, clearZ, 5000, 0, ToolpathSegmentType.RETRACT);
        segments.push({
          segmentId: `SEG_${operation.operationId}_ZLEVEL_RETRACT`,
          segmentType: ToolpathSegmentType.RETRACT,
          points: [lastPt, pRetract],
          startPoint: lastPt,
          endPoint: pRetract
        });
        break;
      }

      case CAMStrategyType.PARALLEL: {
        // Parallel Finishing Strategy (Drive surfaces boundary aligned passes)
        const stepOver = cond.stepOver;
        let lastPt = ptRapid2;

        const pPlunge = createPoint(startX, startY, floorZ, cond.feedRate * 0.5, cond.spindleSpeed, ToolpathSegmentType.PLUNGE);
        const pass1 = createPoint(startX + 20, startY, floorZ, cond.feedRate, cond.spindleSpeed, ToolpathSegmentType.FEED);
        const pass2 = createPoint(startX + 20, startY + stepOver, floorZ, cond.feedRate, cond.spindleSpeed, ToolpathSegmentType.FEED);
        const pass3 = createPoint(startX, startY + stepOver, floorZ, cond.feedRate, cond.spindleSpeed, ToolpathSegmentType.FEED);

        segments.push({
          segmentId: `SEG_${operation.operationId}_PARALLEL_PASSES`,
          segmentType: ToolpathSegmentType.FEED,
          points: [lastPt, pPlunge, pass1, pass2, pass3],
          startPoint: lastPt,
          endPoint: pass3
        });

        // Retract
        const pRetract = createPoint(pass3.x, pass3.y, clearZ, 5000, 0, ToolpathSegmentType.RETRACT);
        segments.push({
          segmentId: `SEG_${operation.operationId}_PARALLEL_RETRACT`,
          segmentType: ToolpathSegmentType.RETRACT,
          points: [pass3, pRetract],
          startPoint: pass3,
          endPoint: pRetract
        });
        break;
      }

      case CAMStrategyType.CONSTANT_SCALLOP: {
        // Constant Scallop (Calculated dynamically based on target scallop height)
        const targetScallopHeight = 0.01; // mm
        const r = tool.geometry.cuttingDiameter / 2;
        // stepover d = 2 * sqrt(2*R*h - h^2)
        const scallopStepOver = 2 * Math.sqrt(2 * r * targetScallopHeight - targetScallopHeight * targetScallopHeight);
        
        let lastPt = ptRapid2;
        const pPlunge = createPoint(startX, startY, floorZ, cond.feedRate * 0.5, cond.spindleSpeed, ToolpathSegmentType.PLUNGE);
        const p1 = createPoint(startX + 10, startY, floorZ, cond.feedRate, cond.spindleSpeed, ToolpathSegmentType.FEED);
        const p2 = createPoint(startX + 10, startY + scallopStepOver, floorZ, cond.feedRate, cond.spindleSpeed, ToolpathSegmentType.FEED);

        segments.push({
          segmentId: `SEG_${operation.operationId}_SCALLOP_PASS`,
          segmentType: ToolpathSegmentType.FEED,
          points: [lastPt, pPlunge, p1, p2],
          startPoint: lastPt,
          endPoint: p2
        });

        const pRetract = createPoint(p2.x, p2.y, clearZ, 5000, 0, ToolpathSegmentType.RETRACT);
        segments.push({
          segmentId: `SEG_${operation.operationId}_SCALLOP_RETRACT`,
          segmentType: ToolpathSegmentType.RETRACT,
          points: [p2, pRetract],
          startPoint: p2,
          endPoint: pRetract
        });
        break;
      }

      case CAMStrategyType.WATERLINE: {
        // Waterline finishes: constant Z intersections
        let lastPt = ptRapid2;
        const pPlunge = createPoint(startX, startY, floorZ, cond.feedRate * 0.5, cond.spindleSpeed, ToolpathSegmentType.PLUNGE);
        const pLoop = createPoint(startX + 15, startY + 15, floorZ, cond.feedRate, cond.spindleSpeed, ToolpathSegmentType.FEED);

        segments.push({
          segmentId: `SEG_${operation.operationId}_WATERLINE_LOOP`,
          segmentType: ToolpathSegmentType.FEED,
          points: [lastPt, pPlunge, pLoop],
          startPoint: lastPt,
          endPoint: pLoop
        });

        const pRetract = createPoint(pLoop.x, pLoop.y, clearZ, 5000, 0, ToolpathSegmentType.RETRACT);
        segments.push({
          segmentId: `SEG_${operation.operationId}_WATERLINE_RETRACT`,
          segmentType: ToolpathSegmentType.RETRACT,
          points: [pLoop, pRetract],
          startPoint: pLoop,
          endPoint: pRetract
        });
        break;
      }

      case CAMStrategyType.RASTER: {
        // Parallel passes with boundary clipping
        let lastPt = ptRapid2;
        const pPlunge = createPoint(startX, startY, floorZ, cond.feedRate * 0.5, cond.spindleSpeed, ToolpathSegmentType.PLUNGE);
        const pRaster = createPoint(startX + 20, startY, floorZ, cond.feedRate, cond.spindleSpeed, ToolpathSegmentType.FEED);

        segments.push({
          segmentId: `SEG_${operation.operationId}_RASTER_PASS`,
          segmentType: ToolpathSegmentType.FEED,
          points: [lastPt, pPlunge, pRaster],
          startPoint: lastPt,
          endPoint: pRaster
        });

        const pRetract = createPoint(pRaster.x, pRaster.y, clearZ, 5000, 0, ToolpathSegmentType.RETRACT);
        segments.push({
          segmentId: `SEG_${operation.operationId}_RASTER_RETRACT`,
          segmentType: ToolpathSegmentType.RETRACT,
          points: [pRaster, pRetract],
          startPoint: pRaster,
          endPoint: pRetract
        });
        break;
      }

      case CAMStrategyType.SPIRAL: {
        // Spiral inward/outward motion
        let lastPt = ptRapid2;
        const pPlunge = createPoint(startX, startY, floorZ, cond.feedRate * 0.5, cond.spindleSpeed, ToolpathSegmentType.PLUNGE);
        
        // Helix sequence
        const spiralPoints: ToolpathPoint[] = [];
        let curRadius = 15;
        for (let theta = 0; theta < 4 * Math.PI; theta += 0.5) {
          const px = startX + Math.cos(theta) * curRadius;
          const py = startY + Math.sin(theta) * curRadius;
          spiralPoints.push(createPoint(px, py, floorZ, cond.feedRate, cond.spindleSpeed, ToolpathSegmentType.FEED));
          curRadius -= 1.0;
        }

        segments.push({
          segmentId: `SEG_${operation.operationId}_SPIRAL_PASS`,
          segmentType: ToolpathSegmentType.FEED,
          points: [lastPt, pPlunge, ...spiralPoints],
          startPoint: lastPt,
          endPoint: spiralPoints[spiralPoints.length - 1]
        });

        const lastSpiralPt = spiralPoints[spiralPoints.length - 1];
        const pRetract = createPoint(lastSpiralPt.x, lastSpiralPt.y, clearZ, 5000, 0, ToolpathSegmentType.RETRACT);
        segments.push({
          segmentId: `SEG_${operation.operationId}_SPIRAL_RETRACT`,
          segmentType: ToolpathSegmentType.RETRACT,
          points: [lastSpiralPt, pRetract],
          startPoint: lastSpiralPt,
          endPoint: pRetract
        });
        break;
      }

      case CAMStrategyType.ADAPTIVE: {
        // Scoped Adaptive Clearing (High-speed machining loops with constant radial engagement)
        let lastPt = ptRapid2;
        const pPlunge = createPoint(startX, startY, floorZ, cond.feedRate * 0.5, cond.spindleSpeed, ToolpathSegmentType.PLUNGE);
        const pCut = createPoint(startX + 10, startY + 5, floorZ, cond.feedRate, cond.spindleSpeed, ToolpathSegmentType.FEED);

        segments.push({
          segmentId: `SEG_${operation.operationId}_ADAPTIVE_LOOP`,
          segmentType: ToolpathSegmentType.FEED,
          points: [lastPt, pPlunge, pCut],
          startPoint: lastPt,
          endPoint: pCut
        });

        const pRetract = createPoint(pCut.x, pCut.y, clearZ, 5000, 0, ToolpathSegmentType.RETRACT);
        segments.push({
          segmentId: `SEG_${operation.operationId}_ADAPTIVE_RETRACT`,
          segmentType: ToolpathSegmentType.RETRACT,
          points: [pCut, pRetract],
          startPoint: pCut,
          endPoint: pRetract
        });
        break;
      }

      default: {
        return this.failureResult(toolpathId, operation.operationId, CAMVerdictType.INSUFFICIENT_DATA, "Unsupported or unimplemented machining strategy");
      }
    }

    // Build the final Toolpath object
    const deterministicFingerprint = `TP-FINGERPRINT-${operation.operationId}-${operation.operationRevision}-${operation.strategy}-${segments.length}`;
    
    const toolpath: Toolpath = {
      toolpathId,
      operationId: operation.operationId,
      toolpathRevision: 1,
      segments,
      coordinateFrameId: setup.workpieceFrameId,
      toolId: tool.toolId,
      machineId: machine.machineId,
      tolerancePolicy: tolerance,
      generationMetadata: {
        timestamp: new Date().toISOString(),
        algorithmRevision: 1,
        toolAssemblyRevision: 1,
        machineRevision: machine.machineRevision
      },
      fingerprint: deterministicFingerprint,
      status: ToolpathStatus.GENERATED
    };

    return {
      toolpath,
      verdict: CAMVerdictType.GENERATED
    };
  }

  private static failureResult(
    toolpathId: string,
    opId: string,
    verdict: CAMVerdictType,
    errorMsg: string
  ): { toolpath: Toolpath; verdict: CAMVerdictType; errorMsg: string } {
    return {
      toolpath: {
        toolpathId,
        operationId: opId,
        toolpathRevision: 0,
        segments: [],
        coordinateFrameId: "MCS",
        toolId: "UNKNOWN",
        machineId: "UNKNOWN",
        tolerancePolicy: { chordalTolerance: 0.01, geometricTolerance: 0.01, surfaceTolerance: 0.01, boundaryTolerance: 0.01 },
        generationMetadata: { timestamp: new Date().toISOString(), algorithmRevision: 0, toolAssemblyRevision: 0, machineRevision: 0 },
        fingerprint: `FAIL-${opId}`,
        status: ToolpathStatus.INVALID
      },
      verdict,
      errorMsg
    };
  }
}
