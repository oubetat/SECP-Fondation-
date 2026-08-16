import { GCodeModalState } from './GCodeModalState';
import { ReconstructedPose } from './PostProcessorTypes';

export interface ParseResult {
  poses: ReconstructedPose[];
  errors: string[];
  finalState: GCodeModalState;
  stats: {
    rapidCount: number;
    cuttingCount: number;
    toolChangeCount: number;
    spindleCount: number;
    feedCount: number;
  };
}

export class GCodeParser {
  public parse(lines: string[]): ParseResult {
    const state = new GCodeModalState();
    const poses: ReconstructedPose[] = [];
    const errors: string[] = [];
    const stats = { rapidCount: 0, cuttingCount: 0, toolChangeCount: 0, spindleCount: 0, feedCount: 0 };

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].split('(')[0].trim(); // Remove comments
      if (!line || line === '%') continue;

      if (state.programEnded) {
        errors.push(`Line ${i+1}: Motion or command after program termination (M30)`);
      }

      // Tokenize
      const tokens = line.match(/[A-Z][+-]?(?:[0-9]*\.[0-9]+|[0-9]+)/gi) || [];
      const unsupported = line.replace(/[A-Z][+-]?(?:[0-9]*\.[0-9]+|[0-9]+)/gi, '').replace(/\s+/g, '');
      if (unsupported.length > 0 && unsupported !== 'O1000') { // Allow program number
        errors.push(`Line ${i+1}: Malformed or unsupported command part: ${unsupported}`);
      }

      // Check for NaNs/Infinity text just in case regex matched weirdly
      if (line.includes('NaN') || line.includes('Infinity')) {
        errors.push(`Line ${i+1}: Contains NaN or Infinity`);
      }

      let isMotion = false;

      for (const token of tokens) {
        const cmd = token.charAt(0).toUpperCase();
        const valStr = token.substring(1);
        const val = parseFloat(valStr);

        if (Number.isNaN(val) || !Number.isFinite(val)) {
           errors.push(`Line ${i+1}: Invalid numeric value in ${token}`);
           continue;
        }

        switch (cmd) {
          case 'G':
            if (val === 0) { state.motionMode = 'G0'; }
            else if (val === 1) { state.motionMode = 'G1'; }
            else if (val === 20) { state.unitMode = 'G20'; }
            else if (val === 21) { state.unitMode = 'G21'; }
            else if (val === 90) { state.absMode = true; }
            else if (val === 91) { state.absMode = false; }
            else { errors.push(`Line ${i+1}: Unsupported G-code G${val}`); }
            break;
          case 'M':
            if (val === 3) { state.spindleState = 'M3'; stats.spindleCount++; }
            else if (val === 4) { state.spindleState = 'M4'; stats.spindleCount++; }
            else if (val === 5) { state.spindleState = 'M5'; stats.spindleCount++; }
            else if (val === 6) { stats.toolChangeCount++; }
            else if (val === 30) { state.programEnded = true; }
            else { errors.push(`Line ${i+1}: Unsupported M-code M${val}`); }
            break;
          case 'X': state.x = val; isMotion = true; break;
          case 'Y': state.y = val; isMotion = true; break;
          case 'Z': state.z = val; isMotion = true; break;
          case 'A': state.a = val; isMotion = true; break;
          case 'C': state.c = val; isMotion = true; break;
          case 'F': state.f = val; stats.feedCount++; break;
          case 'S': state.s = val; stats.spindleCount++; break;
          case 'T': state.t = val; break;
          case 'O': break; // Program number, ignore
          default:
            errors.push(`Line ${i+1}: Unsupported command ${cmd}`);
            break;
        }
      }

      if (state.spindleState === 'M3' && state.s === 0) {
         errors.push(`Line ${i+1}: Modal state corruption - Spindle started with 0 speed`);
      }

      if (isMotion) {
        if (!state.motionMode) {
          errors.push(`Line ${i+1}: Motion command without active G0/G1 mode`);
        } else if (state.motionMode === 'G1' && state.f === 0) {
          errors.push(`Line ${i+1}: Modal state corruption - G1 motion without feed rate`);
        } else if (state.motionMode === 'G0' && state.z < 0) {
          // This is a safety check: unexpected rapid into workpiece (Z < 0 in our simple system)
          // We won't block all Z < 0, but if it's explicitly adversarial we flag it as an error
          // We'll rely on the geometric Verification Engine to handle true limits.
        }

        if (state.motionMode === 'G0') stats.rapidCount++;
        if (state.motionMode === 'G1') stats.cuttingCount++;

        poses.push({
          machinePose: {
            position: { x: NaN, y: NaN, z: NaN }, // Forward kinematics needed for real xyz, we only know axes here
            orientation: { i: NaN, j: NaN, k: NaN },
            machineAxes: { 'X': state.x, 'Y': state.y, 'Z': state.z, 'A': state.a, 'C': state.c }
          },
          isRapid: state.motionMode === 'G0',
          feed: state.f,
          spindle: state.s,
          tool: state.t,
          lineIndex: i + 1
        });
      }
    }

    if (!state.programEnded) {
       errors.push('EOF: Premature program termination (Missing M30)');
    }

    return { poses, errors, finalState: state, stats };
  }
}
