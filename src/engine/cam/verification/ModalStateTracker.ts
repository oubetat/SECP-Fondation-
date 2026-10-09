/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-263 — Modal State Tracker
 * 
 * Tracks the complete CNC machine modal state across blocks (Motion, Plane,
 * Distance, Feed, Units, Tool Length & Radius Compensation, Spindle, Coolant, WCS, RTCP).
 * Audits transitions and detects illegal modal changes.
 */

import { Vector3D } from '../../cadKernel';
import { ControllerDialect, CoordinateSystemId, UnitsMode, ActivePlane, MotionMode, FeedMode, SpindleState, CoolantState, CutterCompensationMode, RTCPMode } from '../post-processor/PostTypes';
import { ToolSnapshot } from '../tool-library/ToolTypes';
import { NCBlockTokens, NCExecutionState, MachineCoordinates, VerificationIssue } from './GCodeVerificationTypes';
import { GCodeTokenizer } from './GCodeTokenizer';

export class ModalStateTracker {
  private currentState: NCExecutionState;
  private dialect: ControllerDialect;
  private toolSnapshotsMap: Map<number, ToolSnapshot>;
  private stepCounter = 0;

  constructor(
    dialect: ControllerDialect = 'GENERIC_ISO',
    initialUnits: UnitsMode = 'METRIC_MM',
    toolSnapshots: ToolSnapshot[] = []
  ) {
    this.dialect = dialect;
    this.toolSnapshotsMap = new Map();
    for (const snap of toolSnapshots) {
      if (snap.toolNumber) {
        this.toolSnapshotsMap.set(snap.toolNumber, snap);
      }
    }

    // Initialize Default Starting Machine State
    this.currentState = {
      stepIndex: 0,
      lineIndex: 0,
      rawGCode: '',
      position: { x: 0, y: 0, z: 0, a: 0, b: 0, c: 0 },
      toolOrientation: { x: 0, y: 0, z: 1 },
      motionMode: 'G0_RAPID',
      units: initialUnits,
      plane: 'G17_XY',
      distanceMode: 'G90_ABSOLUTE',
      arcDistanceMode: 'G91.1_INCREMENTAL',
      feedMode: 'G94_UNITS_PER_MIN',
      coordinateSystem: 'G54',
      wcsOffset: { x: 0, y: 0, z: 0, a: 0, b: 0, c: 0 },
      activeToolNumber: 1,
      activeToolId: toolSnapshots.length > 0 ? toolSnapshots[0].frozenTool.toolId : undefined,
      activeToolSnapshot: toolSnapshots.length > 0 ? toolSnapshots[0] : undefined,
      activeHOffsetNumber: 1,
      activeDOffsetNumber: 1,
      toolLengthCompActive: false,
      cutterCompMode: 'G40_OFF',
      rtcpMode: 'OFF',
      spindleState: 'M5_OFF',
      spindleRpm: 0,
      feedRate: 1000,
      coolantState: 'M9_OFF',
      cycleActive: false,
      isRapid: true,
      isCutting: false
    };
  }

  /**
   * Get current state snapshot
   */
  public getState(): NCExecutionState {
    return {
      ...this.currentState,
      position: { ...this.currentState.position },
      toolOrientation: { ...this.currentState.toolOrientation },
      wcsOffset: { ...this.currentState.wcsOffset }
    };
  }

  /**
   * Process a single block tokens and update modal state, generating issues on illegal transitions
   */
  public updateWithBlock(
    block: NCBlockTokens,
    issues: VerificationIssue[]
  ): NCExecutionState {
    if (block.isEmpty || block.isCommentOnly) {
      return this.getState();
    }

    this.stepCounter++;
    const prevUnits = this.currentState.units;
    const prevCutterComp = this.currentState.cutterCompMode;
    const gCodes = block.wordsMap.get('G') || [];
    const mCodes = block.wordsMap.get('M') || [];

    // 1. Units Mode (G20/G21 or G70/G71)
    if (gCodes.includes(21) || gCodes.includes(71)) {
      this.currentState.units = 'METRIC_MM';
    } else if (gCodes.includes(20) || gCodes.includes(70)) {
      this.currentState.units = 'IMPERIAL_INCH';
    }

    if (prevUnits !== this.currentState.units && this.currentState.isCutting) {
      issues.push({
        id: `ISSUE-MODAL-${issues.length + 1}`,
        code: 'INVALID_MODAL_TRANSITION',
        severity: 'CRITICAL',
        lineIndex: block.lineIndex,
        sequenceNumber: block.sequenceNumber,
        rawGCode: block.rawText,
        message: `Illegal units mode switch from ${prevUnits} to ${this.currentState.units} while machining operation is active.`
      });
    }

    // 2. Distance Mode (G90/G91)
    if (gCodes.includes(90)) {
      this.currentState.distanceMode = 'G90_ABSOLUTE';
    } else if (gCodes.includes(91)) {
      this.currentState.distanceMode = 'G91_INCREMENTAL';
    }

    // 3. Plane Selection (G17/G18/G19)
    if (gCodes.includes(17)) {
      this.currentState.plane = 'G17_XY';
    } else if (gCodes.includes(18)) {
      this.currentState.plane = 'G18_ZX';
    } else if (gCodes.includes(19)) {
      this.currentState.plane = 'G19_YZ';
    }

    // 4. Motion Mode (G0, G1, G2, G3, G80-G89)
    if (gCodes.includes(0)) {
      this.currentState.motionMode = 'G0_RAPID';
      this.currentState.isRapid = true;
      this.currentState.isCutting = false;
      this.currentState.cycleActive = false;
    } else if (gCodes.includes(1)) {
      this.currentState.motionMode = 'G1_LINEAR';
      this.currentState.isRapid = false;
      this.currentState.isCutting = true;
      this.currentState.cycleActive = false;
    } else if (gCodes.includes(2)) {
      this.currentState.motionMode = 'G2_CW_ARC';
      this.currentState.isRapid = false;
      this.currentState.isCutting = true;
      this.currentState.cycleActive = false;
    } else if (gCodes.includes(3)) {
      this.currentState.motionMode = 'G3_CCW_ARC';
      this.currentState.isRapid = false;
      this.currentState.isCutting = true;
      this.currentState.cycleActive = false;
    } else if (gCodes.some(g => g >= 81 && g <= 89)) {
      this.currentState.motionMode = 'CANNED_CYCLE';
      this.currentState.isRapid = false;
      this.currentState.isCutting = true;
      this.currentState.cycleActive = true;
      const cycleG = gCodes.find(g => g >= 81 && g <= 89);
      this.currentState.cycleType = `G${cycleG}`;
    } else if (gCodes.includes(80)) {
      this.currentState.cycleActive = false;
    }

    // 5. Feed Mode (G94/G95/G93)
    if (gCodes.includes(94)) {
      this.currentState.feedMode = 'G94_UNITS_PER_MIN';
    } else if (gCodes.includes(95)) {
      this.currentState.feedMode = 'G95_UNITS_PER_REV';
    } else if (gCodes.includes(93)) {
      this.currentState.feedMode = 'G93_INVERSE_TIME';
    }

    // Feed Rate (F word)
    const feedVal = GCodeTokenizer.getFirstWordValue(block, 'F');
    if (feedVal !== null) {
      this.currentState.feedRate = feedVal;
    }

    // 6. Work Coordinate System (G54 - G59)
    for (let wcsNum = 54; wcsNum <= 59; wcsNum++) {
      if (gCodes.includes(wcsNum)) {
        this.currentState.coordinateSystem = `G${wcsNum}` as CoordinateSystemId;
      }
    }

    // 7. Cutter Radius Compensation (G40, G41, G42)
    if (gCodes.includes(40)) {
      this.currentState.cutterCompMode = 'G40_OFF';
    } else if (gCodes.includes(41)) {
      this.currentState.cutterCompMode = 'G41_LEFT';
      const dVal = GCodeTokenizer.getFirstWordValue(block, 'D');
      if (dVal !== null) {
        this.currentState.activeDOffsetNumber = Math.round(dVal);
      }
    } else if (gCodes.includes(42)) {
      this.currentState.cutterCompMode = 'G42_RIGHT';
      const dVal = GCodeTokenizer.getFirstWordValue(block, 'D');
      if (dVal !== null) {
        this.currentState.activeDOffsetNumber = Math.round(dVal);
      }
    }

    // 8. Tool Length Compensation (G43, G49, G43.4)
    if (gCodes.includes(49)) {
      this.currentState.toolLengthCompActive = false;
      this.currentState.rtcpMode = 'OFF';
    } else if (gCodes.includes(43.4) || (this.dialect === 'SIEMENS_840D' && block.words.some(w => w.rawValue === 'TRAORI'))) {
      this.currentState.toolLengthCompActive = true;
      this.currentState.rtcpMode = this.dialect === 'SIEMENS_840D' ? 'TRAORI_SIEMENS' : 'G43.4_FANUC_TCPC';
    } else if (gCodes.includes(43)) {
      this.currentState.toolLengthCompActive = true;
      const hVal = GCodeTokenizer.getFirstWordValue(block, 'H');
      if (hVal !== null) {
        this.currentState.activeHOffsetNumber = Math.round(hVal);
      }
    }

    // Haas TCPC G234
    if (gCodes.includes(234)) {
      this.currentState.rtcpMode = 'G234_HAAS_TCPC';
      this.currentState.toolLengthCompActive = true;
    }

    // Heidenhain M128/M129
    if (mCodes.includes(128)) {
      this.currentState.rtcpMode = 'M128_TCPM_HEIDENHAIN';
      this.currentState.toolLengthCompActive = true;
    } else if (mCodes.includes(129)) {
      this.currentState.rtcpMode = 'OFF';
    }

    // 9. Tool Selection & Change (T word, M06)
    const tVal = GCodeTokenizer.getFirstWordValue(block, 'T');
    if (tVal !== null) {
      const toolNum = Math.round(tVal);
      this.currentState.activeToolNumber = toolNum;
      const snapshot = this.toolSnapshotsMap.get(toolNum);
      if (snapshot) {
        this.currentState.activeToolId = snapshot.frozenTool.toolId;
        this.currentState.activeToolSnapshot = snapshot;
      }
    }

    // 10. Spindle Control (M3, M4, M5, S word)
    const sVal = GCodeTokenizer.getFirstWordValue(block, 'S');
    if (sVal !== null) {
      this.currentState.spindleRpm = sVal;
    }
    if (mCodes.includes(3)) {
      this.currentState.spindleState = 'M3_CW';
    } else if (mCodes.includes(4)) {
      this.currentState.spindleState = 'M4_CCW';
    } else if (mCodes.includes(5)) {
      this.currentState.spindleState = 'M5_OFF';
    }

    // 11. Coolant Control (M8, M7, M88, M9)
    if (mCodes.includes(8)) {
      this.currentState.coolantState = 'M8_FLOOD';
    } else if (mCodes.includes(7)) {
      this.currentState.coolantState = 'M7_MIST';
    } else if (mCodes.includes(88)) {
      this.currentState.coolantState = 'M88_THROUGH_SPINDLE';
    } else if (mCodes.includes(9)) {
      this.currentState.coolantState = 'M9_OFF';
    }

    // Update basic block metadata
    this.currentState.stepIndex = this.stepCounter;
    this.currentState.lineIndex = block.lineIndex;
    this.currentState.blockNumber = block.sequenceNumber;
    this.currentState.rawGCode = block.rawText;

    return this.getState();
  }

  /**
   * Update internal reconstructed position
   */
  public setPosition(pos: MachineCoordinates): void {
    this.currentState.position = { ...pos };
  }

  /**
   * Update internal reconstructed tool orientation
   */
  public setToolOrientation(orient: Vector3D): void {
    this.currentState.toolOrientation = { ...orient };
  }
}
