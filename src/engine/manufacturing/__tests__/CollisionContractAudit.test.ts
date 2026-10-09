import { describe, it, expect } from 'vitest';
import { CollisionDetector } from '../collision/CollisionDetector';
import { CollisionClassifier } from '../collision/CollisionClassifier';
import { TrueCollisionVerdict, CollisionObjectType, CollisionHierarchyType } from '../collision/types';

describe('CAP-SUP-005 — CANONICAL COLLISION CONTRACT AUDIT SUITE', () => {
  const baseModel: any = {
    collisionModelId: 'mdl_contract_test',
    revision: 1,
    stock: { isActive: false },
    workpiece: { isActive: false },
    fixture: [],
    checkSurfaces: [],
    keepOutVolumes: [],
    samplingPolicy: { sampleCount: 1, coverageMetric: 1.0, continuousMotionEnabled: false, maximumStep: 10, minAngularStepDeg: 5 },
    tolerance: { clearanceTolerance: 1.0, collisionTolerance: 0.001, contactTolerance: 0.02 }
  };

  const collisionPoint = {
    toolpathId: 'tp_collision',
    points: [{
      position: { x: 0, y: 0, z: 0 },
      toolAxis: { x: 0, y: 0, z: 1 }
    }]
  };

  it('CONTRACT-01: Confirmed collision must override low sampling coverage (Inverse Safety)', () => {
    const lowCoverageModel = {
      ...baseModel,
      samplingPolicy: { sampleCount: 1, coverageMetric: 0.1, continuousMotionEnabled: false, maximumStep: 10, minAngularStepDeg: 5 },
      fixture: [{
        objectId: 'collision_target',
        type: CollisionObjectType.FIXTURE,
        isActive: true,
        aabb: { min: { x: -1, y: -1, z: -1 }, max: { x: 1, y: 1, z: 1 } }
      }]
    };

    const report = CollisionDetector.evaluateToolpath(collisionPoint as any, lowCoverageModel as any);
    expect(report.verdict).toBe(TrueCollisionVerdict.FIXTURE_COLLISION);
    expect(report.provenSafe).toBe(false);
  });

  it('CONTRACT-02: Safety Invariants Enforcement', () => {
    // Invariant 1: CONFIRMED_COLLISION => provenSafe === false
    const collisionModel = {
      ...baseModel,
      fixture: [{
        objectId: 'col_target',
        type: CollisionObjectType.FIXTURE,
        isActive: true,
        aabb: { min: { x: -1, y: -1, z: -1 }, max: { x: 1, y: 1, z: 1 } }
      }]
    };
    const repCollision = CollisionDetector.evaluateToolpath(collisionPoint as any, collisionModel as any);
    expect(repCollision.provenSafe).toBe(false);

    // Invariant 2: INSUFFICIENT_COVERAGE => provenSafe === false
    const lowCovModel = {
      ...baseModel,
      samplingPolicy: { ...baseModel.samplingPolicy, coverageMetric: 0.1 }
    };
    const repLowCov = CollisionDetector.evaluateToolpath(collisionPoint as any, lowCovModel as any);
    expect(repLowCov.provenSafe).toBe(false);
    expect(repLowCov.verdict).toBe(TrueCollisionVerdict.COLLISION_UNDETERMINED);

    // Invariant 3: MISSING_REQUIRED_COLLISION_INPUT => provenSafe === false
    const missingInputModel = { ...baseModel, tolerance: undefined };
    const repMissing = CollisionDetector.evaluateToolpath(collisionPoint as any, missingInputModel as any);
    expect(repMissing.provenSafe).toBe(false);
    expect(repMissing.verdict).toBe(TrueCollisionVerdict.COLLISION_UNDETERMINED);
  });

  it('CONTRACT-03: Mathematical Distance Convention & Boundary Behavior Table', () => {
    const objA: any = { type: CollisionObjectType.TOOL, objectId: 't1' };
    const objB: any = { type: CollisionObjectType.FIXTURE, objectId: 'f1' };
    const req: any = { minimumDistance: 1.0 }; // clearanceReq = 1.0mm
    const tol: any = { collisionTolerance: 0.001, clearanceTolerance: 1.0 }; // tol = 0.001mm

    // 1. distance > clearanceReq (dist = 1.5mm)
    const r1 = CollisionClassifier.classifyInteraction(objA, objB, { minimumDistance: 1.5 } as any, req, tol);
    expect(r1.clearanceState).toBe("CLEAR");
    expect(r1.verdict).toBe(TrueCollisionVerdict.COLLISION_FREE);

    // 2. distance == clearanceReq (dist = 1.0mm)
    const r2 = CollisionClassifier.classifyInteraction(objA, objB, { minimumDistance: 1.0 } as any, req, tol);
    expect(r2.clearanceState).toBe("CLEAR");
    expect(r2.verdict).toBe(TrueCollisionVerdict.COLLISION_FREE);

    // 3. collisionTolerance < distance < clearanceReq (dist = 0.5mm)
    const r3 = CollisionClassifier.classifyInteraction(objA, objB, { minimumDistance: 0.5 } as any, req, tol);
    expect(r3.clearanceState).toBe("MARGINAL");
    expect(r3.verdict).toBe(TrueCollisionVerdict.CLEARANCE_VIOLATION);

    // 4. distance == collisionTolerance (dist = 0.001mm)
    const r4 = CollisionClassifier.classifyInteraction(objA, objB, { minimumDistance: 0.001 } as any, req, tol);
    expect(r4.clearanceState).toBe("VIOLATED");
    expect(r4.verdict).toBe(TrueCollisionVerdict.FIXTURE_COLLISION);

    // 5. 0 < distance < collisionTolerance (dist = 0.0005mm)
    const r5 = CollisionClassifier.classifyInteraction(objA, objB, { minimumDistance: 0.0005 } as any, req, tol);
    expect(r5.clearanceState).toBe("VIOLATED");

    // 6. distance == 0 (dist = 0.0mm)
    const r6 = CollisionClassifier.classifyInteraction(objA, objB, { minimumDistance: 0.0 } as any, req, tol);
    expect(r6.clearanceState).toBe("VIOLATED");

    // 7. -collisionTolerance < distance < 0 (dist = -0.0005mm)
    const r7 = CollisionClassifier.classifyInteraction(objA, objB, { minimumDistance: -0.0005 } as any, req, tol);
    expect(r7.clearanceState).toBe("VIOLATED");

    // 8. distance == -collisionTolerance (dist = -0.001mm)
    const r8 = CollisionClassifier.classifyInteraction(objA, objB, { minimumDistance: -0.001 } as any, req, tol);
    expect(r8.clearanceState).toBe("VIOLATED");

    // 9. distance < -collisionTolerance (dist = -1.0mm)
    const r9 = CollisionClassifier.classifyInteraction(objA, objB, { minimumDistance: -1.0 } as any, req, tol);
    expect(r9.clearanceState).toBe("VIOLATED");
    expect(r9.verdict).toBe(TrueCollisionVerdict.FIXTURE_COLLISION);
  });

  it('CONTRACT-04: Independent Fixture Transformation Verification', () => {
    // Prove that local fixture coordinates != world coordinates when transformed by assembly tool pose
    const fixtureInAssembly = {
      ...baseModel,
      toolAssembly: [
        {
          objectId: 'tool_flute',
          name: 'Flute',
          type: CollisionObjectType.TOOL,
          isActive: true,
          capsule: { p1: { x: 0, y: 0, z: 0 }, p2: { x: 0, y: 0, z: 40 }, radius: 5 },
          aabb: { min: { x: -5, y: -5, z: 0 }, max: { x: 5, y: 5, z: 40 } }
        },
        {
          objectId: 'tool_fixture',
          name: 'Collet Clamp Fixture',
          type: CollisionObjectType.FIXTURE,
          isActive: true,
          capsule: { p1: { x: 0, y: 0, z: 0 }, p2: { x: 0, y: 0, z: 10 }, radius: 25 },
          aabb: { min: { x: -25, y: -25, z: 0 }, max: { x: 25, y: 25, z: 10 } }
        }
      ],
      stock: {
        objectId: 'stock_block',
        name: 'Stock Block at World X=100',
        type: CollisionObjectType.STOCK,
        isActive: true,
        aabb: { min: { x: 90, y: -10, z: -10 }, max: { x: 110, y: 10, z: 10 } }
      }
    };

    // Pose 1: Tool at origin (0,0,0) -> Fixture at origin. Stock is at X=100. Distance ~75mm (no collision)
    const originPoint = { toolpathId: 'tp_origin', points: [{ position: { x: 0, y: 0, z: 0 }, toolAxis: { x: 0, y: 0, z: 1 } }] };
    const repOrigin = CollisionDetector.evaluateToolpath(originPoint as any, fixtureInAssembly as any);
    expect(repOrigin.collisionEvents.length).toBe(0);

    // Pose 2: Tool moved to (100,0,0) -> Assembly fixture is transformed to World X=100 -> COLLISION WITH STOCK!
    const movedPoint = { toolpathId: 'tp_moved', points: [{ position: { x: 100, y: 0, z: 0 }, toolAxis: { x: 0, y: 0, z: 1 } }] };
    const repMoved = CollisionDetector.evaluateToolpath(movedPoint as any, fixtureInAssembly as any);
    expect(repMoved.collisionEvents.length).toBeGreaterThan(0);
    expect(repMoved.verdict).toBe(TrueCollisionVerdict.FIXTURE_COLLISION);
  });

  it('CONTRACT-05: Tool vs Holder vs Spindle Priority Resolution', () => {
    const multiCollisionModel = {
      ...baseModel,
      fixture: [{
        objectId: 'target',
        type: CollisionObjectType.FIXTURE,
        isActive: true,
        aabb: { min: { x: -50, y: -50, z: -50 }, max: { x: 50, y: 50, z: 50 } }
      }]
    };

    const report = CollisionDetector.evaluateToolpath(collisionPoint as any, multiCollisionModel as any);
    // Holder starts at Z=40, length 60 -> [40, 100]. Tool tip is at 0,0,0. Both collide with AABB [-50, 50].
    // Deterministic priority dictates HOLDER_COLLISION.
    expect(report.verdict).toBe(TrueCollisionVerdict.HOLDER_COLLISION);
  });
});
