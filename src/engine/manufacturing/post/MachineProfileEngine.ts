import { 
  MachineProfile, 
  SpindleDirection,
  MachineAxisConvention
} from "./types";
import { MachineType, MachineAxisType } from "../kinematics/types";

export class MachineProfileEngine {
  public static createStandard5AxisMachineProfile(): MachineProfile {
    return {
      machineId: "MACHINE_TRUNNION_5AXIS_01",
      machineRevision: 1,
      name: "High-Precision 5-Axis Trunnion VMC",
      kinematicType: MachineType.TRUNNION_5AXIS,
      axisDefinitions: {
        X: { type: MachineAxisType.LINEAR, minLimit: -600, maxLimit: 600, maxFeed: 30000, unit: "mm" },
        Y: { type: MachineAxisType.LINEAR, minLimit: -400, maxLimit: 400, maxFeed: 30000, unit: "mm" },
        Z: { type: MachineAxisType.LINEAR, minLimit: -50, maxLimit: 500, maxFeed: 30000, unit: "mm" },
        A: { type: MachineAxisType.ROTARY, minLimit: -120, maxLimit: 120, maxFeed: 18000, unit: "deg" },
        C: { type: MachineAxisType.ROTARY, minLimit: -99999, maxLimit: 99999, maxFeed: 36000, unit: "deg" }
      },
      axisLimits: {
        X: { min: -600, max: 600 },
        Y: { min: -400, max: 400 },
        Z: { min: -50, max: 500 },
        A: { min: -120, max: 120 },
        C: { min: -99999, max: 99999 }
      },
      axisUnits: "METRIC_MM",
      homePositions: { X: 0, Y: 0, Z: 500, A: 0, C: 0 },
      safePositions: { X: 0, Y: 0, Z: 200, A: 0, C: 0 },
      rotaryAxes: [
        {
          axisName: "A",
          rotationDirection: "CW_POSITIVE",
          zeroPosition: 0,
          wrapMode: "STRICT_RANGE" as any,
          continuousMode: false,
          minAngle: -120,
          maxAngle: 120
        },
        {
          axisName: "C",
          rotationDirection: "CCW_POSITIVE",
          zeroPosition: 0,
          wrapMode: "UNWRAPPED" as any,
          continuousMode: true,
          minAngle: -99999,
          maxAngle: 99999
        }
      ],
      spindle: {
        maxRPM: 24000,
        minRPM: 50,
        maxPowerKW: 18.5,
        directions: [SpindleDirection.CW, SpindleDirection.CCW]
      },
      toolChanger: {
        capacity: 40,
        maxToolLengthMM: 300,
        maxToolDiameterMM: 80,
        changeTimeSec: 2.8
      },
      coolant: {
        flood: true,
        mist: true,
        throughSpindle: true,
        airBlast: true
      },
      provenance: {
        sourceId: "SYSTEM_MACHINE_LIB",
        sourceType: "STANDARD" as any,
        reference: "Industrial Machine Specifications",
        timestamp: new Date().toISOString(),
        author: "SECP Kinematics Team",
        hash: "0xTRUNNION5AXIS"
      }
    };
  }

  public static validateMachineProfile(profile: MachineProfile): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!profile) {
      return { valid: false, errors: ["Null or undefined machine profile"] };
    }
    if (!profile.machineId) errors.push("Missing machineId");
    if (!profile.axisDefinitions) errors.push("Missing axisDefinitions");
    if (!profile.axisLimits) errors.push("Missing axisLimits");
    if (!profile.spindle) errors.push("Missing spindle definition");

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
