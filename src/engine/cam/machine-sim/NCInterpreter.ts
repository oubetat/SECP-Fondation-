/**
 * SECP Industrial OS - PATCH-264: Machine Simulation Engine
 * NC Interpreter: Multi-Dialect Controller Line-by-Line Interpreter
 */

import { ControllerDialect } from '../post-processor/PostTypes';
import { ModalSimulationState, CoolantState, Vector3D } from './MachineSimulationTypes';

export interface InterpretedBlockCommand {
  blockIndex: number;
  rawText: string;
  commandType: 'MOTION' | 'DWELL' | 'TOOL_CHANGE' | 'SPINDLE_CHANGE' | 'COOLANT_CHANGE' | 'WCS_CHANGE' | 'MISC';
  targetAxes: {
    x?: number;
    y?: number;
    z?: number;
    a?: number;
    b?: number;
    c?: number;
  };
  arcCenterOffsets?: {
    i?: number;
    j?: number;
    k?: number;
    r?: number;
  };
  feedrate?: number;
  spindleRpm?: number;
  toolNumber?: number;
  lengthOffsetH?: number;
  radiusOffsetD?: number;
  dwellSec?: number;
  cannedCycleParams?: {
    rPlane?: number;
    depthZ?: number;
    peckQ?: number;
    dwellP?: number;
  };
  isRapid: boolean;
  isCutting: boolean;
  isArc: boolean;
  arcDirection?: 'CW' | 'CCW';
  rtcpCommand?: 'ENABLE' | 'DISABLE';
}

export class NCInterpreter {
  private dialect: ControllerDialect;
  private currentModal: ModalSimulationState;

  constructor(dialect: ControllerDialect = 'FANUC_31I') {
    this.dialect = dialect;
    this.currentModal = this.getInitialModalState();
  }

  public getInitialModalState(): ModalSimulationState {
    return {
      units: 'METRIC',
      distanceMode: 'ABSOLUTE',
      feedMode: 'UNITS_PER_MINUTE',
      motionMode: 'RAPID',
      activePlane: 'XY',
      activeWcs: 'G54',
      activeToolNumber: 1,
      activeLengthOffsetH: 1,
      activeRadiusOffsetD: 0,
      spindleState: 'STOPPED',
      spindleRpm: 0,
      feedrate: 1000,
      coolant: 'OFF',
      rtcpActive: false,
    };
  }

  public getModalState(): ModalSimulationState {
    return { ...this.currentModal };
  }

  public reset(): void {
    this.currentModal = this.getInitialModalState();
  }

  public interpretLine(rawLine: string, blockIndex: number): InterpretedBlockCommand {
    const cleanLine = this.stripComments(rawLine).trim();
    const command: InterpretedBlockCommand = {
      blockIndex,
      rawText: rawLine,
      commandType: 'MISC',
      targetAxes: {},
      isRapid: false,
      isCutting: false,
      isArc: false,
    };

    if (!cleanLine) {
      return command;
    }

    const words = this.extractWords(cleanLine);
    let hasMotion = false;

    for (const { letter, value, text } of words) {
      switch (letter) {
        // G-Codes
        case 'G': {
          const gVal = Math.round(value * 10) / 10;
          switch (gVal) {
            case 0:
              this.currentModal.motionMode = 'RAPID';
              command.isRapid = true;
              hasMotion = true;
              break;
            case 1:
              this.currentModal.motionMode = 'LINEAR';
              command.isCutting = true;
              hasMotion = true;
              break;
            case 2:
              this.currentModal.motionMode = 'CW_ARC';
              command.isCutting = true;
              command.isArc = true;
              command.arcDirection = 'CW';
              hasMotion = true;
              break;
            case 3:
              this.currentModal.motionMode = 'CCW_ARC';
              command.isCutting = true;
              command.isArc = true;
              command.arcDirection = 'CCW';
              hasMotion = true;
              break;
            case 4:
              command.commandType = 'DWELL';
              break;
            case 17:
              this.currentModal.activePlane = 'XY';
              break;
            case 18:
              this.currentModal.activePlane = 'XZ';
              break;
            case 19:
              this.currentModal.activePlane = 'YZ';
              break;
            case 20:
              this.currentModal.units = 'INCH';
              break;
            case 21:
              this.currentModal.units = 'METRIC';
              break;
            case 40:
              this.currentModal.activeRadiusOffsetD = 0;
              break;
            case 41:
            case 42:
              // Cutter compensation handled via D register
              break;
            case 43:
              // Tool length compensation
              break;
            case 43.4:
              // Fanuc RTCP / TCPC
              this.currentModal.rtcpActive = true;
              command.rtcpCommand = 'ENABLE';
              break;
            case 49:
              // Cancel length comp / RTCP
              this.currentModal.rtcpActive = false;
              command.rtcpCommand = 'DISABLE';
              break;
            case 54:
            case 55:
            case 56:
            case 57:
            case 58:
            case 59:
              this.currentModal.activeWcs = `G${Math.round(gVal)}`;
              command.commandType = 'WCS_CHANGE';
              break;
            case 81:
            case 82:
            case 83:
            case 84:
            case 85:
              this.currentModal.motionMode = 'CANNED_CYCLE';
              command.isCutting = true;
              hasMotion = true;
              break;
            case 90:
              this.currentModal.distanceMode = 'ABSOLUTE';
              break;
            case 91:
              this.currentModal.distanceMode = 'INCREMENTAL';
              break;
            case 94:
              this.currentModal.feedMode = 'UNITS_PER_MINUTE';
              break;
            case 95:
              this.currentModal.feedMode = 'UNITS_PER_REV';
              break;
          }
          break;
        }

        // M-Codes
        case 'M': {
          const mVal = Math.round(value);
          switch (mVal) {
            case 3:
              this.currentModal.spindleState = 'CW';
              command.commandType = 'SPINDLE_CHANGE';
              break;
            case 4:
              this.currentModal.spindleState = 'CCW';
              command.commandType = 'SPINDLE_CHANGE';
              break;
            case 5:
              this.currentModal.spindleState = 'STOPPED';
              command.commandType = 'SPINDLE_CHANGE';
              break;
            case 6:
              command.commandType = 'TOOL_CHANGE';
              break;
            case 7:
              this.currentModal.coolant = 'MIST';
              command.commandType = 'COOLANT_CHANGE';
              break;
            case 8:
              this.currentModal.coolant = 'FLOOD';
              command.commandType = 'COOLANT_CHANGE';
              break;
            case 9:
              this.currentModal.coolant = 'OFF';
              command.commandType = 'COOLANT_CHANGE';
              break;
            case 128:
              // Heidenhain M128 TCPM
              this.currentModal.rtcpActive = true;
              command.rtcpCommand = 'ENABLE';
              break;
            case 129:
              this.currentModal.rtcpActive = false;
              command.rtcpCommand = 'DISABLE';
              break;
          }
          break;
        }

        // Axes
        case 'X':
          command.targetAxes.x = value;
          hasMotion = true;
          break;
        case 'Y':
          command.targetAxes.y = value;
          hasMotion = true;
          break;
        case 'Z':
          command.targetAxes.z = value;
          hasMotion = true;
          break;
        case 'A':
          command.targetAxes.a = value;
          hasMotion = true;
          break;
        case 'B':
          command.targetAxes.b = value;
          hasMotion = true;
          break;
        case 'C':
          command.targetAxes.c = value;
          hasMotion = true;
          break;

        // Arc offsets
        case 'I':
          command.arcCenterOffsets = command.arcCenterOffsets || {};
          command.arcCenterOffsets.i = value;
          break;
        case 'J':
          command.arcCenterOffsets = command.arcCenterOffsets || {};
          command.arcCenterOffsets.j = value;
          break;
        case 'K':
          command.arcCenterOffsets = command.arcCenterOffsets || {};
          command.arcCenterOffsets.k = value;
          break;
        case 'R':
          command.arcCenterOffsets = command.arcCenterOffsets || {};
          command.arcCenterOffsets.r = value;
          break;

        // Feed, Speed, Tool
        case 'F':
          this.currentModal.feedrate = value;
          command.feedrate = value;
          break;
        case 'S':
          this.currentModal.spindleRpm = value;
          command.spindleRpm = value;
          break;
        case 'T':
          this.currentModal.activeToolNumber = Math.round(value);
          command.toolNumber = Math.round(value);
          break;
        case 'H':
          this.currentModal.activeLengthOffsetH = Math.round(value);
          command.lengthOffsetH = Math.round(value);
          break;
        case 'D':
          this.currentModal.activeRadiusOffsetD = Math.round(value);
          command.radiusOffsetD = Math.round(value);
          break;
        case 'P':
          command.dwellSec = value / 1000.0;
          break;
        case 'Q':
          command.cannedCycleParams = command.cannedCycleParams || {};
          command.cannedCycleParams.peckQ = value;
          break;
      }
    }

    // Siemens TRAORI / CYCLE800 syntax check
    if (cleanLine.toUpperCase().includes('TRAORI')) {
      this.currentModal.rtcpActive = true;
      command.rtcpCommand = 'ENABLE';
    } else if (cleanLine.toUpperCase().includes('TRAFOOF')) {
      this.currentModal.rtcpActive = false;
      command.rtcpCommand = 'DISABLE';
    }

    if (hasMotion) {
      command.commandType = 'MOTION';
      if (this.currentModal?.motionMode === 'RAPID') {
        command.isRapid = true;
        command.isCutting = false;
      } else {
        command.isCutting = true;
        command.isRapid = false;
        if (this.currentModal?.motionMode === 'CW_ARC') {
          command.isArc = true;
          command.arcDirection = 'CW';
        } else if (this.currentModal?.motionMode === 'CCW_ARC') {
          command.isArc = true;
          command.arcDirection = 'CCW';
        }
      }
    }

    return command;
  }

  private extractWords(line: string): Array<{ letter: string; value: number; text: string }> {
    const words: Array<{ letter: string; value: number; text: string }> = [];
    const regex = /([A-Za-z])([+-]?\d*\.?\d+)/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(line)) !== null) {
      words.push({
        letter: match[1].toUpperCase(),
        value: parseFloat(match[2]),
        text: match[0],
      });
    }

    return words;
  }

  private stripComments(line: string): string {
    return line.replace(/\(.*?\)/g, '').replace(/;.*$/, '').trim();
  }
}
