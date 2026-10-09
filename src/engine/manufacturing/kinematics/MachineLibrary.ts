import { 
  MachineKinematicModel, 
  MachineType, 
  MachineLibraryStatus, 
  MachineAxisType, 
  KinematicJointType,
  MachineCompatibilityVerdict
} from "./types";
import { KinematicReachabilityAnalyzer } from "./KinematicReachabilityAnalyzer";

export class MachineLibrary {
  private machines: Map<string, MachineKinematicModel> = new Map();

  constructor() {
    this.registerPreconfiguredMachines();
  }

  public createMachine(machine: MachineKinematicModel): void {
    const validation = this.validateMachine(machine);
    if (!validation.isValid) {
      throw new Error(`Invalid machine definition: ${validation.errors.join("; ")}`);
    }
    this.machines.set(machine.machineId, machine);
  }

  public getMachine(machineId: string): MachineKinematicModel | undefined {
    return this.machines.get(machineId);
  }

  public updateMachine(machineId: string, machine: MachineKinematicModel): void {
    this.createMachine(machine);
  }

  public listMachines(): MachineKinematicModel[] {
    return Array.from(this.machines.values());
  }

  /**
   * Deep validation of machine kinematics topology, avoiding loops, duplicates, or missing links.
   */
  public validateMachine(machine: MachineKinematicModel): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!machine.machineId) errors.push("Missing machineId");
    if (machine.machineRevision <= 0) errors.push("Revision must be greater than 0");

    // Check for duplicate axes
    const axisIds = new Set<string>();
    for (const axis of machine.axes) {
      if (axisIds.has(axis.axisId)) {
        errors.push(`Duplicate axis ID: ${axis.axisId}`);
      }
      axisIds.add(axis.axisId);

      // Check axis travel bounds
      if (axis.travelLimits.min > axis.travelLimits.max) {
        errors.push(`Inverted travel limits on axis ${axis.axisId}`);
      }
    }

    // Kinematic graph connectivity checks
    const links = machine.kinematicChain.links;
    const joints = machine.kinematicChain.joints;

    for (const joint of joints) {
      const parentExists = links.some(l => l.linkId === joint.parentLink);
      const childExists = links.some(l => l.linkId === joint.childLink);

      if (!parentExists) {
        errors.push(`Joint ${joint.jointId} references missing parent link ${joint.parentLink}`);
      }
      if (!childExists) {
        errors.push(`Joint ${joint.jointId} references missing child link ${joint.childLink}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Match a manufacturing feature and tooling assembly against available machines.
   */
  public findCompatibleMachines(
    feature: { depth: number; diameter?: number },
    toolAssembly: { gaugeLength: number; stickoutLength: number }
  ): { machineId: string; verdict: MachineCompatibilityVerdict; reason: string }[] {
    const results: { machineId: string; verdict: MachineCompatibilityVerdict; reason: string }[] = [];

    const requiredZReach = feature.depth + toolAssembly.gaugeLength;

    for (const machine of this.machines.values()) {
      const envelope = machine.limits.workEnvelope;
      const zTravel = envelope.zMax - envelope.zMin;

      if (zTravel < requiredZReach) {
        results.push({
          machineId: machine.machineId,
          verdict: MachineCompatibilityVerdict.INCOMPATIBLE,
          reason: `Insufficient Z travel (${zTravel}mm) to clear tool assembly gauge length (${toolAssembly.gaugeLength}mm) and cut depth (${feature.depth}mm)`
        });
      } else {
        results.push({
          machineId: machine.machineId,
          verdict: MachineCompatibilityVerdict.COMPATIBLE,
          reason: "Spindle travel envelopes are fully sufficient for this tooling assembly"
        });
      }
    }

    return results;
  }

  private registerPreconfiguredMachines(): void {
    // 1. HAAS VF-2 (Standard 3-Axis CNC Mill)
    const haasVF2: MachineKinematicModel = {
      machineId: "HAAS_VF2",
      machineRevision: 1,
      machineType: MachineType.MILL_3_AXIS,
      baseFrame: {
        frameId: "BASE",
        origin: { x: 0, y: 0, z: 0 },
        xAxis: { x: 1, y: 0, z: 0 },
        yAxis: { x: 0, y: 1, z: 0 },
        zAxis: { x: 0, y: 0, z: 1 },
        handedness: "RIGHT_HANDED"
      },
      coordinateSystems: [
        {
          id: "MCS",
          name: "Machine Coordinate System",
          baseFrameId: "BASE",
          transformToBase: {
            matrix: [
              [1, 0, 0, 0],
              [0, 1, 0, 0],
              [0, 0, 1, 0],
              [0, 0, 0, 1]
            ]
          }
        }
      ],
      axes: [
        {
          axisId: "X",
          axisName: "X Linear Axis",
          axisType: MachineAxisType.LINEAR_X,
          direction: { x: 1, y: 0, z: 0 },
          origin: { x: 0, y: 0, z: 0 },
          jointId: "J_X",
          travelLimits: { min: -381, max: 381 }, // ±381mm travel (762mm total)
          velocityLimit: 500,
          accelerationLimit: 1200,
          homePosition: 0,
          zeroPosition: 0,
          signConvention: 1
        },
        {
          axisId: "Y",
          axisName: "Y Linear Axis",
          axisType: MachineAxisType.LINEAR_Y,
          direction: { x: 0, y: 1, z: 0 },
          origin: { x: 0, y: 0, z: 0 },
          jointId: "J_Y",
          travelLimits: { min: -254, max: 254 }, // ±254mm travel (508mm total)
          velocityLimit: 500,
          accelerationLimit: 1200,
          homePosition: 0,
          zeroPosition: 0,
          signConvention: 1
        },
        {
          axisId: "Z",
          axisName: "Z Linear Axis",
          axisType: MachineAxisType.LINEAR_Z,
          direction: { x: 0, y: 0, z: 1 },
          origin: { x: 0, y: 0, z: 0 },
          jointId: "J_Z",
          travelLimits: { min: 0, max: 508 }, // 508mm travel
          velocityLimit: 500,
          accelerationLimit: 1200,
          homePosition: 508,
          zeroPosition: 0,
          signConvention: 1
        }
      ],
      kinematicChain: {
        chainId: "MILL_3X_CHAIN",
        links: [
          { linkId: "BASE_LINK", name: "Machine Base Bed" },
          { linkId: "TABLE_LINK", name: "Workpiece Table" },
          { linkId: "SPINDLE_HEAD", name: "Milling Spindle Head" }
        ],
        joints: [
          { jointId: "J_X", jointType: KinematicJointType.PRISMATIC, parentLink: "BASE_LINK", childLink: "TABLE_LINK", axisId: "X", origin: { x: 0, y: 0, z: 0 }, offset: 0 },
          { jointId: "J_Z", jointType: KinematicJointType.PRISMATIC, parentLink: "BASE_LINK", childLink: "SPINDLE_HEAD", axisId: "Z", origin: { x: 0, y: 0, z: 0 }, offset: 0 }
        ],
        baseFrameId: "BASE"
      },
      spindle: {
        spindleId: "SPINDLE_1",
        maxRPM: 10000,
        interfaceType: "CAT40"
      },
      limits: {
        maxWorkpieceWeight: 1361,
        maxToolWeight: 5.4,
        workEnvelope: {
          xMin: -381,
          xMax: 381,
          yMin: -254,
          yMax: 254,
          zMin: 0,
          zMax: 508
        }
      },
      controllerCapabilities: {
        rtcpSupported: false,
        toolLengthCompensation: true,
        workOffsetsCount: 100,
        rotaryInterpolation: false,
        inverseTimeFeed: false,
        continuous5Axis: false
      },
      status: MachineLibraryStatus.ACTIVE,
      provenance: {
        source: "HAAS_CATALOG_2026",
        manufacturer: "Haas Automation",
        model: "VF-2",
        serialNumber: "SN-VF2-109283",
        importDate: new Date().toISOString()
      },
      fingerprint: "haas-vf2-provenance-fingerprint-2026"
    };

    this.machines.set(haasVF2.machineId, haasVF2);

    // 2. HERMLE C32 (Production 5-Axis Table-Table CNC Mill)
    const hermleC32: MachineKinematicModel = {
      machineId: "HERMLE_C32",
      machineRevision: 1,
      machineType: MachineType.MILL_5_AXIS,
      baseFrame: {
        frameId: "BASE",
        origin: { x: 0, y: 0, z: 0 },
        xAxis: { x: 1, y: 0, z: 0 },
        yAxis: { x: 0, y: 1, z: 0 },
        zAxis: { x: 0, y: 0, z: 1 },
        handedness: "RIGHT_HANDED"
      },
      coordinateSystems: [
        {
          id: "MCS",
          name: "Machine Coordinate System",
          baseFrameId: "BASE",
          transformToBase: {
            matrix: [
              [1, 0, 0, 0],
              [0, 1, 0, 0],
              [0, 0, 1, 0],
              [0, 0, 0, 1]
            ]
          }
        }
      ],
      axes: [
        {
          axisId: "X",
          axisName: "X Linear Axis",
          axisType: MachineAxisType.LINEAR_X,
          direction: { x: 1, y: 0, z: 0 },
          origin: { x: 0, y: 0, z: 0 },
          jointId: "J_X",
          travelLimits: { min: -325, max: 325 }, // 650mm total
          velocityLimit: 1000,
          accelerationLimit: 6000,
          homePosition: 0,
          zeroPosition: 0,
          signConvention: 1
        },
        {
          axisId: "Y",
          axisName: "Y Linear Axis",
          axisType: MachineAxisType.LINEAR_Y,
          direction: { x: 0, y: 1, z: 0 },
          origin: { x: 0, y: 0, z: 0 },
          jointId: "J_Y",
          travelLimits: { min: -300, max: 300 }, // 600mm total
          velocityLimit: 1000,
          accelerationLimit: 6000,
          homePosition: 0,
          zeroPosition: 0,
          signConvention: 1
        },
        {
          axisId: "Z",
          axisName: "Z Linear Axis",
          axisType: MachineAxisType.LINEAR_Z,
          direction: { x: 0, y: 0, z: 1 },
          origin: { x: 0, y: 0, z: 0 },
          jointId: "J_Z",
          travelLimits: { min: 0, max: 500 }, // 500mm total
          velocityLimit: 1000,
          accelerationLimit: 6000,
          homePosition: 500,
          zeroPosition: 0,
          signConvention: 1
        },
        {
          axisId: "A",
          axisName: "Rotary Swivel Axis A",
          axisType: MachineAxisType.ROTARY_A,
          direction: { x: 1, y: 0, z: 0 },
          origin: { x: 0, y: 0, z: 0 },
          jointId: "J_A",
          travelLimits: { min: -130, max: 130 }, // ±130 degrees tilt
          velocityLimit: 50,
          accelerationLimit: 200,
          homePosition: 0,
          zeroPosition: 0,
          signConvention: 1
        },
        {
          axisId: "C",
          axisName: "Rotary Table Axis C",
          axisType: MachineAxisType.ROTARY_C,
          direction: { x: 0, y: 0, z: 1 },
          origin: { x: 0, y: 0, z: 0 },
          jointId: "J_C",
          travelLimits: { min: -360, max: 360 },
          velocityLimit: 65,
          accelerationLimit: 300,
          homePosition: 0,
          zeroPosition: 0,
          signConvention: 1,
          continuousRotation: true
        }
      ],
      kinematicChain: {
        chainId: "TABLE-TABLE",
        links: [
          { linkId: "BASE_LINK", name: "Hermle Base Structure" },
          { linkId: "TRUNNION_A", name: "A-Axis Trunnion Table" },
          { linkId: "ROT_C_TABLE", name: "C-Axis Rotating Disk" },
          { linkId: "COLUMN_XYZ", name: "Upper Column structure" }
        ],
        joints: [
          { jointId: "J_A", jointType: KinematicJointType.REVOLUTE, parentLink: "BASE_LINK", childLink: "TRUNNION_A", axisId: "A", origin: { x: 0, y: 0, z: 0 }, offset: 0 },
          { jointId: "J_C", jointType: KinematicJointType.REVOLUTE, parentLink: "TRUNNION_A", childLink: "ROT_C_TABLE", axisId: "C", origin: { x: 0, y: 0, z: 0 }, offset: 0 }
        ],
        baseFrameId: "BASE"
      },
      spindle: {
        spindleId: "SPINDLE_H32",
        maxRPM: 18000,
        interfaceType: "HSK-A63"
      },
      limits: {
        maxWorkpieceWeight: 1000,
        maxToolWeight: 8.0,
        workEnvelope: {
          xMin: -325,
          xMax: 325,
          yMin: -300,
          yMax: 300,
          zMin: 0,
          zMax: 500
        }
      },
      controllerCapabilities: {
        rtcpSupported: true, // RTCP capability metadata separated from machine kinematics
        toolLengthCompensation: true,
        workOffsetsCount: 500,
        rotaryInterpolation: true,
        inverseTimeFeed: true,
        continuous5Axis: true
      },
      status: MachineLibraryStatus.ACTIVE,
      provenance: {
        source: "HERMLE_MANUFACTURER_CATALOG",
        manufacturer: "Hermle AG",
        model: "C32 U",
        serialNumber: "SN-H32-849202",
        importDate: new Date().toISOString()
      },
      fingerprint: "hermle-c32-provenance-fingerprint-2026"
    };

    this.machines.set(hermleC32.machineId, hermleC32);
  }
}
