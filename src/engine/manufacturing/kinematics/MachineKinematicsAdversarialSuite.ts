import { 
  MachineKinematicModel, 
  MachineType, 
  MachineLibraryStatus, 
  MachineAxisType, 
  HomogeneousTransform 
} from "./types";
import { KinematicMath } from "./KinematicMath";
import { CoordinateFrameGraph } from "./CoordinateFrameGraph";
import { ForwardKinematicsSolver } from "./ForwardKinematicsSolver";
import { InverseKinematicsSolver } from "./InverseKinematicsSolver";
import { MachineLibrary } from "./MachineLibrary";

export interface KinematicAdversarialResult {
  testId: string;
  category: string;
  description: string;
  passed: boolean;
  details: string;
}

export class MachineKinematicsAdversarialSuite {
  public static runSuite(): KinematicAdversarialResult[] {
    const results: KinematicAdversarialResult[] = [];
    const lib = new MachineLibrary();
    const haas = lib.getMachine("HAAS_VF2")!;

    // Test 1: Non-orthogonal rotation matrix validation
    const badMatrix: HomogeneousTransform = {
      matrix: [
        [1.2, 0.1, 0.0, 0],
        [0.0, 0.9, 0.0, 0],
        [0.0, 0.0, 1.0, 0],
        [0.0, 0.0, 0.0, 1]
      ]
    };
    const isOrthogonal = KinematicMath.validateRotation(badMatrix);
    results.push({
      testId: "ADV-MATH-001",
      category: "TRANSFORMS",
      description: "Detect non-orthogonal rotation matrix (scales and shears)",
      passed: isOrthogonal === false,
      details: `Validator result for non-orthogonal matrix: ${isOrthogonal}`
    });

    // Test 2: Transform inversion validation (T * T^-1 = I)
    const originalT = KinematicMath.createRotationY(0.785); // 45 deg
    const invertedT = KinematicMath.invert(originalT);
    const product = KinematicMath.multiply(originalT, invertedT);
    const isIdentity = Math.abs(product.matrix[0][0] - 1.0) < 1e-5 && Math.abs(product.matrix[0][2]) < 1e-5;
    results.push({
      testId: "ADV-MATH-002",
      category: "TRANSFORMS",
      description: "Rigid transform inversion numerical stability",
      passed: isIdentity,
      details: `Inversion diagonal element: ${product.matrix[0][0]}`
    });

    // Test 3: Circular Frame Graph Detection
    const graph = new CoordinateFrameGraph();
    graph.addFrame("A", "B", KinematicMath.createIdentity());
    graph.addFrame("B", "C", KinematicMath.createIdentity());
    graph.addFrame("C", "A", KinematicMath.createIdentity()); // Circle!
    const graphValidation = graph.validateGraph();
    results.push({
      testId: "ADV-FRAME-001",
      category: "TRANSFORMS",
      description: "Identify and reject circular coordinate frame loops",
      passed: !graphValidation.isValid && graphValidation.errors.some(e => e.includes("Circular")),
      details: `Detected errors: ${graphValidation.errors.join("; ")}`
    });

    // Test 4: Frame Graph Multi-Path Inconsistency
    const inconsistentGraph = new CoordinateFrameGraph();
    inconsistentGraph.addFrame("A");
    inconsistentGraph.addFrame("B", "A", KinematicMath.createTranslation(10, 0, 0));
    inconsistentGraph.addFrame("C", "B", KinematicMath.createTranslation(0, 10, 0)); // Path 1: A -> B -> C = (10, 10, 0)
    inconsistentGraph.addFrame("C", "A", KinematicMath.createTranslation(20, 20, 0)); // Path 2: A -> C = (20, 20, 0) (Disagrees!)
    const frameSolverResult = inconsistentGraph.getTransform("A", "C");
    results.push({
      testId: "ADV-FRAME-002",
      category: "TRANSFORMS",
      description: "Identify multi-path transform disagreement (FRAME_INCONSISTENCY)",
      passed: !frameSolverResult.isConsistent && frameSolverResult.errorMsg?.includes("FRAME_INCONSISTENCY") === true,
      details: `Error message: ${frameSolverResult.errorMsg}`
    });

    // Test 5: Inverse Kinematics Limit Violation Detection
    // HAAS VF2 Z-travel is 0 to 508. Let's query Z = 600
    const outOfBoundsTarget = KinematicMath.createTranslation(0, 0, 600);
    const ikSolutions = InverseKinematicsSolver.solve(haas, outOfBoundsTarget);
    const limitViolation = ikSolutions.some(s => s.status === "LIMIT_VIOLATION");
    results.push({
      testId: "ADV-IK-001",
      category: "IK",
      description: "Detect and flag joint travel limit overflow in inverse solver",
      passed: limitViolation,
      details: `Solutions count: ${ikSolutions.length}, limits state of first solution: ${ikSolutions[0]?.status}`
    });

    // Test 6: Inverted Limits on Axis Definition
    const badHaas = JSON.parse(JSON.stringify(haas)) as MachineKinematicModel;
    badHaas.axes[0].travelLimits = { min: 200, max: -200 }; // Inverted!
    const machineValidation = lib.validateMachine(badHaas);
    results.push({
      testId: "ADV-MACH-001",
      category: "MACHINE",
      description: "Identify and reject inverted joint travel limits",
      passed: !machineValidation.isValid && machineValidation.errors.some(e => e.includes("Inverted")),
      details: `Detected errors: ${machineValidation.errors.join("; ")}`
    });

    return results;
  }
}
