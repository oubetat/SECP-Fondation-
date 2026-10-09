import { describe, expect, it } from "vitest";
import { 
  KinematicMath, 
  CoordinateFrameGraph, 
  ForwardKinematicsSolver, 
  InverseKinematicsSolver, 
  IKSolutionSelector, 
  KinematicReachabilityAnalyzer, 
  KinematicSingularityDetector, 
  MachineLibrary, 
  MachineKinematicsAdversarialSuite, 
  HardAcceptanceGate103, 
  generateReports103,
  SingularityVerdict,
  IKSolutionStatus
} from "../kinematics/index";

describe("PATCH-103: Machine Kinematics Engine", () => {
  it("1. KinematicMath verifies rotation orthogonality and rigid transforms", () => {
    const ident = KinematicMath.createIdentity();
    expect(KinematicMath.validateRotation(ident)).toBe(true);

    const rotY = KinematicMath.createRotationY(Math.PI / 4); // 45 deg
    expect(KinematicMath.validateRotation(rotY)).toBe(true);

    const invRotY = KinematicMath.invert(rotY);
    const prod = KinematicMath.multiply(rotY, invRotY);
    expect(Math.abs(prod.matrix[0][0] - 1.0) < 1e-5).toBe(true);
  });

  it("2. CoordinateFrameGraph detects circular dependencies and path inconsistencies", () => {
    const graph = new CoordinateFrameGraph();
    graph.addFrame("A", "B", KinematicMath.createIdentity());
    graph.addFrame("B", "C", KinematicMath.createIdentity());
    graph.addFrame("C", "A", KinematicMath.createIdentity()); // Loop

    const validation = graph.validateGraph();
    expect(validation.isValid).toBe(false);
    expect(validation.errors.some(e => e.includes("Circular"))).toBe(true);
  });

  it("3. ForwardKinematicsSolver outputs deterministic tool and table poses", () => {
    const lib = new MachineLibrary();
    const haas = lib.getMachine("HAAS_VF2")!;
    const state = { X: 100, Y: -100, Z: 200 };

    const fk = ForwardKinematicsSolver.solve(haas, state);
    expect(fk.isConsistent).toBe(true);
    expect(fk.workpiecePose.matrix[0][3]).toBe(100);
    expect(fk.workpiecePose.matrix[1][3]).toBe(-100);
    expect(fk.toolPose.matrix[2][3]).toBe(200);
  });

  it("4. InverseKinematicsSolver calculates analytical solutions and detects limit violations", () => {
    const lib = new MachineLibrary();
    const haas = lib.getMachine("HAAS_VF2")!;

    // Case A: Within bounds
    const targetInside = KinematicMath.createTranslation(50, 50, 100);
    const ikSolutions = InverseKinematicsSolver.solve(haas, targetInside);
    expect(ikSolutions.length).toBe(1);
    expect(ikSolutions[0].status).toBe(IKSolutionStatus.VALID);

    // Case B: Limit Violation (X-travel of Haas VF2 is -381 to 381. Let's query X = 500)
    const targetOutside = KinematicMath.createTranslation(500, 0, 100);
    const ikSolutionsOut = InverseKinematicsSolver.solve(haas, targetOutside);
    expect(ikSolutionsOut[0].status).toBe(IKSolutionStatus.LIMIT_VIOLATION);
  });

  it("5. KinematicSingularityDetector identifies singular states for 5-axis setups", () => {
    const lib = new MachineLibrary();
    const hermle = lib.getMachine("HERMLE_C32")!;

    const singularState = { X: 0, Y: 0, Z: 0, A: 0, C: 0 };
    const result = KinematicSingularityDetector.detectSingularity(hermle, singularState);
    expect(result).toBe(SingularityVerdict.SINGULAR);
  });

  it("6. HardAcceptanceGate103 evaluates to PASS", () => {
    const gate = HardAcceptanceGate103.evaluateGate();
    expect(gate.verdict).toBe("PASS");
  });

  it("7. generateReports103 executes successfully", () => {
    expect(() => generateReports103()).not.toThrow();
  });
});
