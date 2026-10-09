import { describe, it, expect } from "vitest";
import {
  BroadPhaseCollisionEngine,
  NarrowPhaseCollisionEngine,
  SweptVolumeEngine,
  AdaptiveCollisionSampling,
  CollisionClassifier,
  CollisionDetector,
  CollisionAvoidanceEngine,
  MinimumClearanceAnalyzer,
  CollisionAvoidanceAdversarialSuite,
  HardAcceptanceGate106,
  CollisionObjectType,
  CollisionHierarchyType,
  CollisionSeverity,
  TrueCollisionVerdict,
  AvoidanceVerdict,
  AvoidanceStrategy
} from "../collision";

describe("PATCH-106: Collision Avoidance Engine (Manufacturing / CAM)", () => {
  it("should correctly prune disjoint bounding boxes in broad phase", () => {
    const boxA = { min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 10, z: 10 } };
    const boxB = { min: { x: 5, y: 5, z: 5 }, max: { x: 15, y: 15, z: 15 } };
    const boxC = { min: { x: 30, y: 30, z: 30 }, max: { x: 40, y: 40, z: 40 } };

    const objA = { objectId: "A", name: "A", type: CollisionObjectType.TOOL, geometryType: "AABB" as any, aabb: boxA, isActive: true };
    const objB = { objectId: "B", name: "B", type: CollisionObjectType.WORKPIECE, geometryType: "AABB" as any, aabb: boxB, isActive: true };
    const objC = { objectId: "C", name: "C", type: CollisionObjectType.FIXTURE, geometryType: "AABB" as any, aabb: boxC, isActive: true };

    expect(BroadPhaseCollisionEngine.evaluatePairAABB(objA, objB)).toBe("CANDIDATE");
    expect(BroadPhaseCollisionEngine.evaluatePairAABB(objA, objC)).toBe("DISJOINT");
  });

  it("should calculate exact minimum distance and penetration depth in narrow phase", () => {
    const cap1 = { p1: { x: 0, y: 0, z: 0 }, p2: { x: 0, y: 0, z: 50 }, radius: 5 };
    const cap2 = { p1: { x: 20, y: 0, z: 0 }, p2: { x: 20, y: 0, z: 50 }, radius: 5 };

    const distRes = NarrowPhaseCollisionEngine.capsuleToCapsuleDistance(cap1, cap2, ["T1", "T2"]);
    expect(distRes.minimumDistance).toBeCloseTo(10.0, 3); // 20 - (5+5) = 10mm clearance

    const capPenetrating = { p1: { x: 6, y: 0, z: 0 }, p2: { x: 6, y: 0, z: 50 }, radius: 5 };
    const penRes = NarrowPhaseCollisionEngine.capsuleToCapsuleDistance(cap1, capPenetrating, ["T1", "T3"]);
    expect(penRes.minimumDistance).toBeCloseTo(-4.0, 3); // 6 - 10 = -4mm penetration
  });

  it("should compute continuous 5-axis swept volume and intermediate poses", () => {
    const swept = SweptVolumeEngine.computeSweptVolume(
      { position: { x: 0, y: 0, z: 0 }, toolAxis: { x: 0, y: 0, z: 1 } },
      { position: { x: 100, y: 0, z: 0 }, toolAxis: { x: 0.707, y: 0, z: 0.707 } },
      5,
      40,
      { sweepType: "SIX_DOF_SWEEP" as any, intermediateSteps: 10, envelopeExpansionTol: 0.2 }
    );

    expect(swept.intermediatePoses.length).toBe(11);
    expect(swept.boundingBox.max.x).toBeGreaterThanOrEqual(100);
    expect(swept.intermediatePoses[5].position.x).toBeCloseTo(50, 1);
  });

  it("should classify interactions into Valid Contact vs Gouge vs Holder Collision", () => {
    const tolPolicy = {
      geometricTolerance: 0.005,
      collisionTolerance: 0.001,
      contactTolerance: 0.02,
      clearanceTolerance: 1.0,
      angularToleranceDeg: 0.1
    };
    const clearReq = {
      minimumDistance: 3.0,
      objectPair: [CollisionObjectType.TOOL_HOLDER, CollisionObjectType.WORKPIECE] as [CollisionObjectType, CollisionObjectType],
      tolerance: 0.5,
      policy: "STRICT" as const,
      source: "TEST"
    };

    const toolObj = { objectId: "TOOL_01", name: "Tool", type: CollisionObjectType.TOOL, geometryType: "AABB" as any, aabb: { min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 10, z: 10 } }, isActive: true };
    const holderObj = { objectId: "HOLDER_01", name: "Holder", type: CollisionObjectType.TOOL_HOLDER, geometryType: "AABB" as any, aabb: { min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 10, z: 10 } }, isActive: true };
    const wpObj = { objectId: "WP_01", name: "Workpiece", type: CollisionObjectType.WORKPIECE, geometryType: "AABB" as any, aabb: { min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 10, z: 10 } }, isActive: true };

    // 1. Valid cutting contact
    const validContact = CollisionClassifier.classifyInteraction(
      toolObj,
      wpObj,
      { minimumDistance: -0.005, closestPointA: { x: 0, y: 0, z: 0 }, closestPointB: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 1 }, pair: ["T", "W"], confidence: 1.0 },
      clearReq,
      tolPolicy,
      true
    );
    expect(validContact.verdict).toBe(TrueCollisionVerdict.CONTACT_ONLY);

    // 2. Workpiece Gouge
    const gouge = CollisionClassifier.classifyInteraction(
      toolObj,
      wpObj,
      { minimumDistance: -1.2, closestPointA: { x: 0, y: 0, z: 0 }, closestPointB: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 1 }, pair: ["T", "W"], confidence: 1.0 },
      clearReq,
      tolPolicy,
      true
    );
    expect(gouge.hierarchy).toBe(CollisionHierarchyType.GOUGE);
    expect(gouge.verdict).toBe(TrueCollisionVerdict.GOUGE);

    // 3. Holder Collision
    const holderCol = CollisionClassifier.classifyInteraction(
      holderObj,
      wpObj,
      { minimumDistance: -0.5, closestPointA: { x: 0, y: 0, z: 0 }, closestPointB: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 1 }, pair: ["H", "W"], confidence: 1.0 },
      clearReq,
      tolPolicy,
      true
    );
    expect(holderCol.hierarchy).toBe(CollisionHierarchyType.CRITICAL);
    expect(holderCol.verdict).toBe(TrueCollisionVerdict.HOLDER_COLLISION);
  });

  it("should evaluate full toolpath and produce deterministic collision reports", () => {
    const model = {
      collisionModelId: "TEST_MODEL_01",
      revision: 1,
      machineGeometry: [],
      toolAssembly: [
        CollisionDetector.createDefaultToolObject(5, 40),
        CollisionDetector.createDefaultHolderObject(25, 60)
      ],
      stock: { objectId: "S", name: "S", type: CollisionObjectType.STOCK, geometryType: "AABB" as any, aabb: { min: { x: -50, y: -50, z: -50 }, max: { x: 50, y: 50, z: 0 } }, isActive: true },
      workpiece: { objectId: "W", name: "W", type: CollisionObjectType.WORKPIECE, geometryType: "AABB" as any, aabb: { min: { x: -40, y: -40, z: -40 }, max: { x: 40, y: 40, z: 0 } }, isActive: true },
      fixture: [{ objectId: "F", name: "F", type: CollisionObjectType.FIXTURE, geometryType: "AABB" as any, aabb: { min: { x: 60, y: -20, z: 0 }, max: { x: 90, y: 20, z: 25 } }, isActive: true }],
      checkSurfaces: [],
      keepOutVolumes: [],
      tolerance: { geometricTolerance: 0.005, collisionTolerance: 0.001, contactTolerance: 0.02, clearanceTolerance: 1.0, angularToleranceDeg: 0.1 },
      samplingPolicy: { sampleCount: 10, minimumStep: 0.1, maximumStep: 5.0, adaptiveTriggers: [], coverageMetric: 1.0, continuousMotionEnabled: true, minAngularStepDeg: 5.0 }
    };

    const safePath = {
      toolpathId: "TP_SAFE_01",
      operationId: "OP_01",
      points: [
        { position: { x: 0, y: 0, z: 10 }, toolAxis: { x: 0, y: 0, z: 1 }, toolOrientation: { x: 0, y: 0, z: 1 }, sequenceNumber: 0 },
        { position: { x: 20, y: 0, z: 10 }, toolAxis: { x: 0, y: 0, z: 1 }, toolOrientation: { x: 0, y: 0, z: 1 }, sequenceNumber: 1 }
      ],
      tolerance: 0.01,
      totalLength: 20,
      estimatedTimeSeconds: 1
    };

    const rep1 = CollisionDetector.evaluateToolpath(safePath, model);
    const rep2 = CollisionDetector.evaluateToolpath(safePath, model);

    expect(rep1.verdict).toBe(TrueCollisionVerdict.COLLISION_FREE);
    expect(rep1.provenSafe).toBe(true);
    expect(rep1.fingerprint.deterministicHash).toBe(rep2.fingerprint.deterministicHash);
  });

  it("should pass the 100% HardAcceptanceGate106 verification", () => {
    const gateRes = HardAcceptanceGate106.evaluateGate();
    expect(gateRes.verdict).toBe("PASS");
    expect(gateRes.passedChecks).toBe(gateRes.totalChecks);
    expect(gateRes.merkleRootHash).toMatch(/^0x[0-9A-F]{8}$/);
  });

  it("should pass the full Adversarial Validation Suite for PATCH-106", () => {
    const advRes = CollisionAvoidanceAdversarialSuite.runSuite();
    expect(advRes.passed).toBe(true);
    expect(advRes.passedChecks).toBe(advRes.totalChecks);
  });
});
