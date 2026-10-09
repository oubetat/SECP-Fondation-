import { ToolpathGenerator } from "./ToolpathGenerator";
import { ToolpathValidator } from "./ToolpathValidator";
import { 
  CAMOperation, 
  CAMSetup, 
  CAMStrategyType, 
  CAMVerdictType, 
  ToolpathSegmentType, 
  MachiningRegion,
  StockModel,
  FixtureModel
} from "./types";
import { ToolDefinition, ToolAssembly, ManufacturingToolType, ToolLibraryStatus, ToolMaterialType, ToolCoatingType } from "../toolLibrary/types";
import { MachineLibrary } from "../kinematics/MachineLibrary";
import { CoordinateFrameGraph } from "../kinematics/CoordinateFrameGraph";
import { KinematicMath } from "../kinematics/KinematicMath";

export interface Gate104Report {
  verdict: "PASS" | "FAIL";
  checks: { id: string; passed: boolean; details: string }[];
}

export class HardAcceptanceGate104 {
  public static evaluateGate(): Gate104Report {
    const checks: { id: string; passed: boolean; details: string }[] = [];
    const addCheck = (id: string, passed: boolean, details: string) => {
      checks.push({ id, passed, details });
    };

    // 1. Setup Mock Data
    const machineLib = new MachineLibrary();
    const haas = machineLib.getMachine("HAAS_VF2")!;

    const region: MachiningRegion = {
      machiningBoundary: [
        { x: 10, y: 10, z: 0 },
        { x: 100, y: 10, z: 0 },
        { x: 100, y: 100, z: 0 },
        { x: 10, y: 100, z: 0 }
      ],
      avoidBoundary: [],
      topZ: 50,
      floorZ: 20
    };

    const stock: StockModel = {
      stockId: "STOCK_BLOCK_01",
      stockRevision: 1,
      type: "BLOCK" as any,
      dimensions: { x: 120, y: 120, z: 60 },
      origin: { x: 0, y: 0, z: 0 },
      geometryFingerprint: "STOCK-FGP",
      source: "CAD_MODEL"
    };

    const fixture: FixtureModel = {
      fixtureId: "VISE_01",
      type: "VICE",
      dimensions: { x: 150, y: 150, z: 40 },
      position: { x: 0, y: 0, z: -40 }
    };

    const setup: CAMSetup = {
      setupId: "SETUP_01",
      setupRevision: 1,
      machineId: "HAAS_VF2",
      machineRevision: 1,
      workpieceFrameId: "WCS",
      stock: stock,
      fixture: fixture,
      toolOrientation: { x: 0, y: 0, z: 1 }, // 3-axis constant Z-axis
      origin: { x: 0, y: 0, z: 0 },
      clearancePlane: 80,
      retractPlane: 70,
      safetyPlane: 55
    };

    const tool: ToolDefinition = {
      toolId: "EM_10_HSS",
      toolRevision: 1,
      toolType: ManufacturingToolType.END_MILL,
      manufacturer: "Guhring",
      manufacturerPartNumber: "EM10",
      catalogNumber: "10MM-EM",
      toolName: "10mm End Mill",
      description: "10mm Flat End Mill",
      standard: "DIN6527",
      status: ToolLibraryStatus.ACTIVE,
      geometry: {
        cuttingDiameter: 10,
        cuttingLength: 30,
        overallLength: 75,
        shankDiameter: 10,
        shankLength: 45
      },
      material: ToolMaterialType.HSS,
      coating: ToolCoatingType.UNCOATED,
      cuttingEdges: [],
      maximumRPM: 8000,
      coolantCompatibility: [],
      operationCompatibility: {},
      materialsCuttingRules: [],
      provenance: {
        source: "Catalog",
        sourceType: "VENDOR",
        manufacturer: "Guhring",
        catalogRevision: 1,
        importTimestamp: new Date().toISOString()
      },
      fingerprint: "EM-10-FGP"
    };

    const assembly: ToolAssembly = {
      assemblyId: "ASSY_EM_10",
      toolId: "EM_10_HSS",
      stickoutLength: 45, // mm
      gaugeLength: 85,
      effectiveReach: 40,
      maximumReach: 45,
      recommendedReach: 35,
      envelope: {
        radialEnvelope: 10,
        axialEnvelope: 85,
        holderEnvelope: 25,
        cuttingEnvelope: 10,
        assemblyEnvelope: 25
      },
      fingerprint: "ASSY-FGP"
    };

    const validOperation: CAMOperation = {
      operationId: "OP_FACE_01",
      operationRevision: 1,
      setupId: "SETUP_01",
      featureIds: ["REGION_01"],
      toolId: "EM_10_HSS",
      toolAssemblyId: "ASSY_EM_10",
      machineId: "HAAS_VF2",
      strategy: CAMStrategyType.PLANAR,
      operationType: "PLANAR_MILLING" as any,
      geometryReference: "REGION_01",
      stockReference: "STOCK_BLOCK_01",
      cuttingConditions: {
        spindleSpeed: 3000,
        cuttingSpeed: 100,
        feedRate: 800,
        feedPerTooth: 0.1,
        feedPerRevolution: 0.4,
        stepDown: 5,
        stepOver: 7, // 70% of diameter
        depthOfCut: 5,
        widthOfCut: 7,
        provenance: {
          source: "RECOMMENDED",
          sourceRevision: 1,
          materialId: "ALUM_6061_T6",
          toolId: "EM_10_HSS",
          operationType: "PLANAR_MILLING" as any
        }
      },
      tolerancePolicy: {
        chordalTolerance: 0.01,
        geometricTolerance: 0.01,
        surfaceTolerance: 0.01,
        boundaryTolerance: 0.01
      },
      status: "DRAFT" as any,
      fingerprint: "OP-FGP"
    };

    // Initialize Coordinate graph
    const graph = new CoordinateFrameGraph();
    graph.addFrame("MCS");
    graph.addFrame("WCS", "MCS", KinematicMath.createTranslation(0, 0, 0));

    // Test Case 1: Planar Strategy Verification
    const resPlanar = ToolpathGenerator.generateToolpath(validOperation, setup, tool, assembly, haas, region, graph);
    addCheck(
      "PLANAR_TOOLPATH_GENERATION",
      resPlanar.verdict === CAMVerdictType.GENERATED && resPlanar.toolpath.segments.length > 0,
      `Planar strategy correctly computed ${resPlanar.toolpath.segments.length} segments of 3-axis motion.`
    );

    // Test Case 2: 100% Deterministic Fingerprints
    const resPlanar2 = ToolpathGenerator.generateToolpath(validOperation, setup, tool, assembly, haas, region, graph);
    addCheck(
      "DETERMINISTIC_FINGERPRINTS",
      resPlanar.toolpath.fingerprint === resPlanar2.toolpath.fingerprint,
      `Deterministic state confirmed: Fingerprints match exactly (${resPlanar.toolpath.fingerprint})`
    );

    // Test Case 3: Contour Strategy Multi-Level Depth
    const contourOp = { ...validOperation, operationId: "OP_CONT_01", strategy: CAMStrategyType.CONTOUR };
    const resContour = ToolpathGenerator.generateToolpath(contourOp, setup, tool, assembly, haas, region, graph);
    addCheck(
      "CONTOUR_DEPTH_COMPUTATION",
      resContour.verdict === CAMVerdictType.GENERATED && resContour.toolpath.segments.some(s => s.segmentId.includes("CONTOUR_PASS")),
      "Contour profiling multi-level slicing and vertical constraint validation verified successfully."
    );

    // Test Case 4: Axis Orientation Constraint Verification (3-Axis vertical tool orientation constraint)
    const badSetup = { ...setup, toolOrientation: { x: 0.707, y: 0.707, z: 0.0 } };
    const resBadOrient = ToolpathGenerator.generateToolpath(validOperation, badSetup, tool, assembly, haas, region, graph);
    addCheck(
      "AXIS_ORIENTATION_CONSTRAINT",
      resBadOrient.verdict === CAMVerdictType.GEOMETRY_FAILURE,
      "Gated 3-axis vertical toolpath validation correctly blocked non-vertical tool axis vectors."
    );

    // Test Case 5: Spindle Limit Validation
    const fastOp = { ...validOperation, cuttingConditions: { ...validOperation.cuttingConditions, spindleSpeed: 12000 } };
    const resFast = ToolpathGenerator.generateToolpath(fastOp, setup, tool, assembly, haas, region, graph);
    addCheck(
      "SPINDLE_LIMIT_ENFORCEMENT",
      resFast.verdict === CAMVerdictType.LIMIT_FAILURE,
      "Limits check successfully triggers failure on spindle RPM exceeding machine maximum."
    );

    // Test Case 6: Weight Threshold Limit Violation
    const heavyStock: StockModel = { ...stock, dimensions: { x: 2000, y: 2000, z: 2000 } }; // Extravagantly heavy stock (8 m3 -> ~21,000 kg)
    const heavySetup = { ...setup, stock: heavyStock };
    const validTP = resPlanar.toolpath;
    const reportWeight = ToolpathValidator.validate(validTP, validOperation, heavySetup, tool, assembly, haas, region, graph);
    addCheck(
      "WEIGHT_LIMIT_VERIFICATION",
      reportWeight.verdict === CAMVerdictType.LIMIT_FAILURE && reportWeight.anomalies.some(a => a.code === "WEIGHT_LIMIT_EXCEEDED"),
      "Weight threshold limits correctly caught heavy workpiece assembly configurations."
    );


    // Test Case 7: Critical Gouge Detection Check
    // If a toolpath point goes below region.floorZ, it must fail gouge check
    const badSegments = [...validTP.segments];
    badSegments.push({
      segmentId: "GOUGE_SEG_01",
      segmentType: ToolpathSegmentType.FEED,
      points: [
        { x: 20, y: 20, z: 15, feed: 800, spindle: 3000, segmentType: ToolpathSegmentType.FEED, sequence: 9999 } // 15 is below floorZ=20
      ],
      startPoint: { x: 20, y: 20, z: 15, feed: 800, spindle: 3000, segmentType: ToolpathSegmentType.FEED, sequence: 9999 },
      endPoint: { x: 20, y: 20, z: 15, feed: 800, spindle: 3000, segmentType: ToolpathSegmentType.FEED, sequence: 9999 }
    });
    const gougingTP = { ...validTP, segments: badSegments };
    const reportGouge = ToolpathValidator.validate(gougingTP, validOperation, setup, tool, assembly, haas, region, graph);
    addCheck(
      "GOUGE_DETECTION_LOGIC",
      reportGouge.verdict === CAMVerdictType.LIMIT_FAILURE && reportGouge.anomalies.some(a => a.code === "CRITICAL_GOUGE_DETECTION"),
      "Gouge check correctly identifies physical tool intrusion below design workpiece floor boundary."
    );

    // Test Case 8: Dangerous Stickout Ratio warning
    const longAssembly = { ...assembly, gaugeLength: 300 }; // too long for overallLength 75
    const reportStickout = ToolpathValidator.validate(validTP, validOperation, setup, tool, longAssembly, haas, region, graph);
    addCheck(
      "DANGEROUS_STICKOUT_WARNING",
      reportStickout.anomalies.some(a => a.code === "DANGEROUS_STICKOUT"),
      "Stiffness checker successfully flagged dangerous stickout-to-rigidity ratio."
    );

    // Test Case 9: Tool Reach Verification
    const deepRegion = { ...region, floorZ: -10 }; // required reach is 50 - (-10) = 60, but stickout is only 45
    const resReach = ToolpathGenerator.generateToolpath(validOperation, setup, tool, assembly, haas, deepRegion, graph);
    addCheck(
      "TOOL_REACH_VERIFICATION",
      resReach.verdict === CAMVerdictType.UNREACHABLE,
      "Reachability validator successfully caught insufficient tool assembly stickout limits."
    );

    // Test Case 10: Envelope Boundaries Verification
    const outOfBoundsRegion: MachiningRegion = {
      ...region,
      machiningBoundary: [
        { x: -500, y: 10, z: 0 },
        { x: 100, y: 10, z: 0 },
        { x: 100, y: 100, z: 0 },
        { x: -500, y: 100, z: 0 }
      ] // -500 is outside X travel limits of Haas VF2 (-508 to 508 but safetyMargin or simple envelope coordinates)
    };
    // HAAS VF-2 envelope in our system: xMin: -508, xMax: 508. Let's force an extreme boundary: -1200
    outOfBoundsRegion.machiningBoundary = [
      { x: -1200, y: 10, z: 0 },
      { x: 100, y: 10, z: 0 },
      { x: 100, y: 100, z: 0 },
      { x: -1200, y: 100, z: 0 }
    ];
    const resEnvelope = ToolpathGenerator.generateToolpath(validOperation, setup, tool, assembly, haas, outOfBoundsRegion, graph);
    addCheck(
      "ENVELOPE_BOUNDARY_SAFETY",
      resEnvelope.verdict === CAMVerdictType.UNREACHABLE,
      "Workpiece envelope limits properly guarded the machine kinematic perimeter."
    );

    const verdict = checks.every(c => c.passed) ? "PASS" : "FAIL";

    return {
      verdict,
      checks
    };
  }
}
