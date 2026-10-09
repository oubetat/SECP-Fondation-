/**
 * SECP Industrial OS - PATCH-264: Machine Simulation Engine
 * Machine Kinematic Model: Complete Forward Kinematic Chain Solver
 */

import { MachineDefinition, MachinePose, AxisPositionState, Vector3D } from './MachineSimulationTypes';

export class MachineKinematicModel {
  private definition: MachineDefinition;

  constructor(definition: MachineDefinition) {
    this.definition = definition;
  }

  public getDefinition(): MachineDefinition {
    return this.definition;
  }

  /**
   * Forward Kinematics:
   * Maps machine axis positions (X, Y, Z, A, B, C) and active tool gauge length
   * to true 3D spatial points for:
   * - Tool Tip (world coordinates)
   * - Tool Base / Shank
   * - Tool Orientation Vector
   * - Tool Holder Origin
   * - Spindle Nose
   * - Machine Table
   * - Stock / Workpiece Origin
   */
  public computeForwardKinematics(
    axes: AxisPositionState,
    toolGaugeLengthMm: number = 100,
    wcsOffset: Vector3D = { x: 0, y: 0, z: 0 }
  ): MachinePose {
    const type = this.definition.type;

    switch (type) {
      case '3-AXIS-MILL':
        return this.compute3AxisPose(axes, toolGaugeLengthMm, wcsOffset);
      case '4-AXIS-TABLE-ROTARY':
        return this.compute4AxisTablePose(axes, toolGaugeLengthMm, wcsOffset);
      case '5-AXIS-TABLE-TABLE':
        return this.compute5AxisTableTablePose(axes, toolGaugeLengthMm, wcsOffset);
      case '5-AXIS-HEAD-TABLE':
        return this.compute5AxisHeadTablePose(axes, toolGaugeLengthMm, wcsOffset);
      case '5-AXIS-HEAD-HEAD':
        return this.compute5AxisHeadHeadPose(axes, toolGaugeLengthMm, wcsOffset);
      case 'MILL-TURN':
        return this.computeMillTurnPose(axes, toolGaugeLengthMm, wcsOffset);
      default:
        return this.compute3AxisPose(axes, toolGaugeLengthMm, wcsOffset);
    }
  }

  private compute3AxisPose(
    axes: AxisPositionState,
    toolLength: number,
    wcs: Vector3D
  ): MachinePose {
    // In standard 3-axis VMC: Tool moves in XYZ relative to fixed table + WCS
    const toolTipWorld: Vector3D = {
      x: axes.x + wcs.x,
      y: axes.y + wcs.y,
      z: axes.z + wcs.z,
    };

    const toolOrientationWorld: Vector3D = { x: 0, y: 0, z: 1 }; // Pointing straight down along +Z tool axis

    const toolBaseWorld: Vector3D = {
      x: toolTipWorld.x,
      y: toolTipWorld.y,
      z: toolTipWorld.z + toolLength,
    };

    const holderOriginWorld: Vector3D = {
      x: toolBaseWorld.x,
      y: toolBaseWorld.y,
      z: toolBaseWorld.z + 20, // 20mm holder collet clearance
    };

    const spindleNoseWorld: Vector3D = {
      x: holderOriginWorld.x,
      y: holderOriginWorld.y,
      z: holderOriginWorld.z + 80, // Spindle face
    };

    const tablePositionWorld: Vector3D = { x: 0, y: 0, z: 0 };
    const stockOriginWorld: Vector3D = { x: wcs.x, y: wcs.y, z: wcs.z };

    return {
      axes,
      toolTipWorld,
      toolBaseWorld,
      toolOrientationWorld,
      holderOriginWorld,
      spindleNoseWorld,
      tablePositionWorld,
      stockOriginWorld,
    };
  }

  private compute4AxisTablePose(
    axes: AxisPositionState,
    toolLength: number,
    wcs: Vector3D
  ): MachinePose {
    // 4-Axis: Rotary table around A (X-axis) or B (Y-axis) or C (Z-axis)
    const rotRad = (axes.a * Math.PI) / 180.0;
    const cosA = Math.cos(rotRad);
    const sinA = Math.sin(rotRad);

    // Stock rotates with rotary table around X-axis (A-axis)
    const rotatedStockOrigin: Vector3D = {
      x: wcs.x,
      y: wcs.y * cosA - wcs.z * sinA,
      z: wcs.y * sinA + wcs.z * cosA,
    };

    const toolTipWorld: Vector3D = {
      x: axes.x,
      y: axes.y,
      z: axes.z,
    };

    // Tool orientation remains vertical in 4-axis table rotary
    const toolOrientationWorld: Vector3D = {
      x: 0,
      y: -sinA,
      z: cosA,
    };

    const toolBaseWorld: Vector3D = {
      x: toolTipWorld.x,
      y: toolTipWorld.y,
      z: toolTipWorld.z + toolLength,
    };

    const holderOriginWorld: Vector3D = {
      x: toolBaseWorld.x,
      y: toolBaseWorld.y,
      z: toolBaseWorld.z + 25,
    };

    const spindleNoseWorld: Vector3D = {
      x: holderOriginWorld.x,
      y: holderOriginWorld.y,
      z: holderOriginWorld.z + 80,
    };

    return {
      axes,
      toolTipWorld,
      toolBaseWorld,
      toolOrientationWorld,
      holderOriginWorld,
      spindleNoseWorld,
      tablePositionWorld: { x: 0, y: 0, z: 0 },
      stockOriginWorld: rotatedStockOrigin,
    };
  }

  private compute5AxisTableTablePose(
    axes: AxisPositionState,
    toolLength: number,
    wcs: Vector3D
  ): MachinePose {
    // 5-Axis Table-Table (Trunnion A/B tilting, C rotary)
    const aRad = ((axes.a || axes.b) * Math.PI) / 180.0;
    const cRad = (axes.c * Math.PI) / 180.0;

    const cosA = Math.cos(aRad);
    const sinA = Math.sin(aRad);
    const cosC = Math.cos(cRad);
    const sinC = Math.sin(cRad);

    // Orientation vector derived from table inverse rotation
    const toolOrientationWorld: Vector3D = {
      x: sinA * sinC,
      y: sinA * cosC,
      z: cosA,
    };

    // Normalize orientation vector
    const mag = Math.sqrt(
      toolOrientationWorld.x * toolOrientationWorld.x +
      toolOrientationWorld.y * toolOrientationWorld.y +
      toolOrientationWorld.z * toolOrientationWorld.z
    ) || 1.0;

    const normOrientation: Vector3D = {
      x: toolOrientationWorld.x / mag,
      y: toolOrientationWorld.y / mag,
      z: toolOrientationWorld.z / mag,
    };

    const toolTipWorld: Vector3D = {
      x: axes.x + wcs.x,
      y: axes.y + wcs.y,
      z: axes.z + wcs.z,
    };

    const toolBaseWorld: Vector3D = {
      x: toolTipWorld.x,
      y: toolTipWorld.y,
      z: toolTipWorld.z + toolLength,
    };

    const holderOriginWorld: Vector3D = {
      x: toolBaseWorld.x,
      y: toolBaseWorld.y,
      z: toolBaseWorld.z + 30,
    };

    const spindleNoseWorld: Vector3D = {
      x: holderOriginWorld.x,
      y: holderOriginWorld.y,
      z: holderOriginWorld.z + 85,
    };

    return {
      axes,
      toolTipWorld,
      toolBaseWorld,
      toolOrientationWorld: normOrientation,
      holderOriginWorld,
      spindleNoseWorld,
      tablePositionWorld: { x: 0, y: 0, z: 0 },
      stockOriginWorld: { x: wcs.x, y: wcs.y, z: wcs.z },
    };
  }

  private compute5AxisHeadTablePose(
    axes: AxisPositionState,
    toolLength: number,
    wcs: Vector3D
  ): MachinePose {
    // Swivel Head (B-axis tilt) + Rotary Table (C-axis)
    const bRad = (axes.b * Math.PI) / 180.0;
    const cRad = (axes.c * Math.PI) / 180.0;

    const cosB = Math.cos(bRad);
    const sinB = Math.sin(bRad);

    const toolOrientationWorld: Vector3D = {
      x: -sinB,
      y: 0,
      z: cosB,
    };

    const toolTipWorld: Vector3D = {
      x: axes.x + wcs.x,
      y: axes.y + wcs.y,
      z: axes.z + wcs.z,
    };

    const toolBaseWorld: Vector3D = {
      x: toolTipWorld.x + toolLength * toolOrientationWorld.x,
      y: toolTipWorld.y + toolLength * toolOrientationWorld.y,
      z: toolTipWorld.z + toolLength * toolOrientationWorld.z,
    };

    const holderOriginWorld: Vector3D = {
      x: toolBaseWorld.x + 30 * toolOrientationWorld.x,
      y: toolBaseWorld.y + 30 * toolOrientationWorld.y,
      z: toolBaseWorld.z + 30 * toolOrientationWorld.z,
    };

    const spindleNoseWorld: Vector3D = {
      x: holderOriginWorld.x + 80 * toolOrientationWorld.x,
      y: holderOriginWorld.y + 80 * toolOrientationWorld.y,
      z: holderOriginWorld.z + 80 * toolOrientationWorld.z,
    };

    return {
      axes,
      toolTipWorld,
      toolBaseWorld,
      toolOrientationWorld,
      holderOriginWorld,
      spindleNoseWorld,
      tablePositionWorld: { x: 0, y: 0, z: 0 },
      stockOriginWorld: { x: wcs.x, y: wcs.y, z: wcs.z },
    };
  }

  private compute5AxisHeadHeadPose(
    axes: AxisPositionState,
    toolLength: number,
    wcs: Vector3D
  ): MachinePose {
    // Articulated Swivel Head (A/B and C on Spindle)
    const aRad = (axes.a * Math.PI) / 180.0;
    const cRad = (axes.c * Math.PI) / 180.0;

    const sinA = Math.sin(aRad);
    const cosA = Math.cos(aRad);
    const sinC = Math.sin(cRad);
    const cosC = Math.cos(cRad);

    const toolOrientationWorld: Vector3D = {
      x: sinA * sinC,
      y: -sinA * cosC,
      z: cosA,
    };

    const toolTipWorld: Vector3D = {
      x: axes.x + wcs.x,
      y: axes.y + wcs.y,
      z: axes.z + wcs.z,
    };

    const toolBaseWorld: Vector3D = {
      x: toolTipWorld.x + toolLength * toolOrientationWorld.x,
      y: toolTipWorld.y + toolLength * toolOrientationWorld.y,
      z: toolTipWorld.z + toolLength * toolOrientationWorld.z,
    };

    const holderOriginWorld: Vector3D = {
      x: toolBaseWorld.x + 35 * toolOrientationWorld.x,
      y: toolBaseWorld.y + 35 * toolOrientationWorld.y,
      z: toolBaseWorld.z + 35 * toolOrientationWorld.z,
    };

    const spindleNoseWorld: Vector3D = {
      x: holderOriginWorld.x + 90 * toolOrientationWorld.x,
      y: holderOriginWorld.y + 90 * toolOrientationWorld.y,
      z: holderOriginWorld.z + 90 * toolOrientationWorld.z,
    };

    return {
      axes,
      toolTipWorld,
      toolBaseWorld,
      toolOrientationWorld,
      holderOriginWorld,
      spindleNoseWorld,
      tablePositionWorld: { x: 0, y: 0, z: 0 },
      stockOriginWorld: { x: wcs.x, y: wcs.y, z: wcs.z },
    };
  }

  private computeMillTurnPose(
    axes: AxisPositionState,
    toolLength: number,
    wcs: Vector3D
  ): MachinePose {
    // Mill-Turn (Spindle C-axis rotary chuck + Upper B-axis milling head)
    const bRad = (axes.b * Math.PI) / 180.0;
    const sinB = Math.sin(bRad);
    const cosB = Math.cos(bRad);

    const toolOrientationWorld: Vector3D = {
      x: -sinB,
      y: 0,
      z: cosB,
    };

    const toolTipWorld: Vector3D = {
      x: axes.x + wcs.x,
      y: axes.y + wcs.y,
      z: axes.z + wcs.z,
    };

    const toolBaseWorld: Vector3D = {
      x: toolTipWorld.x + toolLength * toolOrientationWorld.x,
      y: toolTipWorld.y,
      z: toolTipWorld.z + toolLength * toolOrientationWorld.z,
    };

    return {
      axes,
      toolTipWorld,
      toolBaseWorld,
      toolOrientationWorld,
      holderOriginWorld: {
        x: toolBaseWorld.x + 30 * toolOrientationWorld.x,
        y: toolBaseWorld.y,
        z: toolBaseWorld.z + 30 * toolOrientationWorld.z,
      },
      spindleNoseWorld: {
        x: toolBaseWorld.x + 100 * toolOrientationWorld.x,
        y: toolBaseWorld.y,
        z: toolBaseWorld.z + 100 * toolOrientationWorld.z,
      },
      tablePositionWorld: { x: 0, y: 0, z: 0 },
      stockOriginWorld: { x: wcs.x, y: wcs.y, z: wcs.z },
    };
  }
}
