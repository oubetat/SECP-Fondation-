/**
 * SECP Industrial OS v2 — Real CAM Kernel
 * PATCH-257 — 4-Axis Machine Kinematics & Transformation Solver
 */

import { Vector3D } from '../toolpath/ToolpathTypes';
import {
  FourAxisMachineModel,
  RotaryAxisLetter,
  RotaryCoordinateSystem,
  FourAxisToolPosition
} from './FourAxisTypes';

export interface KinematicTransformResult {
  machinePosition: Vector3D;
  rotaryAngleDeg: number;
  residualMm: number; // Discrepancy between forward and inverse check
  isSingular: boolean;
  singularityDistance: number;
}

export class FourAxisKinematics {
  /**
   * Forward Kinematics:
   * Maps Workpiece/Part Coordinates (Xw, Yw, Zw) + Rotary Angle theta (A/B/C) -> Machine Coordinates (Xm, Ym, Zm)
   * 
   * For Table-Rotary (most common 4-axis mill with rotary indexer/trunnion):
   * The part rotates with the rotary table around the rotary axis pivot (P_rot).
   * 
   * When Table rotates by +theta:
   * Point P_w in part space is rotated by R(+theta) around rotary origin P_rot:
   * P_m = P_rot + R(+theta) * (P_w - P_rot) + WorkOffset
   */
  public static forwardKinematics(
    partPoint: Vector3D,
    rotaryAngleDeg: number,
    machine: FourAxisMachineModel,
    wcs: RotaryCoordinateSystem
  ): Vector3D {
    const rad = (rotaryAngleDeg * Math.PI) / 180.0;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    // Relative vector from Rotary Origin in WCS
    const rx = partPoint.x - wcs.origin.x;
    const ry = partPoint.y - wcs.origin.y;
    const rz = partPoint.z - wcs.origin.z;

    let xTrans = rx;
    let yTrans = ry;
    let zTrans = rz;

    if (machine.tableType === 'TABLE_ROTARY') {
      if (machine.rotaryAxisLetter === 'A') {
        // Rotation around X-axis [1, 0, 0]
        // [ 1    0      0  ]
        // [ 0   cos   -sin ]
        // [ 0   sin    cos ]
        yTrans = ry * cos - rz * sin;
        zTrans = ry * sin + rz * cos;
      } else if (machine.rotaryAxisLetter === 'B') {
        // Rotation around Y-axis [0, 1, 0]
        // [  cos  0  sin ]
        // [   0   1   0  ]
        // [ -sin  0  cos ]
        xTrans = rx * cos + rz * sin;
        zTrans = -rx * sin + rz * cos;
      } else if (machine.rotaryAxisLetter === 'C') {
        // Rotation around Z-axis [0, 0, 1]
        // [ cos  -sin  0 ]
        // [ sin   cos  0 ]
        // [  0     0   1 ]
        xTrans = rx * cos - ry * sin;
        yTrans = rx * sin + ry * cos;
      }
    } else {
      // HEAD_ROTARY: Head swivels around pivot
      if (machine.rotaryAxisLetter === 'A') {
        yTrans = ry * cos + rz * sin;
        zTrans = -ry * sin + rz * cos;
      } else if (machine.rotaryAxisLetter === 'B') {
        xTrans = rx * cos - rz * sin;
        zTrans = rx * sin + rz * cos;
      } else if (machine.rotaryAxisLetter === 'C') {
        xTrans = rx * cos + ry * sin;
        yTrans = -rx * sin + ry * cos;
      }
    }

    return {
      x: xTrans + wcs.origin.x + machine.rotaryOriginMachine.x,
      y: yTrans + wcs.origin.y + machine.rotaryOriginMachine.y,
      z: zTrans + wcs.origin.z + machine.rotaryOriginMachine.z,
    };
  }

  /**
   * Inverse Kinematics:
   * Given target Part Contact Point (Xw, Yw, Zw) and desired Surface Normal / Tool Orientation Vector,
   * calculate required Machine Linear Axes (Xm, Ym, Zm) and Rotary Angle (A/B/C).
   */
  public static inverseKinematics(
    partContactPoint: Vector3D,
    surfaceNormal: Vector3D,
    machine: FourAxisMachineModel,
    wcs: RotaryCoordinateSystem,
    previousAngleDeg: number = 0
  ): KinematicTransformResult {
    let targetAngleDeg = 0;
    let isSingular = false;
    let singularityDistance = 1.0;

    // Normalize surface normal
    const normLen = Math.sqrt(
      surfaceNormal.x * surfaceNormal.x +
      surfaceNormal.y * surfaceNormal.y +
      surfaceNormal.z * surfaceNormal.z
    );
    const nx = normLen > 1e-8 ? surfaceNormal.x / normLen : 0;
    const ny = normLen > 1e-8 ? surfaceNormal.y / normLen : 0;
    const nz = normLen > 1e-8 ? surfaceNormal.z / normLen : 1;

    if (machine.rotaryAxisLetter === 'A') {
      // Rotation around X-axis. To align tool spindle (parallel to Z-axis [0, 0, 1] in machine space)
      // with workpiece normal (nx, ny, nz), the rotation is in YZ plane:
      // theta = atan2(ny, nz)
      const radialDist = Math.hypot(ny, nz);
      singularityDistance = radialDist;
      if (radialDist < 1e-5) {
        // Normal is purely parallel to X-axis -> tool cannot align perpendicular to X via A-rotation
        isSingular = true;
        targetAngleDeg = previousAngleDeg; // Preserve previous state
      } else {
        const rad = Math.atan2(ny, nz);
        targetAngleDeg = (rad * 180.0) / Math.PI;
      }
    } else if (machine.rotaryAxisLetter === 'B') {
      // Rotation around Y-axis. Aligns in XZ plane:
      // theta = atan2(nx, nz)
      const radialDist = Math.hypot(nx, nz);
      singularityDistance = radialDist;
      if (radialDist < 1e-5) {
        isSingular = true;
        targetAngleDeg = previousAngleDeg;
      } else {
        const rad = Math.atan2(nx, nz);
        targetAngleDeg = (rad * 180.0) / Math.PI;
      }
    } else if (machine.rotaryAxisLetter === 'C') {
      // Rotation around Z-axis. Aligns in XY plane:
      // theta = atan2(ny, nx)
      const radialDist = Math.hypot(nx, ny);
      singularityDistance = radialDist;
      if (radialDist < 1e-5) {
        isSingular = true;
        targetAngleDeg = previousAngleDeg;
      } else {
        const rad = Math.atan2(ny, nx);
        targetAngleDeg = (rad * 180.0) / Math.PI;
      }
    }

    // Compute Machine linear position via forward kinematic transform of contact point
    const machPos = this.forwardKinematics(partContactPoint, targetAngleDeg, machine, wcs);

    // Compute residual discrepancy check
    const roundTripPart = this.machineToPartCoordinates(machPos, targetAngleDeg, machine, wcs);
    const residualMm = Math.sqrt(
      Math.pow(roundTripPart.x - partContactPoint.x, 2) +
      Math.pow(roundTripPart.y - partContactPoint.y, 2) +
      Math.pow(roundTripPart.z - partContactPoint.z, 2)
    );

    return {
      machinePosition: machPos,
      rotaryAngleDeg: targetAngleDeg,
      residualMm,
      isSingular,
      singularityDistance
    };
  }

  /**
   * Machine To Part Coordinates Transformation:
   * Maps current Machine Coordinates (Xm, Ym, Zm) and Rotary Angle -> Workpiece Coordinates (Xw, Yw, Zw)
   */
  public static machineToPartCoordinates(
    machinePoint: Vector3D,
    rotaryAngleDeg: number,
    machine: FourAxisMachineModel,
    wcs: RotaryCoordinateSystem
  ): Vector3D {
    const rad = (rotaryAngleDeg * Math.PI) / 180.0;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    // Remove machine pivot & WCS origin
    const mx = machinePoint.x - wcs.origin.x - machine.rotaryOriginMachine.x;
    const my = machinePoint.y - wcs.origin.y - machine.rotaryOriginMachine.y;
    const mz = machinePoint.z - wcs.origin.z - machine.rotaryOriginMachine.z;

    let px = mx;
    let py = my;
    let pz = mz;

    if (machine.tableType === 'TABLE_ROTARY') {
      // Invert rotation R(-theta)
      if (machine.rotaryAxisLetter === 'A') {
        py = mx * 0 + my * cos + mz * sin;
        pz = -my * sin + mz * cos;
      } else if (machine.rotaryAxisLetter === 'B') {
        px = mx * cos - mz * sin;
        pz = mx * sin + mz * cos;
      } else if (machine.rotaryAxisLetter === 'C') {
        px = mx * cos + my * sin;
        py = -mx * sin + my * cos;
      }
    } else {
      // HEAD_ROTARY inverse
      if (machine.rotaryAxisLetter === 'A') {
        py = my * cos - mz * sin;
        pz = my * sin + mz * cos;
      } else if (machine.rotaryAxisLetter === 'B') {
        px = mx * cos + mz * sin;
        pz = -mx * sin + mz * cos;
      } else if (machine.rotaryAxisLetter === 'C') {
        px = mx * cos - my * sin;
        py = mx * sin + my * cos;
      }
    }

    return {
      x: px + wcs.origin.x,
      y: py + wcs.origin.y,
      z: pz + wcs.origin.z,
    };
  }

  /**
   * Rotary Wrapping Coordinate Mapping:
   * Maps 2D Planar Unwrapped Coordinates (X_flat, Y_flat, Z_cut) onto a cylinder of radius R.
   * For A-Axis:
   * X_part = X_flat
   * Angle A_deg = (Y_flat / R) * (180 / PI)
   * Radius = R - Z_cut (where Z_cut is depth of cut from outer OD)
   * Y_part = Radius * sin(A_rad)
   * Z_part = Radius * cos(A_rad)
   */
  public static mapPlanarToCylindrical(
    xFlatMm: number,
    yFlatMm: number,
    depthMm: number,
    cylinderRadiusMm: number,
    rotaryAxis: RotaryAxisLetter = 'A'
  ): { partPoint: Vector3D; rotaryAngleDeg: number; surfaceNormal: Vector3D } {
    const angleRad = yFlatMm / Math.max(0.001, cylinderRadiusMm);
    const angleDeg = (angleRad * 180.0) / Math.PI;
    const currentRadius = cylinderRadiusMm - depthMm;

    if (rotaryAxis === 'A') {
      // Cylinder axis along X
      const yp = currentRadius * Math.sin(angleRad);
      const zp = currentRadius * Math.cos(angleRad);
      const ny = Math.sin(angleRad);
      const nz = Math.cos(angleRad);

      return {
        partPoint: { x: xFlatMm, y: yp, z: zp },
        rotaryAngleDeg: angleDeg,
        surfaceNormal: { x: 0, y: ny, z: nz },
      };
    } else if (rotaryAxis === 'B') {
      // Cylinder axis along Y
      const xp = currentRadius * Math.sin(angleRad);
      const zp = currentRadius * Math.cos(angleRad);
      const nx = Math.sin(angleRad);
      const nz = Math.cos(angleRad);

      return {
        partPoint: { x: xp, y: xFlatMm, z: zp },
        rotaryAngleDeg: angleDeg,
        surfaceNormal: { x: nx, y: 0, z: nz },
      };
    } else {
      // Cylinder axis along Z (C-axis)
      const xp = currentRadius * Math.cos(angleRad);
      const yp = currentRadius * Math.sin(angleRad);
      const nx = Math.cos(angleRad);
      const ny = Math.sin(angleRad);

      return {
        partPoint: { x: xp, y: yp, z: xFlatMm },
        rotaryAngleDeg: angleDeg,
        surfaceNormal: { x: nx, y: ny, z: 0 },
      };
    }
  }

  /**
   * Radial Arc Distance along cylinder: S = theta_rad * R
   */
  public static angularToArcLength(angularTravelDeg: number, radiusMm: number): number {
    return Math.abs(angularTravelDeg * Math.PI / 180.0) * radiusMm;
  }

  /**
   * Linear arc length to angular displacement: theta_deg = (S / R) * (180 / PI)
   */
  public static arcLengthToAngleDeg(arcLengthMm: number, radiusMm: number): number {
    if (radiusMm <= 1e-6) return 0;
    return (arcLengthMm / radiusMm) * (180.0 / Math.PI);
  }
}
