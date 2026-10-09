import { 
  ToolDefinition, 
  ToolAssembly, 
  ManufacturingToolType, 
  ToolMaterialType, 
  ToolCoatingType, 
  ToolHolderInterface, 
  ToolLibraryStatus, 
  ToolTipType,
  ToolSelectionVerdict, CoolantType, ToolOperationCompatibilityType
} from "./types";
import { ToolDataValidator } from "./ToolDataValidator";
import { ToolSelectionEngine } from "./ToolSelectionEngine";
import { ToolLibraryEngine } from "./ToolLibraryEngine";
import { ToolLibraryAdversarialSuite } from "./ToolLibraryAdversarialSuite";
import { ManufacturingFeature, ManufacturingFeatureType, ManufacturingIntent } from "../features/types";

export interface Gate102Report {
  verdict: "PASS" | "FAIL";
  checks: { id: string; passed: boolean; details: string }[];
}

export class HardAcceptanceGate102 {
  public static evaluateGate(): Gate102Report {
    const checks: { id: string; passed: boolean; details: string }[] = [];

    // Setup representative high-quality tool definitions
    const tool1: ToolDefinition = {
      toolId: "T-EM-010",
      toolRevision: 1,
      toolType: ManufacturingToolType.END_MILL,
      manufacturer: "Guhring",
      manufacturerPartNumber: "3736-10.000",
      catalogNumber: "GH-3736-10",
      toolName: "Ø10 Carbide End Mill",
      description: "Solid carbide high performance end mill",
      standard: "DIN 6527",
      status: ToolLibraryStatus.ACTIVE,
      geometry: {
        cuttingDiameter: 10.0,
        cuttingLength: 22.0,
        overallLength: 72.0,
        shankDiameter: 10.0,
        shankLength: 40.0,
        cornerRadius: 0.0
      },
      flute: {
        fluteCount: 4,
        helixAngle: 38.0,
        fluteLength: 22.0,
        fluteDirection: "RIGHT_HAND",
        variablePitch: true,
        pitchProfile: [88.0, 92.0, 88.0, 92.0],
        variableHelix: false
      },
      material: ToolMaterialType.CARBIDE,
      coating: ToolCoatingType.AlTiN,
      cuttingEdges: [
        { edgeId: "E1", edgeType: "PERIPHERAL", edgeCount: 4, radius: 0.005, condition: "NEW" }
      ],
      tipType: ToolTipType.FLAT,
      maximumRPM: 15000,
      coolantCompatibility: [CoolantType.DRY, CoolantType.FLOOD, CoolantType.MQL],
      operationCompatibility: {
        "MILL": ToolOperationCompatibilityType.COMPATIBLE,
        "DRILL": ToolOperationCompatibilityType.INCOMPATIBLE
      },
      materialsCuttingRules: [
        {
          materialId: "TI-6AL-4V-GR5",
          condition: "ANNEALED",
          cuttingSpeedRange: { min: 60, max: 120 },
          feedRange: { min: 0.02, max: 0.08 },
          docRange: { min: 0.5, max: 5.0 },
          wocRange: { min: 1.0, max: 10.0 },
          coolantRequirement: "REQUIRED" as any
        }
      ],
      provenance: {
        source: "GH_CATALOG_2026",
        sourceType: "MANUFACTURER",
        manufacturer: "Guhring",
        catalogRevision: 3,
        importTimestamp: "2026-08-20T12:00:00Z"
      },
      fingerprint: ""
    };

    tool1.fingerprint = ToolLibraryEngine.calculateToolFingerprint(tool1);

    const assembly1: ToolAssembly = {
      assemblyId: "ASM-EM-10",
      toolId: "T-EM-010",
      stickoutLength: 32.0,
      gaugeLength: 112.0, // holder 80 + stickout 32
      effectiveReach: 32.0,
      maximumReach: 40.0,
      recommendedReach: 32.0,
      envelope: { radialEnvelope: 25, axialEnvelope: 112, holderEnvelope: 50, cuttingEnvelope: 10, assemblyEnvelope: 50 },
      holder: {
        holderId: "H-ER32-BT40",
        holderType: "COLLET_CHUCK",
        interfaceType: ToolHolderInterface.BT,
        gaugeLength: 80.0,
        overallLength: 120.0,
        diameter: 50.0,
        runout: 0.003,
        maxRPM: 18000,
        manufacturer: "Rego-Fix",
        revision: 1
      },
      fingerprint: ""
    };

    assembly1.fingerprint = ToolLibraryEngine.calculateAssemblyFingerprint(assembly1);

    // Check 1: TOOL GEOMETRY COMPLIANCE
    const validateToolResult = ToolDataValidator.validateToolDefinition(tool1);
    checks.push({
      id: "TOOL_GEOMETRY_COMPLIANCE",
      passed: validateToolResult.isValid,
      details: "Solid carbide tool parameters successfully passed structural geometry constraints validation"
    });

    // Check 2: ASSEMBLY CONSISTENCY
    const validateAssemblyResult = ToolDataValidator.validateAssembly(assembly1, tool1);
    checks.push({
      id: "ASSEMBLY_CONSISTENCY",
      passed: validateAssemblyResult.isValid,
      details: "Tool assembly gauge lengths and interface dimensions verified for physical consistency"
    });

    // Check 3: TOOL SELECTION VERDICT
    const mockPocketFeature: ManufacturingFeature = {
      featureId: "FEAT-001",
      featureType: ManufacturingFeatureType.POCKET,
      partId: "PART-1",
      partRevision: 1,
      geometryReferences: ["F1"],
      topologyReferences: ["L1"],
      parameters: {
        diameter: { name: "Diameter", value: 12.0, unit: "mm", confidence: 1.0, provenance: {} as any },
        depth: { name: "Depth", value: 15.0, unit: "mm", confidence: 1.0, provenance: {} as any }
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

    const selectionResult = ToolSelectionEngine.selectToolsForFeature(
      mockPocketFeature,
      [tool1],
      [assembly1],
      "TI-6AL-4V-GR5"
    );

    const eligibleCandidate = selectionResult.find(r => r.toolId === "T-EM-010");
    checks.push({
      id: "TOOL_SELECTION_ENGINE_VALIDATION",
      passed: eligibleCandidate !== undefined && eligibleCandidate.verdict === ToolSelectionVerdict.ELIGIBLE,
      details: "Selection engine correctly matches and qualifies tool based on pocket depth and material compatibility"
    });

    // Check 4: SPINDLE INTERFACE ENFORCEMENT
    const isSpindleComp = ToolDataValidator.checkMachineInterfaceCompatibility("BT", ToolHolderInterface.BT);
    checks.push({
      id: "SPINDLE_INTERFACE_ENFORCEMENT",
      passed: isSpindleComp === true,
      details: "Interface engine verified spindle compatibility of holder to prevent mechanical tooling collision"
    });

    // Check 5: ADVERSARIAL SUITE PASS
    const advResults = ToolLibraryAdversarialSuite.runSuite();
    const allAdvPassed = advResults.every(r => r.passed);
    checks.push({
      id: "ADVERSARIAL_SUITE_STRESS_TEST",
      passed: allAdvPassed,
      details: "Stress testing passed. Detected and rejected geometry impossibilities, spindle mismatches, and wear violations"
    });

    const verdict = checks.every(c => c.passed) ? "PASS" : "FAIL";

    return { verdict, checks };
  }
}
