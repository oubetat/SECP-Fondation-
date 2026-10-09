/**
 * SECP Industrial OS v3 — PATCH-179: 5-Axis Machine Kinematics & IK Engine
 * Implements Forward & Inverse Kinematics for Table-Table, Head-Head, and Head-Table
 * topologies, Singularity Detection, Quadrant Unwrapping, and Travel Limit Enforcement.
 */

import { Vector3D } from '../../cadKernel';
import { 
  MachineDefinition, 
  MachineAxesState, 
  MachineKinematicTopology 
} from './FiveAxisTypes';

export interface IKSolution {
  solutionFound: boolean;
  axes: MachineAxesState;
  alternativeAxes?: MachineAxesState;
  isSingularityNear: boolean;
  singularityDistanceDeg: number;
  withinLimits: boolean;
  limitViolations: string[];
}

export class MachineKinematicsEngine {
  /**
   * Pre-configured industrial 5-axis machines
   */
  public static getStandardMachineDefinitions(): Record<string, MachineDefinition> {
    return {
      'TRUNNION_AC_500': {
        machineId: 'TRUNNION_AC_500',
        name: 'DMG MORI NMV 5000 DCG (Table-Table AC)',
        manufacturer: 'DMG MORI',
        topology: 'TABLE_TABLE_AC',
        linearLimits: {
          X: { min: -350, max: 350, maxVelocity: 50000, maxAcceleration: 5000 },
          Y: { min: -250, max: 250, maxVelocity: 50000, maxAcceleration: 5000 },
          Z: { min: -400, max: 150, maxVelocity: 50000, maxAcceleration: 5000 }
        },
        rotaryLimits: {
          primary: {
            axis: 'A',
            limits: { min: -120, max: 120, maxVelocity: 18000, maxAcceleration: 2000 },
            pivotOffsetMm: { x: 0, y: 0, z: 0 }
          },
          secondary: {
            axis: 'C',
            limits: { min: -720, max: 720, maxVelocity: 36000, maxAcceleration: 3000 },
            pivotOffsetMm: { x: 0, y: 0, z: 0 }
          }
        },
        gaugePivotOffsetMm: { x: 0, y: 0, z: 250 },
        tableCenterMm: { x: 0, y: 0, z: 0 },
        maxSpindleRpm: 20000,
        rapidFeedMmMin: 50000,
        singularityConeAngleDeg: 1.5,
        controller: 'HEIDENHAIN_TNC640'
      },

      'GANTRY_HEAD_HEAD_AB': {
        machineId: 'GANTRY_HEAD_HEAD_AB',
        name: 'FIDIA GTF3514 / Articulated Head (Head-Head AB)',
        manufacturer: 'FIDIA',
        topology: 'HEAD_HEAD_AB',
        linearLimits: {
          X: { min: -1000, max: 1000, maxVelocity: 40000, maxAcceleration: 4000 },
          Y: { min: -800, max: 800, maxVelocity: 40000, maxAcceleration: 4000 },
          Z: { min: -600, max: 200, maxVelocity: 40000, maxAcceleration: 4000 }
        },
        rotaryLimits: {
          primary: {
            axis: 'A',
            limits: { min: -110, max: 110, maxVelocity: 12000, maxAcceleration: 1500 },
            pivotOffsetMm: { x: 0, y: 0, z: 180 }
          },
          secondary: {
            axis: 'B',
            limits: { min: -180, max: 180, maxVelocity: 15000, maxAcceleration: 1800 },
            pivotOffsetMm: { x: 0, y: 0, z: 0 }
          }
        },
        gaugePivotOffsetMm: { x: 0, y: 0, z: 320 },
        tableCenterMm: { x: 0, y: 0, z: 0 },
        maxSpindleRpm: 24000,
        rapidFeedMmMin: 40000,
        singularityConeAngleDeg: 2.0,
        controller: 'SIEMENS_840D'
      },

      'UNIVERSAL_HEAD_TABLE_BC': {
        machineId: 'UNIVERSAL_HEAD_TABLE_BC',
        name: 'HERMLE C42 U MT (Head-Table BC)',
        manufacturer: 'HERMLE',
        topology: 'HEAD_TABLE_BC',
        linearLimits: {
          X: { min: -400, max: 400, maxVelocity: 45000, maxAcceleration: 6000 },
          Y: { min: -400, max: 400, maxVelocity: 45000, maxAcceleration: 6000 },
          Z: { min: -450, max: 100, maxVelocity: 45000, maxAcceleration: 6000 }
        },
        rotaryLimits: {
          primary: {
            axis: 'B',
            limits: { min: -115, max: 115, maxVelocity: 15000, maxAcceleration: 2500 },
            pivotOffsetMm: { x: 0, y: 0, z: 200 }
          },
          secondary: {
            axis: 'C',
            limits: { min: -9999, max: 9999, maxVelocity: 48000, maxAcceleration: 4000 },
            pivotOffsetMm: { x: 0, y: 0, z: 0 }
          }
        },
        gaugePivotOffsetMm: { x: 0, y: 0, z: 220 },
        tableCenterMm: { x: 0, y: 0, z: 0 },
        maxSpindleRpm: 18000,
        rapidFeedMmMin: 45000,
        singularityConeAngleDeg: 1.2,
        controller: 'HEIDENHAIN_TNC640'
      }
    };
  }

  /**
   * Solves Inverse Kinematics (IK) for a given TCP position (X,Y,Z) and Tool Axis vector (I,J,K)
   */
  public static solveInverseKinematics(
    machine: MachineDefinition,
    tcpWCS: Vector3D,
    toolAxisWCS: Vector3D,
    prevMachineState?: MachineAxesState
  ): IKSolution {
    // Normalize tool axis
    const mag = Math.hypot(toolAxisWCS.x, toolAxisWCS.y, toolAxisWCS.z) || 1.0;
    const I = toolAxisWCS.x / mag;
    const J = toolAxisWCS.y / mag;
    const K = toolAxisWCS.z / mag;

    let primaryAngleDeg = 0;
    let secondaryAngleDeg = 0;
    let altPrimaryDeg = 0;
    let altSecondaryDeg = 0;
    let singularityDistDeg = 0;
    let isNearSingularity = false;

    // Detect Singularity (Z-aligned tool vector on Table-Table AC or Head-Head)
    const poleDeviationDeg = Math.acos(Math.max(-1.0, Math.min(1.0, Math.abs(K)))) * (180 / Math.PI);
    if (poleDeviationDeg < machine.singularityConeAngleDeg) {
      isNearSingularity = true;
      singularityDistDeg = poleDeviationDeg;
    } else {
      singularityDistDeg = poleDeviationDeg;
    }

    if (machine.topology === 'TABLE_TABLE_AC') {
      // Primary: A-axis (rotates around X), Secondary: C-axis (rotates around Z)
      // Vector on table: v_table = R_x(-A) * R_z(-C) * [0,0,1]^T
      // => I = sin(A)*sin(C), J = -sin(A)*cos(C), K = cos(A)
      
      const cosA = Math.max(-1.0, Math.min(1.0, K));
      const A_rad1 = Math.acos(cosA);
      const A_rad2 = -A_rad1;

      primaryAngleDeg = A_rad1 * (180 / Math.PI);
      altPrimaryDeg = A_rad2 * (180 / Math.PI);

      if (Math.abs(Math.sin(A_rad1)) > 1e-6) {
        const C_rad1 = Math.atan2(I / Math.sin(A_rad1), -J / Math.sin(A_rad1));
        const C_rad2 = Math.atan2(I / Math.sin(A_rad2), -J / Math.sin(A_rad2));
        secondaryAngleDeg = C_rad1 * (180 / Math.PI);
        altSecondaryDeg = C_rad2 * (180 / Math.PI);
      } else {
        // At singularity (A=0), preserve previous C angle
        secondaryAngleDeg = prevMachineState ? prevMachineState.C : 0;
        altSecondaryDeg = secondaryAngleDeg;
      }
    } else if (machine.topology === 'TABLE_TABLE_BC') {
      // Primary: B-axis (rotates around Y), Secondary: C-axis (rotates around Z)
      const cosB = Math.max(-1.0, Math.min(1.0, K));
      const B_rad1 = Math.acos(cosB);
      primaryAngleDeg = B_rad1 * (180 / Math.PI);
      altPrimaryDeg = -primaryAngleDeg;

      if (Math.abs(Math.sin(B_rad1)) > 1e-6) {
        secondaryAngleDeg = Math.atan2(J / Math.sin(B_rad1), I / Math.sin(B_rad1)) * (180 / Math.PI);
        altSecondaryDeg = Math.atan2(J / Math.sin(-B_rad1), I / Math.sin(-B_rad1)) * (180 / Math.PI);
      } else {
        secondaryAngleDeg = prevMachineState ? prevMachineState.C : 0;
        altSecondaryDeg = secondaryAngleDeg;
      }
    } else if (machine.topology === 'HEAD_HEAD_AB') {
      // Head tilts A (around X) and B (around Y)
      const B_rad = Math.atan2(I, K);
      const A_rad = Math.atan2(-J, Math.sqrt(I * I + K * K));
      primaryAngleDeg = A_rad * (180 / Math.PI);
      secondaryAngleDeg = B_rad * (180 / Math.PI);
      altPrimaryDeg = -primaryAngleDeg;
      altSecondaryDeg = secondaryAngleDeg + 180;
    } else {
      // Default / Universal Head-Table BC
      const B_rad = Math.atan2(Math.sqrt(I * I + J * J), K);
      const C_rad = Math.atan2(J, I);
      primaryAngleDeg = B_rad * (180 / Math.PI);
      secondaryAngleDeg = C_rad * (180 / Math.PI);
      altPrimaryDeg = -primaryAngleDeg;
      altSecondaryDeg = secondaryAngleDeg + 180;
    }

    // Quadrant unwrapping to prevent sudden 360-degree rotations
    if (prevMachineState) {
      secondaryAngleDeg = this.unwrapAngle(secondaryAngleDeg, prevMachineState.C || prevMachineState.B);
      altSecondaryDeg = this.unwrapAngle(altSecondaryDeg, prevMachineState.C || prevMachineState.B);
    }

    // Solve Linear Coordinates (X, Y, Z) considering Table or Head Kinematic Offset
    const linearMCS = this.computeLinearAxes(machine, tcpWCS, primaryAngleDeg, secondaryAngleDeg);
    const altLinearMCS = this.computeLinearAxes(machine, tcpWCS, altPrimaryDeg, altSecondaryDeg);

    const primaryState: MachineAxesState = {
      X: linearMCS.x,
      Y: linearMCS.y,
      Z: linearMCS.z,
      A: machine.rotaryLimits.primary.axis === 'A' ? primaryAngleDeg : 0,
      B: machine.rotaryLimits.primary.axis === 'B' ? primaryAngleDeg : (machine.rotaryLimits.secondary.axis === 'B' ? secondaryAngleDeg : 0),
      C: machine.rotaryLimits.secondary.axis === 'C' ? secondaryAngleDeg : 0
    };

    const altState: MachineAxesState = {
      X: altLinearMCS.x,
      Y: altLinearMCS.y,
      Z: altLinearMCS.z,
      A: machine.rotaryLimits.primary.axis === 'A' ? altPrimaryDeg : 0,
      B: machine.rotaryLimits.primary.axis === 'B' ? altPrimaryDeg : (machine.rotaryLimits.secondary.axis === 'B' ? altSecondaryDeg : 0),
      C: machine.rotaryLimits.secondary.axis === 'C' ? altSecondaryDeg : 0
    };

    // Check limits on primary candidate
    const limitViolations: string[] = [];
    let withinLimits = true;

    if (primaryState.X < machine.linearLimits.X.min || primaryState.X > machine.linearLimits.X.max) {
      withinLimits = false;
      limitViolations.push(`X out of bounds [${primaryState.X.toFixed(1)} mm]`);
    }
    if (primaryState.Y < machine.linearLimits.Y.min || primaryState.Y > machine.linearLimits.Y.max) {
      withinLimits = false;
      limitViolations.push(`Y out of bounds [${primaryState.Y.toFixed(1)} mm]`);
    }
    if (primaryState.Z < machine.linearLimits.Z.min || primaryState.Z > machine.linearLimits.Z.max) {
      withinLimits = false;
      limitViolations.push(`Z out of bounds [${primaryState.Z.toFixed(1)} mm]`);
    }

    const primRotVal = machine.rotaryLimits.primary.axis === 'A' ? primaryState.A : primaryState.B;
    if (primRotVal < machine.rotaryLimits.primary.limits.min || primRotVal > machine.rotaryLimits.primary.limits.max) {
      withinLimits = false;
      limitViolations.push(`${machine.rotaryLimits.primary.axis} angle out of bounds [${primRotVal.toFixed(1)}°]`);
    }

    return {
      solutionFound: true,
      axes: primaryState,
      alternativeAxes: altState,
      isSingularityNear: isNearSingularity,
      singularityDistanceDeg: singularityDistDeg,
      withinLimits,
      limitViolations
    };
  }

  /**
   * Computes Linear Machine Coordinates (X_m, Y_m, Z_m) taking rotary transformations into account
   */
  private static computeLinearAxes(
    machine: MachineDefinition,
    tcpWCS: Vector3D,
    primaryDeg: number,
    secondaryDeg: number
  ): Vector3D {
    const pRad = (primaryDeg * Math.PI) / 180;
    const sRad = (secondaryDeg * Math.PI) / 180;

    if (machine.topology === 'TABLE_TABLE_AC') {
      // Workpiece is mounted on rotary table.
      // Pos_MCS = R_x(A) * R_z(C) * Pos_WCS + TableCenter
      const cosC = Math.cos(sRad);
      const sinC = Math.sin(sRad);
      const cosA = Math.cos(pRad);
      const sinA = Math.sin(pRad);

      // Rotate around Z (C)
      const x1 = tcpWCS.x * cosC - tcpWCS.y * sinC;
      const y1 = tcpWCS.x * sinC + tcpWCS.y * cosC;
      const z1 = tcpWCS.z;

      // Rotate around X (A)
      const x2 = x1;
      const y2 = y1 * cosA - z1 * sinA;
      const z2 = y1 * sinA + z1 * cosA;

      return {
        x: Number((x2 + machine.tableCenterMm.x).toFixed(4)),
        y: Number((y2 + machine.tableCenterMm.y).toFixed(4)),
        z: Number((z2 + machine.tableCenterMm.z).toFixed(4))
      };
    } else if (machine.topology === 'HEAD_HEAD_AB') {
      // Tool head tilts. Pivot length = L
      const L = machine.gaugePivotOffsetMm.z;
      const sinB = Math.sin(sRad);
      const sinA = Math.sin(pRad);

      return {
        x: Number((tcpWCS.x - L * sinB).toFixed(4)),
        y: Number((tcpWCS.y + L * sinA).toFixed(4)),
        z: Number((tcpWCS.z).toFixed(4))
      };
    } else {
      // Generic transformation
      return {
        x: Number(tcpWCS.x.toFixed(4)),
        y: Number(tcpWCS.y.toFixed(4)),
        z: Number(tcpWCS.z.toFixed(4))
      };
    }
  }

  /**
   * Forward Kinematics (FK): Calculates TCP (WCS) and Tool Vector (IJK) from Machine Joint Angles
   */
  public static solveForwardKinematics(
    machine: MachineDefinition,
    axes: MachineAxesState
  ): { tcpWCS: Vector3D; toolVector: Vector3D } {
    const aRad = (axes.A * Math.PI) / 180;
    const bRad = (axes.B * Math.PI) / 180;
    const cRad = (axes.C * Math.PI) / 180;

    if (machine.topology === 'TABLE_TABLE_AC') {
      // Tool direction in machine frame is always [0, 0, -1] or spindle axis [0, 0, 1]
      // In WCS: v_wcs = R_z(-C) * R_x(-A) * [0, 0, 1]
      const I = Math.sin(aRad) * Math.sin(cRad);
      const J = -Math.sin(aRad) * Math.cos(cRad);
      const K = Math.cos(aRad);

      // Inverse table transform to get TCP in WCS
      const x_rel = axes.X - machine.tableCenterMm.x;
      const y_rel = axes.Y - machine.tableCenterMm.y;
      const z_rel = axes.Z - machine.tableCenterMm.z;

      // Un-rotate A (around X)
      const cosA = Math.cos(-aRad);
      const sinA = Math.sin(-aRad);
      const y1 = y_rel * cosA - z_rel * sinA;
      const z1 = y_rel * sinA + z_rel * cosA;
      const x1 = x_rel;

      // Un-rotate C (around Z)
      const cosC = Math.cos(-cRad);
      const sinC = Math.sin(-cRad);
      const xw = x1 * cosC - y1 * sinC;
      const yw = x1 * sinC + y1 * cosC;
      const zw = z1;

      return {
        tcpWCS: { x: xw, y: yw, z: zw },
        toolVector: { x: I, y: J, z: K }
      };
    } else {
      // Head-Head or generic
      const I = Math.sin(bRad);
      const J = -Math.sin(aRad) * Math.cos(bRad);
      const K = Math.cos(aRad) * Math.cos(bRad);

      return {
        tcpWCS: { x: axes.X, y: axes.Y, z: axes.Z },
        toolVector: { x: I, y: J, z: K }
      };
    }
  }

  /**
   * Angle unwrapper to choose the closest continuous angular representation
   */
  public static unwrapAngle(targetDeg: number, referenceDeg: number): number {
    let diff = targetDeg - referenceDeg;
    while (diff > 180) {
      targetDeg -= 360;
      diff -= 360;
    }
    while (diff < -180) {
      targetDeg += 360;
      diff += 360;
    }
    return targetDeg;
  }
}
