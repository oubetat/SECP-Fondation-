import {
  ArcDirection,
  ArcPlane,
  AxisMapping,
  CannedCycleType,
  ControllerProfile,
  MachineProfile,
  NCBlock,
  NCCommandType,
  NCIntermediateCommand,
  NCIntermediateRepresentation,
  NCModalState,
  NCPrecisionPolicy,
  NCDialect,
  NCWord,
  PostErrorCode,
  PostProcessingTraceEntry,
  ProgramFooterPolicy,
  ProgramHeaderPolicy,
  SafeStartPolicy,
  SpindleDirection
} from "./types";

export class NCFormatter {
  public static formatNumber(val: number, precision: number, stripZeros = false): string {
    // Deterministic fixed-point rounding
    const factor = Math.pow(10, precision);
    const rounded = Math.round((val + Number.EPSILON) * factor) / factor;
    let str = rounded.toFixed(precision);
    if (stripZeros && str.includes(".")) {
      str = str.replace(/\.?0+$/, "");
    }
    // Avoid -0.0000
    if (str === "-0" || str === "-0." + "0".repeat(precision)) {
      str = (0).toFixed(precision);
    }
    return str;
  }

  public static formatRepresentation(
    ir: NCIntermediateRepresentation,
    machineProfile: MachineProfile,
    controllerProfile: ControllerProfile,
    headerPolicy: ProgramHeaderPolicy,
    footerPolicy: ProgramFooterPolicy,
    safeStartPolicy: SafeStartPolicy,
    axisMapping: AxisMapping,
    traceEntries: PostProcessingTraceEntry[]
  ): { blocks: NCBlock[]; rawText: string; errors: string[] } {
    const blocks: NCBlock[] = [];
    const errors: string[] = [];
    let blockNumber = 10;
    const precision = controllerProfile.formatRules;

    const modalState: NCModalState = { ...ir.modalInitialState };

    const addBlock = (words: NCWord[], comment?: string, srcCmd?: NCIntermediateCommand) => {
      const lineWords = words.map(w => w.rawText).join(" ");
      let fullLine = `N${blockNumber} ${lineWords}`.trim();
      if (comment) {
        fullLine += (lineWords.length > 0 ? " " : "") + `(${comment})`;
      }

      blocks.push({
        blockNumber,
        sequenceNumber: blockNumber / 10,
        lineText: fullLine,
        words,
        comment,
        sourceOperation: srcCmd?.point?.operationId,
        sourcePointIndex: srcCmd?.point?.sequenceNumber,
        machineState: srcCmd?.point,
        modalState: { ...modalState }
      });
      blockNumber += 10;
    };

    traceEntries.push({
      step: "NC_FORMATTING_START",
      inputSummary: `IR contains ${ir.commands.length} commands`,
      transformation: "Formatting IR to controller dialect syntax",
      decision: `Formatting for dialect ${controllerProfile.dialect} (Controller: ${controllerProfile.controllerId})`,
      outputSummary: "Initializing header and safe-start blocks"
    });

    // 1. Program Header
    if (controllerProfile.dialect === NCDialect.FANUC_LIKE || controllerProfile.dialect === NCDialect.ISO_NC) {
      if (headerPolicy.programNumber) {
        addBlock([{ letter: "O", value: headerPolicy.programNumber, rawText: `O${String(headerPolicy.programNumber).padStart(4, "0")}` }], headerPolicy.programName);
      }
    }

    for (const comment of headerPolicy.customPreambleComments) {
      addBlock([], comment);
    }
    addBlock([], `SECP Industrial OS - Verified NC Program: ${headerPolicy.programName}`);
    addBlock([], `Machine: ${machineProfile.name} | Controller: ${controllerProfile.name}`);

    // 2. Safe Start Blocks
    for (const safeStr of safeStartPolicy.startupBlocks) {
      const words: NCWord[] = safeStr.split(" ").filter(s => s.length > 0).map(tok => ({
        letter: tok.charAt(0),
        value: tok.slice(1),
        rawText: tok
      }));
      addBlock(words, "Safe Start Initialization");
    }

    // Default coordinate setup G90 G21 / G20 G17 G54
    const initWords: NCWord[] = [
      { letter: "G", value: "90", rawText: "G90" },
      { letter: "G", value: headerPolicy.unitsCode.slice(1), rawText: headerPolicy.unitsCode },
      { letter: "G", value: "17", rawText: "G17" },
      { letter: "G", value: "54", rawText: "G54" },
      { letter: "G", value: "40", rawText: "G40" },
      { letter: "G", value: "80", rawText: "G80" },
      { letter: "G", value: "49", rawText: "G49" }
    ];
    addBlock(initWords, "Default Modal Initialization");

    let prevPos = { x: Number.NaN, y: Number.NaN, z: Number.NaN, a: Number.NaN, b: Number.NaN, c: Number.NaN };

    // 3. Process IR Commands
    for (const cmd of ir.commands) {
      switch (cmd.type) {
        case NCCommandType.PROGRAM_START:
          // Handled by header
          break;

        case NCCommandType.TOOL_CHANGE: {
          const tNum = cmd.textParams?.toolNumber || 1;
          const hNum = cmd.textParams?.offsetNumber || tNum;

          // Safe Z retract before tool change
          addBlock([
            { letter: "G", value: "00", rawText: "G00" },
            { letter: "Z", value: machineProfile.safePositions.Z || 50.0, rawText: `Z${NCFormatter.formatNumber(machineProfile.safePositions.Z || 50.0, precision.linearPrecision, precision.stripTrailingZeros)}` }
          ], "Safe Retract Z");

          // Stop spindle and coolant
          addBlock([{ letter: "M", value: "05", rawText: "M05" }, { letter: "M", value: "09", rawText: "M09" }], "Spindle & Coolant Stop");

          // Tool call
          addBlock([
            { letter: "T", value: tNum, rawText: `T${tNum}` },
            { letter: "M", value: "06", rawText: "M06" }
          ], `Tool Change to T${tNum}`);

          // Tool length compensation
          addBlock([
            { letter: "G", value: "43", rawText: "G43" },
            { letter: "H", value: hNum, rawText: `H${hNum}` }
          ], "Apply Tool Length Offset");

          modalState.activeTool = tNum;
          modalState.toolLengthOffsetActive = true;
          break;
        }

        case NCCommandType.SPINDLE_START: {
          const dir = cmd.textParams?.direction || SpindleDirection.CW;
          const rpm = cmd.textParams?.rpm || 1000;
          const mCode = dir === SpindleDirection.CW ? "M03" : "M04";

          addBlock([
            { letter: "S", value: rpm, rawText: `S${NCFormatter.formatNumber(rpm, precision.spindlePrecision)}` },
            { letter: "M", value: mCode.slice(1), rawText: mCode }
          ], `Spindle Start ${rpm} RPM ${dir}`);

          modalState.spindleState = dir;
          modalState.activeSpindleRPM = rpm;
          break;
        }

        case NCCommandType.SPINDLE_STOP: {
          addBlock([{ letter: "M", value: "05", rawText: "M05" }], "Spindle Stop");
          modalState.spindleState = SpindleDirection.STOP;
          break;
        }

        case NCCommandType.COOLANT_ON: {
          addBlock([{ letter: "M", value: "08", rawText: "M08" }], "Coolant ON (Flood)");
          modalState.coolantActive = true;
          break;
        }

        case NCCommandType.COOLANT_OFF: {
          addBlock([{ letter: "M", value: "09", rawText: "M09" }], "Coolant OFF");
          modalState.coolantActive = false;
          break;
        }

        case NCCommandType.RAPID_MOVE: {
          if (!cmd.point) break;
          const words: NCWord[] = [];
          if (modalState.motionGCode !== "G00") {
            words.push({ letter: "G", value: "00", rawText: "G00" });
            modalState.motionGCode = "G00";
          }
          const pt = cmd.point;
          if (pt.position.x !== prevPos.x) {
            const xStr = NCFormatter.formatNumber(pt.position.x, precision.linearPrecision, precision.stripTrailingZeros);
            words.push({ letter: axisMapping.x, value: pt.position.x, rawText: `${axisMapping.x}${xStr}` });
            prevPos.x = pt.position.x;
          }
          if (pt.position.y !== prevPos.y) {
            const yStr = NCFormatter.formatNumber(pt.position.y, precision.linearPrecision, precision.stripTrailingZeros);
            words.push({ letter: axisMapping.y, value: pt.position.y, rawText: `${axisMapping.y}${yStr}` });
            prevPos.y = pt.position.y;
          }
          if (pt.position.z !== prevPos.z) {
            const zStr = NCFormatter.formatNumber(pt.position.z, precision.linearPrecision, precision.stripTrailingZeros);
            words.push({ letter: axisMapping.z, value: pt.position.z, rawText: `${axisMapping.z}${zStr}` });
            prevPos.z = pt.position.z;
          }
          if (pt.rotaryAxes?.a !== undefined && pt.rotaryAxes.a !== prevPos.a && axisMapping.a) {
            const aStr = NCFormatter.formatNumber(pt.rotaryAxes.a, precision.rotaryPrecision, precision.stripTrailingZeros);
            words.push({ letter: axisMapping.a, value: pt.rotaryAxes.a, rawText: `${axisMapping.a}${aStr}` });
            prevPos.a = pt.rotaryAxes.a;
          }
          if (pt.rotaryAxes?.c !== undefined && pt.rotaryAxes.c !== prevPos.c && axisMapping.c) {
            const cStr = NCFormatter.formatNumber(pt.rotaryAxes.c, precision.rotaryPrecision, precision.stripTrailingZeros);
            words.push({ letter: axisMapping.c, value: pt.rotaryAxes.c, rawText: `${axisMapping.c}${cStr}` });
            prevPos.c = pt.rotaryAxes.c;
          }

          if (words.length > 0) {
            addBlock(words, undefined, cmd);
          }
          break;
        }

        case NCCommandType.LINEAR_MOVE: {
          if (!cmd.point) break;
          const words: NCWord[] = [];
          if (modalState.motionGCode !== "G01") {
            words.push({ letter: "G", value: "01", rawText: "G01" });
            modalState.motionGCode = "G01";
          }
          const pt = cmd.point;
          if (pt.position.x !== prevPos.x || words.length > 0) {
            const xStr = NCFormatter.formatNumber(pt.position.x, precision.linearPrecision, precision.stripTrailingZeros);
            words.push({ letter: axisMapping.x, value: pt.position.x, rawText: `${axisMapping.x}${xStr}` });
            prevPos.x = pt.position.x;
          }
          if (pt.position.y !== prevPos.y) {
            const yStr = NCFormatter.formatNumber(pt.position.y, precision.linearPrecision, precision.stripTrailingZeros);
            words.push({ letter: axisMapping.y, value: pt.position.y, rawText: `${axisMapping.y}${yStr}` });
            prevPos.y = pt.position.y;
          }
          if (pt.position.z !== prevPos.z) {
            const zStr = NCFormatter.formatNumber(pt.position.z, precision.linearPrecision, precision.stripTrailingZeros);
            words.push({ letter: axisMapping.z, value: pt.position.z, rawText: `${axisMapping.z}${zStr}` });
            prevPos.z = pt.position.z;
          }
          if (pt.rotaryAxes?.a !== undefined && pt.rotaryAxes.a !== prevPos.a && axisMapping.a) {
            const aStr = NCFormatter.formatNumber(pt.rotaryAxes.a, precision.rotaryPrecision, precision.stripTrailingZeros);
            words.push({ letter: axisMapping.a, value: pt.rotaryAxes.a, rawText: `${axisMapping.a}${aStr}` });
            prevPos.a = pt.rotaryAxes.a;
          }
          if (pt.rotaryAxes?.c !== undefined && pt.rotaryAxes.c !== prevPos.c && axisMapping.c) {
            const cStr = NCFormatter.formatNumber(pt.rotaryAxes.c, precision.rotaryPrecision, precision.stripTrailingZeros);
            words.push({ letter: axisMapping.c, value: pt.rotaryAxes.c, rawText: `${axisMapping.c}${cStr}` });
            prevPos.c = pt.rotaryAxes.c;
          }

          if (pt.feedRate > 0 && pt.feedRate !== modalState.activeFeedRate) {
            const fStr = NCFormatter.formatNumber(pt.feedRate, precision.feedPrecision, precision.stripTrailingZeros);
            words.push({ letter: "F", value: pt.feedRate, rawText: `F${fStr}` });
            modalState.activeFeedRate = pt.feedRate;
          }

          if (words.length > 0) {
            addBlock(words, undefined, cmd);
          }
          break;
        }

        case NCCommandType.ARC_MOVE: {
          if (!cmd.point) break;
          const arc = cmd.textParams || cmd.point.arcParameters;
          const dir = arc?.direction === ArcDirection.CCW ? "G03" : "G02";
          const words: NCWord[] = [{ letter: "G", value: dir.slice(1), rawText: dir }];
          modalState.motionGCode = dir;

          const pt = cmd.point;
          const xStr = NCFormatter.formatNumber(pt.position.x, precision.linearPrecision, precision.stripTrailingZeros);
          const yStr = NCFormatter.formatNumber(pt.position.y, precision.linearPrecision, precision.stripTrailingZeros);
          const zStr = NCFormatter.formatNumber(pt.position.z, precision.linearPrecision, precision.stripTrailingZeros);

          words.push({ letter: axisMapping.x, value: pt.position.x, rawText: `${axisMapping.x}${xStr}` });
          words.push({ letter: axisMapping.y, value: pt.position.y, rawText: `${axisMapping.y}${yStr}` });
          words.push({ letter: axisMapping.z, value: pt.position.z, rawText: `${axisMapping.z}${zStr}` });

          if (arc?.radius) {
            const rStr = NCFormatter.formatNumber(arc.radius, precision.linearPrecision, precision.stripTrailingZeros);
            words.push({ letter: "R", value: arc.radius, rawText: `R${rStr}` });
          } else if (arc?.center) {
            const iOffset = arc.center.x - (Number.isNaN(prevPos.x) ? 0 : prevPos.x);
            const jOffset = arc.center.y - (Number.isNaN(prevPos.y) ? 0 : prevPos.y);
            const iStr = NCFormatter.formatNumber(iOffset, precision.linearPrecision, precision.stripTrailingZeros);
            const jStr = NCFormatter.formatNumber(jOffset, precision.linearPrecision, precision.stripTrailingZeros);
            words.push({ letter: "I", value: iOffset, rawText: `I${iStr}` });
            words.push({ letter: "J", value: jOffset, rawText: `J${jStr}` });
          }

          if (pt.feedRate > 0 && pt.feedRate !== modalState.activeFeedRate) {
            const fStr = NCFormatter.formatNumber(pt.feedRate, precision.feedPrecision, precision.stripTrailingZeros);
            words.push({ letter: "F", value: pt.feedRate, rawText: `F${fStr}` });
            modalState.activeFeedRate = pt.feedRate;
          }

          prevPos.x = pt.position.x;
          prevPos.y = pt.position.y;
          prevPos.z = pt.position.z;

          addBlock(words, undefined, cmd);
          break;
        }

        case NCCommandType.DWELL: {
          const sec = cmd.textParams?.seconds || 1.0;
          const pVal = Math.round(sec * 1000);
          addBlock([
            { letter: "G", value: "04", rawText: "G04" },
            { letter: "P", value: pVal, rawText: `P${pVal}` }
          ], `Dwell ${sec}s`);
          break;
        }

        case NCCommandType.CANNED_CYCLE: {
          if (!cmd.point) break;
          const params = cmd.textParams || cmd.point.cycleParameters;
          const gCode = params?.type === CannedCycleType.PECK_DRILL ? "G83" : "G81";
          const zDepth = params?.zDepth || cmd.point.position.z;
          const rPlane = params?.rPlane || 2.0;

          const words: NCWord[] = [
            { letter: "G", value: gCode.slice(1), rawText: gCode },
            { letter: "Z", value: zDepth, rawText: `Z${NCFormatter.formatNumber(zDepth, precision.linearPrecision)}` },
            { letter: "R", value: rPlane, rawText: `R${NCFormatter.formatNumber(rPlane, precision.linearPrecision)}` }
          ];

          if (params?.peckDepth && params.type === CannedCycleType.PECK_DRILL) {
            words.push({ letter: "Q", value: params.peckDepth, rawText: `Q${NCFormatter.formatNumber(params.peckDepth, precision.linearPrecision)}` });
          }

          if (cmd.point.feedRate > 0) {
            words.push({ letter: "F", value: cmd.point.feedRate, rawText: `F${NCFormatter.formatNumber(cmd.point.feedRate, precision.feedPrecision)}` });
          }

          addBlock(words, `Canned Cycle ${params?.type}`, cmd);
          break;
        }

        case NCCommandType.PROGRAM_END:
          // Handled by footer
          break;

        default:
          if (cmd.comment) {
            addBlock([], cmd.comment);
          }
          break;
      }
    }

    // 4. Program Footer
    addBlock([{ letter: "G", value: "80", rawText: "G80" }], "Cancel Canned Cycles");
    addBlock([{ letter: "M", value: footerPolicy.coolantOffMCode.slice(1), rawText: footerPolicy.coolantOffMCode }], "Coolant Off");
    addBlock([{ letter: "M", value: footerPolicy.spindleStopMCode.slice(1), rawText: footerPolicy.spindleStopMCode }], "Spindle Stop");

    for (const retLine of footerPolicy.retractHomeGCode) {
      const words: NCWord[] = retLine.split(" ").filter(s => s.length > 0).map(tok => ({
        letter: tok.charAt(0),
        value: tok.slice(1),
        rawText: tok
      }));
      addBlock(words, "Retract Home");
    }

    addBlock([{ letter: "M", value: footerPolicy.programEndMCode.slice(1), rawText: footerPolicy.programEndMCode }], "Program End");

    const rawText = blocks.map(b => b.lineText).join("\n");

    traceEntries.push({
      step: "NC_FORMATTING_COMPLETE",
      inputSummary: `Processed ${ir.commands.length} IR commands`,
      transformation: "Generated NCBlocks and consolidated raw G-Code text",
      decision: "Complete NC program formed",
      outputSummary: `Total ${blocks.length} NC blocks formatted`
    });

    return { blocks, rawText, errors };
  }
}
