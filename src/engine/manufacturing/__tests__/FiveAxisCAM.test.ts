import { describe, it, expect } from "vitest";
import { FiveAxisToolpathGenerator, FiveAxisGeneratorConfig } from "../cam/FiveAxisToolpathGenerator";
import { FiveAxisToolpathValidator } from "../cam/FiveAxisToolpathValidator";
import { FiveAxisAdversarialSuite } from "../cam/FiveAxisAdversarialSuite";
import { HardAcceptanceGate105 } from "../cam/HardAcceptanceGate105";
import {
  FiveAxisDriveCurve,
  FiveAxisDriveSurface,
  FiveAxisStrategy,
  ToolOrientationPolicyType,
  OrientationInterpolation,
  TolerancePolicy,
  CAMVerdictType,
  DriveCurveType,
  DriveSurfaceType,
  StockModel,
  FixtureModel
} from "../cam/types";
import { MachineLibrary } from "../kinematics/MachineLibrary";
import { CoordinateFrameGraph } from "../kinematics/CoordinateFrameGraph";
import { ToolDefinition, ToolAssembly, ManufacturingToolType, ToolLibraryStatus } from "../toolLibrary/types";

describe("PATCH-105: 5-Axis Simultaneous CAM Engine Tests", () => {
  const machineLib = new MachineLibrary();
  const haas = machineLib.getMachine("HERMLE_C32")!; // standard 5-axis simultaneous setup

  const tolerancePolicy: TolerancePolicy = {
    chordalTolerance: 0.01,
    geometricTolerance: 0.01,
    surfaceTolerance: 0.01,
    boundaryTolerance: 0.01
  };

  const mockTool: ToolDefinition = {
    toolId: "EM_10_SOLID",
    toolRevision: 1,
    toolType: ManufacturingToolType.END_MILL,
    manufacturer: "Precision Mills",
    manufacturerPartNumber: "PM-10",
    catalogNumber: "CAT-10",
    toolName: "10mm Flat Endmill",
    description: "Carbide flat end mill",
    standard: "DIN",
    status: ToolLibraryStatus.ACTIVE,
    geometry: {
      cuttingDiameter: 10,
      cuttingLength: 25,
      overallLength: 70,
      shankDiameter: 10,
      shankLength: 45
    },
    material: "CARBIDE" as any,
    coating: "TIALN" as any,
    cuttingEdges: [],
    maximumRPM: 15000,
    coolantCompatibility: [],
    operationCompatibility: {},
    materialsCuttingRules: [],
    provenance: { source: "M", sourceType: "C", manufacturer: "X", catalogRevision: 1, importTimestamp: "" },
    fingerprint: "MOCK-TOOL-FGP"
  };

  const mockAssembly: ToolAssembly = {
    assemblyId: "ASSY_10",
    toolId: "EM_10_SOLID",
    stickoutLength: 40,
    gaugeLength: 80,
    effectiveReach: 35,
    maximumReach: 40,
    recommendedReach: 30,
    envelope: { radialEnvelope: 10, axialEnvelope: 80, holderEnvelope: 25, cuttingEnvelope: 10, assemblyEnvelope: 25 },
    fingerprint: "MOCK-ASSY-FGP"
  };

  const mockStock: StockModel = {
    stockId: "MOCK_BLOCK_01",
    stockRevision: 1,
    type: "BLOCK" as any,
    dimensions: { x: 100, y: 100, z: 40 },
    origin: { x: 0, y: 0, z: 0 },
    geometryFingerprint: "BLOCK-FGP",
    source: "CAD_MODEL"
  };

  const mockFixture: FixtureModel = {
    fixtureId: "MOCK_VISE",
    type: "VISE",
    dimensions: { x: 120, y: 120, z: 30 },
    position: { x: 0, y: 0, z: -30 }
  };

  const driveSurf: FiveAxisDriveSurface = {
    surfaceId: "SURF_01",
    type: DriveSurfaceType.B_REP,
    geometryData: {},
    sourceOfTruth: "TRUTH-HSH"
  };

  const config: FiveAxisGeneratorConfig = {
    strategy: FiveAxisStrategy.MULTI_AXIS_CONTOUR,
    orientationPolicy: ToolOrientationPolicyType.NORMAL_TO_SURFACE,
    leadAngle: { value: 5, unit: "DEGREES", referenceFrame: "WCS", explicit: true },
    tiltAngle: { value: 10, unit: "DEGREES", referenceFrame: "WCS", explicit: true },
    rotationOrder: "LEAD_THEN_TILT",
    interpolation: OrientationInterpolation.SLERP,
    gougeAvoidance: true,
    smoothingEnabled: true,
    maxAngularStep: 0.05,
    unwrappingEnabled: true
  };

  it("should generate a valid 5-axis continuous trajectory along drive curve coordinates", () => {
    const driveCurve: FiveAxisDriveCurve = {
      curveId: "CRV_01",
      type: DriveCurveType.CURVE_3D,
      points: [
        { x: 0, y: 0, z: 10 },
        { x: 20, y: 0, z: 10 },
        { x: 40, y: 10, z: 10 },
        { x: 60, y: 30, z: 10 }
      ]
    };

    const result = FiveAxisToolpathGenerator.generateToolpath(
      driveSurf,
      driveCurve,
      mockTool,
      mockAssembly,
      haas,
      config,
      tolerancePolicy
    );

    expect(result.verdict).toBe(CAMVerdictType.GENERATED);
    expect(result.toolpath).toBeDefined();
    expect(result.machineAxisToolpath).toBeDefined();
    expect(result.toolpath!.segments[0].points.length).toBe(4);
  });

  it("should perform SLERP tool pose orientation interpolation between endpoints", () => {
    const startPose = {
      position: { x: 0, y: 0, z: 0 },
      toolAxis: { x: 0, y: 0, z: 1 },
      toolOrientation: { x: 0, y: 0, z: 1 },
      coordinateFrame: "WCS",
      sequence: 0
    };

    const endPose = {
      position: { x: 10, y: 10, z: 10 },
      toolAxis: { x: 1, y: 0, z: 0 },
      toolOrientation: { x: 1, y: 0, z: 0 },
      coordinateFrame: "WCS",
      sequence: 100
    };

    const mid = FiveAxisToolpathGenerator.interpolatePose(startPose, endPose, 0.5, OrientationInterpolation.SLERP);
    expect(mid.position.x).toBe(5);
    expect(mid.position.y).toBe(5);
    expect(mid.position.z).toBe(5);

    // Magnitude of interpolated tool axis vector should remain 1.0
    const mag = Math.sqrt(mid.toolAxis.x * mid.toolAxis.x + mid.toolAxis.y * mid.toolAxis.y + mid.toolAxis.z * mid.toolAxis.z);
    expect(mag).toBeCloseTo(1.0, 5);
  });

  it("should block and fail on unreachable coordinate steps exceeding envelope boundaries", () => {
    const unreachableCurve: FiveAxisDriveCurve = {
      curveId: "CRV_BAD",
      type: DriveCurveType.CURVE_3D,
      points: [{ x: 9999, y: 0, z: 0 }]
    };

    const result = FiveAxisToolpathGenerator.generateToolpath(
      driveSurf,
      unreachableCurve,
      mockTool,
      mockAssembly,
      haas,
      config,
      tolerancePolicy
    );

    expect(result.verdict).toBe(CAMVerdictType.UNREACHABLE);
  });

  it("should run adversarial checking suite successfully with zero failures", () => {
    const report = FiveAxisAdversarialSuite.runSuite();
    expect(report.passed).toBe(true);
    expect(report.passedChecks).toBe(report.totalChecks);
  });

  it("should evaluate hard acceptance gate and get a perfect PASS verdict", () => {
    const result = HardAcceptanceGate105.evaluateGate();
    expect(result.verdict).toBe("PASS");
  });
});
