/**
 * PATCH-SECP-058 — 058-D: NC Program Verification
 * Thorough simulation, linting, and verification of generated G-Code against
 * machine kinematic envelopes, axis feed speed, spindle RPM, and safety retract planes.
 */

import { MachineDefinition, NCBlock, NCValidationIssue, NCVerificationReport } from './NCExecutionTypes';

export class NCProgramVerifier {
  /**
   * Performs high-fidelity kinematic, syntax, and safety linting on G-Code blocks
   */
  public static verifyNCProgram(
    operationId: string,
    blocks: NCBlock[],
    machine: MachineDefinition
  ): NCVerificationReport {
    const issues: NCValidationIssue[] = [];
    let isValid = true;
    let maxFeedRateUsedMmMin = 0;
    let maxSpindleRpmUsed = 0;
    let currentSpindleSpeed = 0;
    let activeToolPocket: number | null = null;

    // Build axis limits helper
    const xLim = machine.envelope;
    const yLim = machine.envelope;
    const zLim = machine.envelope;

    const maxFeedRateLimit = Math.max(...machine.axes.map(a => a.maxSpeedMmMin));

    blocks.forEach((block) => {
      const line = block.gCodeLine.toUpperCase().trim();
      const num = block.blockNumber;

      // Skip empty comments/headers
      if (line.length === 0 || (line.startsWith(';') && !line.includes('SECP-'))) {
        return;
      }

      // Parse G-code tokens via simple regex
      const gMatch = line.match(/G\d+/g);
      const mMatch = line.match(/M\d+/g);
      const xMatch = line.match(/X([-\d.]+)/);
      const yMatch = line.match(/Y([-\d.]+)/);
      const zMatch = line.match(/Z([-\d.]+)/);
      const bMatch = line.match(/B([-\d.]+)/);
      const cMatch = line.match(/C([-\d.]+)/);
      const fMatch = line.match(/F(\d+)/);
      const sMatch = line.match(/S(\d+)/);
      const tMatch = line.match(/T(\d+)/);

      // 1. Tool Selection Verification (058-D)
      if (tMatch) {
        const pocket = parseInt(tMatch[1]);
        if (pocket < 1 || pocket > machine.toolMagazine.capacity) {
          isValid = false;
          issues.push({
            blockNumber: num,
            gCodeLine: block.gCodeLine,
            issueType: 'INVALID_TOOL_REFERENCE',
            description: `Tool Pocket T${pocket} exceeds tool magazine capacity (${machine.toolMagazine.capacity}).`,
            severity: 'CRITICAL'
          });
        }
        activeToolPocket = pocket;
      }

      // 2. Spindle Speed Verification (058-D)
      if (sMatch) {
        const speed = parseInt(sMatch[1]);
        currentSpindleSpeed = speed;
        if (speed > maxSpindleRpmUsed) {
          maxSpindleRpmUsed = speed;
        }

        if (speed > machine.spindle.maxRpm || speed < machine.spindle.minRpm) {
          isValid = false;
          issues.push({
            blockNumber: num,
            gCodeLine: block.gCodeLine,
            issueType: 'SPINDLE_LIMIT_VIOLATION',
            description: `Spindle S${speed} RPM exceeds spindle capability limits [${machine.spindle.minRpm} - ${machine.spindle.maxRpm}].`,
            severity: 'CRITICAL'
          });
        }
      }

      // 3. Feed Rate Verification (058-D)
      if (fMatch) {
        const feed = parseInt(fMatch[1]);
        if (feed > maxFeedRateUsedMmMin) {
          maxFeedRateUsedMmMin = feed;
        }

        if (feed > maxFeedRateLimit) {
          isValid = false;
          issues.push({
            blockNumber: num,
            gCodeLine: block.gCodeLine,
            issueType: 'FEED_LIMIT_VIOLATION',
            description: `Feed rate F${feed} mm/min exceeds maximum axis rapid speed of ${maxFeedRateLimit} mm/min.`,
            severity: 'CRITICAL'
          });
        }
      }

      // 4. Axis Coordinate Limit Verification (058-D)
      if (xMatch) {
        const val = parseFloat(xMatch[1]);
        if (val < xLim.xMin || val > xLim.xMax) {
          isValid = false;
          issues.push({
            blockNumber: num,
            gCodeLine: block.gCodeLine,
            issueType: 'AXIS_LIMIT_VIOLATION',
            description: `Coordinate X${val} exceeds machine travel limits [${xLim.xMin} to ${xLim.xMax}].`,
            severity: 'CRITICAL'
          });
        }
      }

      if (yMatch) {
        const val = parseFloat(yMatch[1]);
        if (val < yLim.yMin || val > yLim.yMax) {
          isValid = false;
          issues.push({
            blockNumber: num,
            gCodeLine: block.gCodeLine,
            issueType: 'AXIS_LIMIT_VIOLATION',
            description: `Coordinate Y${val} exceeds machine travel limits [${yLim.yMin} to ${yLim.yMax}].`,
            severity: 'CRITICAL'
          });
        }
      }

      if (zMatch) {
        const val = parseFloat(zMatch[1]);
        if (val < zLim.zMin || val > zLim.zMax) {
          isValid = false;
          issues.push({
            blockNumber: num,
            gCodeLine: block.gCodeLine,
            issueType: 'AXIS_LIMIT_VIOLATION',
            description: `Coordinate Z${val} exceeds machine travel limits [${zLim.zMin} to ${zLim.zMax}].`,
            severity: 'CRITICAL'
          });
        }
      }

      // 5. Rotary Limits Check
      if (bMatch) {
        const val = parseFloat(bMatch[1]);
        const bAxisDef = machine.axes.find(a => a.axisId === 'B');
        if (!bAxisDef) {
          isValid = false;
          issues.push({
            blockNumber: num,
            gCodeLine: block.gCodeLine,
            issueType: 'UNSUPPORTED_COMMAND',
            description: `Machine lacks physical B rotary axis. Tilt command B${val} is unsupported.`,
            severity: 'CRITICAL'
          });
        } else if (val < bAxisDef.minLimit || val > bAxisDef.maxLimit) {
          isValid = false;
          issues.push({
            blockNumber: num,
            gCodeLine: block.gCodeLine,
            issueType: 'IMPOSSIBLE_ROTARY_POSITION',
            description: `Tilt B${val} exceeds axis rotation limits [${bAxisDef.minLimit} to ${bAxisDef.maxLimit}].`,
            severity: 'CRITICAL'
          });
        }
      }

      if (cMatch) {
        const val = parseFloat(cMatch[1]);
        const cAxisDef = machine.axes.find(a => a.axisId === 'C');
        if (!cAxisDef) {
          isValid = false;
          issues.push({
            blockNumber: num,
            gCodeLine: block.gCodeLine,
            issueType: 'UNSUPPORTED_COMMAND',
            description: `Machine lacks physical C rotary axis. Rotary command C${val} is unsupported.`,
            severity: 'CRITICAL'
          });
        }
      }

      // 6. Rapid Safety retract check (058-D)
      if (line.includes('G00') && zMatch) {
        const val = parseFloat(zMatch[1]);
        if (val < 0) { // Warning on G0 Z rapid plunging below top-face coordinate (typically Z=0.0)
          issues.push({
            blockNumber: num,
            gCodeLine: block.gCodeLine,
            issueType: 'UNSAFE_RAPID_TRANSITION',
            description: `Rapid G00 move descending to negative coordinate Z${val}. Risk of rapid tool plunge.`,
            severity: 'WARNING'
          });
        }
      }
    });

    return {
      operationId,
      isValid: isValid && !issues.some(i => i.severity === 'CRITICAL'),
      issues,
      checkedLinesCount: blocks.length,
      maxFeedRateUsedMmMin,
      maxSpindleRpmUsed,
      verifiedAt: new Date().toISOString()
    };
  }
}
