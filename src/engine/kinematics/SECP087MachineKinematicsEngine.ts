/**
 * SECP087MachineKinematicsEngine.ts
 *
 * 5-Axis Kinematic Engine:
 * - Homogeneous Transformation Matrices (4x4)
 * - Inverse Kinematics (WCS/TCS Toolpath -> Machine Joints X,Y,Z,A,B,C)
 * - Forward Kinematics (Machine Joints X,Y,Z,A,B,C -> Component 3D Transforms & WCS/TCS Position)
 * - Singularity detection, axis-limit verification, rotary wrapping
 * - Immutable machine configurations with deterministic SHA-256 digests
 */

import {
  ComponentTransforms,
  MachineAxisLimits,
  MachineConfiguration,
  MachineJointValues,
  MachineKinematicType,
  Matrix4x4,
  Vector3D
} from './SECP087Types';
import { TelemetryHasher } from '../telemetry/TelemetryHasher';

export class SECP087MachineKinematicsEngine {

  public static readonly DEFAULT_LIMITS: MachineAxisLimits = {
    xMinMm: -600, xMaxMm: 600,
    yMinMm: -500, yMaxMm: 500,
    zMinMm: -200, zMaxMm: 650,
    aMinDeg: -120, aMaxDeg: 120,
    bMinDeg: -120, bMaxDeg: 120,
    cMinDeg: -360, cMaxDeg: 360,
    maxLinearFeedMmMin: 15000,
    maxRapidFeedMmMin: 30000,
    maxRotaryVelocityDegSec: 180,
    maxRotaryAccelDegSec2: 720
  };

  /**
   * Create standard 5-Axis Trunnion Table-Table (A-C) Machine Config
   */
  public static createDefaultTrunnionMachineConfig(id: string = '5AXIS-TRUNNION-AC-01'): MachineConfiguration {
    const limits = { ...SECP087MachineKinematicsEngine.DEFAULT_LIMITS };
    const geometry = {
      bedDimensionsMm: { x: 1200, y: 800, z: 150 },
      tableRadiusMm: 250,
      pivotOffsetMm: { x: 0, y: 0, z: 50 }, // Distance from C-table to A-tilt pivot
      gaugePivotOffsetMm: { x: 0, y: 0, z: 0 },
      spindleClearanceMm: 120,
      fixtureOffsetMm: { x: 0, y: 0, z: 30 },
      stockDimensionsMm: { x: 150, y: 150, z: 100 }
    };

    const inputStr = `${id}:TABLE_TABLE_TRUNNION_AC:${JSON.stringify(limits)}:${JSON.stringify(geometry)}`;
    const hashHex = TelemetryHasher.hashString(inputStr).substring(0, 16).toUpperCase();

    return {
      machineId: id,
      name: '5-Axis Trunnion CNC Center (A-C Table)',
      kinematicType: 'TABLE_TABLE_TRUNNION_AC',
      limits,
      geometry,
      configHash: `CFG-5AXIS-${hashHex}`
    };
  }

  /**
   * Create 5-Axis Head-Table (B-C) Machine Config
   */
  public static createHeadTableMachineConfig(id: string = '5AXIS-HEADTABLE-BC-01'): MachineConfiguration {
    const limits = { ...SECP087MachineKinematicsEngine.DEFAULT_LIMITS };
    const geometry = {
      bedDimensionsMm: { x: 1400, y: 900, z: 200 },
      tableRadiusMm: 300,
      pivotOffsetMm: { x: 0, y: 0, z: 0 },
      gaugePivotOffsetMm: { x: 0, y: 0, z: 120 }, // B-head pivot to spindle face
      spindleClearanceMm: 150,
      fixtureOffsetMm: { x: 0, y: 0, z: 40 },
      stockDimensionsMm: { x: 200, y: 200, z: 120 }
    };

    const inputStr = `${id}:HEAD_TABLE_BC:${JSON.stringify(limits)}:${JSON.stringify(geometry)}`;
    const hashHex = TelemetryHasher.hashString(inputStr).substring(0, 16).toUpperCase();

    return {
      machineId: id,
      name: '5-Axis Head-Table Milling Center (B-Head / C-Table)',
      kinematicType: 'HEAD_TABLE_BC',
      limits,
      geometry,
      configHash: `CFG-5AXIS-${hashHex}`
    };
  }

  // --- MATRIX MATH HELPERS ---

  public static identityMatrix(): Matrix4x4 {
    return [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1]
    ];
  }

  public static translationMatrix(dx: number, dy: number, dz: number): Matrix4x4 {
    return [
      [1, 0, 0, dx],
      [0, 1, 0, dy],
      [0, 0, 1, dz],
      [0, 0, 0, 1]
    ];
  }

  public static rotationXMatrix(angleDeg: number): Matrix4x4 {
    const rad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return [
      [1, 0, 0, 0],
      [0, cos, -sin, 0],
      [0, sin, cos, 0],
      [0, 0, 0, 1]
    ];
  }

  public static rotationYMatrix(angleDeg: number): Matrix4x4 {
    const rad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return [
      [cos, 0, sin, 0],
      [0, 1, 0, 0],
      [-sin, 0, cos, 0],
      [0, 0, 0, 1]
    ];
  }

  public static rotationZMatrix(angleDeg: number): Matrix4x4 {
    const rad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return [
      [cos, -sin, 0, 0],
      [sin, cos, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1]
    ];
  }

  public static multiplyMatrices(a: Matrix4x4, b: Matrix4x4): Matrix4x4 {
    const res: Matrix4x4 = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) {
          sum += a[r][k] * b[k][c];
        }
        res[r][c] = sum;
      }
    }
    return res;
  }

  public static transformPoint(mat: Matrix4x4, pt: Vector3D): Vector3D {
    const x = mat[0][0] * pt.x + mat[0][1] * pt.y + mat[0][2] * pt.z + mat[0][3];
    const y = mat[1][0] * pt.x + mat[1][1] * pt.y + mat[1][2] * pt.z + mat[1][3];
    const z = mat[2][0] * pt.x + mat[2][1] * pt.y + mat[2][2] * pt.z + mat[2][3];
    const w = mat[3][0] * pt.x + mat[3][1] * pt.y + mat[3][2] * pt.z + mat[3][3];
    const scale = Math.abs(w) > 1e-9 ? 1 / w : 1;
    return {
      x: x * scale,
      y: y * scale,
      z: z * scale
    };
  }

  public static transformVector(mat: Matrix4x4, vec: Vector3D): Vector3D {
    const x = mat[0][0] * vec.x + mat[0][1] * vec.y + mat[0][2] * vec.z;
    const y = mat[1][0] * vec.x + mat[1][1] * vec.y + mat[1][2] * vec.z;
    const z = mat[2][0] * vec.x + mat[2][1] * vec.y + mat[2][2] * vec.z;
    const len = Math.hypot(x, y, z);
    if (len < 1e-9) return { x: 0, y: 0, z: 1 };
    return { x: x / len, y: y / len, z: z / len };
  }

  // --- INVERSE KINEMATICS ---

  /**
   * Calculates Machine Joint Values (X, Y, Z, A, B, C) from WCS Tool Tip Position & Tool Vector
   */
  public static calculateInverseKinematics(
    toolPosWcs: Vector3D,
    toolVecWcs: Vector3D,
    config: MachineConfiguration
  ): MachineJointValues {
    // Normalize Tool Vector
    const len = Math.hypot(toolVecWcs.x, toolVecWcs.y, toolVecWcs.z);
    const i = len > 1e-9 ? toolVecWcs.x / len : 0;
    const j = len > 1e-9 ? toolVecWcs.y / len : 0;
    const k = len > 1e-9 ? toolVecWcs.z / len : 1;

    let aDeg = 0;
    let bDeg = 0;
    let cDeg = 0;
    let xMm = 0;
    let yMm = 0;
    let zMm = 0;

    if (config.kinematicType === 'TABLE_TABLE_TRUNNION_AC') {
      // Rotary A (tilt around X) and C (rotation around Z)
      // Tool vector in WCS: I = sin(A)*sin(C), J = sin(A)*cos(C), K = cos(A)
      const kClamped = Math.min(Math.max(k, -1.0), 1.0);
      aDeg = (Math.acos(kClamped) * 180) / Math.PI; // A-tilt angle
      
      if (Math.abs(Math.sin((aDeg * Math.PI) / 180)) > 1e-5) {
        cDeg = (Math.atan2(i, j) * 180) / Math.PI; // C-rotary angle
      } else {
        cDeg = 0; // Singularity: A=0, C arbitrary
      }

      // Inverse kinematic transformation for table rotation:
      // Rotated WCS position: P_table = R_x(-A) * R_z(-C) * P_wcs
      const rzInv = SECP087MachineKinematicsEngine.rotationZMatrix(-cDeg);
      const rxInv = SECP087MachineKinematicsEngine.rotationXMatrix(-aDeg);
      const rCombinedInv = SECP087MachineKinematicsEngine.multiplyMatrices(rxInv, rzInv);

      const pRotated = SECP087MachineKinematicsEngine.transformPoint(rCombinedInv, toolPosWcs);

      // Account for pivot offsets
      const pivotZ = config.geometry.pivotOffsetMm.z;
      xMm = pRotated.x;
      yMm = pRotated.y;
      zMm = pRotated.z + pivotZ;

    } else if (config.kinematicType === 'HEAD_TABLE_BC') {
      // Head B (tilt around Y) and Table C (rot around Z)
      // Tool vector in WCS: I = sin(B)*cos(C), J = sin(B)*sin(C), K = cos(B)
      const kClamped = Math.min(Math.max(k, -1.0), 1.0);
      bDeg = (Math.acos(kClamped) * 180) / Math.PI;

      if (Math.abs(Math.sin((bDeg * Math.PI) / 180)) > 1e-5) {
        cDeg = (Math.atan2(j, i) * 180) / Math.PI;
      } else {
        cDeg = 0;
      }

      const rzInv = SECP087MachineKinematicsEngine.rotationZMatrix(-cDeg);
      const pRotatedTable = SECP087MachineKinematicsEngine.transformPoint(rzInv, toolPosWcs);

      const gaugeL = config.geometry.gaugePivotOffsetMm.z;
      const bRad = (bDeg * Math.PI) / 180;

      xMm = pRotatedTable.x + gaugeL * Math.sin(bRad);
      yMm = pRotatedTable.y;
      zMm = pRotatedTable.z + gaugeL * (1 - Math.cos(bRad));
    } else {
      // Fallback for default linear-rotary
      aDeg = (Math.acos(Math.min(Math.max(k, -1.0), 1.0)) * 180) / Math.PI;
      cDeg = (Math.atan2(i, j) * 180) / Math.PI;
      xMm = toolPosWcs.x;
      yMm = toolPosWcs.y;
      zMm = toolPosWcs.z;
    }

    return {
      xMm: Number(xMm.toFixed(4)),
      yMm: Number(yMm.toFixed(4)),
      zMm: Number(zMm.toFixed(4)),
      aDeg: Number(aDeg.toFixed(4)),
      bDeg: Number(bDeg.toFixed(4)),
      cDeg: Number(cDeg.toFixed(4))
    };
  }

  // --- FORWARD KINEMATICS ---

  /**
   * Evaluates Forward Kinematics from Machine Joint Values -> 3D Component Transforms & Tool Position/Vector
   */
  public static evaluateForwardKinematics(
    joints: MachineJointValues,
    config: MachineConfiguration
  ): {
    forwardPos: Vector3D;
    forwardVector: Vector3D;
    componentTransforms: ComponentTransforms;
  } {
    const bedTransform = SECP087MachineKinematicsEngine.identityMatrix();

    let tableTransform: Matrix4x4;
    let workpieceTransform: Matrix4x4;
    let toolTransform: Matrix4x4;
    let spindleTransform: Matrix4x4;
    let headTransform: Matrix4x4;

    let forwardPos: Vector3D;
    let forwardVector: Vector3D;

    if (config.kinematicType === 'TABLE_TABLE_TRUNNION_AC') {
      // Table rotation matrices: R_z(C) then R_x(A)
      const rz = SECP087MachineKinematicsEngine.rotationZMatrix(joints.cDeg);
      const rx = SECP087MachineKinematicsEngine.rotationXMatrix(joints.aDeg);
      const pivotTrans = SECP087MachineKinematicsEngine.translationMatrix(0, 0, -config.geometry.pivotOffsetMm.z);
      
      // Table transform = R_x(A) * R_z(C)
      tableTransform = SECP087MachineKinematicsEngine.multiplyMatrices(rx, rz);
      
      const fixtureTrans = SECP087MachineKinematicsEngine.translationMatrix(
        config.geometry.fixtureOffsetMm.x,
        config.geometry.fixtureOffsetMm.y,
        config.geometry.fixtureOffsetMm.z
      );
      workpieceTransform = SECP087MachineKinematicsEngine.multiplyMatrices(tableTransform, fixtureTrans);

      // Tool Moves linearly relative to Bed: T(X, Y, Z - pivotZ)
      const linearTrans = SECP087MachineKinematicsEngine.translationMatrix(joints.xMm, joints.yMm, joints.zMm - config.geometry.pivotOffsetMm.z);
      toolTransform = linearTrans;
      spindleTransform = linearTrans;
      headTransform = linearTrans;

      // Reconstruct Tool Position in WCS = R_z(C)^T * R_x(A)^T * Tool_MCS
      forwardPos = SECP087MachineKinematicsEngine.transformPoint(tableTransform, {
        x: joints.xMm,
        y: joints.yMm,
        z: joints.zMm - config.geometry.pivotOffsetMm.z
      });

      // Tool Vector in WCS = R_x(A) * R_z(C) * (0, 0, 1)
      forwardVector = SECP087MachineKinematicsEngine.transformVector(tableTransform, { x: 0, y: 0, z: 1 });

    } else {
      // Head-Table or General
      const rz = SECP087MachineKinematicsEngine.rotationZMatrix(joints.cDeg);
      const rb = SECP087MachineKinematicsEngine.rotationYMatrix(joints.bDeg);
      
      tableTransform = rz;
      workpieceTransform = rz;
      
      const linearTrans = SECP087MachineKinematicsEngine.translationMatrix(joints.xMm, joints.yMm, joints.zMm);
      headTransform = SECP087MachineKinematicsEngine.multiplyMatrices(linearTrans, rb);
      spindleTransform = headTransform;
      toolTransform = headTransform;

      forwardPos = SECP087MachineKinematicsEngine.transformPoint(tableTransform, { x: joints.xMm, y: joints.yMm, z: joints.zMm });
      forwardVector = SECP087MachineKinematicsEngine.transformVector(rb, { x: 0, y: 0, z: 1 });
    }

    return {
      forwardPos,
      forwardVector,
      componentTransforms: {
        bedTransform,
        tableTransform,
        workpieceTransform,
        toolTransform,
        spindleTransform,
        headTransform
      }
    };
  }

  /**
   * Check if joints violate machine physical limits
   */
  public static checkAxisLimits(joints: MachineJointValues, limits: MachineAxisLimits): boolean {
    return (
      joints.xMm < limits.xMinMm || joints.xMm > limits.xMaxMm ||
      joints.yMm < limits.yMinMm || joints.yMm > limits.yMaxMm ||
      joints.zMm < limits.zMinMm || joints.zMm > limits.zMaxMm ||
      joints.aDeg < limits.aMinDeg || joints.aDeg > limits.aMaxDeg ||
      joints.bDeg < limits.bMinDeg || joints.bDeg > limits.bMaxDeg ||
      joints.cDeg < limits.cMinDeg || joints.cDeg > limits.cMaxDeg
    );
  }
}
