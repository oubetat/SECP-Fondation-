import {
  ArcPlane,
  CutterCompensationMode,
  FeedMode,
  SpindleDirection,
  SpindleMode
} from "../post/types";
import {
  ModalStateSnapshot,
  ParsedNCBlock,
  SemanticErrorCode
} from "./types";

export interface ModalStateTransition {
  lineNumber: number;
  blockText: string;
  stateBefore: ModalStateSnapshot;
  stateAfter: ModalStateSnapshot;
  changedModals: string[];
  semanticErrors: {
    code: SemanticErrorCode;
    message: string;
  }[];
}

export class ModalStateEngine {
  private currentState: ModalStateSnapshot;

  constructor(initialDefaults?: Partial<ModalStateSnapshot>) {
    this.currentState = this.createDefaultState(initialDefaults);
  }

  public createDefaultState(overrides?: Partial<ModalStateSnapshot>): ModalStateSnapshot {
    return {
      units: overrides?.units ?? "METRIC_MM",
      distanceMode: overrides?.distanceMode ?? "ABSOLUTE",
      plane: overrides?.plane ?? ArcPlane.XY_G17,
      feedMode: overrides?.feedMode ?? FeedMode.FEED_PER_MINUTE,
      coordinateSystem: overrides?.coordinateSystem ?? "G54",
      motionMode: overrides?.motionMode ?? "G00",
      activeTool: overrides?.activeTool ?? 1,
      toolLengthOffset: overrides?.toolLengthOffset ?? { active: false, offsetNumber: 1, lengthMM: 0 },
      toolRadiusOffset: overrides?.toolRadiusOffset ?? { active: false, offsetNumber: 1, radiusMM: 0 },
      cutterCompensation: overrides?.cutterCompensation ?? CutterCompensationMode.NONE,
      spindleState: overrides?.spindleState ?? { direction: SpindleDirection.STOP, mode: SpindleMode.RPM, rpm: 0, css: 0 },
      coolantState: overrides?.coolantState ?? { flood: false, mist: false, throughSpindle: false, air: false }
    };
  }

  public getCurrentState(): ModalStateSnapshot {
    return JSON.parse(JSON.stringify(this.currentState));
  }

  public reset(state?: Partial<ModalStateSnapshot>): void {
    this.currentState = this.createDefaultState(state);
  }

  /**
   * Processes an NC block and updates modal states, returning the full transition record.
   */
  public processBlock(block: ParsedNCBlock): ModalStateTransition {
    const stateBefore = this.getCurrentState();
    const stateAfter = this.getCurrentState();
    const changedModals: string[] = [];
    const semanticErrors: ModalStateTransition["semanticErrors"] = [];

    const words = block.words;

    for (const w of words) {
      const letter = w.letter;
      const val = Number(w.value);

      // G-Codes
      if (letter === "G") {
        switch (val) {
          // Motion
          case 0:
            if (stateAfter.motionMode !== "G00") {
              stateAfter.motionMode = "G00";
              changedModals.push("motionMode");
            }
            break;
          case 1:
            if (stateAfter.motionMode !== "G01") {
              stateAfter.motionMode = "G01";
              changedModals.push("motionMode");
            }
            break;
          case 2:
            if (stateAfter.motionMode !== "G02") {
              stateAfter.motionMode = "G02";
              changedModals.push("motionMode");
            }
            break;
          case 3:
            if (stateAfter.motionMode !== "G03") {
              stateAfter.motionMode = "G03";
              changedModals.push("motionMode");
            }
            break;

          // Planes
          case 17:
            if (stateAfter.plane !== ArcPlane.XY_G17) {
              stateAfter.plane = ArcPlane.XY_G17;
              changedModals.push("plane");
            }
            break;
          case 18:
            if (stateAfter.plane !== ArcPlane.XZ_G18) {
              stateAfter.plane = ArcPlane.XZ_G18;
              changedModals.push("plane");
            }
            break;
          case 19:
            if (stateAfter.plane !== ArcPlane.YZ_G19) {
              stateAfter.plane = ArcPlane.YZ_G19;
              changedModals.push("plane");
            }
            break;

          // Units
          case 20:
            if (stateAfter.units !== "IMPERIAL_INCH") {
              stateAfter.units = "IMPERIAL_INCH";
              changedModals.push("units");
            }
            break;
          case 21:
            if (stateAfter.units !== "METRIC_MM") {
              stateAfter.units = "METRIC_MM";
              changedModals.push("units");
            }
            break;

          // Distance mode
          case 90:
            if (stateAfter.distanceMode !== "ABSOLUTE") {
              stateAfter.distanceMode = "ABSOLUTE";
              changedModals.push("distanceMode");
            }
            break;
          case 91:
            if (stateAfter.distanceMode !== "INCREMENTAL") {
              stateAfter.distanceMode = "INCREMENTAL";
              changedModals.push("distanceMode");
            }
            break;

          // Feed mode
          case 93:
            if (stateAfter.feedMode !== FeedMode.INVERSE_TIME) {
              stateAfter.feedMode = FeedMode.INVERSE_TIME;
              changedModals.push("feedMode");
            }
            break;
          case 94:
            if (stateAfter.feedMode !== FeedMode.FEED_PER_MINUTE) {
              stateAfter.feedMode = FeedMode.FEED_PER_MINUTE;
              changedModals.push("feedMode");
            }
            break;
          case 95:
            if (stateAfter.feedMode !== FeedMode.FEED_PER_REVOLUTION) {
              stateAfter.feedMode = FeedMode.FEED_PER_REVOLUTION;
              changedModals.push("feedMode");
            }
            break;

          // Cutter Comp
          case 40:
            if (stateAfter.cutterCompensation !== CutterCompensationMode.NONE) {
              stateAfter.cutterCompensation = CutterCompensationMode.NONE;
              changedModals.push("cutterCompensation");
            }
            break;
          case 41:
            if (stateAfter.cutterCompensation === CutterCompensationMode.LEFT) {
              semanticErrors.push({
                code: SemanticErrorCode.DOUBLE_COMPENSATION,
                message: `Duplicate G41 left cutter compensation applied at line ${block.lineNumber}`
              });
            }
            stateAfter.cutterCompensation = CutterCompensationMode.LEFT;
            changedModals.push("cutterCompensation");
            break;
          case 42:
            if (stateAfter.cutterCompensation === CutterCompensationMode.RIGHT) {
              semanticErrors.push({
                code: SemanticErrorCode.DOUBLE_COMPENSATION,
                message: `Duplicate G42 right cutter compensation applied at line ${block.lineNumber}`
              });
            }
            stateAfter.cutterCompensation = CutterCompensationMode.RIGHT;
            changedModals.push("cutterCompensation");
            break;

          // Tool Length Offset
          case 43:
            stateAfter.toolLengthOffset.active = true;
            changedModals.push("toolLengthOffset");
            break;
          case 49:
            stateAfter.toolLengthOffset.active = false;
            changedModals.push("toolLengthOffset");
            break;

          // Work Offsets (G54 - G59)
          case 54: case 55: case 56: case 57: case 58: case 59:
            const wcsStr = `G${val}`;
            if (stateAfter.coordinateSystem !== wcsStr) {
              stateAfter.coordinateSystem = wcsStr;
              changedModals.push("coordinateSystem");
            }
            break;

          // Canned Cycles
          case 80:
            stateAfter.motionMode = "G00"; // Cancel cycles
            changedModals.push("motionMode");
            break;
          case 81: case 82: case 83: case 84: case 85: case 86: case 87: case 88: case 89:
            stateAfter.motionMode = `G${val}`;
            changedModals.push("motionMode");
            break;
        }
      }

      // M-Codes
      if (letter === "M") {
        switch (val) {
          case 3:
            stateAfter.spindleState.direction = SpindleDirection.CW;
            changedModals.push("spindleState");
            break;
          case 4:
            stateAfter.spindleState.direction = SpindleDirection.CCW;
            changedModals.push("spindleState");
            break;
          case 5:
            stateAfter.spindleState.direction = SpindleDirection.STOP;
            stateAfter.spindleState.rpm = 0;
            changedModals.push("spindleState");
            break;
          case 6:
            // Tool change execution
            changedModals.push("activeTool");
            break;
          case 7:
            stateAfter.coolantState.mist = true;
            changedModals.push("coolantState");
            break;
          case 8:
            stateAfter.coolantState.flood = true;
            changedModals.push("coolantState");
            break;
          case 9:
            stateAfter.coolantState.flood = false;
            stateAfter.coolantState.mist = false;
            stateAfter.coolantState.throughSpindle = false;
            stateAfter.coolantState.air = false;
            changedModals.push("coolantState");
            break;
        }
      }

      // Tool word
      if (letter === "T") {
        stateAfter.activeTool = Math.floor(val);
        changedModals.push("activeTool");
      }

      // Tool offset registers
      if (letter === "H") {
        stateAfter.toolLengthOffset.offsetNumber = Math.floor(val);
      }
      if (letter === "D") {
        stateAfter.toolRadiusOffset.offsetNumber = Math.floor(val);
      }

      // Spindle Speed
      if (letter === "S") {
        stateAfter.spindleState.rpm = val;
        changedModals.push("spindleRPM");
      }
    }

    this.currentState = stateAfter;

    return {
      lineNumber: block.lineNumber,
      blockText: block.sourceText,
      stateBefore,
      stateAfter,
      changedModals,
      semanticErrors
    };
  }
}
