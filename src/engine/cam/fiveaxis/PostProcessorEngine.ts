/**
 * SECP Industrial OS v3 — PATCH-179: 5-Axis Post-Processor & G-Code Engine
 * Translates generic simultaneous 5-axis toolpaths into controller-specific NC programs
 * for Heidenhain, Siemens 840D, Fanuc 31i, Haas NGC, and Standard ISO.
 */

import { Vector3D } from '../../cadKernel';
import { 
  FiveAxisTrajectory, 
  MachineDefinition, 
  PostProcessedProgram, 
  GCodeBlock, 
  FiveAxisToolpathPoint 
} from './FiveAxisTypes';
import { generateDeterministicHashSync } from '../../../lib/hash';

export class PostProcessorEngine {
  /**
   * Generates production-ready NC G-Code from a verified 5-axis toolpath trajectory
   */
  public static postProcess(
    trajectory: FiveAxisTrajectory,
    machine: MachineDefinition,
    programNumber: number = 1001
  ): PostProcessedProgram {
    const controller = machine.controller || 'HEIDENHAIN_TNC640';
    const blocks: GCodeBlock[] = [];
    const header: string[] = [];
    const footer: string[] = [];
    let lineNum = 10;

    // Header metadata
    header.push(`; SECP INDUSTRIAL 5-AXIS CAM POST-PROCESSOR V3.0`);
    header.push(`; PROGRAM: O${programNumber} — ${trajectory.operationName}`);
    header.push(`; MACHINE: ${machine.name} (${machine.topology})`);
    header.push(`; CONTROLLER: ${controller}`);
    header.push(`; TOOL: T01 ${trajectory.tool.name} (D=${trajectory.tool.diameterMm}mm, R=${trajectory.tool.cornerRadMm}mm)`);
    header.push(`; HOLDER: ${trajectory.tool.holder.name} (Clearance Margin: ${trajectory.tool.holder.clearanceMarginMm}mm)`);
    header.push(`; TIMESTAMP: ${new Date().toISOString()}`);

    if (controller === 'HEIDENHAIN_TNC640') {
      header.push(`BEGIN PGM ${programNumber} MM`);
      header.push(`BLK FORM 0.1 Z X-100 Y-100 Z-50`);
      header.push(`BLK FORM 0.2 X+100 Y+100 Z+0`);
      header.push(`TOOL CALL 1 Z S${trajectory.points[0]?.spindleRpm || 12000}`);
      header.push(`FUNCTION TCPM F TCP AXIS POS PATHCTRL AXIS`);
    } else if (controller === 'SIEMENS_840D') {
      header.push(`;$PATH=/_N_WKS_DIR/_N_PART_WPD`);
      header.push(`N${lineNum++} G90 G94 G710 G64`);
      header.push(`N${lineNum++} T="T_${trajectory.tool.name.replace(/\s+/g, '_')}" M6`);
      header.push(`N${lineNum++} S${trajectory.points[0]?.spindleRpm || 12000} M3`);
      header.push(`N${lineNum++} TRAORI`);
    } else if (controller === 'FANUC_31I') {
      header.push(`%`);
      header.push(`O${programNumber} (${trajectory.operationName})`);
      header.push(`N${lineNum++} G90 G17 G40 G49 G80`);
      header.push(`N${lineNum++} T01 M06`);
      header.push(`N${lineNum++} S${trajectory.points[0]?.spindleRpm || 12000} M03`);
      header.push(`N${lineNum++} G43.4 H01`); // Fanuc Tool Center Point Control (TCPC)
    } else if (controller === 'HAAS_NGC') {
      header.push(`%`);
      header.push(`O${programNumber}`);
      header.push(`N${lineNum++} T1 M06`);
      header.push(`N${lineNum++} S${trajectory.points[0]?.spindleRpm || 12000} M03`);
      header.push(`N${lineNum++} G234 H01`); // Haas TCPC Mode
    } else {
      // Standard ISO
      header.push(`%`);
      header.push(`O${programNumber}`);
      header.push(`N${lineNum++} G90 G21 G17 G94`);
      header.push(`N${lineNum++} T01 M06`);
      header.push(`N${lineNum++} S${trajectory.points[0]?.spindleRpm || 12000} M03`);
    }

    // Process Toolpath Points into NC Blocks
    for (let i = 0; i < trajectory.points.length; i++) {
      const pt = trajectory.points[i];
      const axes = pt.machineAxes || { X: pt.position.x, Y: pt.position.y, Z: pt.position.z, A: 0, B: 0, C: 0 };
      let rawText = '';
      let cmdType: GCodeBlock['commandType'] = 'LINEAR';

      if (pt.moveType === 'RAPID_APPROACH' || pt.moveType === 'RETRACT') {
        cmdType = 'RAPID';
      }

      if (controller === 'HEIDENHAIN_TNC640') {
        const moveCode = cmdType === 'RAPID' ? 'F MAX' : `F${pt.feedRateMmMin}`;
        if (machine.topology === 'TABLE_TABLE_AC') {
          rawText = `L X${axes.X.toFixed(3)} Y${axes.Y.toFixed(3)} Z${axes.Z.toFixed(3)} A${axes.A.toFixed(3)} C${axes.C.toFixed(3)} ${moveCode}`;
        } else {
          rawText = `L X${axes.X.toFixed(3)} Y${axes.Y.toFixed(3)} Z${axes.Z.toFixed(3)} B${axes.B.toFixed(3)} C${axes.C.toFixed(3)} ${moveCode}`;
        }
      } else if (controller === 'SIEMENS_840D') {
        const gCode = cmdType === 'RAPID' ? 'G0' : 'G1';
        const fCode = cmdType === 'RAPID' ? '' : ` F=${pt.feedRateMmMin}`;
        rawText = `N${lineNum++} ${gCode} X=${axes.X.toFixed(3)} Y=${axes.Y.toFixed(3)} Z=${axes.Z.toFixed(3)} A=${axes.A.toFixed(3)} C=${axes.C.toFixed(3)}${fCode}`;
      } else if (controller === 'FANUC_31I') {
        const gCode = cmdType === 'RAPID' ? 'G00' : 'G01';
        const fCode = cmdType === 'RAPID' ? '' : ` F${pt.feedRateMmMin}`;
        // Using direct vector IJK or machine angles
        rawText = `N${lineNum++} ${gCode} X${axes.X.toFixed(4)} Y${axes.Y.toFixed(4)} Z${axes.Z.toFixed(4)} I${pt.toolAxis.x.toFixed(5)} J${pt.toolAxis.y.toFixed(5)} K${pt.toolAxis.z.toFixed(5)}${fCode}`;
      } else {
        // Generic ISO
        const gCode = cmdType === 'RAPID' ? 'G00' : 'G01';
        const fCode = cmdType === 'RAPID' ? '' : ` F${pt.feedRateMmMin}`;
        rawText = `N${lineNum++} ${gCode} X${axes.X.toFixed(3)} Y${axes.Y.toFixed(3)} Z${axes.Z.toFixed(3)} A${axes.A.toFixed(3)} C${axes.C.toFixed(3)}${fCode}`;
      }

      blocks.push({
        lineNumber: lineNum,
        rawText,
        commandType: cmdType,
        targetAxes: axes,
        feedRate: pt.feedRateMmMin,
        spindleRpm: pt.spindleRpm,
        toolVector: pt.toolAxis
      });
    }

    // Footers
    if (controller === 'HEIDENHAIN_TNC640') {
      footer.push(`FUNCTION RESET TCPM`);
      footer.push(`M30`);
      footer.push(`END PGM ${programNumber} MM`);
    } else if (controller === 'SIEMENS_840D') {
      footer.push(`N${lineNum++} TRAFOOF`);
      footer.push(`N${lineNum++} M30`);
    } else if (controller === 'FANUC_31I') {
      footer.push(`N${lineNum++} G49`); // Cancel TCPC
      footer.push(`N${lineNum++} M05`);
      footer.push(`N${lineNum++} M30`);
      footer.push(`%`);
    } else {
      footer.push(`N${lineNum++} M05`);
      footer.push(`N${lineNum++} M30`);
      footer.push(`%`);
    }

    const allLines = [...header, ...blocks.map(b => b.rawText), ...footer];
    const rawGCodeText = allLines.join('\n');
    const checksum = generateDeterministicHashSync(rawGCodeText);

    return {
      programName: `O${programNumber}`,
      controller,
      header,
      blocks,
      footer,
      totalBlocks: blocks.length,
      rawGCodeText,
      checksum
    };
  }
}

export class GCodeVerifier {
  /**
   * Independently parses and validates NC blocks against machine physics and bounds
   */
  public static verifyGCode(
    program: PostProcessedProgram,
    machine: MachineDefinition
  ): { isValid: boolean; issues: string[]; maxTravel: { X: number; Y: number; Z: number; A: number; C: number } } {
    const issues: string[] = [];
    const maxTravel = { X: -Infinity, Y: -Infinity, Z: -Infinity, A: -Infinity, C: -Infinity };

    if (program.blocks.length === 0) {
      issues.push('G-code program contains no executable motion blocks.');
      return { isValid: false, issues, maxTravel };
    }

    let prevA: number | null = null;
    let prevC: number | null = null;

    for (let i = 0; i < program.blocks.length; i++) {
      const block = program.blocks[i];
      const axes = block.targetAxes;

      if (axes.X !== undefined) {
        if (axes.X < machine.linearLimits.X.min || axes.X > machine.linearLimits.X.max) {
          issues.push(`Block #${block.lineNumber}: X coordinate ${axes.X} mm exceeds machine travel [${machine.linearLimits.X.min}, ${machine.linearLimits.X.max}]`);
        }
        maxTravel.X = Math.max(maxTravel.X, Math.abs(axes.X));
      }

      if (axes.Y !== undefined) {
        if (axes.Y < machine.linearLimits.Y.min || axes.Y > machine.linearLimits.Y.max) {
          issues.push(`Block #${block.lineNumber}: Y coordinate ${axes.Y} mm exceeds machine travel [${machine.linearLimits.Y.min}, ${machine.linearLimits.Y.max}]`);
        }
        maxTravel.Y = Math.max(maxTravel.Y, Math.abs(axes.Y));
      }

      if (axes.Z !== undefined) {
        if (axes.Z < machine.linearLimits.Z.min || axes.Z > machine.linearLimits.Z.max) {
          issues.push(`Block #${block.lineNumber}: Z coordinate ${axes.Z} mm exceeds machine travel [${machine.linearLimits.Z.min}, ${machine.linearLimits.Z.max}]`);
        }
        maxTravel.Z = Math.max(maxTravel.Z, Math.abs(axes.Z));
      }

      if (axes.A !== undefined) {
        if (axes.A < machine.rotaryLimits.primary.limits.min || axes.A > machine.rotaryLimits.primary.limits.max) {
          issues.push(`Block #${block.lineNumber}: A rotary angle ${axes.A}° exceeds rotary limits [${machine.rotaryLimits.primary.limits.min}°, ${machine.rotaryLimits.primary.limits.max}°]`);
        }
        maxTravel.A = Math.max(maxTravel.A, Math.abs(axes.A));

        // Check for sudden angular jumps
        if (prevA !== null && Math.abs(axes.A - prevA) > 45 && block.commandType !== 'RAPID') {
          issues.push(`Block #${block.lineNumber}: Excessive A-axis jump of ${Math.abs(axes.A - prevA).toFixed(1)}° during cutting.`);
        }
        prevA = axes.A;
      }

      if (axes.C !== undefined) {
        maxTravel.C = Math.max(maxTravel.C, Math.abs(axes.C));
        if (prevC !== null && Math.abs(axes.C - prevC) > 180) {
          issues.push(`Block #${block.lineNumber}: Unsafe rotary unwrapping in C-axis (${Math.abs(axes.C - prevC).toFixed(1)}° jump).`);
        }
        prevC = axes.C;
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      maxTravel
    };
  }
}
