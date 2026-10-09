import { 
  ToolDefinition, 
  ToolAssembly, 
  ToolInstance, 
  ToolLibraryStatus, 
  ManufacturingToolType, 
  ToolMaterialType, 
  ToolCoatingType, 
  ToolHolderInterface, 
  ToolCondition, 
  ToolSelectionVerdict
} from "./types";
import { ToolDataValidator } from "./ToolDataValidator";
import { ToolLibraryEngine } from "./ToolLibraryEngine";

export interface AdversarialTestResult {
  testId: string;
  category: "IDENTITY" | "GEOMETRY" | "MATERIAL" | "LIMITS" | "ASSEMBLY" | "CUTTING_DATA" | "QUALIFICATION" | "INTEGRITY";
  description: string;
  passed: boolean;
  details: string;
}

export class ToolLibraryAdversarialSuite {
  /**
   * Run the adversarial testing suite.
   */
  public static runSuite(): AdversarialTestResult[] {
    const results: AdversarialTestResult[] = [];

    // Test 1: Impossible Geometry (cuttingLength > overallLength)
    const impossibleTool: ToolDefinition = {
      toolId: "T-IMP-001",
      toolRevision: 1,
      toolType: ManufacturingToolType.END_MILL,
      manufacturer: "ToolCorp",
      manufacturerPartNumber: "TC-IMP-1",
      catalogNumber: "CAT-1",
      toolName: "Broken Geometry Tool",
      description: "Impossible length",
      standard: "ISO",
      status: ToolLibraryStatus.DRAFT,
      geometry: {
        cuttingDiameter: 10,
        cuttingLength: 50, // Longer than overall length!
        overallLength: 30,
        shankDiameter: 10,
        shankLength: 10
      },
      material: ToolMaterialType.CARBIDE,
      coating: ToolCoatingType.TiN,
      cuttingEdges: [],
      maximumRPM: 12000,
      coolantCompatibility: [],
      operationCompatibility: {},
      materialsCuttingRules: [],
      provenance: { source: "MANUAL", sourceType: "USER", manufacturer: "ToolCorp", catalogRevision: 1, importTimestamp: "" },
      fingerprint: ""
    };

    const geomValidation = ToolDataValidator.validateToolDefinition(impossibleTool);
    results.push({
      testId: "ADV-GEOM-001",
      category: "GEOMETRY",
      description: "Reject tool when cutting length exceeds overall tool length",
      passed: !geomValidation.isValid && geomValidation.errors.some(e => e.includes("cannot be greater than overallLength")),
      details: geomValidation.errors.join("; ")
    });

    // Test 2: Impossible Assembly (stickout > overallLength)
    const badAssembly: ToolAssembly = {
      assemblyId: "A-BAD-1",
      toolId: "T-IMP-001",
      stickoutLength: 40, // More than 30 overallLength!
      gaugeLength: 40,
      effectiveReach: 40,
      maximumReach: 40,
      recommendedReach: 30,
      envelope: { radialEnvelope: 10, axialEnvelope: 50, holderEnvelope: 30, cuttingEnvelope: 10, assemblyEnvelope: 10 },
      fingerprint: ""
    };

    const assemblyValidation = ToolDataValidator.validateAssembly(badAssembly, impossibleTool);
    results.push({
      testId: "ADV-ASSM-001",
      category: "ASSEMBLY",
      description: "Reject assembly when stickout length exceeds tool overall length",
      passed: !assemblyValidation.isValid && assemblyValidation.errors.some(e => e.includes("exceeds tool overall length")),
      details: assemblyValidation.errors.join("; ")
    });

    // Test 3: Spindle Interface Mismatch
    const machineSpindle = "HSK";
    const catHolderInterface = ToolHolderInterface.CAT;
    const isCompatible = ToolDataValidator.checkMachineInterfaceCompatibility(machineSpindle, catHolderInterface);
    results.push({
      testId: "ADV-LIMIT-001",
      category: "LIMITS",
      description: "Detect spindle interface mismatch (HSK Spindle with CAT Holder)",
      passed: isCompatible === false,
      details: `Compatibility evaluation result: ${isCompatible}`
    });

    // Test 4: Tool wear-out and automatic retirement telemetry
    const initialInstance: ToolInstance = {
      instanceId: "I-001",
      toolId: "T-1",
      serialNumber: "SN-9912",
      batchNumber: "B1",
      location: "Spindle",
      status: ToolCondition.USED,
      usageCount: 10,
      cuttingTime: 80,
      lastInspection: "",
      remainingLife: 20,
      wearState: {
        wearMetric: "Flank Wear VB",
        wearValue: 0.25,
        wearLimit: 0.3, // Limit is 0.3mm
        measurementMethod: "Optical Microscope",
        timestamp: ""
      }
    };

    const telemetryUpdated = ToolLibraryEngine.updateTelemetry(initialInstance, 10, 0.32); // Exceeds wearLimit!
    results.push({
      testId: "ADV-LIMIT-002",
      category: "LIMITS",
      description: "Telemetry forces tool instance retirement when flank wear exceeds safety threshold",
      passed: telemetryUpdated.status === ToolCondition.RETIRED,
      details: `New status: ${telemetryUpdated.status}, Wear value: ${telemetryUpdated.wearState?.wearValue}`
    });

    return results;
  }
}
