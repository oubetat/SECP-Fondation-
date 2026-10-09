import { MachineLibrary } from "./MachineLibrary";
import { ForwardKinematicsSolver } from "./ForwardKinematicsSolver";
import { InverseKinematicsSolver } from "./InverseKinematicsSolver";
import { IKSolutionSelector } from "./IKSolutionSelector";
import { KinematicMath } from "./KinematicMath";
import { CoordinateFrameGraph } from "./CoordinateFrameGraph";
import { KinematicReachabilityAnalyzer } from "./KinematicReachabilityAnalyzer";
import { KinematicSingularityDetector, SingularityVerdict } from "./KinematicSingularityDetector";
import { MachineKinematicsAdversarialSuite } from "./MachineKinematicsAdversarialSuite";
import { MachineKinematicState, HomogeneousTransform } from "./types";

export interface Gate103Report {
  verdict: "PASS" | "FAIL";
  checks: { id: string; passed: boolean; details: string }[];
}

export class HardAcceptanceGate103 {
  public static evaluateGate(): Gate103Report {
    const checks: { id: string; passed: boolean; details: string }[] = [];
    const lib = new MachineLibrary();
    const haas = lib.getMachine("HAAS_VF2")!;
    const hermle = lib.getMachine("HERMLE_C32")!;

    // Helper to log check
    const addCheck = (id: string, passed: boolean, details: string) => {
      checks.push({ id, passed, details });
    };

    // 1. Core Model
    addCheck(
      "MACHINE_KINEMATIC_MODEL_IMPLEMENTED",
      haas !== undefined && hermle !== undefined,
      "Deterministic machine kinematic structures successfully defined for HAAS VF2 and Hermle C32"
    );

    // 2. Machine Type Support
    addCheck(
      "MACHINE_TYPES_SUPPORTED",
      haas.machineType === "MILL_3_AXIS" && hermle.machineType === "MILL_5_AXIS",
      "Correct machine architecture mapping for 3-axis and 5-axis systems verified"
    );

    // 3. Forward Kinematics Correctness and Determinism
    const axisPositions = { X: 100, Y: -50, Z: 200 };
    const fkResult = ForwardKinematicsSolver.solve(haas, axisPositions);
    addCheck(
      "FORWARD_KINEMATICS_SOLVER",
      fkResult.isConsistent && fkResult.toolPose.matrix[0][3] === 0 && fkResult.workpiecePose.matrix[0][3] === 100,
      "Forward kinematics successfully resolves tool and table transformations deterministically"
    );

    // 4. Inverse Kinematics Multi-Solution Support
    const targetPose = KinematicMath.createTranslation(50, 50, 100);
    const ikResult = InverseKinematicsSolver.solve(haas, targetPose);
    addCheck(
      "INVERSE_KINEMATICS_SOLVER",
      ikResult.length > 0 && ikResult[0].axisValues.X === 50 && ikResult[0].axisValues.Z === 100,
      "Inverse solver successfully calculates joint coordinate values analytically"
    );

    // 5. Reachability and Work Envelope Bounds
    const targetPoint = { x: 100, y: 100, z: 200 };
    const reachability = KinematicReachabilityAnalyzer.analyzePoint(haas, targetPoint);
    addCheck(
      "REACHABILITY_ANALYSIS",
      reachability === "REACHABLE",
      "Reachability analyzer correctly validates spatial coordinates inside workspace boundary limits"
    );

    // 6. Coordinate Frame Graph Consistency
    const graph = new CoordinateFrameGraph();
    graph.addFrame("MCS");
    graph.addFrame("WCS", "MCS", KinematicMath.createTranslation(50, 50, -100));
    graph.addFrame("PART", "WCS", KinematicMath.createTranslation(10, 10, 0));
    const partToMcs = graph.getTransform("PART", "MCS");
    addCheck(
      "COORDINATE_FRAME_GRAPH",
      partToMcs.isConsistent && partToMcs.transform.matrix[0][3] === 60,
      "Frame Graph successfully resolves multi-link transformations and checks consistency"
    );

    // 7. Singularity Alignment Detection
    const singularState = { X: 0, Y: 0, Z: 0, A: 0, C: 0 };
    const singularity = KinematicSingularityDetector.detectSingularity(hermle, singularState);
    addCheck(
      "SINGULARITY_DETECTION",
      singularity === SingularityVerdict.SINGULAR,
      "Singularity detector identifies collinear axis orientations and potential gimbal lock configurations"
    );

    // 8. Adversarial Stress Suite Validation
    const advSuite = MachineKinematicsAdversarialSuite.runSuite();
    const allAdvPassed = advSuite.every(r => r.passed);
    addCheck(
      "ADVERSARIAL_STRESS_TEST",
      allAdvPassed,
      "Kinematics adversarial suite executed and passed on all structural safety, matrix math, and boundary limit checks"
    );

    const verdict = checks.every(c => c.passed) ? "PASS" : "FAIL";

    return {
      verdict,
      checks
    };
  }
}
