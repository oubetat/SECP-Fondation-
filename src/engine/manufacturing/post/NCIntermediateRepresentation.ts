import {
  ArcDirection,
  ArcPlane,
  ControllerProfile,
  FeedMode,
  MachineAxisPoint,
  MachineAxisToolpath,
  MachineProfile,
  NCCommandType,
  NCIntermediateCommand,
  NCIntermediateRepresentation,
  NCModalState,
  PostErrorCode,
  PostProcessingTraceEntry,
  SpindleDirection
} from "./types";

export class NCIntermediateRepresentationEngine {
  public static buildIntermediateRepresentation(
    trajectory: MachineAxisToolpath,
    machineProfile: MachineProfile,
    controllerProfile: ControllerProfile,
    traceEntries: PostProcessingTraceEntry[]
  ): { ir: NCIntermediateRepresentation; errors: string[]; warnings: string[] } {
    const commands: NCIntermediateCommand[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    // Initial modal state
    const modalInitialState: NCModalState = {
      motionGCode: "G00",
      planeGCode: "G17",
      distanceModeGCode: "G90",
      feedModeGCode: "G94",
      unitsGCode: machineProfile.axisUnits === "METRIC_MM" ? "G21" : "G20",
      cutterCompGCode: "G40",
      workOffsetGCode: "G54",
      activeTool: 0,
      toolLengthOffsetActive: false,
      spindleState: SpindleDirection.STOP,
      activeSpindleRPM: 0,
      activeFeedRate: 0,
      coolantActive: false
    };

    // Program start command
    commands.push({
      commandId: `CMD_PROG_START_${trajectory.toolpathId}`,
      type: NCCommandType.PROGRAM_START,
      comment: `Program Start: ${trajectory.toolpathId}`
    });

    let currentTool = -1;
    let currentSpindleDir = SpindleDirection.STOP;
    let currentSpindleRPM = 0;
    let currentCoolant = false;

    traceEntries.push({
      step: "IR_SYNTHESIS_START",
      inputSummary: `Total toolpath points: ${trajectory.points.length}`,
      transformation: "Converting machine axis trajectory to NC IR commands",
      decision: "Iterate sequential points and emit discrete high-level IR nodes",
      outputSummary: "Beginning IR command conversion"
    });

    for (let i = 0; i < trajectory.points.length; i++) {
      const pt = trajectory.points[i];

      // Tool change check
      if (pt.toolNumber > 0 && pt.toolNumber !== currentTool) {
        commands.push({
          commandId: `CMD_TC_${i}_T${pt.toolNumber}`,
          type: NCCommandType.TOOL_CHANGE,
          point: pt,
          textParams: { toolNumber: pt.toolNumber, offsetNumber: pt.offsetNumber || pt.toolNumber },
          comment: `Tool Change T${pt.toolNumber}`
        });
        currentTool = pt.toolNumber;

        traceEntries.push({
          step: `TOOL_CHANGE_IR_T${pt.toolNumber}`,
          inputSummary: `Point ${i}: Request tool ${pt.toolNumber}`,
          transformation: "Emit TOOL_CHANGE intermediate command",
          decision: "Tool number transition detected",
          outputSummary: `T${pt.toolNumber} queued`
        });
      }

      // Spindle start / update check
      if (
        pt.spindleDirection !== SpindleDirection.STOP &&
        (pt.spindleDirection !== currentSpindleDir || pt.spindleSpeed !== currentSpindleRPM)
      ) {
        // Validate spindle limits
        if (pt.spindleSpeed > machineProfile.spindle.maxRPM || pt.spindleSpeed < machineProfile.spindle.minRPM) {
          errors.push(
            `Spindle speed ${pt.spindleSpeed} RPM at point ${i} violates machine limits [${machineProfile.spindle.minRPM}, ${machineProfile.spindle.maxRPM}]`
          );
        }

        commands.push({
          commandId: `CMD_SPINDLE_${i}`,
          type: NCCommandType.SPINDLE_START,
          point: pt,
          textParams: { direction: pt.spindleDirection, rpm: pt.spindleSpeed }
        });
        currentSpindleDir = pt.spindleDirection;
        currentSpindleRPM = pt.spindleSpeed;
      } else if (pt.spindleDirection === SpindleDirection.STOP && currentSpindleDir !== SpindleDirection.STOP) {
        commands.push({
          commandId: `CMD_SPINDLE_STOP_${i}`,
          type: NCCommandType.SPINDLE_STOP,
          point: pt
        });
        currentSpindleDir = SpindleDirection.STOP;
        currentSpindleRPM = 0;
      }

      // Coolant check
      const coolantRequested = pt.coolantState.flood || pt.coolantState.mist || pt.coolantState.throughSpindle;
      if (coolantRequested && !currentCoolant) {
        commands.push({
          commandId: `CMD_COOLANT_ON_${i}`,
          type: NCCommandType.COOLANT_ON,
          point: pt
        });
        currentCoolant = true;
      } else if (!coolantRequested && currentCoolant) {
        commands.push({
          commandId: `CMD_COOLANT_OFF_${i}`,
          type: NCCommandType.COOLANT_OFF,
          point: pt
        });
        currentCoolant = false;
      }

      // Motion command
      if (pt.motionType === "RAPID") {
        commands.push({
          commandId: `CMD_RAPID_${i}`,
          type: NCCommandType.RAPID_MOVE,
          point: pt
        });
      } else if (pt.motionType === "LINEAR") {
        commands.push({
          commandId: `CMD_LINEAR_${i}`,
          type: NCCommandType.LINEAR_MOVE,
          point: pt
        });
      } else if (pt.motionType === "ARC") {
        if (!controllerProfile.capabilities.supportsArcs) {
          // Arc fallback linearization
          warnings.push(`Controller ${controllerProfile.controllerId} does not support native arcs; linearizing point ${i}`);
          commands.push({
            commandId: `CMD_LINEAR_ARC_FALLBACK_${i}`,
            type: NCCommandType.LINEAR_MOVE,
            point: pt
          });
        } else {
          commands.push({
            commandId: `CMD_ARC_${i}`,
            type: NCCommandType.ARC_MOVE,
            point: pt,
            textParams: pt.arcParameters
          });
        }
      } else if (pt.motionType === "SPLINE") {
        if (!controllerProfile.capabilities.supportsSplines) {
          // Spline fallback linearization
          warnings.push(`Controller ${controllerProfile.controllerId} does not support native splines; linearizing point ${i}`);
          commands.push({
            commandId: `CMD_LINEAR_SPLINE_FALLBACK_${i}`,
            type: NCCommandType.LINEAR_MOVE,
            point: pt
          });
        } else {
          commands.push({
            commandId: `CMD_SPLINE_${i}`,
            type: NCCommandType.SPLINE_MOVE,
            point: pt
          });
        }
      } else if (pt.motionType === "DWELL") {
        commands.push({
          commandId: `CMD_DWELL_${i}`,
          type: NCCommandType.DWELL,
          point: pt,
          textParams: { seconds: pt.dwellSeconds || 1.0 }
        });
      } else if (pt.motionType === "CYCLE") {
        if (!controllerProfile.capabilities.supportsCannedCycles) {
          warnings.push(`Controller ${controllerProfile.controllerId} does not support canned cycles; expanding to linear`);
          commands.push({
            commandId: `CMD_CYCLE_EXPANDED_${i}`,
            type: NCCommandType.LINEAR_MOVE,
            point: pt
          });
        } else {
          commands.push({
            commandId: `CMD_CYCLE_${i}`,
            type: NCCommandType.CANNED_CYCLE,
            point: pt,
            textParams: pt.cycleParameters
          });
        }
      }
    }

    // Program end command
    commands.push({
      commandId: `CMD_PROG_END_${trajectory.toolpathId}`,
      type: NCCommandType.PROGRAM_END,
      comment: "End of Program"
    });

    const ir: NCIntermediateRepresentation = {
      representationId: `IR_${trajectory.toolpathId}_REV${trajectory.revision}`,
      sourceToolpathId: trajectory.toolpathId,
      commands,
      modalInitialState,
      createdAt: new Date().toISOString()
    };

    traceEntries.push({
      step: "IR_SYNTHESIS_COMPLETE",
      inputSummary: `Processed ${trajectory.points.length} points`,
      transformation: "IR commands compiled",
      decision: errors.length > 0 ? "IR contains validation errors" : "IR valid and complete",
      outputSummary: `Generated ${commands.length} IR commands with ${errors.length} errors, ${warnings.length} warnings`
    });

    return { ir, errors, warnings };
  }
}
