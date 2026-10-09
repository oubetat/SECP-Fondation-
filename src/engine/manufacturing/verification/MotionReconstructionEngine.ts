import { Point3D, Vector3D } from "../collision/types";
import {
  ArcDirection,
  ArcPlane,
  CannedCycleType,
  MachineAxisPoint,
  MachineAxisToolpath,
  MachineProfile,
  SpindleDirection
} from "../post/types";
import { ModalStateEngine } from "./ModalStateEngine";
import {
  MachineStateSnapshot,
  MachineStateTraceEntry,
  ModalStateSnapshot,
  ParsedNCBlock,
  SemanticErrorCode,
  ToolPoseSnapshot,
  ToolPoseTraceEntry
} from "./types";

export interface MotionReconstructionResult {
  reconstructedToolpath: MachineAxisToolpath;
  machineStateTrace: MachineStateTraceEntry[];
  toolPoseTrace: ToolPoseTraceEntry[];
  arcErrors: {
    lineNumber: number;
    code: SemanticErrorCode;
    message: string;
  }[];
  totalMotionBlocks: number;
  totalInterpolatedSamples: number;
}

export class MotionReconstructionEngine {
  private machineProfile: MachineProfile;
  private modalEngine: ModalStateEngine;

  constructor(machineProfile: MachineProfile, initialModalState?: Partial<ModalStateSnapshot>) {
    this.machineProfile = machineProfile;
    this.modalEngine = new ModalStateEngine(initialModalState);
  }

  /**
   * Reconstructs discrete machine states and continuous toolpose traces from parsed NC blocks.
   */
  public reconstructMotion(
    blocks: ParsedNCBlock[],
    samplesPerSegment: number = 10
  ): MotionReconstructionResult {
    const points: MachineAxisPoint[] = [];
    const machineStateTrace: MachineStateTraceEntry[] = [];
    const toolPoseTrace: ToolPoseTraceEntry[] = [];
    const arcErrors: MotionReconstructionResult["arcErrors"] = [];

    // Initial position at machine origin or home
    let currentX = this.machineProfile.homePositions?.["X"] ?? 0;
    let currentY = this.machineProfile.homePositions?.["Y"] ?? 0;
    let currentZ = this.machineProfile.homePositions?.["Z"] ?? 50;
    let currentA = this.machineProfile.homePositions?.["A"] ?? 0;
    let currentB = this.machineProfile.homePositions?.["B"] ?? 0;
    let currentC = this.machineProfile.homePositions?.["C"] ?? 0;
    let currentFeed = 1000;
    let currentRPM = 6000;

    let seqNumber = 1;

    for (let bIdx = 0; bIdx < blocks.length; bIdx++) {
      const block = blocks[bIdx];
      if (block.isProgramDelimiter) continue;

      const transition = this.modalEngine.processBlock(block);
      const modal = transition.stateAfter;

      for (const err of transition.semanticErrors) {
        arcErrors.push({
          lineNumber: block.lineNumber,
          code: err.code,
          message: err.message
        });
      }

      // Check if this block specifies or implies motion
      const params = block.parameters;
      const hasCoord = "X" in params || "Y" in params || "Z" in params || "A" in params || "B" in params || "C" in params;
      const isMotionG = ["G00", "G01", "G02", "G03"].includes(modal?.motionMode);
      const isCycle = modal?.motionMode.startsWith("G8");

      if ("F" in params) {
        currentFeed = Number(params["F"]);
      }
      if ("S" in params) {
        currentRPM = Number(params["S"]);
      }

      const stateBeforeSnapshot: MachineStateSnapshot = {
        machinePosition: { x: currentX, y: currentY, z: currentZ },
        workPosition: { x: currentX, y: currentY, z: currentZ },
        rotaryAngles: { a: currentA, b: currentB, c: currentC },
        feedRate: currentFeed,
        effectiveFeedRate: currentFeed,
        spindleRPM: currentRPM,
        activeToolNumber: modal.activeTool,
        modalState: transition.stateBefore
      };

      if (hasCoord) {
        // Calculate new coordinate values based on G90 / G91
        let targetX = currentX;
        let targetY = currentY;
        let targetZ = currentZ;
        let targetA = currentA;
        let targetB = currentB;
        let targetC = currentC;

        if (modal.distanceMode === "ABSOLUTE") {
          if ("X" in params) targetX = Number(params["X"]);
          if ("Y" in params) targetY = Number(params["Y"]);
          if ("Z" in params) targetZ = Number(params["Z"]);
          if ("A" in params) targetA = Number(params["A"]);
          if ("B" in params) targetB = Number(params["B"]);
          if ("C" in params) targetC = Number(params["C"]);
        } else { // INCREMENTAL
          if ("X" in params) targetX += Number(params["X"]);
          if ("Y" in params) targetY += Number(params["Y"]);
          if ("Z" in params) targetZ += Number(params["Z"]);
          if ("A" in params) targetA += Number(params["A"]);
          if ("B" in params) targetB += Number(params["B"]);
          if ("C" in params) targetC += Number(params["C"]);
        }

        let motionTypeStr: "RAPID" | "LINEAR" | "ARC" | "CYCLE" = "LINEAR";
        let traceMotionType: MachineStateTraceEntry["motionType"] = "LINEAR";

        if (modal?.motionMode === "G00") {
          motionTypeStr = "RAPID";
          traceMotionType = "RAPID";
        } else if (modal?.motionMode === "G02" || modal?.motionMode === "G03") {
          motionTypeStr = "ARC";
          traceMotionType = modal?.motionMode === "G02" ? "ARC_CW" : "ARC_CCW";

          // Arc center and radius validation
          const isCW = modal?.motionMode === "G02";
          const plane = modal.plane === "UNDETERMINED" ? ArcPlane.XY_G17 : modal.plane;

          let arcCenter: Point3D = { x: currentX, y: currentY, z: currentZ };
          let arcRadius = 0;

          if ("I" in params || "J" in params || "K" in params) {
            const iOffset = Number(params["I"] ?? 0);
            const jOffset = Number(params["J"] ?? 0);
            const kOffset = Number(params["K"] ?? 0);

            arcCenter = {
              x: currentX + iOffset,
              y: currentY + jOffset,
              z: currentZ + kOffset
            };

            const rStart = Math.hypot(currentX - arcCenter.x, currentY - arcCenter.y, currentZ - arcCenter.z);
            const rEnd = Math.hypot(targetX - arcCenter.x, targetY - arcCenter.y, targetZ - arcCenter.z);
            arcRadius = rStart;

            // Check arc center consistency (rStart ~= rEnd)
            const deltaR = Math.abs(rStart - rEnd);
            if (deltaR > 0.05) { // 0.05mm tolerance for center inconsistency
              arcErrors.push({
                lineNumber: block.lineNumber,
                code: SemanticErrorCode.ARC_GEOMETRY_MISMATCH,
                message: `Arc center mismatch at line ${block.lineNumber}: rStart=${rStart.toFixed(4)}, rEnd=${rEnd.toFixed(4)}, delta=${deltaR.toFixed(4)}`
              });
            }
          } else if ("R" in params) {
            arcRadius = Number(params["R"]);
            if (arcRadius <= 0) {
              arcErrors.push({
                lineNumber: block.lineNumber,
                code: SemanticErrorCode.INVALID_ARC_RADIUS,
                message: `Arc radius R=${arcRadius} at line ${block.lineNumber} must be positive`
              });
            }
          }
        }

        const point: MachineAxisPoint = {
          position: { x: targetX, y: targetY, z: targetZ },
          rotaryAxes: { a: targetA, b: targetB, c: targetC },
          feedRate: currentFeed,
          spindleSpeed: currentRPM,
          spindleDirection: modal.spindleState.direction,
          coolantState: modal.coolantState,
          sequenceNumber: seqNumber++,
          toolNumber: modal.activeTool,
          motionType: motionTypeStr
        };

        points.push(point);

        const stateAfterSnapshot: MachineStateSnapshot = {
          machinePosition: { x: targetX, y: targetY, z: targetZ },
          workPosition: { x: targetX, y: targetY, z: targetZ },
          rotaryAngles: { a: targetA, b: targetB, c: targetC },
          feedRate: currentFeed,
          effectiveFeedRate: currentFeed,
          spindleRPM: currentRPM,
          activeToolNumber: modal.activeTool,
          modalState: modal
        };

        machineStateTrace.push({
          lineNumber: block.lineNumber,
          blockIndex: bIdx,
          commandText: block.sourceText,
          stateBefore: stateBeforeSnapshot,
          stateAfter: stateAfterSnapshot,
          motionType: traceMotionType
        });

        // Compute tool poses via forward kinematics
        const startPose = this.computeForwardKinematics(
          { x: currentX, y: currentY, z: currentZ },
          { a: currentA, b: currentB, c: currentC },
          0
        );
        const endPose = this.computeForwardKinematics(
          { x: targetX, y: targetY, z: targetZ },
          { a: targetA, b: targetB, c: targetC },
          1
        );

        // Interpolate intermediate continuous samples T(t)
        const samples: ToolPoseSnapshot[] = [];
        for (let s = 0; s <= samplesPerSegment; s++) {
          const t = s / samplesPerSegment;
          const interpPos: Point3D = {
            x: currentX + t * (targetX - currentX),
            y: currentY + t * (targetY - currentY),
            z: currentZ + t * (targetZ - currentZ)
          };
          const interpRot = {
            a: currentA + t * (targetA - currentA),
            b: currentB + t * (targetB - currentB),
            c: currentC + t * (targetC - currentC)
          };
          samples.push(this.computeForwardKinematics(interpPos, interpRot, t));
        }

        toolPoseTrace.push({
          motionSegmentIndex: points.length - 1,
          startPose,
          endPose,
          interpolation: motionTypeStr === "RAPID" ? "RAPID" : "LINEAR",
          samples
        });

        // Update current state
        currentX = targetX;
        currentY = targetY;
        currentZ = targetZ;
        currentA = targetA;
        currentB = targetB;
        currentC = targetC;
      } else {
        // Non-motion state change
        machineStateTrace.push({
          lineNumber: block.lineNumber,
          blockIndex: bIdx,
          commandText: block.sourceText,
          stateBefore: stateBeforeSnapshot,
          stateAfter: {
            ...stateBeforeSnapshot,
            modalState: modal
          },
          motionType: "STATE_ONLY"
        });
      }
    }

    const reconstructedToolpath: MachineAxisToolpath = {
      toolpathId: "RECONSTRUCTED_NC_TOOLPATH",
      revision: 1,
      machineId: this.machineProfile.machineId,
      points,
      tolerance: 0.005,
      coordinateSystem: "WORK_PIECE",
      provenance: {
        sourceId: "PROV_NC_RECON",
        sourceType: "STANDARD" as any,
        reference: "Independent NC Interpreter Reconstruction",
        timestamp: new Date().toISOString(),
        author: "SECP GCode Verifier",
        hash: "0xGCODERECON"
      }
    };

    let totalSamples = 0;
    for (const t of toolPoseTrace) {
      totalSamples += t.samples.length;
    }

    return {
      reconstructedToolpath,
      machineStateTrace,
      toolPoseTrace,
      arcErrors,
      totalMotionBlocks: points.length,
      totalInterpolatedSamples: totalSamples
    };
  }

  /**
   * Computes forward kinematics for the machine configuration to yield tool tip and orientation vectors.
   */
  public computeForwardKinematics(
    pos: Point3D,
    rot: { a: number; b: number; c: number },
    timeNormalized: number
  ): ToolPoseSnapshot {
    const aRad = (rot.a * Math.PI) / 180;
    const bRad = (rot.b * Math.PI) / 180;
    const cRad = (rot.c * Math.PI) / 180;

    // For 5-axis Table-Table (Trunnion AC or BC)
    // Table rotations orient the workpiece relative to spindle Z [0, 0, 1]
    const toolAxis: Vector3D = {
      x: Math.sin(bRad || aRad) * Math.sin(cRad),
      y: -Math.sin(bRad || aRad) * Math.cos(cRad),
      z: Math.cos(bRad || aRad)
    };

    return {
      tipPosition: { ...pos },
      orientationVector: toolAxis,
      toolAxisVector: toolAxis,
      spindleAxisVector: { x: 0, y: 0, z: 1 },
      timeNormalized
    };
  }
}
