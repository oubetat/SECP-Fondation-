/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-258 — Forward Kinematics Solver (FK)
 * Computes Part-Space TCP (X_wcs, Y_wcs, Z_wcs) and Normalized Tool Vector (Tx, Ty, Tz)
 * from Machine Joint Angles & Linear Positions.
 */

import { Vector3D } from '../../cadKernel';
import { 
  FiveAxisMachineDefinition, 
  MachineAxesState, 
  ToolOrientationVector 
} from './FiveAxisTypes';
import { FiveAxisMathUtils } from './FiveAxisMathUtils';

export interface FKSolution {
  tcpWCS: Vector3D;
  toolOrientation: ToolOrientationVector;
  toolTipWCS: Vector3D;
  spindleGaugePointMCS: Vector3D;
}

export class ForwardKinematicsSolver {
  /**
   * Solves Forward Kinematics (FK) for any supported 5-axis machine configuration.
   * Maps joint state (X, Y, Z, A, B, C) -> Part/Workpiece Frame TCP & Tool Orientation.
   */
  public static solveFK(
    machine: FiveAxisMachineDefinition,
    axes: MachineAxesState,
    toolLengthMm: number = 0
  ): FKSolution {
    const aRad = axes.A * FiveAxisMathUtils.DEG2RAD;
    const bRad = axes.B * FiveAxisMathUtils.DEG2RAD;
    const cRad = axes.C * FiveAxisMathUtils.DEG2RAD;

    let tcpWCS: Vector3D;
    let toolVectorWCS: Vector3D;
    let gaugeMCS: Vector3D;

    if (machine.architecture === 'TABLE_TABLE') {
      // ----------------------------------------------------
      // TABLE-TABLE ARCHITECTURE
      // Tool direction in machine frame (MCS) is vertical [0, 0, 1] (or towards tool tip [0, 0, -1])
      // Table transforms the workpiece relative to tool.
      // ----------------------------------------------------
      if (machine.topology === 'TABLE_TABLE_AC') {
        // Table A tilts around X, Table C rotates around Z
        // Spindle position in MCS = (X, Y, Z)
        gaugeMCS = { x: axes.X, y: axes.Y, z: axes.Z };

        // Relative to table center:
        const x_rel = axes.X - machine.tableCenterMm.x;
        const y_rel = axes.Y - machine.tableCenterMm.y;
        const z_rel = axes.Z - machine.tableCenterMm.z;

        // Tool vector in WCS is obtained by inverse table rotation: R_z(-C) * R_x(-A) * [0, 0, 1]
        // Tool axis:
        const I = Math.sin(aRad) * Math.sin(cRad);
        const J = -Math.sin(aRad) * Math.cos(cRad);
        const K = Math.cos(aRad);
        toolVectorWCS = FiveAxisMathUtils.normalize({ x: I, y: J, z: K });

        // Un-rotate A (around X by -A)
        const cosA = Math.cos(-aRad);
        const sinA = Math.sin(-aRad);
        const y1 = y_rel * cosA - z_rel * sinA;
        const z1 = y_rel * sinA + z_rel * cosA;
        const x1 = x_rel;

        // Un-rotate C (around Z by -C)
        const cosC = Math.cos(-cRad);
        const sinC = Math.sin(-cRad);
        const xw = x1 * cosC - y1 * sinC;
        const yw = x1 * sinC + y1 * cosC;
        const zw = z1;

        tcpWCS = {
          x: Number(xw.toFixed(6)),
          y: Number(yw.toFixed(6)),
          z: Number(zw.toFixed(6))
        };
      } else {
        // TABLE_TABLE_BC: Table B tilts around Y, Table C rotates around Z
        gaugeMCS = { x: axes.X, y: axes.Y, z: axes.Z };

        const x_rel = axes.X - machine.tableCenterMm.x;
        const y_rel = axes.Y - machine.tableCenterMm.y;
        const z_rel = axes.Z - machine.tableCenterMm.z;

        // Tool axis in WCS: R_z(-C) * R_y(-B) * [0, 0, 1]
        const I = Math.sin(bRad) * Math.cos(cRad);
        const J = Math.sin(bRad) * Math.sin(cRad);
        const K = Math.cos(bRad);
        toolVectorWCS = FiveAxisMathUtils.normalize({ x: I, y: J, z: K });

        // Un-rotate B (around Y by -B)
        const cosB = Math.cos(-bRad);
        const sinB = Math.sin(-bRad);
        const x1 = x_rel * cosB + z_rel * sinB;
        const z1 = -x_rel * sinB + z_rel * cosB;
        const y1 = y_rel;

        // Un-rotate C (around Z by -C)
        const cosC = Math.cos(-cRad);
        const sinC = Math.sin(-cRad);
        const xw = x1 * cosC - y1 * sinC;
        const yw = x1 * sinC + y1 * cosC;
        const zw = z1;

        tcpWCS = {
          x: Number(xw.toFixed(6)),
          y: Number(yw.toFixed(6)),
          z: Number(zw.toFixed(6))
        };
      }
    } else if (machine.architecture === 'HEAD_HEAD') {
      // ----------------------------------------------------
      // HEAD-HEAD ARCHITECTURE
      // Workpiece is stationary on table. Tool head tilts around pivot.
      // Total effective tool length L_eff = gaugePivotOffsetMm.z + toolLengthMm
      // ----------------------------------------------------
      const L_eff = machine.gaugePivotOffsetMm.z + toolLengthMm;

      if (machine.topology === 'HEAD_HEAD_AB') {
        // Head A tilts around X, Head B tilts around Y
        // Tool vector:
        const I = Math.sin(bRad);
        const J = -Math.sin(aRad) * Math.cos(bRad);
        const K = Math.cos(aRad) * Math.cos(bRad);
        toolVectorWCS = FiveAxisMathUtils.normalize({ x: I, y: J, z: K });

        // Machine linear coordinates command the pivot center; TCP is offset by tool vector * L_eff
        const tcpX = axes.X + L_eff * toolVectorWCS.x;
        const tcpY = axes.Y + L_eff * toolVectorWCS.y;
        const tcpZ = axes.Z - L_eff * (1.0 - toolVectorWCS.z);

        gaugeMCS = { x: axes.X, y: axes.Y, z: axes.Z };
        tcpWCS = {
          x: Number(tcpX.toFixed(6)),
          y: Number(tcpY.toFixed(6)),
          z: Number(tcpZ.toFixed(6))
        };
      } else {
        // HEAD_HEAD_BC: Head B tilts around Y, C rotates around Z
        const I = Math.sin(bRad) * Math.sin(cRad);
        const J = -Math.sin(bRad) * Math.cos(cRad);
        const K = Math.cos(bRad);
        toolVectorWCS = FiveAxisMathUtils.normalize({ x: I, y: J, z: K });

        const tcpX = axes.X + L_eff * toolVectorWCS.x;
        const tcpY = axes.Y + L_eff * toolVectorWCS.y;
        const tcpZ = axes.Z - L_eff * (1.0 - toolVectorWCS.z);

        gaugeMCS = { x: axes.X, y: axes.Y, z: axes.Z };
        tcpWCS = {
          x: Number(tcpX.toFixed(6)),
          y: Number(tcpY.toFixed(6)),
          z: Number(tcpZ.toFixed(6))
        };
      }
    } else {
      // ----------------------------------------------------
      // HEAD-TABLE ARCHITECTURE
      // Tilting Head (e.g. B or A) + Rotary Table (C)
      // ----------------------------------------------------
      const L_head = machine.gaugePivotOffsetMm.z + toolLengthMm;

      if (machine.topology === 'HEAD_TABLE_BC') {
        // Head tilts around Y (B), Table rotates around Z (C)
        // In head frame: tool vector v_head = [sin(B), 0, cos(B)]
        // Table un-rotates by -C:
        const cosC = Math.cos(-cRad);
        const sinC = Math.sin(-cRad);
        const I = Math.sin(bRad) * cosC;
        const J = Math.sin(bRad) * sinC;
        const K = Math.cos(bRad);
        toolVectorWCS = FiveAxisMathUtils.normalize({ x: I, y: J, z: K });

        // Head pivot in machine coordinates
        const pivotX = axes.X;
        const pivotY = axes.Y;
        const pivotZ = axes.Z;

        // Tool tip in machine frame:
        const tipMCS_X = pivotX + L_head * Math.sin(bRad);
        const tipMCS_Y = pivotY;
        const tipMCS_Z = pivotZ - L_head * (1 - Math.cos(bRad));

        // Rel to table center & un-rotate C:
        const x_rel = tipMCS_X - machine.tableCenterMm.x;
        const y_rel = tipMCS_Y - machine.tableCenterMm.y;
        const z_rel = tipMCS_Z - machine.tableCenterMm.z;

        const xw = x_rel * cosC - y_rel * sinC;
        const yw = x_rel * sinC + y_rel * cosC;
        const zw = z_rel;

        gaugeMCS = { x: axes.X, y: axes.Y, z: axes.Z };
        tcpWCS = {
          x: Number(xw.toFixed(6)),
          y: Number(yw.toFixed(6)),
          z: Number(zw.toFixed(6))
        };
      } else {
        // Generic HEAD-TABLE AC
        const cosC = Math.cos(-cRad);
        const sinC = Math.sin(-cRad);
        const I = -Math.sin(aRad) * sinC;
        const J = Math.sin(aRad) * cosC;
        const K = Math.cos(aRad);
        toolVectorWCS = FiveAxisMathUtils.normalize({ x: I, y: J, z: K });

        const tipMCS_X = axes.X;
        const tipMCS_Y = axes.Y - L_head * Math.sin(aRad);
        const tipMCS_Z = axes.Z - L_head * (1 - Math.cos(aRad));

        const x_rel = tipMCS_X - machine.tableCenterMm.x;
        const y_rel = tipMCS_Y - machine.tableCenterMm.y;
        const z_rel = tipMCS_Z - machine.tableCenterMm.z;

        const xw = x_rel * cosC - y_rel * sinC;
        const yw = x_rel * sinC + y_rel * cosC;
        const zw = z_rel;

        gaugeMCS = { x: axes.X, y: axes.Y, z: axes.Z };
        tcpWCS = {
          x: Number(xw.toFixed(6)),
          y: Number(yw.toFixed(6)),
          z: Number(zw.toFixed(6))
        };
      }
    }

    const toolTipWCS = toolLengthMm > 0
      ? FiveAxisMathUtils.subtract(tcpWCS, FiveAxisMathUtils.scale(toolVectorWCS, toolLengthMm))
      : tcpWCS;

    return {
      tcpWCS,
      toolOrientation: FiveAxisMathUtils.toOrientationVector(toolVectorWCS),
      toolTipWCS,
      spindleGaugePointMCS: gaugeMCS
    };
  }
}
