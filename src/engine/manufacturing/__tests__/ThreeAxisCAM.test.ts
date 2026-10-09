import { describe, expect, it } from "vitest";
import { HardAcceptanceGate104 } from "../cam/HardAcceptanceGate104";
import { ToolpathGenerator } from "../cam/ToolpathGenerator";
import { ToolpathValidator } from "../cam/ToolpathValidator";
import { 
  CAMOperation, 
  CAMSetup, 
  CAMStrategyType, 
  CAMVerdictType, 
  ToolpathSegmentType, 
  MachiningRegion,
  StockModel,
  FixtureModel
} from "../cam/types";
import { ToolDefinition, ToolAssembly, ManufacturingToolType, ToolLibraryStatus, ToolMaterialType, ToolCoatingType } from "../toolLibrary/types";
import { MachineLibrary } from "../kinematics/MachineLibrary";
import { CoordinateFrameGraph } from "../kinematics/CoordinateFrameGraph";

describe("PATCH-104: 3-Axis Subtractive CAM Engine", () => {
  it("1. HardAcceptanceGate104 evaluates to PASS", () => {
    const report = HardAcceptanceGate104.evaluateGate();
    expect(report.verdict).toBe("PASS");
    expect(report.checks.every(c => c.passed)).toBe(true);
  });

  it("2. Blocks non-vertical 3-axis tool orientations", () => {
    const machineLib = new MachineLibrary();
    const haas = machineLib.getMachine("HAAS_VF2")!;

    const region: MachiningRegion = {
      machiningBoundary: [
        { x: 0, y: 0, z: 0 },
        { x: 50, y: 0, z: 0 },
        { x: 50, y: 50, z: 0 },
        { x: 0, y: 50, z: 0 }
      ],
      avoidBoundary: [],
      topZ: 10,
      floorZ: 0
    };

    const setup: CAMSetup = {
      setupId: "SETUP_BAD_AXIS",
      setupRevision: 1,
      machineId: "HAAS_VF2",
      machineRevision: 1,
      workpieceFrameId: "WCS",
      stock: {
        stockId: "ST",
        stockRevision: 1,
        type: "BLOCK" as any,
        dimensions: { x: 50, y: 50, z: 20 },
        origin: { x: 0, y: 0, z: 0 },
        geometryFingerprint: "STOCK-FGP",
        source: "CAD_MODEL"
      },
      origin: { x: 0, y: 0, z: 0 },
      clearancePlane: 50,
      retractPlane: 40,
      safetyPlane: 15,
      toolOrientation: { x: 0.1, y: 0.0, z: 0.99 } // slanted axis
    };

    const tool: ToolDefinition = {
      toolId: "T_TEST", toolRevision: 1, toolType: ManufacturingToolType.END_MILL,
      manufacturer: "X", manufacturerPartNumber: "Y", catalogNumber: "Z", toolName: "T", description: "T",
      standard: "DIN", status: ToolLibraryStatus.ACTIVE,
      geometry: { cuttingDiameter: 6, cuttingLength: 15, overallLength: 50, shankDiameter: 6, shankLength: 35 },
      material: ToolMaterialType.CARBIDE, coating: ToolCoatingType.UNCOATED, cuttingEdges: [], maximumRPM: 12000,
      coolantCompatibility: [], operationCompatibility: {}, materialsCuttingRules: [],
      provenance: { source: "C", sourceType: "M", manufacturer: "X", catalogRevision: 1, importTimestamp: "" },
      fingerprint: "FGP"
    };

    const assembly: ToolAssembly = {
      assemblyId: "ASSY_TEST", toolId: "T_TEST", stickoutLength: 25, gaugeLength: 60,
      effectiveReach: 20, maximumReach: 25, recommendedReach: 15, envelope: { radialEnvelope: 6, axialEnvelope: 60, holderEnvelope: 15, cuttingEnvelope: 6, assemblyEnvelope: 15 },
      fingerprint: "ASSY_FGP"
    };

    const op: CAMOperation = {
      operationId: "OP_TEST",
      operationRevision: 1,
      setupId: "SETUP_BAD_AXIS",
      featureIds: ["REG_TEST"],
      toolId: "T_TEST",
      toolAssemblyId: "ASSY_TEST",
      machineId: "HAAS_VF2",
      strategy: CAMStrategyType.PLANAR,
      operationType: "PLANAR_MILLING" as any,
      geometryReference: "REG_TEST",
      stockReference: "ST",
      cuttingConditions: {
        spindleSpeed: 4000,
        cuttingSpeed: 80,
        feedRate: 600,
        feedPerTooth: 0.05,
        feedPerRevolution: 0.2,
        stepDown: 2,
        stepOver: 4,
        depthOfCut: 2,
        widthOfCut: 4,
        provenance: {
          source: "RECOMMENDED",
          sourceRevision: 1,
          materialId: "AL",
          toolId: "T_TEST",
          operationType: "PLANAR_MILLING" as any
        }
      },
      tolerancePolicy: { chordalTolerance: 0.01, geometricTolerance: 0.01, surfaceTolerance: 0.01, boundaryTolerance: 0.01 },
      status: "DRAFT" as any,
      fingerprint: "OP-FGP"
    };


    const res = ToolpathGenerator.generateToolpath(op, setup, tool, assembly, haas, region);
    expect(res.verdict).toBe(CAMVerdictType.GEOMETRY_FAILURE);
  });
});
