/**
 * PATCH-SECP-083: Deterministic 5-Axis G-Code Postprocessor
 * 
 * Formats 5-axis simultaneous cutter points (X,Y,Z,I,J,K) into standard ISO G-Code blocks
 * with rotary angles A (tilt around X) and C (rotation around Z).
 */

import { FiveAxisToolpath } from './SECP083Types';

export class SECP083FiveAxisPostProcessor {

  public static generateGCode(
    toolpath: FiveAxisToolpath,
    programName: string = 'O8301_5AXIS_SURFACE'
  ): {
    gcodeText: string;
    totalBlocks: number;
    gcodeHash: string;
  } {
    const lines: string[] = [];
    lines.push(`%`);
    lines.push(`(${programName} - SECP-083 5-AXIS SIMULTANEOUS POST)`);
    lines.push(`(TOOL: ${toolpath.tool.toolId} - D${toolpath.tool.diameterMm}mm)`);
    lines.push(`G90 G21 G17 G40 G80 G49`);
    lines.push(`T1 M06`);
    lines.push(`S${toolpath.points[0]?.spindleRpm || 10000} M03`);
    lines.push(`G43.4 H01 (TCPM ON - TOOL CENTER POINT MANAGEMENT)`);

    for (const pt of toolpath.points) {
      // Calculate rotary angles A and C from unit vector (I, J, K)
      // I = sin(A)*sin(C), J = sin(A)*cos(C), K = cos(A)
      const kClamped = Math.min(Math.max(pt.toolVector.z, -1.0), 1.0);
      const aDeg = (Math.acos(kClamped) * 180) / Math.PI; // Tilt angle
      const cDeg = (Math.atan2(pt.toolVector.x, pt.toolVector.y) * 180) / Math.PI; // Azimuth angle

      const moveCmd = pt.moveType === 'RAPID' ? 'G00' : 'G01';
      const feedStr = pt.moveType !== 'RAPID' ? ` F${pt.feedRateMmMin.toFixed(0)}` : '';

      lines.push(
        `${moveCmd} X${pt.position.x.toFixed(3)} Y${pt.position.y.toFixed(3)} Z${pt.position.z.toFixed(3)} A${aDeg.toFixed(3)} C${cDeg.toFixed(3)}${feedStr}`
      );
    }

    lines.push(`G49 (TCPM OFF)`);
    lines.push(`M05`);
    lines.push(`G00 Z150.0`);
    lines.push(`M30`);
    lines.push(`%`);

    const gcodeText = lines.join('\n');
    let hash = 0;
    for (let i = 0; i < gcodeText.length; i++) {
      hash = ((hash << 5) - hash) + gcodeText.charCodeAt(i);
      hash |= 0;
    }
    const gcodeHash = '0x' + Math.abs(hash).toString(16).padStart(8, '0');

    return {
      gcodeText,
      totalBlocks: lines.length,
      gcodeHash
    };
  }
}
