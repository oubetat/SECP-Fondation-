import { FiveAxisToolpath } from '../kinematics/KinematicTypes';
import { MachinePostProfile, GCodeDocument } from './PostProcessorTypes';

export class GCodePostProcessor {
  private profile: MachinePostProfile;

  constructor(profile: MachinePostProfile) {
    this.profile = profile;
  }

  public generate(toolpath: FiveAxisToolpath, feedRate: number, spindleSpeed: number, toolNumber: number): GCodeDocument {
    const lines: string[] = [];

    // Validations
    if (!Number.isFinite(feedRate) || feedRate < this.profile.feedRange[0] || feedRate > this.profile.feedRange[1]) {
      throw new Error(`Invalid feed rate: ${feedRate}`);
    }
    if (!Number.isFinite(spindleSpeed) || spindleSpeed < this.profile.spindleRange[0] || spindleSpeed > this.profile.spindleRange[1]) {
      throw new Error(`Invalid spindle speed: ${spindleSpeed}`);
    }
    if (!Number.isFinite(toolNumber) || toolNumber < this.profile.toolRange[0] || toolNumber > this.profile.toolRange[1]) {
      throw new Error(`Invalid tool number: ${toolNumber}`);
    }

    // Program Header
    lines.push('%');
    lines.push('O1000 (SECP-100 DETERMINISTIC POST)');
    lines.push('G21 (MM)');
    lines.push('G90 (ABS)');
    lines.push(`T${toolNumber.toFixed(0)} M6`);
    lines.push(`S${spindleSpeed.toFixed(0)} M3`);
    lines.push(`F${feedRate.toFixed(1)}`);

    let currentMode: 'G0' | 'G1' | null = null;
    let prevX = NaN, prevY = NaN, prevZ = NaN, prevA = NaN, prevC = NaN;

    for (const point of toolpath.points) {
      if (!point.machinePose) {
        throw new Error('Toolpath point missing verified machine pose');
      }

      const axes = point.machinePose.machineAxes;
      const x = axes['X'] || 0;
      const y = axes['Y'] || 0;
      const z = axes['Z'] || 0;
      const a = axes['A'] || 0;
      const c = axes['C'] || 0;

      // Reject non-finite
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) || !Number.isFinite(a) || !Number.isFinite(c)) {
        throw new Error('Non-finite machine axis in pose');
      }

      let line = '';
      const mode = point.moveType === 'RAPID' ? 'G0' : 'G1';
      if (mode !== currentMode) {
        line += mode + ' ';
        currentMode = mode;
      }

      // Always explicitly format changes, or for deterministic consistency just output all if changed
      // To ensure strictly deterministic formatting, we'll output axes if they differ by > 1e-5
      const formatCoord = (val: number, prefix: string, prev: number) => {
        if (Number.isNaN(prev) || Math.abs(val - prev) > 1e-5) {
           return `${prefix}${val.toFixed(4)} `;
        }
        return '';
      };

      line += formatCoord(x, 'X', prevX);
      line += formatCoord(y, 'Y', prevY);
      line += formatCoord(z, 'Z', prevZ);
      if (this.profile.hasA) line += formatCoord(a, 'A', prevA);
      if (this.profile.hasC) line += formatCoord(c, 'C', prevC);

      prevX = x; prevY = y; prevZ = z; prevA = a; prevC = c;

      line = line.trim();
      if (line !== '' && line !== mode) {
        lines.push(line);
      }
    }

    // Program Footer
    lines.push('M5');
    lines.push('M30');
    lines.push('%');

    const documentText = lines.join('\n');
    return {
      lines,
      byteLength: new TextEncoder().encode(documentText).length,
      provenance: { postId: 'SECP-100-v1', points: toolpath.points.length }
    };
  }
}
