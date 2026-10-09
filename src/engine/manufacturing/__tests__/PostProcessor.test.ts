import { describe, it, expect } from "vitest";
import { PropertySourceType } from "../../materials/types";
import {
  MachineProfileEngine,
  ControllerProfileEngine,
  PostProcessorInstance,
  NCIntermediateRepresentationEngine,
  NCFormatter,
  NCSyntaxValidator,
  NCSemanticValidator,
  NCInterpreterReconstructor,
  RoundTripVerifier,
  PostProcessorAdversarialSuite,
  HardAcceptanceGate107,
  generateReports107,
  NCDialect,
  NCProgramStatus,
  NCSafetyStatus,
  PostTrueVerdict,
  SpindleDirection,
  MachineAxisToolpath,
  MachineAxisPoint
} from "../post";

describe("PATCH-107: Post Processor Architecture (Manufacturing / CAM)", () => {
  it("should create and validate standard machine and controller profiles", () => {
    const machProfile = MachineProfileEngine.createStandard5AxisMachineProfile();
    const ctrlProfile = ControllerProfileEngine.createFanucLikeProfile();

    const machVal = MachineProfileEngine.validateMachineProfile(machProfile);
    expect(machVal.valid).toBe(true);

    const ctrlVal = ControllerProfileEngine.validateControllerProfile(ctrlProfile);
    expect(ctrlVal.valid).toBe(true);
    expect(ctrlProfile.dialect).toBe(NCDialect.FANUC_LIKE);
    expect(ctrlProfile.capabilities.supports5AxisSimultaneous).toBe(true);
  });

  it("should build structured NC Intermediate Representation (NC IR)", () => {
    const machProfile = MachineProfileEngine.createStandard5AxisMachineProfile();
    const ctrlProfile = ControllerProfileEngine.createFanucLikeProfile();

    const testToolpath: MachineAxisToolpath = {
      toolpathId: "TP_IR_TEST",
      revision: 1,
      machineId: machProfile.machineId,
      tolerance: 0.001,
      coordinateSystem: "WORK_PIECE",
      provenance: {
        sourceId: "PROV_IR_TEST",
        sourceType: PropertySourceType.STANDARD,
        reference: "Test Spec",
        timestamp: "2026-08-21T00:00:00Z",
        author: "SECP Test",
        hash: "0xIRTEST"
      },
      points: [
        {
          position: { x: 0, y: 0, z: 20 },
          rotaryAxes: { a: 0, c: 0 },
          feedRate: 3000,
          spindleSpeed: 6000,
          spindleDirection: SpindleDirection.CW,
          coolantState: { flood: true, mist: false, throughSpindle: false, air: false },
          sequenceNumber: 1,
          toolNumber: 1,
          motionType: "RAPID"
        },
        {
          position: { x: 50, y: 25, z: 0 },
          rotaryAxes: { a: 10, c: 45 },
          feedRate: 1500,
          spindleSpeed: 6000,
          spindleDirection: SpindleDirection.CW,
          coolantState: { flood: true, mist: false, throughSpindle: false, air: false },
          sequenceNumber: 2,
          toolNumber: 1,
          motionType: "LINEAR"
        }
      ]
    };

    const trace: any[] = [];
    const irRes = NCIntermediateRepresentationEngine.buildIntermediateRepresentation(
      testToolpath,
      machProfile,
      ctrlProfile,
      trace
    );

    expect(irRes.errors.length).toBe(0);
    expect(irRes.ir.commands.length).toBeGreaterThanOrEqual(4);
  });

  it("should format NC IR into verified NCBlocks and G-Code text", () => {
    const machProfile = MachineProfileEngine.createStandard5AxisMachineProfile();
    const ctrlProfile = ControllerProfileEngine.createFanucLikeProfile();
    const contract = PostProcessorInstance.createDefaultContract("POST_FMT_TEST", machProfile, ctrlProfile);

    const post = new PostProcessorInstance();
    const initRes = post.initialize(contract, machProfile, ctrlProfile);
    expect(initRes.ready).toBe(true);

    const testToolpath: MachineAxisToolpath = {
      toolpathId: "TP_FMT_TEST",
      revision: 1,
      machineId: machProfile.machineId,
      tolerance: 0.001,
      coordinateSystem: "WORK_PIECE",
      provenance: {
        sourceId: "PROV_FMT_TEST",
        sourceType: PropertySourceType.STANDARD,
        reference: "Test Spec",
        timestamp: "2026-08-21T00:00:00Z",
        author: "SECP Test",
        hash: "0xFMTTEST"
      },
      points: [
        {
          position: { x: 10, y: 20, z: 30 },
          rotaryAxes: { a: 5, c: 15 },
          feedRate: 1000,
          spindleSpeed: 5000,
          spindleDirection: SpindleDirection.CW,
          coolantState: { flood: true, mist: false, throughSpindle: false, air: false },
          sequenceNumber: 1,
          toolNumber: 1,
          motionType: "LINEAR"
        }
      ]
    };

    const genRes = post.process(testToolpath, "FMT_PROGRAM", 2001);
    expect(genRes.program).not.toBeNull();
    expect(genRes.errors.length).toBe(0);
    expect(genRes.program!.rawGCodeText).toContain("G90");
    expect(genRes.program!.rawGCodeText).toContain("M06");
    expect(genRes.program!.rawGCodeText).toContain("M03");
    expect(genRes.program!.rawGCodeText).toContain("M30");
  });

  it("should perform round-trip reconstruction and verify kinematic tolerance gate", () => {
    const machProfile = MachineProfileEngine.createStandard5AxisMachineProfile();
    const ctrlProfile = ControllerProfileEngine.createFanucLikeProfile();
    const contract = PostProcessorInstance.createDefaultContract("POST_ROUNDTRIP_TEST", machProfile, ctrlProfile);

    const post = new PostProcessorInstance();
    post.initialize(contract, machProfile, ctrlProfile);

    const sourcePoints: MachineAxisPoint[] = [
      {
        position: { x: 0, y: 0, z: 20 },
        rotaryAxes: { a: 0, c: 0 },
        feedRate: 3000,
        spindleSpeed: 6000,
        spindleDirection: SpindleDirection.CW,
        coolantState: { flood: true, mist: false, throughSpindle: false, air: false },
        sequenceNumber: 1,
        toolNumber: 1,
        motionType: "RAPID"
      },
      {
        position: { x: 10.1234, y: 20.5678, z: 0.0 },
        rotaryAxes: { a: 12.5, c: 45.0 },
        feedRate: 1200,
        spindleSpeed: 6000,
        spindleDirection: SpindleDirection.CW,
        coolantState: { flood: true, mist: false, throughSpindle: false, air: false },
        sequenceNumber: 2,
        toolNumber: 1,
        motionType: "LINEAR"
      }
    ];

    const sourceToolpath: MachineAxisToolpath = {
      toolpathId: "TP_ROUNDTRIP_TEST",
      revision: 1,
      machineId: machProfile.machineId,
      points: sourcePoints,
      tolerance: 0.001,
      coordinateSystem: "WORK_PIECE",
      provenance: {
        sourceId: "PROV_RT",
        sourceType: PropertySourceType.STANDARD,
        reference: "RT Spec",
        timestamp: "2026-08-21T00:00:00Z",
        author: "SECP RT",
        hash: "0xRTHASH"
      }
    };

    const genRes = post.process(sourceToolpath, "RT_TEST", 3001);
    const prog = genRes.program!;

    const recon = NCInterpreterReconstructor.reconstructTrajectoryFromProgram(prog);
    expect(recon.points.length).toBeGreaterThanOrEqual(2);

    const { roundTripResult, kinematicResult } = RoundTripVerifier.verifyRoundTrip(sourceToolpath, prog);
    expect(roundTripResult.isIdenticalWithinTolerance).toBe(true);
    expect(roundTripResult.maxObservedPositionDeltaMM).toBeLessThanOrEqual(0.002);
    expect(kinematicResult.isValid).toBe(true);
  });

  it("should pass all adversarial test cases", () => {
    const results = PostProcessorAdversarialSuite.runSuite();
    expect(results.length).toBeGreaterThanOrEqual(5);
    for (const r of results) {
      expect(r.passed).toBe(true);
    }
  });

  it("should execute HardAcceptanceGate107 with 100% PASS score", () => {
    const gateRes = HardAcceptanceGate107.executeGate();
    expect(gateRes.passed).toBe(true);
    expect(gateRes.scorePercentage).toBe(100.0);
    expect(gateRes.verdict).toBe(PostTrueVerdict.QUALIFIED);
    expect(gateRes.merkleRootHash).toMatch(/^0x[0-9a-fA-F]{8}$/);
  });

  it("should generate all 64 evidence reports without errors", () => {
    expect(() => generateReports107()).not.toThrow();
  });
});
