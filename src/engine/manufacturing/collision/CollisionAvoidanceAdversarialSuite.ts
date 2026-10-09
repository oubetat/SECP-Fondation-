import {
  AvoidanceStrategy,
  AvoidanceVerdict,
  CollisionHierarchyType,
  CollisionModel,
  CollisionObject,
  CollisionObjectType,
  CollisionSeverity,
  FiveAxisToolpath,
  SamplingPolicy,
  TrueCollisionVerdict
} from "./types";
import { CollisionDetector } from "./CollisionDetector";
import { CollisionAvoidanceEngine } from "./CollisionAvoidanceEngine";
import { SweptVolumeEngine } from "./SweptVolumeEngine";

export interface AdversarialCheckResult {
  id: string;
  name: string;
  category: "DETECTION" | "CLASSIFICATION" | "SWEPT_MOTION" | "AVOIDANCE" | "NUMERICAL";
  passed: boolean;
  message: string;
  details?: any;
}

export interface AdversarialSuiteReport {
  suiteId: string;
  timestamp: string;
  totalChecks: number;
  passedChecks: number;
  passed: boolean;
  checks: AdversarialCheckResult[];
}

export class CollisionAvoidanceAdversarialSuite {
  public static runSuite(): AdversarialSuiteReport {
    const checks: AdversarialCheckResult[] = [];

    const baseSamplingPolicy: SamplingPolicy = {
      sampleCount: 10,
      minimumStep: 0.1,
      maximumStep: 5.0,
      adaptiveTriggers: ["HIGH_ANGULAR_DELTA", "NARROW_CLEARANCE_ZONE"],
      coverageMetric: 1.0,
      continuousMotionEnabled: true,
      minAngularStepDeg: 5.0
    };

    const baseModel: CollisionModel = {
      collisionModelId: "ADV_COLLISION_MODEL_01",
      revision: 1,
      machineGeometry: [],
      toolAssembly: [
        CollisionDetector.createDefaultToolObject(5, 40),
        CollisionDetector.createDefaultHolderObject(25, 60)
      ],
      stock: {
        objectId: "ADV_STOCK",
        name: "Aluminum Raw Block",
        type: CollisionObjectType.STOCK,
        geometryType: "AABB" as any,
        aabb: { min: { x: -50, y: -50, z: -50 }, max: { x: 50, y: 50, z: 0 } },
        isActive: true
      },
      workpiece: {
        objectId: "ADV_WORKPIECE",
        name: "Target Finished Part",
        type: CollisionObjectType.WORKPIECE,
        geometryType: "AABB" as any,
        aabb: { min: { x: -40, y: -40, z: -40 }, max: { x: 40, y: 40, z: 0 } },
        isActive: true
      },
      fixture: [
        {
          objectId: "ADV_FIXTURE_CLAMP",
          name: "Steel Toe Clamp",
          type: CollisionObjectType.FIXTURE,
          geometryType: "AABB" as any,
          aabb: { min: { x: 45, y: -20, z: 0 }, max: { x: 75, y: 20, z: 25 } },
          isActive: true
        }
      ],
      checkSurfaces: [],
      keepOutVolumes: [],
      tolerance: {
        geometricTolerance: 0.005,
        collisionTolerance: 0.001,
        contactTolerance: 0.02,
        clearanceTolerance: 1.0,
        angularToleranceDeg: 0.1
      },
      samplingPolicy: baseSamplingPolicy
    };

    // 1. Check: Holder Colliding into Fixture Clamp
    const holderCollidingPath: FiveAxisToolpath = {
      toolpathId: "TP_ADV_HOLDER_COLLISION",
      operationId: "OP_HOLDER_TEST",
      points: [
        {
          position: { x: 40, y: 0, z: 5 },
          toolAxis: { x: 0, y: 0, z: 1 },
          toolOrientation: { x: 0, y: 0, z: 1 },
          feedRate: 1200,
          spindleSpeed: 10000,
          sequenceNumber: 0
        },
        {
          position: { x: 55, y: 0, z: 5 }, // Moves right into clamp area where holder radius (25mm) penetrates clamp
          toolAxis: { x: 0, y: 0, z: 1 },
          toolOrientation: { x: 0, y: 0, z: 1 },
          feedRate: 1200,
          spindleSpeed: 10000,
          sequenceNumber: 1
        }
      ],
      tolerance: 0.01,
      totalLength: 15,
      estimatedTimeSeconds: 1
    };

    const holderReport = CollisionDetector.evaluateToolpath(holderCollidingPath, baseModel);
    const holderCaught = holderReport.verdict === TrueCollisionVerdict.HOLDER_COLLISION || holderReport.collisionEvents.some(e => e.objectA.type === CollisionObjectType.TOOL_HOLDER);

    checks.push({
      id: "ADV_HOLDER_CLAMP_COLLISION",
      name: "Tool Holder to Fixture Clamp Interference Catch",
      category: "DETECTION",
      passed: holderCaught,
      message: holderCaught ? "Successfully detected tool holder collision with fixture clamp." : "Failed to catch holder collision."
    });

    // 2. Check: Intermediate Trajectory Collision (Endpoints Safe, Middle Pierces Obstacle)
    // Wall located at x=0, y=0, z=[-10..20], tool starts at (-20, 0, 5) and ends at (+20, 0, 5)
    const wallFixture: CollisionObject = {
      objectId: "ADV_MID_WALL",
      name: "Obstacle Wall",
      type: CollisionObjectType.FIXTURE,
      geometryType: "AABB" as any,
      aabb: { min: { x: -2, y: -20, z: -10 }, max: { x: 2, y: 20, z: 30 } },
      isActive: true
    };
    const modelWithWall: CollisionModel = {
      ...baseModel,
      fixture: [wallFixture]
    };

    const intermediateToolpath: FiveAxisToolpath = {
      toolpathId: "TP_ADV_INTERMEDIATE",
      operationId: "OP_MID_TEST",
      points: [
        {
          position: { x: -50, y: 0, z: 5 }, // Safe start (holder radius 25 ends at x=-25, clear of wall x=[-2..2])
          toolAxis: { x: 0, y: 0, z: 1 },
          toolOrientation: { x: 0, y: 0, z: 1 },
          feedRate: 1000,
          sequenceNumber: 0
        },
        {
          position: { x: 50, y: 0, z: 5 },  // Safe end (holder radius 25 starts at x=25, clear of wall x=[-2..2])
          toolAxis: { x: 0, y: 0, z: 1 },
          toolOrientation: { x: 0, y: 0, z: 1 },
          feedRate: 1000,
          sequenceNumber: 1
        }
      ],
      tolerance: 0.01,
      totalLength: 100,
      estimatedTimeSeconds: 5
    };

    const midReport = CollisionDetector.evaluateToolpath(intermediateToolpath, modelWithWall);
    const midCaught = midReport.collisionEvents.length > 0 && midReport.verdict !== TrueCollisionVerdict.COLLISION_FREE;

    checks.push({
      id: "ADV_INTERMEDIATE_SWEPT_COLLISION",
      name: "Continuous Swept Intermediate Collision Catch",
      category: "SWEPT_MOTION",
      passed: midCaught,
      message: midCaught ? "Caught collision at intermediate pose C(0.5) where start and end points were both clear." : "Failed continuous swept motion check."
    });

    // 3. Check: Rotary 5-Axis Orientation Transition Collision
    const rotarySweepModel: CollisionModel = {
      ...baseModel,
      fixture: [
        {
          objectId: "ADV_OVERHEAD_OBSTACLE",
          name: "Top Head Enclosure",
          type: CollisionObjectType.FIXTURE,
          geometryType: "AABB" as any,
          aabb: { min: { x: 10, y: 10, z: 40 }, max: { x: 60, y: 60, z: 90 } },
          isActive: true
        }
      ]
    };

    const rotaryTiltPath: FiveAxisToolpath = {
      toolpathId: "TP_ADV_ROTARY_SWEEP",
      operationId: "OP_ROTARY",
      points: [
        {
          position: { x: 0, y: 0, z: 0 },
          toolAxis: { x: 0, y: 0, z: 1 }, // Vertical
          toolOrientation: { x: 0, y: 0, z: 1 },
          sequenceNumber: 0
        },
        {
          position: { x: 0, y: 0, z: 0 },
          toolAxis: { x: 0.707, y: 0.707, z: 0.05 }, // Tilted ~85 degrees towards overhead obstacle
          toolOrientation: { x: 0.707, y: 0.707, z: 0.05 },
          sequenceNumber: 1
        }
      ],
      tolerance: 0.01,
      totalLength: 0,
      estimatedTimeSeconds: 1
    };

    const rotaryReport = CollisionDetector.evaluateToolpath(rotaryTiltPath, rotarySweepModel);
    const rotaryCaught = rotaryReport.collisionEvents.length > 0;

    checks.push({
      id: "ADV_ROTARY_SWEEP_COLLISION",
      name: "5-Axis Rotary Orientation Transition Collision Catch",
      category: "DETECTION",
      passed: rotaryCaught,
      message: rotaryCaught ? "Correctly flagged collision caused by rotary tool tilt during 5-axis posture transition." : "Failed to catch rotary sweep collision."
    });

    // 4. Check: Workpiece Gouge vs Valid Machining Contact
    const gougePath: FiveAxisToolpath = {
      toolpathId: "TP_ADV_GOUGE",
      operationId: "OP_GOUGE",
      points: [
        {
          position: { x: 0, y: 0, z: -10 }, // Plunges 10mm into finished workpiece (max Z=0)
          toolAxis: { x: 0, y: 0, z: 1 },
          toolOrientation: { x: 0, y: 0, z: 1 },
          feedRate: 800,
          sequenceNumber: 0
        }
      ],
      tolerance: 0.01,
      totalLength: 0,
      estimatedTimeSeconds: 1
    };

    const gougeReport = CollisionDetector.evaluateToolpath(gougePath, baseModel);
    const gougeCaught = gougeReport.verdict === TrueCollisionVerdict.GOUGE || gougeReport.collisionEvents.some(e => e.classification === CollisionHierarchyType.GOUGE);

    checks.push({
      id: "ADV_WORKPIECE_GOUGE_CLASSIFICATION",
      name: "Workpiece Floor Level Gouge Classification",
      category: "CLASSIFICATION",
      passed: gougeCaught,
      message: gougeCaught ? "Properly classified deep tool plunge as GOUGE rather than valid machining contact." : "Failed to classify gouge."
    });

    // 5. Check: Multi-Strategy Avoidance and Full Re-Verification Cycle
    const avoidanceResult = CollisionAvoidanceEngine.planAndAvoidCollisions(intermediateToolpath, midReport, modelWithWall);
    const avoidancePassed = avoidanceResult.verdict === AvoidanceVerdict.AVOIDED &&
                            avoidanceResult.revalidationReport !== undefined &&
                            avoidanceResult.revalidationReport.verdict === TrueCollisionVerdict.COLLISION_FREE;

    checks.push({
      id: "ADV_AVOIDANCE_REVERIFICATION",
      name: "Collision Avoidance Multi-Candidate Re-Verification",
      category: "AVOIDANCE",
      passed: avoidancePassed,
      message: avoidancePassed ? `Avoidance generated candidate via ${avoidanceResult.strategyUsed} and passed 100% collision-free re-verification.` : "Avoidance cycle failed."
    });

    // 6. Check: Determinism and Reproducibility (identical results on duplicate executions)
    const rep1 = CollisionDetector.evaluateToolpath(holderCollidingPath, baseModel);
    const rep2 = CollisionDetector.evaluateToolpath(holderCollidingPath, baseModel);
    const isDeterministic = rep1.fingerprint.deterministicHash === rep2.fingerprint.deterministicHash &&
                            rep1.collisionEvents.length === rep2.collisionEvents.length;

    checks.push({
      id: "ADV_DETERMINISTIC_REPRODUCIBILITY",
      name: "Deterministic Collision Hash and Reproducibility",
      category: "NUMERICAL",
      passed: isDeterministic,
      message: isDeterministic ? `100% reproducible hash confirmed (${rep1.fingerprint.deterministicHash.slice(0, 32)}...)` : "Failed determinism check."
    });

    const totalChecks = checks.length;
    const passedChecks = checks.filter(c => c.passed).length;

    return {
      suiteId: "ADV_SUITE_PATCH_106",
      timestamp: new Date().toISOString(),
      totalChecks,
      passedChecks,
      passed: totalChecks === passedChecks,
      checks
    };
  }
}
