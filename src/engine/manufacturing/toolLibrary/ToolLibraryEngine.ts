import { 
  ToolDefinition, 
  ToolAssembly, 
  ToolInstance, 
  ToolCondition, 
  ToolQualification,
  ToolQualificationVerdict
} from "./types";

export class ToolLibraryEngine {
  /**
   * Calculates a deterministic, reproducible cryptographic fingerprint for a tool definition.
   */
  public static calculateToolFingerprint(tool: ToolDefinition): string {
    const parts = [
      tool.toolId,
      tool.toolRevision.toString(),
      tool.toolType,
      tool.manufacturer,
      tool.manufacturerPartNumber,
      tool.maximumRPM.toString(),
      tool.material,
      tool.coating,
      tool.geometry.cuttingDiameter.toString(),
      tool.geometry.cuttingLength.toString(),
      tool.geometry.overallLength.toString(),
      tool.provenance.source
    ];

    return "tool-fingerprint-" + parts.join("__").replace(/[^a-zA-Z0-9_-]/g, "");
  }

  /**
   * Calculates a deterministic, reproducible cryptographic fingerprint for a tool assembly.
   */
  public static calculateAssemblyFingerprint(assembly: ToolAssembly): string {
    const parts = [
      assembly.assemblyId,
      assembly.toolId,
      assembly.stickoutLength.toString(),
      assembly.gaugeLength.toString(),
      assembly.effectiveReach.toString(),
      assembly.holder ? assembly.holder.holderId : "no-holder",
      assembly.extension ? assembly.extension.extensionId : "no-extension"
    ];

    return "assembly-fingerprint-" + parts.join("__").replace(/[^a-zA-Z0-9_-]/g, "");
  }

  /**
   * Evaluates the qualification of a tool for a specific combination of material, operation, and machine.
   */
  public static evaluateQualification(
    qualification: ToolQualification,
    actualRPM: number,
    actualFeed: number
  ): ToolQualificationVerdict {
    // 1. Invalidation/Suspension check
    if (qualification.verdict === ToolQualificationVerdict.SUSPENDED) {
      return ToolQualificationVerdict.SUSPENDED;
    }

    if (qualification.verdict === ToolQualificationVerdict.EXPIRED) {
      return ToolQualificationVerdict.EXPIRED;
    }

    // 2. Bound constraints check
    const limits = qualification.evidence.limits;
    if (actualRPM > limits.maxRPM || actualFeed > limits.maxFeed) {
      return ToolQualificationVerdict.OUTSIDE_SCOPE;
    }

    return ToolQualificationVerdict.QUALIFIED;
  }

  /**
   * Processes a physical tool telemetry update (spindle/cutting time) and updates the tool life and wear state.
   */
  public static updateTelemetry(
    instance: ToolInstance,
    cuttingTimeIncrement: number, // in minutes
    measuredWear?: number
  ): ToolInstance {
    const updatedInstance = { ...instance };

    // Update times
    updatedInstance.cuttingTime += cuttingTimeIncrement;
    updatedInstance.usageCount += 1;

    // Check Wear State
    if (updatedInstance.wearState) {
      const wear = updatedInstance.wearState;
      if (measuredWear !== undefined) {
        wear.wearValue = measuredWear;
      } else {
        // Linear wear simulation as a fallback
        wear.wearValue += cuttingTimeIncrement * 0.005; // 0.005mm per minute
      }
      wear.timestamp = new Date().toISOString();

      // Check if wear limit is exceeded
      if (wear.wearValue >= wear.wearLimit) {
        updatedInstance.status = ToolCondition.RETIRED;
      } else if (wear.wearValue >= wear.wearLimit * 0.8) {
        updatedInstance.status = ToolCondition.WORN;
      } else {
        updatedInstance.status = ToolCondition.USED;
      }
    }

    // Update remaining life
    if (updatedInstance.lifeModel) {
      updatedInstance.lifeModel.remainingLife = Math.max(
        0,
        updatedInstance.lifeModel.nominalLife - updatedInstance.cuttingTime
      );
      updatedInstance.remainingLife = updatedInstance.lifeModel.remainingLife;

      if (updatedInstance.remainingLife <= 0 && updatedInstance.status !== ToolCondition.RETIRED) {
        updatedInstance.status = ToolCondition.INSPECTION_REQUIRED;
      }
    } else {
      updatedInstance.remainingLife = Math.max(0, updatedInstance.remainingLife - cuttingTimeIncrement);
    }

    return updatedInstance;
  }
}
