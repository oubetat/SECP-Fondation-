import { describe, expect, it } from "vitest";
import { 
  ToolDataValidator, 
  ToolSelectionEngine, 
  ToolLibraryEngine, 
  ToolLibraryAdversarialSuite,
  HardAcceptanceGate102,
  generateReports102,
  ManufacturingToolType,
  ToolMaterialType,
  ToolCoatingType,
  ToolLibraryStatus,
  ToolTipType,
  ToolHolderInterface,
  ToolCondition,
  ToolSelectionVerdict
} from "../toolLibrary/index";
import { ManufacturingFeature, ManufacturingFeatureType, ManufacturingIntent } from "../features/types";

describe("PATCH-102: CAM Tool Library Model", () => {
  const sampleTool: any = {
    toolId: "T1",
    toolRevision: 1,
    toolType: ManufacturingToolType.END_MILL,
    manufacturer: "Guhring",
    manufacturerPartNumber: "MPN-1",
    catalogNumber: "CAT-1",
    toolName: "Ø10 End Mill",
    description: "Solid Carbide",
    standard: "DIN",
    status: ToolLibraryStatus.ACTIVE,
    geometry: {
      cuttingDiameter: 10,
      cuttingLength: 22,
      overallLength: 72,
      shankDiameter: 10,
      shankLength: 40
    },
    material: ToolMaterialType.CARBIDE,
    coating: ToolCoatingType.AlTiN,
    cuttingEdges: [],
    maximumRPM: 15000,
    coolantCompatibility: ["FLOOD"],
    operationCompatibility: {
      "MILL": "COMPATIBLE"
    },
    materialsCuttingRules: [],
    provenance: { source: "CATALOG", sourceType: "MANUFACTURER", manufacturer: "Guhring", catalogRevision: 1, importTimestamp: "" },
    fingerprint: ""
  };

  it("1. ToolDataValidator flags invalid tool geometries", () => {
    const invalidTool = {
      ...sampleTool,
      geometry: {
        ...sampleTool.geometry,
        cuttingLength: 80 // > overallLength (72)
      }
    };
    const validation = ToolDataValidator.validateToolDefinition(invalidTool);
    expect(validation.isValid).toBe(false);
    expect(validation.errors.some(e => e.includes("cannot be greater than overallLength"))).toBe(true);
  });

  it("2. ToolDataValidator validates assembly consistency", () => {
    const assembly: any = {
      assemblyId: "ASM-1",
      toolId: "T1",
      stickoutLength: 32,
      gaugeLength: 112, // 80 (holder) + 32 (stickout)
      effectiveReach: 32,
      maximumReach: 40,
      recommendedReach: 32,
      holder: {
        holderId: "H1",
        interfaceType: ToolHolderInterface.BT,
        gaugeLength: 80,
        overallLength: 100,
        diameter: 40,
        runout: 0.002,
        maxRPM: 18000,
        manufacturer: "Rego-Fix",
        revision: 1
      }
    };

    const validation = ToolDataValidator.validateAssembly(assembly, sampleTool);
    expect(validation.isValid).toBe(true);
  });

  it("3. ToolSelectionEngine qualifies and ranks compatible candidates", () => {
    const feature: ManufacturingFeature = {
      featureId: "FEAT-P1",
      featureType: ManufacturingFeatureType.POCKET,
      partId: "P-1",
      partRevision: 1,
      geometryReferences: ["F1"],
      topologyReferences: [],
      parameters: {
        diameter: { name: "Diameter", value: 12, unit: "mm", confidence: 1.0, provenance: {} as any },
        depth: { name: "Depth", value: 15, unit: "mm", confidence: 1.0, provenance: {} as any }
      },
      intent: ManufacturingIntent.MILL,
      origin: "RECOGNIZED" as any,
      childFeatures: [],
      dependencies: [],
      status: "VALID" as any,
      visibility: "VISIBLE" as any,
      accessibility: ["+Z"],
      revision: 1,
      timestamp: "",
      fingerprint: ""
    };

    const selection = ToolSelectionEngine.selectToolsForFeature(feature, [sampleTool], [], "STEEL");
    expect(selection.length).toBe(1);
    expect(selection[0].verdict).toBe(ToolSelectionVerdict.ELIGIBLE);
  });

  it("4. ToolLibraryEngine handles telemetry and auto-retire on high wear", () => {
    const instance: any = {
      instanceId: "INST-1",
      toolId: "T1",
      serialNumber: "SN-1",
      batchNumber: "B1",
      location: "Spindle",
      status: ToolCondition.USED,
      usageCount: 5,
      cuttingTime: 40,
      lastInspection: "",
      remainingLife: 60,
      wearState: {
        wearMetric: "Flank",
        wearValue: 0.1,
        wearLimit: 0.3,
        measurementMethod: "Optical",
        timestamp: ""
      }
    };

    // Increment cutting time by 10 mins and simulate wear value 0.31 (exceeding limit 0.3)
    const updated = ToolLibraryEngine.updateTelemetry(instance, 10, 0.31);
    expect(updated.status).toBe(ToolCondition.RETIRED);
    expect(updated.cuttingTime).toBe(50);
  });

  it("5. ToolLibraryAdversarialSuite passes all cases", () => {
    const advResults = ToolLibraryAdversarialSuite.runSuite();
    expect(advResults.every(r => r.passed)).toBe(true);
  });

  it("6. HardAcceptanceGate102 evaluates to PASS", () => {
    const gate = HardAcceptanceGate102.evaluateGate();
    expect(gate.verdict).toBe("PASS");
  });

  it("7. generateReports102 runs without errors", () => {
    expect(() => generateReports102()).not.toThrow();
  });
});
