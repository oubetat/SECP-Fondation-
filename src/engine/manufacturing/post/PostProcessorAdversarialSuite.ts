import { PropertySourceType } from "../../materials/types";
import { CollisionDetector } from "../collision/CollisionDetector";
import { CollisionModel, CollisionObjectType } from "../collision/types";
import { ControllerProfileEngine } from "./ControllerProfileEngine";
import { MachineProfileEngine } from "./MachineProfileEngine";
import { PostProcessorInstance } from "./PostProcessorInstance";
import { MachineAxisPoint, MachineAxisToolpath, SpindleDirection } from "./types";

export interface AdversarialTestResult {
  testName: string;
  category: "AXIS" | "NUMERIC" | "CONTROLLER" | "TOOL" | "MOTION" | "STATE" | "ROUND_TRIP" | "DETERMINISM";
  passed: boolean;
  expectedFailureCodeOrVerdict: string;
  actualOutcome: string;
  evidence: string;
}

export class PostProcessorAdversarialSuite {
  public static runSuite(): AdversarialTestResult[] {
    const results: AdversarialTestResult[] = [];

    const machineProfile = MachineProfileEngine.createStandard5AxisMachineProfile();
    const controllerProfile = ControllerProfileEngine.createFanucLikeProfile();
    const contract = PostProcessorInstance.createDefaultContract("POST_ADV_SUITE", machineProfile, controllerProfile);

    // 1. AXIS OVERFLOW TEST
    {
      const post = new PostProcessorInstance();
      post.initialize(contract, machineProfile, controllerProfile);

      const overflowToolpath: MachineAxisToolpath = {
        toolpathId: "TP_OVERFLOW_TEST",
        revision: 1,
        machineId: machineProfile.machineId,
        tolerance: 0.001,
        coordinateSystem: "WORK_PIECE",
        provenance: {
          sourceId: "PROV_OVERFLOW",
          sourceType: PropertySourceType.STANDARD,
          reference: "Axis Limit Adversarial Test",
          timestamp: new Date().toISOString(),
          author: "SECP Adversarial",
          hash: "0xADV_OVR"
        },
        points: [
          {
            position: { x: 0, y: 0, z: 0 },
            feedRate: 1000,
            spindleSpeed: 3000,
            spindleDirection: SpindleDirection.CW,
            coolantState: { flood: true, mist: false, throughSpindle: false, air: false },
            sequenceNumber: 1,
            toolNumber: 1,
            motionType: "LINEAR"
          },
          {
            position: { x: 9999.0, y: 0, z: 0 }, // Exceeds X limit (600mm)
            feedRate: 1000,
            spindleSpeed: 3000,
            spindleDirection: SpindleDirection.CW,
            coolantState: { flood: true, mist: false, throughSpindle: false, air: false },
            sequenceNumber: 2,
            toolNumber: 1,
            motionType: "LINEAR"
          }
        ]
      };

      const res = post.process(overflowToolpath);
      const passed = res.program === null && res.errors.some(e => e.includes("exceeds machine limit"));
      results.push({
        testName: "Axis Overflow Limit Rejection",
        category: "AXIS",
        passed,
        expectedFailureCodeOrVerdict: "POST_AXIS_LIMIT_FAILURE / Error Caught",
        actualOutcome: passed ? "Successfully caught and rejected axis overflow" : "Failed to catch axis overflow",
        evidence: res.errors.join("; ")
      });
    }

    // 2. NUMERIC NAN / CORRUPTED POINT
    {
      const post = new PostProcessorInstance();
      post.initialize(contract, machineProfile, controllerProfile);

      const nanToolpath: MachineAxisToolpath = {
        toolpathId: "TP_NAN_TEST",
        revision: 1,
        machineId: machineProfile.machineId,
        tolerance: 0.001,
        coordinateSystem: "WORK_PIECE",
        provenance: {
          sourceId: "PROV_NAN",
          sourceType: PropertySourceType.STANDARD,
          reference: "NaN Coordinate Adversarial Test",
          timestamp: new Date().toISOString(),
          author: "SECP Adversarial",
          hash: "0xADV_NAN"
        },
        points: [
          {
            position: { x: Number.NaN, y: 0, z: 0 },
            feedRate: 1000,
            spindleSpeed: 3000,
            spindleDirection: SpindleDirection.CW,
            coolantState: { flood: true, mist: false, throughSpindle: false, air: false },
            sequenceNumber: 1,
            toolNumber: 1,
            motionType: "LINEAR"
          }
        ]
      };

      const res = post.process(nanToolpath);
      const passed = res.program === null && res.errors.some(e => e.includes("NaN"));
      results.push({
        testName: "NaN / Infinite Numeric Rejection",
        category: "NUMERIC",
        passed,
        expectedFailureCodeOrVerdict: "POST_INPUT_INVALID",
        actualOutcome: passed ? "Caught NaN values during input validation" : "Failed to detect NaN values",
        evidence: res.errors.join("; ")
      });
    }

    // 3. TOOL CHANGER CAPACITY VIOLATION
    {
      const post = new PostProcessorInstance();
      post.initialize(contract, machineProfile, controllerProfile);

      const invalidToolPath: MachineAxisToolpath = {
        toolpathId: "TP_TOOL_CAP_TEST",
        revision: 1,
        machineId: machineProfile.machineId,
        tolerance: 0.001,
        coordinateSystem: "WORK_PIECE",
        provenance: {
          sourceId: "PROV_TOOL",
          sourceType: PropertySourceType.STANDARD,
          reference: "Tool Changer Limit Test",
          timestamp: new Date().toISOString(),
          author: "SECP Adversarial",
          hash: "0xADV_TOOL"
        },
        points: [
          {
            position: { x: 10, y: 10, z: 0 },
            feedRate: 1000,
            spindleSpeed: 3000,
            spindleDirection: SpindleDirection.CW,
            coolantState: { flood: true, mist: false, throughSpindle: false, air: false },
            sequenceNumber: 1,
            toolNumber: 999, // Exceeds capacity 30
            motionType: "LINEAR"
          }
        ]
      };

      const genRes = post.process(invalidToolPath);
      let passed = false;
      let evidence = "";
      if (genRes.program) {
        const valRes = post.validateOutputAndQualify(genRes.program, invalidToolPath);
        passed = !valRes.qualified && valRes.errors.some(e => e.includes("exceeds tool changer capacity"));
        evidence = valRes.errors.join("; ");
      }

      results.push({
        testName: "Tool Changer Capacity Violation",
        category: "TOOL",
        passed,
        expectedFailureCodeOrVerdict: "TOOL_CONFIGURATION_FAILURE / SEMANTIC_INVALID",
        actualOutcome: passed ? "Caught invalid tool number in semantic validator" : "Allowed invalid tool number",
        evidence
      });
    }

    // 4. SPINDLE SPEED OVER-LIMIT
    {
      const post = new PostProcessorInstance();
      post.initialize(contract, machineProfile, controllerProfile);

      const spindleToolPath: MachineAxisToolpath = {
        toolpathId: "TP_SPINDLE_LIMIT_TEST",
        revision: 1,
        machineId: machineProfile.machineId,
        tolerance: 0.001,
        coordinateSystem: "WORK_PIECE",
        provenance: {
          sourceId: "PROV_SPINDLE",
          sourceType: PropertySourceType.STANDARD,
          reference: "Spindle Limit Test",
          timestamp: new Date().toISOString(),
          author: "SECP Adversarial",
          hash: "0xADV_SPIN"
        },
        points: [
          {
            position: { x: 10, y: 10, z: 0 },
            feedRate: 1000,
            spindleSpeed: 99999, // Machine max is 15,000 RPM
            spindleDirection: SpindleDirection.CW,
            coolantState: { flood: true, mist: false, throughSpindle: false, air: false },
            sequenceNumber: 1,
            toolNumber: 1,
            motionType: "LINEAR"
          }
        ]
      };

      const genRes = post.process(spindleToolPath);
      const passed = genRes.program === null && genRes.errors.some(e => e.includes("violates machine limits"));

      results.push({
        testName: "Spindle Speed RPM Over-Limit Detection",
        category: "MOTION",
        passed,
        expectedFailureCodeOrVerdict: "SPINDLE_CONFIGURATION_FAILURE",
        actualOutcome: passed ? "Caught excessive spindle RPM during IR compilation" : "Failed to catch excessive RPM",
        evidence: genRes.errors.join("; ")
      });
    }

    // 5. DETERMINISM & REPRODUCIBILITY TEST
    {
      const validToolpath: MachineAxisToolpath = {
        toolpathId: "TP_DETERMINISM_TEST",
        revision: 1,
        machineId: machineProfile.machineId,
        tolerance: 0.001,
        coordinateSystem: "WORK_PIECE",
        provenance: {
          sourceId: "PROV_VALID",
          sourceType: PropertySourceType.STANDARD,
          reference: "Deterministic Validation Toolpath",
          timestamp: "2026-08-21T00:00:00Z",
          author: "SECP Test Engine",
          hash: "0xDET_VALID_HASH"
        },
        points: [
          {
            position: { x: 0, y: 0, z: 20 },
            rotaryAxes: { a: 0, c: 0 },
            feedRate: 2000,
            spindleSpeed: 6000,
            spindleDirection: SpindleDirection.CW,
            coolantState: { flood: true, mist: false, throughSpindle: false, air: false },
            sequenceNumber: 1,
            toolNumber: 1,
            motionType: "RAPID"
          },
          {
            position: { x: 50, y: 50, z: 0 },
            rotaryAxes: { a: 15.0, c: 45.0 },
            feedRate: 800,
            spindleSpeed: 6000,
            spindleDirection: SpindleDirection.CW,
            coolantState: { flood: true, mist: false, throughSpindle: false, air: false },
            sequenceNumber: 2,
            toolNumber: 1,
            motionType: "LINEAR"
          },
          {
            position: { x: 100, y: 50, z: 0 },
            rotaryAxes: { a: 15.0, c: 90.0 },
            feedRate: 800,
            spindleSpeed: 6000,
            spindleDirection: SpindleDirection.CW,
            coolantState: { flood: true, mist: false, throughSpindle: false, air: false },
            sequenceNumber: 3,
            toolNumber: 1,
            motionType: "LINEAR"
          }
        ]
      };

      const post1 = new PostProcessorInstance();
      post1.initialize(contract, machineProfile, controllerProfile);
      const res1 = post1.process(validToolpath, "DETERMINISM_A", 1001);

      const post2 = new PostProcessorInstance();
      post2.initialize(contract, machineProfile, controllerProfile);
      const res2 = post2.process(validToolpath, "DETERMINISM_A", 1001);

      const passed =
        res1.program !== null &&
        res2.program !== null &&
        res1.program.rawGCodeText === res2.program.rawGCodeText &&
        res1.program.fingerprint.merkleRootHash === res2.program.fingerprint.merkleRootHash;

      results.push({
        testName: "Deterministic Output & Fingerprint Invariance",
        category: "DETERMINISM",
        passed,
        expectedFailureCodeOrVerdict: "EXACT_BIT_EQUALITY",
        actualOutcome: passed ? "Two distinct runs produced bit-exact identical NC text and Merkle root" : "Mismatch detected",
        evidence: `Run1 Root: ${res1.program?.fingerprint.merkleRootHash} | Run2 Root: ${res2.program?.fingerprint.merkleRootHash}`
      });
    }

    return results;
  }
}
