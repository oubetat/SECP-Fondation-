import { describe, it, expect } from 'vitest';
import { CollisionDetector } from '../collision/CollisionDetector';
import { CollisionClassifier } from '../collision/CollisionClassifier';
import { TrueCollisionVerdict, CollisionObjectType, CollisionHierarchyType, CollisionSeverity } from '../collision/types';

describe('CAP-SUP-005 — FULL COLLISION MUTATION MATRIX (M-COL-01 to M-COL-10)', () => {
  const baseModel: any = {
    collisionModelId: 'mdl_mutation_test',
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
    toolpathId: 'tp_mutation',
    points: [{
      position: { x: 0, y: 0, z: 0 },
      toolAxis: { x: 0, y: 0, z: 1 }
    }]
  };

  it('M-COL-01: Confirmed collision override (Low coverage cannot suppress collision)', () => {
    // MUTATION: Low coverage metric
    // CONTRACT: Confirmed collision MUST return specific collision verdict, NOT UNDETERMINED
    const model = {
      ...baseModel,
      samplingPolicy: { ...baseModel.samplingPolicy, coverageMetric: 0.1 },
      fixture: [{
        objectId: 'target',
        type: CollisionObjectType.FIXTURE,
        isActive: true,
        aabb: { min: { x: -1, y: -1, z: -1 }, max: { x: 1, y: 1, z: 1 } }
      }]
    };
    const report = CollisionDetector.evaluateToolpath(collisionPoint as any, model as any);
    expect(report.verdict).not.toBe(TrueCollisionVerdict.COLLISION_UNDETERMINED);
    expect(report.verdict).toBe(TrueCollisionVerdict.FIXTURE_COLLISION);
    expect(report.provenSafe).toBe(false);
  });

  it('M-COL-02: Missing or invalid tolerance fails closed', () => {
    // MUTATION: Missing tolerance object
    // CONTRACT: Must return COLLISION_UNDETERMINED and provenSafe = false
    const modelMissing = { ...baseModel, tolerance: undefined };
    const reportMissing = CollisionDetector.evaluateToolpath(collisionPoint as any, modelMissing as any);
    expect(reportMissing.verdict).toBe(TrueCollisionVerdict.COLLISION_UNDETERMINED);
    expect(reportMissing.provenSafe).toBe(false);

    // MUTATION: Negative or NaN tolerance
    const modelNaN = { ...baseModel, tolerance: { ...baseModel.tolerance, collisionTolerance: NaN } };
    const reportNaN = CollisionDetector.evaluateToolpath(collisionPoint as any, modelNaN as any);
    expect(reportNaN.verdict).toBe(TrueCollisionVerdict.COLLISION_UNDETERMINED);
    expect(reportNaN.provenSafe).toBe(false);
  });

  it('M-COL-03: Distance sign inversion / boundary comparison flip', () => {
    // MUTATION: Invert distance or reverse penetration comparison
    // CONTRACT: dist <= collisionTolerance (0.001) MUST be classified as collision / GOUGE / FIXTURE_COLLISION
    const objA: any = { type: CollisionObjectType.TOOL, objectId: 'tool1' };
    const objB: any = { type: CollisionObjectType.FIXTURE, objectId: 'fix1' };
    const req: any = { minimumDistance: 1.0 };
    const tol: any = { collisionTolerance: 0.001, clearanceTolerance: 1.0 };

    // Case A: Penetrating distance (-0.5mm)
    const resPen = CollisionClassifier.classifyInteraction(objA, objB, { minimumDistance: -0.5 } as any, req, tol);
    expect(resPen.clearanceState).toBe("VIOLATED");
    expect(resPen.verdict).toBe(TrueCollisionVerdict.FIXTURE_COLLISION);

    // Case B: Boundary distance (0.001mm)
    const resBoundary = CollisionClassifier.classifyInteraction(objA, objB, { minimumDistance: 0.001 } as any, req, tol);
    expect(resBoundary.clearanceState).toBe("VIOLATED");

    // Case C: Clearance violation distance (0.5mm)
    const resClearance = CollisionClassifier.classifyInteraction(objA, objB, { minimumDistance: 0.5 } as any, req, tol);
    expect(resClearance.clearanceState).toBe("MARGINAL");
    expect(resClearance.verdict).toBe(TrueCollisionVerdict.CLEARANCE_VIOLATION);
  });

  it('M-COL-04: Collision-class priority suppression', () => {
    // MUTATION: Suppress priority hierarchy so FIXTURE overrides HOLDER
    // CONTRACT: Holder collision takes precedence over Fixture collision
    const model = {
      ...baseModel,
      fixture: [{
        objectId: 'target',
        type: CollisionObjectType.FIXTURE,
        isActive: true,
        aabb: { min: { x: -50, y: -50, z: -50 }, max: { x: 50, y: 50, z: 50 } }
      }]
    };
    const report = CollisionDetector.evaluateToolpath(collisionPoint as any, model as any);
    expect(report.verdict).toBe(TrueCollisionVerdict.HOLDER_COLLISION);
  });

  it('M-COL-05: Fixture transform removal / position dependence', () => {
    // CONTRACT: Assembly fixture transform must follow tool pose.
    // When pose moves tool to x=200, assembly-mounted fixture moves with it.
    const customAssemblyModel = {
      ...baseModel,
      toolAssembly: [
        {
          objectId: 'tool_custom',
          name: 'Tool Flute',
          type: CollisionObjectType.TOOL,
          isActive: true,
          capsule: { p1: { x: 0, y: 0, z: 0 }, p2: { x: 0, y: 0, z: 40 }, radius: 5 },
          aabb: { min: { x: -5, y: -5, z: 0 }, max: { x: 5, y: 5, z: 40 } }
        },
        {
          objectId: 'fixture_custom',
          name: 'Assembly Mounted Fixture',
          type: CollisionObjectType.FIXTURE,
          isActive: true,
          capsule: { p1: { x: 0, y: 0, z: 0 }, p2: { x: 0, y: 0, z: 10 }, radius: 20 },
          aabb: { min: { x: -20, y: -20, z: 0 }, max: { x: 20, y: 20, z: 10 } }
        }
      ],
      stock: {
        objectId: 'stock1',
        type: CollisionObjectType.STOCK,
        isActive: true,
        aabb: { min: { x: 180, y: -10, z: -10 }, max: { x: 220, y: 10, z: 10 } }
      }
    };

    const distantPoint = {
      toolpathId: 'tp_distant',
      points: [{ position: { x: 200, y: 0, z: 0 }, toolAxis: { x: 0, y: 0, z: 1 } }]
    };

    const report = CollisionDetector.evaluateToolpath(distantPoint as any, customAssemblyModel as any);
    // Because assembly fixture moves to X=200 with the tool pose, it collides with stock at X=200.
    expect(report.collisionEvents.length).toBeGreaterThan(0);
    expect(report.verdict).toBe(TrueCollisionVerdict.FIXTURE_COLLISION);
  });

  it('M-COL-06: Collision event removal / suppression', () => {
    // CONTRACT: When events exist, collisionEvents list must NOT be empty and verdict must NOT be COLLISION_FREE
    const model = {
      ...baseModel,
      fixture: [{
        objectId: 'target',
        type: CollisionObjectType.FIXTURE,
        isActive: true,
        aabb: { min: { x: -1, y: -1, z: -1 }, max: { x: 1, y: 1, z: 1 } }
      }]
    };
    const report = CollisionDetector.evaluateToolpath(collisionPoint as any, model as any);
    expect(report.collisionEvents.length).toBeGreaterThan(0);
    expect(report.verdict).not.toBe(TrueCollisionVerdict.COLLISION_FREE);
  });

  it('M-COL-07: Force NO_COLLISION / COLLISION_FREE mutant detection', () => {
    // CONTRACT: If any collision occurs, report.verdict can NEVER be COLLISION_FREE
    const model = {
      ...baseModel,
      fixture: [{
        objectId: 'target',
        type: CollisionObjectType.FIXTURE,
        isActive: true,
        aabb: { min: { x: -1, y: -1, z: -1 }, max: { x: 1, y: 1, z: 1 } }
      }]
    };
    const report = CollisionDetector.evaluateToolpath(collisionPoint as any, model as any);
    expect(report.verdict).not.toBe(TrueCollisionVerdict.COLLISION_FREE);
  });

  it('M-COL-08: Force COLLISION_UNDETERMINED mutant detection on valid full coverage', () => {
    // CONTRACT: If coverage >= 0.8 and NO collisions exist, verdict MUST be COLLISION_FREE, NOT COLLISION_UNDETERMINED
    const cleanModel = {
      ...baseModel,
      samplingPolicy: { sampleCount: 5, coverageMetric: 1.0, continuousMotionEnabled: true, maximumStep: 10, minAngularStepDeg: 5 }
    };
    const report = CollisionDetector.evaluateToolpath(collisionPoint as any, cleanModel as any);
    expect(report.verdict).toBe(TrueCollisionVerdict.COLLISION_FREE);
    expect(report.provenSafe).toBe(true);
  });

  it('M-COL-09: Force provenSafe=true mutant detection', () => {
    // CONTRACT: provenSafe MUST be false whenever collision occurs or coverage is insufficient
    const collisionModel = {
      ...baseModel,
      fixture: [{
        objectId: 'target',
        type: CollisionObjectType.FIXTURE,
        isActive: true,
        aabb: { min: { x: -1, y: -1, z: -1 }, max: { x: 1, y: 1, z: 1 } }
      }]
    };
    const reportCollision = CollisionDetector.evaluateToolpath(collisionPoint as any, collisionModel as any);
    expect(reportCollision.provenSafe).toBe(false);

    const lowCoverageModel = {
      ...baseModel,
      samplingPolicy: { ...baseModel.samplingPolicy, coverageMetric: 0.1 }
    };
    const reportLowCoverage = CollisionDetector.evaluateToolpath(collisionPoint as any, lowCoverageModel as any);
    expect(reportLowCoverage.provenSafe).toBe(false);
  });

  it('M-COL-10: Sampling coverage manipulation detection', () => {
    // CONTRACT: If expected samples > actual samples, coverage metric drops and triggers COLLISION_UNDETERMINED
    const lowCoverageModel = {
      ...baseModel,
      samplingPolicy: { sampleCount: 1, coverageMetric: 0.5, continuousMotionEnabled: false, maximumStep: 1, minAngularStepDeg: 1 }
    };
    const report = CollisionDetector.evaluateToolpath(collisionPoint as any, lowCoverageModel as any);
    expect(report.samplingCoverage).toBeLessThan(0.8);
    expect(report.verdict).toBe(TrueCollisionVerdict.COLLISION_UNDETERMINED);
    expect(report.provenSafe).toBe(false);
  });
});
